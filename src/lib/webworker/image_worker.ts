import * as tf from "@tensorflow/tfjs";
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
import ImageDataset from "@/lib/data-processing/dataset_image";
import { ImagePredictArgs, ImagePredictResponse, WorkerState, WorkerTrainArgs } from "@/lib/webworker/worker_types";
import { ProjectType } from "@/types/project_types";
import { createImageSamples } from "@/lib/data-processing/preprocess_image";
import { DatasetImageGenerator } from "@/lib/data-processing/dataset_image_generator";


(async () => {

    let imageset = new ImageDataset();
    let imset: DatasetImageGenerator | undefined = undefined;

    createModelWorker(ProjectType.IMAGE_CLASSIFICATION, {
        [WorkerState.PREDICT]: async (model_meta, { inputs, backend, batch_size, input_shape }: ImagePredictArgs) => {
            try {
                await setBackend(backend);
                await tf.ready();

                const { xs } = await createImageSamples(inputs, input_shape.includes(null) ? undefined : (input_shape as number[]));

                tf.tidy(() => {
                    const result = model_meta.model.predict(tf.concat(xs.map(x => x.div(255).expandDims(0)), 0), {
                        batchSize: batch_size,
                        verbose: true,
                    }) as tf.Tensor;

                    self.postMessage({ state: WorkerState.PREDICT, prediction: (result as tf.Tensor).arraySync() as number[][] } satisfies ImagePredictResponse);
                    result.dispose();
                })


            } catch (error: any) {
                postErrorToMainThread({
                    user_msg: `An error occurred during image classification inference.\n\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: `model.predict(), backend=${backend}, batch_size:${batch_size}, input_shape:${input_shape}`,
                });
            }
        },


        [WorkerState.TRAIN]: async (model_meta, { project_config: project_config_json, dataset, mode }: WorkerTrainArgs) => {
            const project_config = new ProjectConfig({ load: project_config_json });

            const { epochs, batch_size, validation_split, backend } = project_config.model;

            if (backend && !await setBackend(backend)) {
                await tf.ready();
                throw Error(`Image Worker: failed to set the backend to ${backend}. Select a different backend.`);
            }

            if (dataset) {
                imageset = await ImageDataset.load(new File([dataset as any], ""), true);

                const { x_train, y_train } = await imageset.dataset(project_config.preprocessing.input_cols);

                imset = new DatasetImageGenerator({ xs: x_train, ys: y_train, shuffle: true });
                imset.shuffle();
            }

            if (!imset || imset.length == 0) {
                postErrorToMainThread({
                    user_msg: "Image Worker: The image dataset is empty",
                });
                return;
            }

            if (mode == "new_train" || mode == "new_finetune") {
                model_meta.model = compileModel(project_config);
            }

            const val_size = Math.floor(imset.length * validation_split);
            const total_batches = Math.ceil((imset.length - val_size) / batch_size);
            const total_val_batches = Math.ceil(val_size / batch_size);

            const onehot_encoding = project_config.preprocessing.onehot_encoding;
            const image_shape = project_config.model.input_shape;

            if (image_shape.includes(null)) {
                throw Error(`Invalid input image shape: ${JSON.stringify(image_shape)}`);
            }

            const train_set = tf.data.generator(imset.skip(val_size).generator(onehot_encoding, image_shape as number[])).batch(batch_size);

            const validation = val_size > 0 ? {
                dataset: tf.data.generator(imset.take(val_size)
                    .generator(onehot_encoding, image_shape as number[]))
                    .batch(batch_size).prefetch(1) as tf.data.Dataset<{ xs: tf.Tensor, ys: tf.Tensor }>,
                batches: total_val_batches
            } : undefined;

            prepareModel(model_meta, project_config);

            model_meta.model.fitDataset(train_set, {
                epochs,
                callbacks: modelCallbacks(model_meta, total_batches, project_config.metrics_history.length, validation)
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
