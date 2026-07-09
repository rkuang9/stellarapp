import { DatasetGenerator } from "@/lib/data-processing/dataset_base_generator";
import * as tf from "@tensorflow/tfjs";
import * as tfs from "@stellarapp/tfjs-stellar";
import { decode as decodeFastPNG } from "fast-png";
import { decode as decodeTiff } from "tiff";


export class DatasetSegmentationGenerator extends DatasetGenerator {
    protected xs: File[];
    protected ys: File[];


    constructor({ xs, ys, shuffle = true }: {
        xs: File[];
        ys: File[];
        shuffle: boolean
    }) {
        super({ shuffle });

        this.xs = xs;
        this.ys = ys;
    }


    /**
     * Shuffle the dataset once
     */
    public shuffle() {
        DatasetGenerator.shuffle(this.xs, this.ys);
    }


    public skip(size: number) {
        return new DatasetSegmentationGenerator({
            xs: this.xs.slice(size, this.xs.length),
            ys: this.ys.slice(size, this.ys.length),
            shuffle: this.shuffle_per_epoch
        })
    }


    public take(size: number) {
        return new DatasetSegmentationGenerator({
            xs: this.xs.slice(0, size),
            ys: this.ys.slice(0, size),
            shuffle: this.shuffle_per_epoch
        })
    }


    /**
     * @param target_shape the shape to resize images to, in the format `[height, width, channels]`
     * @param binary indicates the masks are binary encoded. If positive is not encoded as 1, then scales it down to 1.
     */
    public override generator(target_shape: [number, number, number], output_units: number) {
        const shuffle = this.shuffle_per_epoch;

        const x_train = this.xs;
        const y_train = this.ys;

        if (output_units == undefined || !output_units) {
            throw Error("DatasetSegmentation.generator: the number of output units (categories) is not defined. How many categories are you segmenting?");
        }

        if (x_train.length != y_train.length) {
            throw Error(`DatasetSegmentation.generator: the number of images (${x_train.length}) don't match the number of image masks (${y_train.length})`)
        }

        const resize_shape: [number, number] = [target_shape[0], target_shape[1]];
        const crop_size = [...resize_shape, -1];

        return async function* () {
            if (shuffle) {
                DatasetGenerator.shuffle(x_train, y_train);
            }

            for (let i = 0; i < x_train.length; i++) {
                const x_image: ImageData | ImageBitmap = await getImageData(x_train[i]);
                const y_image: ImageData | ImageBitmap = await getImageData(y_train[i]);

                yield tf.tidy(() => {
                    let x_scale = 1;
                    let y_scale = 1;

                    let x_tensor: tf.Tensor3D;
                    let y_tensor: tf.Tensor3D;

                    if (x_image instanceof ImageBitmap) {
                        x_tensor = tf.browser.fromPixels(x_image).toFloat();
                        x_scale = 255;
                        x_image.close();
                    } else {
                        x_tensor = tf.tensor<tf.Rank.R3>(x_image.data, x_image.shape, "float32");
                        x_scale = x_image.scale;
                    }

                    if (y_image instanceof ImageBitmap) {
                        y_tensor = tf.browser.fromPixels(y_image).toFloat();
                        y_image.close();
                    } else {
                        if (y_image.shape[2] != 1) { // needs to be single channel
                            throw Error(`DatasetSegmentation.generator: expected segmentation mask` +
                                ` ${y_train[i].name} to have 1 channel, found ${y_image.shape[2]} channels` +
                                ` instead, (image shape=[${y_image.shape.toString()}])`)
                        }
                        y_tensor = tf.tensor<tf.Rank.R3>(y_image.data, y_image.shape, "float32");
                        y_scale = y_image.scale;
                    }


                    const scale_shape = tfs.utils.getScaleShape(x_tensor.shape, resize_shape);
                    const random_crop_start = tfs.utils.getRandomCropStart(scale_shape, resize_shape);

                    const result = {
                        xs: x_tensor.resizeBilinear(scale_shape).slice(random_crop_start, crop_size).div(x_scale),
                        // don't need to scale the label just yet
                        ys: y_tensor.resizeNearestNeighbor(scale_shape).slice(random_crop_start, crop_size)
                    }

                    if (output_units == 1) {
                        // tensors are binary (0 / 1) encoded,
                        // some datasets masks might encode positive as 255 (or 65535 if 16 bit) instead
                        // of 1 so that they're viewable, but we need to scale them back down to (0, 1)
                        if ((result.ys.max().equal(y_scale).dataSync() as any) == 1) {
                            result.ys = result.ys.div(y_scale);
                        }
                    } else {
                        // convert the sparse image masks to dense, onehot format because TFJS
                        // does not support sparse categorical crossentropy, see
                        // https://github.com/tensorflow/tfjs/blob/0fc04d958ea592f3b8db79a8b3b497b5c8904097/tfjs-layers/src/losses.ts#L143-L146
                        // remove the channels dim and apply onehot which adds it back
                        result.ys = tf.oneHot(result.ys.squeeze([2]).asType("int32"), output_units).asType("float32") as tf.Tensor3D;
                    }

                    return result;
                })
            }
        }
    }


    public override get length() {
        return this.xs.length;
    }
}


export interface ImageData {
    data: tf.TensorLike;
    shape: [number, number, number];
    scale: number;
}


export async function getImageData(image: File) {
    if (image.type == "image/png") {
        return getPngData(image);
    } else if (image.type == "image/tiff") {
        return getTiffData(image);
    } else {
        return browserSupportedImageToTensor(image);
    }
}


async function getTiffData(image: File): Promise<ImageData> {
    const tiff = decodeTiff(await image.arrayBuffer());
    const { height, width, data } = tiff[0];

    let scale = 1;

    if (data instanceof Uint8Array) {
        scale = 255; // 2^8 - 1
    } else if (data instanceof Uint16Array) {
        scale = 65535; // 2^16 - 1
    } else if (data instanceof Uint32Array) {
        scale = 4294967295; // 2^32 - 1
    } else {
        throw Error(`DatasetSegmentation.tiffToTensor: expected the TIFF image to be either 8, 16, or 32 bit. The image's data array is: ${data.constructor.name}`)
    }

    return { data, shape: [height, width, data.length / (height * width)], scale }
}


async function getPngData(image: File): Promise<ImageData> {
    const { data, height, width, channels, depth } = decodeFastPNG(await image.arrayBuffer());
    let scale = 1;

    if (depth == 8) {
        scale = 255 // 2^8 - 1
    } else if (depth == 16) {
        scale = 65535 // 2^16 - 1
    } else {
        throw Error(`DatasetSegmentation.pngToTensor: ${image.name} bit depth is ${depth}, only 8 and 16 are supported`);
    }

    return { data, shape: [height, width, channels], scale }
}


async function browserSupportedImageToTensor(image: File) {
    return await createImageBitmap(image);
}
