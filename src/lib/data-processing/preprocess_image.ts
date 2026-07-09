import { fromPixels } from "@tensorflow/tfjs-core/dist/ops/browser";
import { image as tf_image } from "@tensorflow/tfjs-core/dist/ops/ops";
import type { Tensor3D } from "@tensorflow/tfjs-core/dist/tensor";
import { OneHotEncodingArgs } from "@/lib/data-processing/project_config";
import '@tensorflow/tfjs-backend-cpu';
import { browser as tf_browser, tidy, div } from "@tensorflow/tfjs-core";


/**
 * Converts an array of image blobs to their tensor representations
 * 
 * @param x_train   an array of image blobs
 */
export async function createImageSamples(x_train: Blob[], input_shape?: number[]): Promise<{
    xs: Tensor3D[],
    input_shape: number[],
    skipped: number[];
}> {
    if (x_train.length == 0) {
        return { input_shape: [], xs: [], skipped: [] };
    }

    if (input_shape && input_shape.length != 3) {
        throw new Error(`preprocess.createImageSamples: expected a rank 3 shape, but received ${input_shape}`);
    }

    let images_dim = input_shape;

    if (!images_dim) {
        const first_image = await createImageBitmap(x_train[0]);
        const first_tensor = tidy(() => tf_browser.fromPixels(first_image));
        images_dim = first_tensor.shape;
    }

    const skipped_indices: number[] = [];

    // using flatMap so we can discard bad images by returning []
    const samples = await Promise.all(x_train.flatMap(async (blob, index) => {
        const bitmap = await createImageBitmap(blob);

        const result = tidy(() => {
            let tensor = fromPixels(bitmap);

            if (tensor.shape[2] != images_dim[2]) {
                skipped_indices.push(index);
                // this image's channels don't match what is expected, discard this image
                return [];
            }

            if (tensor.shape[0] != images_dim[0] || tensor.shape[1] != images_dim[1]) {
                // resize the image to the expected shape
                tensor = tf_image.resizeBilinear(tensor, [images_dim[0], images_dim[1]]);
            }

            // scale down to [0, 1] because it's standard practice AND for webgpu to not
            // generate tons of warnings (really they are errors)
            return div(tensor, 255);
        })

        return result;
    }));

    return {
        input_shape: images_dim,
        xs: samples as Tensor3D[],
        skipped: skipped_indices
    }
}


export function createImageClassificationLabels({ categories, labels, onehot_encoding, skip = [] }: {
    categories: string[];
    labels: string[];
    onehot_encoding?: OneHotEncodingArgs;
    skip?: number[];
}): {
    ys: number[][];
    onehot_encoding: OneHotEncodingArgs;
} {
    if (categories.length == 0) {
        throw Error("preprocess_images.createImageClassificationLabels: No image categories provided");
    }

    if (labels.length == 0) {
        return { ys: [], onehot_encoding: {} };
    }

    const onehot_encoding_new = onehot_encoding && Object.keys(onehot_encoding).length > 0
        ? onehot_encoding
        : createOneHotEncoding(categories);

    const ys: number[][] = labels
        .filter((label, index) => !skip.includes(index))
        .map(label => {
            // sparse onehot encoding, use sparseCategoricalCrossentropy instead of categoricalCrossentropy
            const hot_index = onehot_encoding_new[label];

            if (hot_index == undefined) {
                throw Error(`preprocess_image.createImageClassificationLabels: the label "${label}" was not found`);
            }

            return [hot_index];
        })

    return { ys, onehot_encoding: onehot_encoding_new }
}


/**
 * Generate a set of onehot encodings for an array of image categories.
 */
export function createOneHotEncoding(categories: string[]): OneHotEncodingArgs {
    return Object.fromEntries(
        categories.toSorted().map((category, index) => [category, index]));
}