import * as tf from "@tensorflow/tfjs";
import * as tfs from "@stellarapp/tfjs-stellar";
import ModelTimer from "@/lib/webworker/model_timer";


import {
    LoadResponse,
    TrainStartResponse,
    UploadResponse,
    WorkerErrorArgs,
    WorkerLoadArgs,
    WorkerState,
    WorkerStopArgs,
} from "@/lib/webworker/worker_types";
import {
    ForgeModelSaveZip,
    ForgeModelSerializeFile,
    ForgeModelSerializeFileResult,
    ForgeSaveResult
} from "@/lib/data-processing/model_io_handler";
import { logError } from "@/lib/errors/error_handling_client";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { ProjectType } from "@/types/project_types";
import { RemapCustomLosses, UnsupportedCustomLosses, UnsupportedCustomMetrics } from "@/types/hyperparameters";
import type BaseConfig from "@/lib/data-processing/base_config";
import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { uploadModel } from "@/features/training/model_io";


tf.env().set('IS_NODE', false);

// https://www.tensorflow.org/js/guide/platform_environment#flags
//tf.enableProdMode();

type ModelHandlers = { [key in WorkerState]?: (model: ModelMeta, args?: any) => void | Promise<void> }

interface ModelMeta {
    model: tf.Sequential | tf.LayersModel | tfs.models.UNetModel | tfs.models.LlmModel;
    timer: ModelTimer;
    val_timer: ModelTimer;
}

