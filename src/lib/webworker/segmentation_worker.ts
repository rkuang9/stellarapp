import * as tf from "@tensorflow/tfjs";
import * as tfs from "@stellarapp/tfjs-stellar";
import '@tensorflow/tfjs-backend-webgpu';
import {
    compileModel,
    createModelWorker,
    modelCallbacks,
    postErrorToMainThread,
    prepareModel,
    setBackend
} from "@/lib/webworker/base_worker";

import ProjectConfig from "@/lib/data-processing/project_config";
import {
    SegmentationDatasetArgs,
    SegmentationPredictArgs,
    SegmentationPredictResponse,
    WorkerState,
    WorkerTrainArgs
} from "@/lib/webworker/worker_types";
import { ProjectType } from "@/types/project_types";
import { DatasetSegmentationGenerator, getImageData, ImageData } from "@/lib/data-processing/dataset_segmentation_generator";
import DistinctColors from "distinct-colors";


(async () => {
    let segmentation_dataset: DatasetSegmentationGenerator | undefined = undefined;
    let color_palette: tf.Tensor2D | undefined = undefined;
    let num_categories: number | undefined; // binary is 2 (foreground, background), classification is 3+

    createModelWorker(ProjectType.IMAGE_SEGMENTATION, {
        [WorkerState.PREDICT]: async (model_meta, { inputs, backend, batch_size, depth, colorize }: SegmentationPredictArgs) => {
            try {
                await setBackend(backend);
                await tf.ready();

                const x: ImageBitmap | ImageData = await getImageData(inputs);
                let x_scale = 1;

                let prediction = tf.tidy(() => {
                    let x_tensor: tf.Tensor3D;

                    if (x instanceof ImageBitmap) {
                        x_tensor = tf.browser.fromPixels(x).asType("float32");
                        x_scale = 255;
                        x.close();
                    } else {
                        x_tensor = tf.tensor<tf.Rank.R3>(x.data, x.shape, "float32");
                        x_scale = x.scale;
                    }

                    const x_channels = x_tensor.shape.at(-1);

                    if (x_channels != 3) {
                        throw Error(`Segmentation Worker: ${inputs.name} is not an RGB image (expected 3 channels, found ${x_channels})`);
                    }

                    const [pad_height, pad_width] = tfs.utils.getPaddingForSegmentation(x_tensor, depth);

                    // if padding is required so that height and width divisible by 2^depth,
                    // then apply them to the bottom and right side of the image
                    if (pad_height > 0 || pad_width > 0) {
                        x_tensor = x_tensor.pad([
                            [0, pad_height], // pad bottom
                            [0, pad_width], // pad right
                            [0, 0], // don't pad channels
                        ]);
                    }

                    let result = model_meta.model.predict(x_tensor.div(x_scale).expandDims(0), {
                        batchSize: batch_size,
                        verbose: true,
                    }) as tf.Tensor<tf.Rank.R4>; // includes batch dimension which is always 1

                    if (pad_height > 0 || pad_width > 0) {
                        // remove padding by slicing the prediction using the original image's size,
                        // note that x_tensor is Tensor3D hence the indices 0 and 1
                        const original_height = x_tensor.shape[0] - pad_height;
                        const original_width = x_tensor.shape[1] - pad_width;
                        result = result.slice([0, 0, 0, 0], [-1, original_height, original_width, -1]);
                    }

                    const [batch, height, width, channels] = result.shape;

                    if (channels == 1) {
                        // pixel-wise binary classification, channels=1
                        result = result.round()
                    } else {
                        // pixel-wise categorical classification where each pixel represents a category,
                        // argMax removes the channels dimension
                        result = result.argMax(-1);
                    }

                    if (num_categories == undefined) {
                        num_categories = channels == 1 ? 2 : channels; // if 1 (binary), then we need two colors
                    }

                    // make sure the prediction is returned as Tensor3D
                    return result.reshape<tf.Tensor3D>([height, width, 1]).asType("int32");
                });

                if (colorize && color_palette == undefined && num_categories != undefined && num_categories > 2) {
                    // initialize the reproducible color palette, returns an array of [R, G, B]
                    const generate_palette = DistinctColors({
                        count: num_categories,
                        samples: 5000,
                        quality: 200,
                        lightMax: 70, lightMin: 40,
                        chromaMax: 100, chromaMin: 60

                    }).map(colors => colors.rgb());

                    // this is persistent and should not be in tf.tidy nor disposed
                    color_palette = tf.tensor2d(generate_palette);
                }

                const canvas = new OffscreenCanvas(prediction.shape[0], prediction.shape[1]);
                canvas.getContext("2d"); // prevents FireFox from throwing some NS error on the 4th inference

                // Predictions are single channel grey scale and, for sigmoid outputs, are entirely black.
                // For binary we scale up to 255. For categorical we use the generated color palette to
                // replace the pixel category encodings with an RGB value
                if (colorize) {
                    if (num_categories == undefined || num_categories < 2) {
                        throw Error(`Segmentation Worker: unable to visualize image because the number` +
                            ` of segmentation categories is ${num_categories == undefined ? "unknown" : "less than 2"}`);
                    }

                    const colorized_prediction = tf.tidy(() => {
                        if (num_categories == 2) {
                            // upscale by 255 because we want to present a black (0) and white (255) image
                            return prediction.mul<tf.Tensor3D>(255);
                        } else {
                            // [num_categories, 3] (num colors, RGB) gather [1, H, W, 1] with batch and channels removed
                            return tf.gather(color_palette!, prediction.squeeze()) as unknown as tf.Tensor3D;
                        }
                    })

                    prediction.dispose();
                    prediction = colorized_prediction;
                }


                tf.browser.draw(prediction, canvas as unknown as HTMLCanvasElement);

                const blob = await canvas.convertToBlob({ type: "image/png" });

                self.postMessage({
                    state: WorkerState.PREDICT,
                    prediction: new File([blob], inputs.name, { type: "image/png" })
                } satisfies SegmentationPredictResponse);

                prediction.dispose();

            } catch (error: any) {
                postErrorToMainThread({
                    user_msg: `An error occurred during image segmentation inference.\n\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: `model.predict(), backend=${backend}, batch_size:${batch_size}`,
                });
            }
        },


        [WorkerState.TRAIN]: async (model_meta, { project_config: project_config_json, dataset, mode }: WorkerTrainArgs) => {
            const project_config = new ProjectConfig({ load: project_config_json });

            const { epochs, batch_size, validation_split, backend, input_shape } = project_config.model;
            const image_shape = input_shape as [number, number, number];
            const units = project_config.model.layers.at(0)?.config.units as number;

            if (backend && !await setBackend(backend)) {
                await tf.ready();
                throw Error(`Segmentation Worker: failed to set the backend to ${backend}. Select a different backend.`);
            }

            if ((mode == "new_train" || mode == "new" || !segmentation_dataset || segmentation_dataset.length) && dataset) {
                const { x_train, y_train } = dataset as SegmentationDatasetArgs;
                segmentation_dataset = new DatasetSegmentationGenerator({ xs: x_train, ys: y_train, shuffle: true });
                segmentation_dataset.shuffle();
            }

            if (!segmentation_dataset || segmentation_dataset.length == 0) {
                postErrorToMainThread({
                    user_msg: "Segmentation Worker: The image segmentation dataset is empty or uninitialized",
                });
                return;
            }

            if (mode == "new_train" || mode == "new_finetune") {
                model_meta.model = compileModel(project_config);
            }

            const val_size = Math.floor(segmentation_dataset.length * validation_split);
            const total_train_batches = Math.ceil((segmentation_dataset.length - val_size) / batch_size);
            const total_val_batches = Math.ceil(val_size / batch_size);

            const train_set = tf.data.generator(segmentation_dataset.skip(val_size).generator(image_shape, units)).batch(batch_size).prefetch(1);

            const validation = val_size > 0 ? {
                dataset: tf.data.generator(segmentation_dataset.take(val_size)
                    .generator(image_shape, units))
                    .batch(batch_size).prefetch(1) as tf.data.Dataset<{ xs: tf.Tensor, ys: tf.Tensor }>,
                batches: total_val_batches
            } : undefined;

            prepareModel(model_meta, project_config);

            model_meta.model.fitDataset(train_set, {
                epochs,
                callbacks: modelCallbacks(model_meta, total_train_batches, project_config.metrics_history.length, validation)
            }).catch(error => {
                postErrorToMainThread({
                    user_msg: `An error occurred during model training.\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: "model.fit()",
                });
            });
        },
    });
})();
