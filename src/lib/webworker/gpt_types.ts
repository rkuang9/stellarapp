import { TrainMode, WorkerState } from "@/lib/webworker/worker_types";
//import type ProjectConfig from "@/lib/data-processing/project_config";
import { Tokenizer } from "@/lib/data-processing/nlp_sources";
import { type LLMConfig } from "@/lib/data-processing/llm_config";


export interface GPTWorkerTrainArgs {
    state: WorkerState.TRAIN;
    mode: TrainMode;
    project_config: LLMConfig;
}


export interface GPTWorkerStopArgs {
    state: WorkerState.STOP;
}


export interface GPTPredictArgs {
    state: WorkerState.PREDICT;
    chat: string;
    is_new: boolean;
    backend: string;
    tokenizer: Tokenizer;
    cache_size: number;
}


export interface GPTPredictResponse {
    state: WorkerState.PREDICT;
    next_token: string;
}


export interface GPTPredictFinishResponse {
    state: WorkerState.GENERATE_END;
    cache_full: boolean;
}


export interface GPTDownloadArgs {
    state: WorkerState.SERIALIZE;
    project_config: LLMConfig;
    download_name: string;
}


export interface GPTResetArgs {
    state: WorkerState.RESET;
}