export function createModelWorker(project_type: ProjectType, custom_handlers: ModelHandlers) {

    const model_meta = {
        model: (
            project_type == ProjectType.TEXT_GENERATION
                ? tfs.models.llmModel({ name: "model" })
                : tf.sequential({ name: "model" })
        ),
        timer: new ModelTimer(30),
        val_timer: new ModelTimer(50) // larger window because evaluation is much faster
    };

    const handlers: ModelHandlers = {
        /**
         * Load a TFJS model into the web worker from its model.json and
         * weights.bin files.
         * 
         * If a custom loss was used (saved in the project_config.json), then it
         * was replaced with a placeholder loss because TFJS doesn't support
         * serialization with custom losses. Immediately model load, it is recompiled
         * with its existing optimizer weights and and the custom loss.
         */
        [WorkerState.LOAD]: async (model_ref, { model_json, weights_bin, project_config }: Omit<WorkerLoadArgs, "state">) => {
            await tf.ready();

            const files = weights_bin ? [model_json, weights_bin] : [model_json];
            const { loss_fn, metrics } = project_config.model;

            try {
                const model_files = tf.io.browserFiles(files);

                if (project_type == ProjectType.IMAGE_SEGMENTATION) {
                    model_ref.model = await tfs.loadUNetModel(model_files);
                } else {
                    model_ref.model = await tf.loadLayersModel(model_files) as tf.Sequential;
                }

                // add back custom losses and metrics if used
                if (UnsupportedCustomLosses.includes(loss_fn as any) && (tfs.losses as any)[loss_fn] ||
                    metrics.filter(name => UnsupportedCustomMetrics.includes(name as any) && !!(tfs.metrics as any)[name]).length > 0) {

                    model_ref.model.compile({
                        optimizer: model_ref.model.optimizer, // optimizer unaffected
                        loss: (tfs.losses as any)[loss_fn] ?? loss_fn,
                        metrics: metrics.map(name => (tfs.metrics as any)[name] ?? name)
                    });
                }

            } catch (error: any) {
                postErrorToMainThread({
                    user_msg: `Failed to load the project's model and weights: ${error.toString()}`,
                    system_msg: error.toString(),
                    code: `base_worker: WorkerState.LOAD handler`,
                });

                return;
            }

            self.postMessage({ state: WorkerState.LOAD, parameters: model_ref.model.countParams() } satisfies LoadResponse);
        },


        [WorkerState.STOP]: ({ model }) => {
            model.stopTraining = true;

            self.postMessage({ state: WorkerState.STOP } satisfies WorkerStopArgs);
        },


        [WorkerState.UPLOAD]: async ({ model }, { username, project_name }: { username: string, project_name: string }) => {
            if (!uploadModel) {
                throw Error(`Model Worker: upload unavailable`);
            }

            const param_limit = Number(process.env.NEXT_PUBLIC_MODEL_PARAM_LIMIT)
            let parameters = 0;

            try {
                parameters = model.countParams();
            } catch {
                postErrorToMainThread({ user_msg: "The project's model was not saved because it has not been trained yet" });
                return;
            }

            if (parameters > param_limit) {
                postErrorToMainThread({
                    user_msg: `The model exceeds the ${param_limit.toLocaleString("en", { useGrouping: true })}` +
                        ` parameter limit. Reduce its size or save to your local device instead.`,
                });
                return;
            }

            const { model_json, weights_bin } = await model.save(new ForgeModelSerializeFile(), {
                includeOptimizer: true
            }) as ForgeModelSerializeFileResult;

            uploadModel({
                username,
                project_name,
                model_json,
                weights_bin,
                callback: (event) => {
                    const uploaded = event.loaded! / event.total!;
                    self.postMessage({ state: WorkerState.UPLOAD, progress: uploaded, username, project_name, parameters } satisfies UploadResponse);
                }
            }).then(async () => {
                self.postMessage({ state: WorkerState.UPLOAD, progress: 1, username, project_name, parameters } satisfies UploadResponse);
            }).catch(error => {
                postErrorToMainThread({
                    user_msg: error.message ?? error.toString(),
                    system_msg: error.toString(),
                    code: `base_worker: WorkerState.UPLOAD handler: uploadModel({${username}, ${project_name}, <model_json>, <weights_bin>})`,
                });
            });
        },


        [WorkerState.SERIALIZE]: ({ model }, { project_config, download_name }: { project_config: ProjectConfig, download_name: string }) => {
            // set a placeholder loss if a custom loss was used
            const custom_loss_placeholder = (RemapCustomLosses as any)[project_config.model.loss_fn];

            // list of metrics used, excluding custom metrics
            const serializable_metrics = model.metricsNames?.filter(name => name != "loss" && !UnsupportedCustomMetrics.includes(name as any));

            // strip model of custom loss and metrics before serialization
            if (custom_loss_placeholder || (serializable_metrics && model.metricsNames && serializable_metrics.length != model.metricsNames.length)) {
                model.compile({
                    optimizer: model.optimizer,
                    loss: custom_loss_placeholder ?? project_config.model.loss_fn,
                    metrics: serializable_metrics
                });
            }

            model.save(new ForgeModelSaveZip({
                project_config,
                name: download_name,
                is_built: model.built
            }), { includeOptimizer: true }).then(result => {
                self.postMessage({ state: WorkerState.SERIALIZE, download_link: (result as ForgeSaveResult).download_link });
            });
        },

        // all other handlers are implemented in model specific workers
        ...custom_handlers
    };

    self.onmessage = async event => {
        const { state, ...payload } = event.data;
        const handler = handlers[state as WorkerState];


        if (handler) {
            try {
                await handler(model_meta, payload);
            } catch (error: any) {
                postErrorToMainThread({
                    user_msg: `An error occurred in the web worker: ${error.toString()}`,
                    system_msg: error.toString(),
                    code: "uncaught handler exception"
                })
            }
        }
    }
}


export function postErrorToMainThread({ user_msg, system_msg, code }: {
    user_msg: string;
    system_msg?: string;
    code?: string
}) {
    self.postMessage({ state: WorkerState.ERROR, message: user_msg } satisfies WorkerErrorArgs);

    if (system_msg) {
        logError({
            source: "base_worker.ts",
            code: code ?? "",
            description: system_msg,
        });
    }
}


