import type ProjectConfig from "@/lib/data-processing/project_config";
import { ImagePredictArgs, WorkerDatasetArgs, WorkerState, WorkerTrainArgs } from "@/lib/webworker/worker_types";
import { TrainMode } from "@/lib/webworker/worker_types";
import BaseModelWorker from "@/lib/webworker/base_client";


export default class ImageModelWorker extends BaseModelWorker {

    constructor(project_config: ProjectConfig) {
        super(project_config, new Worker(new URL("@/lib/webworker/image_worker", import.meta.url)));
    }


    public override async predict({ inputs, input_shape, backend, batch_size }: Omit<ImagePredictArgs, "state">): Promise<number[][]> {
        const promise = this.registerListener("predict");

        const predict_data: ImagePredictArgs = {
            state: WorkerState.PREDICT, inputs, backend, batch_size, input_shape
        }

        this.worker.postMessage(predict_data);

        return promise;
    }


    public async train({ project_config, dataset, mode, }: Omit<WorkerTrainArgs, "state">): Promise<{ state: WorkerState; metrics?: { [key: string]: number; }; }> {
        const train_data: WorkerTrainArgs = {
            state: WorkerState.TRAIN, dataset, project_config, mode
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


    public override isChanged(project_config: ProjectConfig): boolean {
        if (Object.keys(this.project_config_frozen).length == 0) {
            // nothing was saved meaning nothing changed because it's new
            return false;
        }

        const replacer = (key: string, value: any) => {
            return key == "metrics" || key == "epochs" || key == "metrics_history" ||
                key == "learning_rate" || key == "use_gpu" ||
                key == "backend" || key == "batch_size" || !value || value.length == 0 ||
                (typeof value == "object" && Object.keys(value).length == 0)
                ? undefined : value;
        }

        return JSON.stringify(this.project_config_frozen, replacer) !=
            JSON.stringify(project_config, replacer);
    }


    public override reset(project_config: ProjectConfig): void {
        super.reset(project_config, new Worker(new URL("@/lib/webworker/image_worker", import.meta.url)));
    }
}
