import * as tf from "@tensorflow/tfjs";
import * as tfs from "@stellarapp/tfjs-stellar";
import '@tensorflow/tfjs-backend-webgpu';
import '@tensorflow/tfjs-backend-wasm';
import { AutoTokenizer, PreTrainedTokenizer } from "@huggingface/transformers";
import { compileModel, createModelWorker, modelCallbacks, postErrorToMainThread, prepareModel, setBackend } from "@/lib/webworker/base_worker";
import { ProjectType } from "@/types/project_types";
import { WorkerState } from "@/lib/webworker/worker_types";
import {
    GPTPredictResponse,
    GPTPredictFinishResponse,
    GPTPredictArgs,
    GPTWorkerTrainArgs,
} from "@/lib/webworker/gpt_types";
import { LlmDatasetGenerator } from "@/lib/data-processing/dataset_llm_generator";
import { LLMConfig } from "@/lib/data-processing/llm_config";
import { Tokenizers } from "@/lib/data-processing/nlp_sources";
import { tokenize } from "@/lib/data-processing/tokenization_pipeline";
import { datasetFileURL } from "@/lib/data-processing/huggingface_datasets";


(async () => {
    let tokenizer: PreTrainedTokenizer | undefined = undefined; // inference only
    let dataset: LlmDatasetGenerator | undefined = undefined; // has its own tokenizer
    let kv_cache = tfs.kvCacheContainer(4096);

    createModelWorker(ProjectType.TEXT_GENERATION, {
        [WorkerState.PREDICT]: async (model_meta, { chat, backend, tokenizer: tokenizer_name, cache_size, is_new }: GPTPredictArgs) => {
            if (!await setBackend(backend)) {
                await tf.ready();
                throw Error(`GPT Worker: failed to set the backend to ${backend}. Select a different backend.`);
            }

            if (!tokenizer) {
                tokenizer = await AutoTokenizer.from_pretrained(tokenizer_name);
            }

            const { eos_token_id, prompt_mask } = Tokenizers[tokenizer_name];
            const end_token = prompt_mask.assistant_end;

            if (is_new) {
                kv_cache.dispose();
                kv_cache = tfs.kvCacheContainer(cache_size);
            }

            const input = tf.tensor1d(tokenizer.encode(chat));

            (model_meta.model as tfs.models.LlmModel).generate(
                input,
                kv_cache,
                async (token) => {
                    await token.array().then(token => {
                        // must await, or it throws the error
                        // TypeError: Cannot read properties of undefined (reading 'backend')
                        const next_token = (token as number[])[0];
                        const decoded = tokenizer!.decode(token as number[]);

                        self.postMessage({
                            state: WorkerState.PREDICT,
                            next_token: decoded
                        } satisfies GPTPredictResponse)

                        if (next_token == eos_token_id || next_token == end_token) {
                            (model_meta.model as tfs.models.LlmModel).stopPredicting = true;
                        }
                    });
                },
            ).then(() => {
                self.postMessage({
                    state: WorkerState.GENERATE_END,
                    cache_full: kv_cache.size >= kv_cache.maxSequenceLength,
                } satisfies GPTPredictFinishResponse);
            }).catch(error => {
                if (kv_cache.size >= kv_cache.maxSequenceLength) {
                    self.postMessage({
                        state: WorkerState.GENERATE_END,
                        cache_full: true,
                    } satisfies GPTPredictFinishResponse);

                    return;
                }

                postErrorToMainThread({
                    user_msg: `An error occurred during token generation.\n\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: `model.generate(input=<chat_tensor>)`,
                });
            }).finally(() => {
                input.dispose();
            })
        },


        [WorkerState.TRAIN]: async (model_meta, { project_config: project_config_json, mode }: GPTWorkerTrainArgs) => {
            const project_config = new LLMConfig({ load: project_config_json });

            const { epochs, batch_size, backend } = project_config.model;
            const {
                sequence_length,
                tokenizer: tokenizer_name,
                pretraining_datasets,
                finetuning_datasets,
                pretraining_stride,
                finetuning_stride
            } = project_config.preprocessing;

            if (backend && !await setBackend(backend)) {
                await tf.ready();
                throw Error(`GPT Worker: failed to set the backend to ${backend}. Select a different backend.`);
            }

            if (!tokenizer_name) {
                throw Error(`GPT Worker: a tokenizer was not chosen`);
            }

            const dataset_urls: string[] = [];
            const training_mode = mode == "new_train" || mode == "resume_train" ? "pretraining" : "finetuning";
            const datasets_saved = training_mode == "pretraining" ? pretraining_datasets : finetuning_datasets;
            const stride = sequence_length * (training_mode == "pretraining" ? pretraining_stride : finetuning_stride) || 1;

            // tokenize all datasets if not already
            for (const url in datasets_saved) {
                if (datasets_saved[url] === null) {
                    // tokenize wikipedia articles, no features because it's unstructured plain text
                    await tokenize(tokenizer_name, [], url);
                    dataset_urls.push(url);
                } else {
                    // huggingface datasets
                    for (const path of datasets_saved[url].files) {
                        const full_url = datasetFileURL(url, path);

                        await tokenize(tokenizer_name, datasets_saved[url].features, full_url);
                        dataset_urls.push(full_url);
                    }
                }
            }

            dataset = new LlmDatasetGenerator({ urls: dataset_urls });

            const total_samples = await dataset.size(sequence_length, stride, tokenizer_name);
            const generator = tf.data.generator(await dataset.generator(training_mode, sequence_length, stride, tokenizer_name)).batch(batch_size).prefetch(1);

            if (mode == "new_train" || mode == "new_finetune") {
                model_meta.model = compileModel(project_config);
            }

            prepareModel(model_meta, project_config);

            model_meta.model.fitDataset(generator, {
                epochs,
                callbacks: modelCallbacks(model_meta, Math.ceil(total_samples / batch_size), project_config.metrics_history.length)
            }).catch(error => {
                postErrorToMainThread({
                    user_msg: `An error occurred during model training.\n${error.toString()}`,
                    system_msg: error.toString(),
                    code: `model.fitDataset(<generator>, { epochs: ${epochs}, callbacks: ... })`,
                });
            });
        },


        [WorkerState.STOP]: (model_meta) => {
            model_meta.model.stopTraining = true;
            (model_meta.model as tfs.models.LlmModel).stopPredicting = true;
            self.postMessage({ state: WorkerState.STOP });
        }
    });
})();