export function compileModel(project_config: BaseConfig) {
    const {
        input_shape,
        layers,
        learning_rate,
        metrics,
        loss_fn,
        optimizer
    } = project_config.model;

    // compile model
    let model: tf.Sequential | tf.LayersModel;

    if (project_config.project_type == ProjectType.TEXT_GENERATION) {
        const { num_layers, num_heads, embed_dim, vocab_size } = (project_config as LLMConfig).preprocessing;

        model = tfs.models.gptModel({
            numHeads: num_heads,
            numLayers: num_layers,
            embedDim: embed_dim,
            vocabSize: vocab_size
        })
    } else if (project_config.project_type == ProjectType.IMAGE_SEGMENTATION) {
        const attributes = project_config.model.layers.at(0);

        if (!attributes) {
            throw Error(`Segmentation Worker: missing U-Net configurations`);
        }

        if (attributes.identifier != "unetModel") {
            throw Error(`Segmentation Worker: failed to compile the U-Net, received identifier ${attributes.identifier}`);
        }

        model = tfs.models.unetModel(attributes.config as any) as tf.LayersModel;// new UNetModel(attributes.config as any);
    } else {
        model = tf.sequential({
            name: "model",
            layers: [
                tf.layers.inputLayer({ inputShape: input_shape }),
                ...layers.map(layer => {
                    const tf_layer = (tf.layers as any)[layer.identifier];

                    if (tf_layer) {
                        return tf_layer(layer.config);
                    } else {
                        const tf_custom_layer = (tfs as any)[layer.identifier];

                        if (tf_custom_layer) {
                            return tf_custom_layer(layer.config);
                        } else {
                            throw Error(`base_worker: compileModel() ${layer.identifier} is not a supported neural network layer`);
                        }
                    }
                })
            ]
        })
    }

    const custom_loss = (tfs.losses as any)[loss_fn];
    const metric_fns = metrics.map(name => (tfs.metrics as any)[name] ?? name)

    model.compile({
        loss: custom_loss ?? loss_fn,
        optimizer: (tf.train as any)[optimizer](learning_rate),
        metrics: metric_fns
    });

    model.summary();

    console.log(`Training backend: ${tf.getBackend()}`);

    return model;
}


/**
 * Set up prior to model training, includes
 * - setting learning rate
 */
export function prepareModel({ model }: ModelMeta, project_config: BaseConfig) {
    const original_learning_rate = (model.optimizer as any).learningRate;

    try {
        (model.optimizer as any).learningRate = project_config.model.learning_rate;
    } catch {
        // restore the default learning rate
        if (!isNaN(original_learning_rate)) {
            (model.optimizer as any).learningRate = original_learning_rate;
        }
    }

    const existing_metrics = new Set(model.metricsNames.filter(metric => metric != "loss"));
    const new_metrics = new Set(project_config.model.metrics);

    // update the model metrics if user changed it in a subsequent epoch
    if (existing_metrics.size != new_metrics.size) {
        model.compile({
            optimizer: model.optimizer,
            loss: model.loss,
            metrics: project_config.model.metrics.map(name => (tfs.metrics as any)[name] ?? name)
        });
    }
}


/**
 * To be ran in onEpochEnd callback, this replaces the built in validation because
 * that only runs all at once rather than reporting per validation batch.
 * 
 * @param model a TFJS layers model
 * @param generator a batched dataset (so that each sample and label include the batch dimension)
 */
