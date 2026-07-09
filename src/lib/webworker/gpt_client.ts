import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { WorkerErrorArgs, WorkerState, WorkerStopArgs } from "@/lib/webworker/worker_types";
import { GPTPredictArgs, GPTPredictFinishResponse, GPTPredictResponse, GPTWorkerTrainArgs } from "@/lib/webworker/gpt_types";
import { TrainMode } from "@/lib/webworker/worker_types";
import type { LayerConfig } from "@/features/training/regression/layers/layer-types";
import BaseModelWorker from "@/lib/webworker/base_client";
import { Tokenizer } from "@/lib/data-processing/nlp_sources";
import { Backend } from "@/types/hyperparameters";


export default class GPTModelWorker extends BaseModelWorker {
    protected is_predicting: boolean = false;

    public onPredict?: (next_token: string) => void;
    public onPredictError?: (error: string) => void;
    public onFinish?: (cache_full: boolean) => void;


    constructor(project_config: LLMConfig) {
        super(project_config, new Worker(new URL("@/lib/webworker/gpt_worker", import.meta.url)));
    }


    public override async train({ project_config, mode = "new_train" }: {
        project_config: LLMConfig;
        mode: TrainMode;
    }): Promise<{
        state: WorkerState;
        parameters?: number;
        backend?: string;
    }> {
        this.is_predicting = false;

        const train_data: GPTWorkerTrainArgs = {
            state: WorkerState.TRAIN, project_config, mode
        };

        this.setProjectConfigChange(project_config);
        this.is_training = true;

        this.worker.removeEventListener("message", this.onTrainHandler);
        this.worker.addEventListener("message", this.onTrainHandler);
        this.onInitialize?.();
        this.worker.postMessage(train_data);

        return new Promise((resolve, reject) => {
            this.onTrain = resolve;
            this.onTrainError = reject;
        });
    }


    public override reset(project_config: LLMConfig): void {
        super.reset(project_config, new Worker(new URL("@/lib/webworker/gpt_worker", import.meta.url)));
        this.is_predicting = false;
    }


    override isChanged(project_config: LLMConfig): boolean {
        if (Object.keys(this.project_config_frozen).length == 0) {
            // nothing was saved meaning nothing changed because it's new
            return false;
        }

        const replacer = (key: string, value: any) => {
            return key == "metrics" || key == "epochs" || key == "metrics_history" ||
                key == "learning_rate" || key == "use_gpu" ||
                key == "backend" || key == "batch_size" ||
                key == "pretraining_stride" || key == "finetuning_stride" ||
                key == "finetuning_datasets" || key == "pretraining_datasets" ||
                key == "sequence_length" ||
                !value || value.length == 0 ||
                (typeof value == "object" && Object.keys(value).length == 0)
                ? undefined : value;
        }

        return JSON.stringify(this.project_config_frozen, replacer) !=
            JSON.stringify(project_config, replacer);
    }


    public isPredicting() {
        return this.is_predicting;
    }


    protected onPredictHandler = (event: MessageEvent<GPTPredictResponse | WorkerStopArgs | GPTPredictFinishResponse | WorkerErrorArgs>) => {
        const state = event.data.state;

        if (state == WorkerState.PREDICT) {
            this.onPredict?.(event.data.next_token);
        } else if (state == WorkerState.STOP) {
            this.is_predicting = false;
            this.onFinish?.(false);
        } else if (state == WorkerState.GENERATE_END) {
            this.is_predicting = false;
            this.onFinish?.(event.data.cache_full);
        } else if (state == WorkerState.ERROR) {
            this.is_predicting = false;
            this.onPredictError?.(event.data.message);
        }
    }


    /**
     * @param chat the chat history, it should be already prepared/formatted
     * @returns 
     */
    public async generate({ chat, backend, tokenizer, cacheSize, isNew }: {
        chat: string;
        backend: Backend;
        tokenizer: Tokenizer;
        cacheSize: number;
        isNew: boolean;
    }) {
        this.worker.removeEventListener("message", this.onPredictHandler);
        this.worker.addEventListener("message", this.onPredictHandler);
        this.is_predicting = true;

        this.worker.postMessage({
            state: WorkerState.PREDICT,
            chat, backend, tokenizer, cache_size: cacheSize, is_new: isNew
        } satisfies GPTPredictArgs);

        return new Promise((resolve, reject) => {
            // the this.onPredict resolve must be manually set
            this.onPredictError = reject;
        });
    }


    // use generate() instead of predict()
    override predict(args: any): Promise<number[][]> {
        throw Error("GPTModelWorker.predict: use generate() instead of predict()")
    }
}
