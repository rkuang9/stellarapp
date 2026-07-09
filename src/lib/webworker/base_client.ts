import {
    WorkerState,
    WorkerLoadArgs,
    WorkerDownloadArgs,
    WorkerUploadArgs,
    WorkerErrorArgs,
    DownloadResponse,
    ErrorResponse,
    LoadResponse,
    StopResponse,
    UploadResponse,
    PredictResponse,
    WorkerTrainArgs,
} from "@/lib/webworker/worker_types";
import BaseConfig from "@/lib/data-processing/base_config";


type tfLogs = {
    [key: string]: number;
};


interface Callbacks {
    handler: (event: MessageEvent<any>) => void;
    // response types are set in the origin function
    then: (response?: any) => void;
    catch: (response?: any) => void;
    // since then and catch may only be called once, this stores a re-runable callback
    callback?: (response?: any) => void;
}


/**
 * Important: All addEventListener() calls must be paired with a 
 * removeEventListener in the promise resolve function.
 */
export default abstract class BaseModelWorker {
    //protected worker_source: URL;
    public worker: Worker;
    protected is_training = false;
    protected built = false;
    protected project_config_frozen: { [key: string]: any } = {};
    protected model_size?: number;

    public onInitialize?: () => void;
    public onEpochStart?: () => void;
    public onBatchEnd?: (metrics: tfLogs) => void;
    public onValBatchEnd?: (metrics: tfLogs) => void;
    public onEpochEnd?: (metrics: tfLogs) => void;
    public onTrain?: (result: { state: WorkerState; metrics?: tfLogs; summary?: { [key: string]: number | string }, parameters?: number, backend?: string }) => void;
    public onTrainEnd?: (metrics: tfLogs) => void
    public onTrainError?: (error: WorkerErrorArgs) => void;


    constructor(project_config: BaseConfig, worker: Worker) {
        this.worker = worker;
        this.setProjectConfigChange(project_config);
    }


    /* abstract functions that must be implemented by child classes */

    /**
     * Make one inference
     */
    public abstract predict(args: any): Promise<number[][] | number[][][] | number[][][][] | File>;


    /**
     * Pass model inputs and start training
     */
    public abstract train(args: Omit<WorkerTrainArgs, "state">): Promise<{ state: WorkerState, metrics?: tfLogs }>;


    /**
     * Check if a project_config changed since the last time it was trained or loaded
     */
    public abstract isChanged(project_config: BaseConfig): boolean;


    /* common functions and properties */

    public promises: { [key: string]: Callbacks } = {
        predict: {
            handler: (event: MessageEvent<PredictResponse | ErrorResponse>) => {
                if (event.data.state == WorkerState.PREDICT) {
                    this.promises.predict.then(event.data.prediction);
                } else if (event.data.state == WorkerState.ERROR) {
                    this.promises.predict.catch(event.data.message);
                }
                this.deregisterListener("predict");
            },
            then: () => { },
            catch: () => { },
        },
        download: {
            handler: (event: MessageEvent<DownloadResponse | ErrorResponse>) => {
                if (event.data.state == WorkerState.SERIALIZE) {
                    this.promises.download.then(event.data.download_link);
                } else if (event.data.state == WorkerState.ERROR) {
                    this.promises.download.catch(event.data.message);
                }
                this.deregisterListener("download");
            },
            then: () => { },
            catch: () => { }
        },
        upload: {
            handler: (event: MessageEvent<UploadResponse | ErrorResponse>) => {
                if (event.data.state == WorkerState.UPLOAD) {
                    if (event.data.progress == 1) {
                        this.promises.upload.then(event.data);
                        this.deregisterListener("upload");
                    } else {
                        this.promises.upload.callback?.({ progress: event.data.progress });
                    }
                } else if (event.data.state == WorkerState.ERROR) {
                    this.promises.upload.catch(event.data.message);
                    this.deregisterListener("upload");
                }
            },
            then: () => { },
            catch: () => { },
        },
        load: {
            handler: (event: MessageEvent<LoadResponse | ErrorResponse>) => {
                if (event.data.state == WorkerState.LOAD) {
                    this.built = true;
                    this.promises.load.then(event.data);
                } else if (event.data.state == WorkerState.ERROR) {
                    this.promises.load.catch(event.data.message);
                }
                this.deregisterListener("load");
            },
            then: () => { },
            catch: () => { },
        },
        stop: {
            handler: (event: MessageEvent<StopResponse & any | ErrorResponse>) => {
                this.is_training = false; // might need to put inside if

                if (event.data.state == WorkerState.STOP ||
                    event.data.state == WorkerState.BATCH_END ||
                    event.data.state == WorkerState.EPOCH_END) {
                    this.promises.stop.then();
                } else if (event.data.state == WorkerState.ERROR) {
                    this.promises.stop.catch(event.data.message);
                }

                this.deregisterListener("stop");
            },
            then: () => { },
            catch: () => { },
        }
    }


