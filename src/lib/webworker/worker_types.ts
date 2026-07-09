import type BaseConfig from "@/lib/data-processing/base_config";
import { ModelInputShape } from "@/lib/data-processing/base_config";
import { TrainingBackend, Backend } from "@/types/hyperparameters";


export type TrainMode = "resume_train" | "resume_finetune" | "new_train" | "new_finetune" | "new" | "resume";
export type SegmentationDatasetArgs = { x_train: File[], y_train: File[] }


export interface WorkerTrainArgs {
	state: WorkerState.TRAIN;
	project_config: BaseConfig;
	dataset?: WorkerDatasetArgs | ArrayBuffer | SegmentationDatasetArgs;
	mode: TrainMode;
}


export interface WorkerLoadArgs {
	state: WorkerState.LOAD;
	model_json: File;
	weights_bin?: File;
	project_config: BaseConfig;
}


export interface WorkerUploadArgs {
	state: WorkerState.UPLOAD;
	username: string;
	project_name: string;
	branch: string;
}


export interface RegressionPredictResponse extends PredictResponse {
	prediction: number[][];
}


export interface SegmentationPredictArgs {
	state: WorkerState.PREDICT,
	inputs: File,
	backend: keyof typeof TrainingBackend;
	batch_size: number;
	depth: number;
	/**
	 * Apply postprocessing to make it visual, such as scaling up to 255 for binary segmentation or using color palette for multi-class segmentation
	 */
	colorize?: boolean;
}


export interface SegmentationPredictResponse extends PredictResponse {
	state: WorkerState.PREDICT;
	prediction: File;
}


export interface ImagePredictArgs {
	state: WorkerState.PREDICT,
	inputs: Blob[],
	backend: keyof typeof TrainingBackend;
	batch_size: number;
	input_shape: ModelInputShape; // [height, width, channels]
}


export interface ImagePredictResponse extends PredictResponse {
	state: WorkerState.PREDICT;
	prediction: number[][];
}


export interface WorkerPredictArgs {
	state: WorkerState.PREDICT,
	inputs: number[][] | number[][][][] | Blob[] | Blob;
	backend: Backend;
	batch_size: number;
}


export interface WorkerDownloadArgs {
	state: WorkerState.SERIALIZE,
	project_config: BaseConfig;
	download_name?: string;
}


export interface WorkerImageDatasetArgs {
	state: WorkerState.IMAGE_DATASET;
	dataset: ArrayBuffer;
}


export interface WorkerStopArgs {
	state: WorkerState.STOP;
}


export interface WorkerErrorArgs {
	state: WorkerState.ERROR;
	message: string;
	[key: string]: number | string
}


export enum WorkerState {
	// command to web worker
	INITIALIZE = 2,
	TRAIN = 1,
	STOP = 4,
	PREDICT = 6,
	LOAD = 200,
	SERIALIZE = 201,
	UPLOAD = 202,
	IMAGE_DATASET = 203,

	// web worker replies
	TRAIN_START = 100,
	TRAIN_END = 101,
	BATCH_END = 102,
	EPOCH_BEGIN = 103,
	EPOCH_END = 104,
	GENERATE_END = 105,
	VAL_BATCH_END = 106,

	RESET = 400,

	// errors
	ERROR = 9000,

	// for fear of falsy comparisons
	DO_NOT_USE_ZERO = 0,
}


export interface WorkerDatasetArgs {
	x_train: number[][];
	y_train: number[][];
	x_val?: number[][];
	y_val?: number[][];
}


export interface TrainStartResponse {
	state: WorkerState.TRAIN_START;
	parameters: number;
	backend: string;
}


export interface ErrorResponse {
	state: WorkerState.ERROR;
	message: string;
}


export interface DownloadResponse {
	state: WorkerState.SERIALIZE;
	download_link: string;
}


export interface LoadResponse {
	state: WorkerState.LOAD;
	parameters: number;
}


export interface StopResponse {
	state: WorkerState.STOP;
}


export interface UploadResponse {
	progress: number;
	state: WorkerState.UPLOAD;
	username: string;
	project_name: string;
	parameters: number;
}


export interface PredictResponse {
	state: WorkerState.PREDICT;
	prediction: number[][] | number[][][] | number[][][][] | File;
}