async function onValCallback(model_meta: ModelMeta, generator: tf.data.Dataset<{ xs: tf.Tensor, ys: tf.Tensor }>, val_batches: number, current_epoch: number) {
    const { model } = model_meta;

    const iterator = await generator.iterator();
    let batch = await iterator.next();
    let batch_index = 0;
    let total_samples = 0; // for calculating epoch average metrics

    const accumulated_logs: tf.Logs = {};

    const timer = model_meta.val_timer;
    timer.start(val_batches, current_epoch);

    while (!batch.done) {
        if (model_meta.model.stopTraining) {
            break;
        }

        const samples = batch.value.xs.shape[0];
        const logs: tf.Logs = { batch: batch_index, size: samples };

        total_samples += samples;

        const metrics = tf.tidy(() => {
            const validation = model.evaluate(batch.value.xs, batch.value.ys);
            return Array.isArray(validation) ? validation : [validation];
        });

        for (let i = 0; i < metrics.length; i++) {
            const metric = `val_${model.metricsNames[i]}`;
            const value = metrics[i].dataSync()[0]

            // fill out the current batch's logs
            logs[metric] = value;

            // save the unaveraged metric, not all batches have the same size
            // (usually the last batch) so this avoids biasing the metrics
            accumulated_logs[metric] = (accumulated_logs[metric] || 0) + (value * logs.size);
        }

        logs.epoch = timer.epoch;
        logs.total_batches = val_batches;
        logs.time = timer.lap(batch_index);

        self.postMessage({ state: WorkerState.VAL_BATCH_END, metrics: logs });

        tf.dispose(metrics);
        tf.dispose(batch.value);

        batch_index++;
        batch = await iterator.next();
    }

    if (total_samples > 0) {
        for (const key in accumulated_logs) {
            accumulated_logs[key] /= total_samples;
        }
    }

    return accumulated_logs;
}


interface ModelCallbacksValArgs {
    dataset: tf.data.Dataset<{ xs: tf.Tensor, ys: tf.Tensor }>;
    batches: number;
}


/**
 * Creates the model callback functions. If a validation dataset is provided,
 * then the logs for each batch is posted back to the client.
 * 
 * @param model_meta
 * @param total_batches total number of batches in the train dataset
 * @param validation.dataset a batched dataset (so that each sample and label include the batch dimension)
 * @param valdation.batches the total number of batches in `val_dataset` (needs to be pre-calculated if using a generator dataset)
 */
export function modelCallbacks(model_meta: ModelMeta, total_batches: number, current_epoch: number, validation?: ModelCallbacksValArgs): tf.CustomCallbackArgs {
    const { model, timer } = model_meta;

    return {
        onTrainBegin: () => {
            self.postMessage({
                state: WorkerState.TRAIN_START,
                backend: tf.getBackend(),
                parameters: model_meta.model.countParams(),
            } satisfies TrainStartResponse);
        },
        onBatchBegin(batch, logs) {
            if (batch == 0) {
                timer.start(total_batches, current_epoch)
            }
        },
        onEpochBegin: () => {
            self.postMessage({ state: WorkerState.EPOCH_BEGIN });
        },
        onBatchEnd: (batch: number, logs: tf.Logs | undefined) => {
            if (!logs) {
                throw Error("base_worker: onBatchEnd missing logs/metrics");
            }

            // metrics to be sent back to main thread
            logs.epoch = timer.epoch;
            logs.total_batches = total_batches;
            logs.time = timer.lap(batch);

            self.postMessage({ state: WorkerState.BATCH_END, metrics: logs });
        },
        onEpochEnd: async (epoch: number, logs: tf.Logs | undefined) => {
            if (!logs) {
                throw Error("base_worker: onEpochEnd missing logs/metrics");
            }

            logs.total_batches = total_batches;
            logs.batch = timer.batches;
            logs.time = timer.time("epoch");

            // logs will be returned like {val_loss, val_metric..., loss, metric...},
            // reorder the keys such that val metrics appear last
            let val_logs: tf.Logs = {};

            if (validation) {
                if (!model.stopTraining) {
                    val_logs = await onValCallback(model_meta, validation.dataset, validation.batches, current_epoch);
                }
            } else {
                for (const i in logs) {
                    if (i.startsWith("val")) {
                        val_logs[i] = logs[i];
                        delete logs[i];
                    }
                }
            }

            self.postMessage({ state: WorkerState.EPOCH_END, metrics: { ...logs, ...val_logs } });
        },
        onTrainEnd() {
            self.postMessage({ state: WorkerState.TRAIN_END });
        },
    }
}


export async function setBackend(backend: string) {
    const current_backend = tf.getBackend();

    if (backend == current_backend) {
        return true;
    }

    try {
        return await tf.setBackend(backend);
    } catch (error) {
        return false;
    }
}