    protected registerListener = (callback_name: string): any => {
        if (!this.promises[callback_name]) {
            throw Error(`BaseModelWorker.registerListener: Callback ${callback_name} not found`);
        }

        this.worker.removeEventListener("message", this.promises[callback_name].handler);
        this.worker.addEventListener("message", this.promises[callback_name].handler);

        return new Promise((resolve, reject) => {
            this.promises[callback_name].then = resolve;
            this.promises[callback_name].catch = reject;
        });
    }


    protected deregisterListener = (callback_name: string): any => {
        this.worker.removeEventListener("message", this.promises[callback_name].handler);
    }


    /**
     * Instruct webworker to save its model architecture, weights, and the project_config
     * into a zip file blob and generate a download link for it.
     */
    public async serialize(project_config: BaseConfig, download_name?: string): Promise<string> {
        const promise = this.registerListener("download");

        const download_data: WorkerDownloadArgs = {
            state: WorkerState.SERIALIZE,
            project_config, download_name
        };

        this.worker.postMessage(download_data);

        return promise;
    }


    protected onTrainHandler = (event: MessageEvent<any>) => {
        const { state, metrics, summary, parameters, backend } = event.data;

        switch (state) {
            case WorkerState.BATCH_END: {
                if (this.onBatchEnd) {
                    this.onBatchEnd(metrics);
                }
                break;
            }

            case WorkerState.VAL_BATCH_END: {
                if (this.onValBatchEnd) {
                    this.onValBatchEnd(metrics);
                }
                break;
            }

            case WorkerState.EPOCH_END: {
                this.is_training = false;
                this.onEpochEnd?.(metrics);
                break;
            }

            case WorkerState.EPOCH_BEGIN: {
                this.is_training = true;
                this.onEpochStart?.();
                break;
            }

            case WorkerState.TRAIN_START: {
                this.built = true;
                this.is_training = true;

                if (parameters != undefined) {
                    this.model_size = parameters;
                }

                this.onTrain?.({ state, parameters, backend });
                break;
            }

            case WorkerState.TRAIN_END: {
                this.is_training = false;
                this.onTrainEnd?.(metrics);
                this.worker.removeEventListener("message", this.onTrainHandler);
                break;
            }

            case WorkerState.INITIALIZE: {
                this.onInitialize?.();
                break;
            }

            case WorkerState.ERROR: {
                this.is_training = false;
                this.onTrainError?.(event.data.message);
                break;
            }
        }
    }


    /**
     * Send a saved TFJS model to the webworker to load.
     * 
     * @param model_json   the model.json file
     * @param weights_bin   the model.weights.bin file if any
     * @param project_config   the project_config instance used to create the TFJS model
     * @returns 
     */
    public async load({ model_json, weights_bin, project_config }: {
        model_json: File,
        weights_bin?: File,
        project_config: BaseConfig
    }): Promise<{ parameters: number }> {
        const promise = this.registerListener("load");

        const load_data: WorkerLoadArgs = {
            state: WorkerState.LOAD,
            model_json, weights_bin, project_config
        };

        if (project_config) {
            this.setProjectConfigChange(project_config);
        }

        this.worker.postMessage(load_data);
        return promise;
    }


    /**
     * Instruct the webworker to serialize the model architecture and its weights
     * and save to the server.
     * 
     * @param username   logged in user's username
     * @param project_name   the project's name
     * @param branch    the project's branch
     */
    public async upload({ username, project_name, callback }: {
        username: string,
        project_name: string,
        callback?: ({ }: { progress: number }) => void;
    }): Promise<{ progress: number, parameters: number }> {
        const promise = this.registerListener("upload");
        this.promises.upload.callback = callback;

        const upload_data: WorkerUploadArgs = {
            state: WorkerState.UPLOAD,
            username, project_name, branch: "main",
        }

        this.worker.postMessage(upload_data);
        return promise;
    }


    /**
     * Stop the webworker from training. This sets the model.stopTraining flag to true
     * and does not wait for the model to stop. The model will complete its current batch
     * and continues as if the epoch and training finished.
     */
    public stop(): Promise<void> {
        const promise = this.registerListener("stop");
        this.worker.postMessage({ state: WorkerState.STOP });

        return promise;
    }


    public isTraining(): boolean {
        return this.is_training;
    }


    public isBuilt(): boolean {
        return this.built;
    }


    /**
     * Dispose of the current webworker and create a new one. The provided
     * project_config becomes the new baseline.
     * 
     */
    public reset(project_config: BaseConfig, worker?: Worker): void {
        this.worker.terminate();

        if (worker) {
            this.worker = worker;
        }

        this.model_size = undefined;
        this.built = false;
        this.is_training = false;

        this.setProjectConfigChange(project_config);
    }


    /**
     * Sets the local project_config copy to be used for comparison
     * with a current project_config.
     * 
     */
    protected setProjectConfigChange(project_config: BaseConfig) {
        this.project_config_frozen = JSON.parse(
            JSON.stringify(project_config));
    }


    public get size() {
        return this.model_size;
    }
}
