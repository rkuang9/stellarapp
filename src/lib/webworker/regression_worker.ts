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
import { RegressionPredictResponse, WorkerDatasetArgs, WorkerPredictArgs, WorkerState, WorkerTrainArgs } from "@/lib/webworker/worker_types";
import { ProjectType } from "@/types/project_types";
import { DatasetRegressionGenerator } from "@/lib/data-processing/dataset_regression_generator";


(async () => {

    let regression_dataset: undefined | DatasetRegressionGenerator = undefined;

    createModelWorker(ProjectType.TABULAR_REGRESSION, {
        [WorkerState.PREDICT]: async (model_meta, { inputs, backend, batch_size }: WorkerPredictArgs) => {
            await setBackend(backend);
            await tf.ready();

            if ((inputs as number[][]).length == 0) {
                self.postMessage({ state: WorkerState.PREDICT, prediction: [] });
            }

            try {
                const result = model_meta.model.predict(tf.tensor(inputs as number[][]), {
                    batchSize: batch_size,
                    verbose: true,
                }) as tf.Tensor;

                self.postMessage({ state: WorkerState.PREDICT, prediction: (result as tf.Tensor).arraySync() as number[][] } satisfies RegressionPredictResponse);
                result.dispose();

            } catch (error: any) {
                postErrorToMainThread({
                    user_msg: `An error occurred during tabular regression inference.\n\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: `model.predict(), backend=${backend}, batch_size:${batch_size}`,
                });
            }
        },


        [WorkerState.TRAIN]: async (model_meta, { project_config: project_config_json, dataset, mode }: WorkerTrainArgs) => {
            const project_config = new ProjectConfig({ load: project_config_json });

            const { epochs, batch_size, validation_split, backend } = project_config.model;

            if (backend && !await setBackend(backend)) {
                await tf.ready();
                throw Error(`Regression Worker: failed to set the backend to ${backend}. Select a different backend.`);
            }

            if (dataset) {
                try {
                    const { x_train, y_train } = dataset as WorkerDatasetArgs;

                    regression_dataset = new DatasetRegressionGenerator({ xs: x_train, ys: y_train, shuffle: true });
                    regression_dataset.shuffle();

                } catch (error: any) {
                    postErrorToMainThread({
                        user_msg: `An error occurred while generating training data.\n${error.toString()}`,
                        system_msg: error.toString(),
                        code: "model.fit()",
                    });
                    return;
                }
            }

            if (!regression_dataset || regression_dataset.length == 0) {
                postErrorToMainThread({
                    user_msg: "Regression Worker: The regression dataset is empty",
                });
                return;
            }

            if (mode == "new_train" || mode == "new_finetune") {
                model_meta.model = compileModel(project_config);
            }

            const val_size = Math.floor(regression_dataset.length * validation_split);
            const total_batches = Math.ceil((regression_dataset.length - val_size) / batch_size);
            const total_val_batches = Math.ceil(val_size / batch_size);

            prepareModel(model_meta, project_config);

            const train_set = tf.data.generator(regression_dataset.skip(val_size).generator()).map(row => ({
                xs: tf.tensor(row.xs),
                ys: tf.tensor(row.ys)
            })).batch(batch_size).prefetch(500);

            const val_set = val_size > 0
                ? tf.data.generator(regression_dataset.take(val_size).generator()).map(row => ({
                    xs: tf.tensor(row.xs),
                    ys: tf.tensor(row.ys)
                })).batch(batch_size)
                : undefined;

            const validation = val_size > 0 ? {
                dataset: tf.data.generator(regression_dataset.take(val_size).generator()).map(row => ({
                    xs: tf.tensor(row.xs),
                    ys: tf.tensor(row.ys)
                })).batch(batch_size).prefetch(1) as tf.data.Dataset<{ xs: tf.Tensor, ys: tf.Tensor }>,
                batches: total_val_batches
            } : undefined;


            model_meta.model.fitDataset(train_set, {
                epochs,
                validationData: val_set,
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
