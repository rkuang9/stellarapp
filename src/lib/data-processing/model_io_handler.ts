/**
 * These are save handlers that work with TFJS's model.save(), see
 * the official implementations at @tensorflow/tfjs-core/dist/io/
 * 
 * These classes allow us to save the model as a zip file and encode
 * it as string to be sent in a fetch call
 */
import { ModelArtifacts, IOHandler } from "@tensorflow/tfjs-core/dist/io/types";
import { getModelArtifactsInfoForJSON, getModelJSONForModelArtifacts } from "@tensorflow/tfjs-core/dist/io/io_utils";
import { CompositeArrayBuffer } from "@tensorflow/tfjs-core/dist/io/composite_array_buffer";
import { SaveResult } from "@tensorflow/tfjs-core/dist/io/types";

import JSZip from "jszip";

import BaseConfig from "@/lib/data-processing/base_config";
import { ModelJsonName, WeightsBinName } from "@/types/project_types";


const DEFAULT_JSON_EXTENSION_NAME = '.json';
const DEFAULT_WEIGHT_DATA_EXTENSION_NAME = '.weights.bin';
const DEFAULT_PROJECT_JSON_EXTENSION_NAME = ".json";


const DEFAULT_WEIGHT_DATA_NAME = "model";
const DEFAULT_MODEL_JSON_NAME = "model";
const DEFAULT_PROJECT_JSON_NAME = "project";


export interface ForgeModelBufferResult extends SaveResult {
	model: { [key: string]: any };
	weights: ArrayBuffer;
}


/**
 * Custom TFJS IOHandler class that generates and returns the model topology and weights.
 */
export class ForgeModelBuffer implements IOHandler {
	async save(modelArtifacts: ModelArtifacts): Promise<ForgeModelBufferResult> {
		const weightBuffer = CompositeArrayBuffer.join(modelArtifacts.weightData);

		if (modelArtifacts.modelTopology instanceof ArrayBuffer) {
			throw new Error('ForgeModelSaveBuffer.save() does not support saving model topology ' +
				'in binary formats yet.');
		}

		if (!modelArtifacts.weightSpecs) {
			throw new Error("ForgeModelSaveBuffer::save modelArtifacts.weightSpecs is null");
		}

		const weightsManifest = [{
			paths: ['./model' + DEFAULT_WEIGHT_DATA_EXTENSION_NAME],
			weights: modelArtifacts.weightSpecs!
		}];

		const modelJSON = getModelJSONForModelArtifacts(modelArtifacts, weightsManifest);

		return {
			modelArtifactsInfo: getModelArtifactsInfoForJSON(modelArtifacts),
			model: modelJSON,
			weights: weightBuffer,
		};
	}
}


/**
 * Custom TFJS IOHandler class that serializes the model and weights as string to
 * be easily moved around or saved as files. When the strings are saved as files, they
 * are identical to that of io.browserDownloads() (e.g. model.save("downloads://..."))
 * and are loadable with tf.io.browserFiles().
 * 
 * To rebuild the serialized model, read the saved files from the file system,
 * convert the buffers to utf-8 string, create file blobs using
 * Buffer.from(model_json), Buffer.from(weights_bin, "base64") and load them
 * with tf.io.browserFiles().
 */
export interface ForgeModelSerializeResult extends SaveResult {
	model_json: string;
	weights_bin: string;
}


export interface ForgeModelSerializeFileResult extends SaveResult {
	model_json: File;
	weights_bin: File;
}


export class ForgeModelSerialize implements IOHandler {
	async save(modelArtifacts: ModelArtifacts): Promise<ForgeModelSerializeResult> {
		const buffers = await new ForgeModelBuffer().save(modelArtifacts);

		return {
			modelArtifactsInfo: buffers.modelArtifactsInfo,
			model_json: JSON.stringify(buffers.model),
			weights_bin: Buffer.from(buffers.weights).toString("base64"),
		}
	}
}


export class ForgeModelSerializeFile implements IOHandler {
	async save(modelArtifacts: ModelArtifacts): Promise<ForgeModelSerializeFileResult> {
		const buffers = await new ForgeModelBuffer().save(modelArtifacts);

		return {
			modelArtifactsInfo: buffers.modelArtifactsInfo,
			model_json: new File([JSON.stringify(buffers.model)], ModelJsonName),
			weights_bin: new File([buffers.weights], WeightsBinName),
		}
	}
}


export interface ForgeSaveResult extends SaveResult {
	download_link: string;
}


/**
 * This custom TFJS IOHandler class is similar to the BrowserDownloads
 * in that it generates the model topology and weights buffer files,
 * but bundles them with the ProjectConfig into a zip file.
 * 
 * The TFJS files are included only if the model was built. Uninitialized
 * models are not included in the zip folder.
 * 
 * The blob URL can be used in an anchor tag to download the zip file.
 */
export class ForgeModelSaveZip implements IOHandler {
	public project_config: BaseConfig;
	public name: string = "project";
	protected is_built: boolean;

	constructor({ project_config, name, is_built }: {
		project_config: BaseConfig;
		name?: string;
		is_built: boolean;
	}) {
		this.is_built = is_built;

		// this is a reference/shallow copy
		this.project_config = project_config;

		if (name) {
			this.name = name;
		}
	}


	// camelCase code is from TFJS, see their implementation browser_files.js
	async save(modelArtifacts: ModelArtifacts): Promise<ForgeSaveResult> {
		const weightBuffer = CompositeArrayBuffer.join(modelArtifacts.weightData);

		if (modelArtifacts.modelTopology instanceof ArrayBuffer) {
			throw new Error('ForgeModelSave.save() does not support saving model topology ' +
				'in binary formats yet.');
		}
		else {
			if (!modelArtifacts.weightSpecs) {
				throw new Error("ForgeIOHandler::save modelArtifacts.weightSpecs is null");
			}

			const weightsManifest = [{
				paths: ['./model' + DEFAULT_WEIGHT_DATA_EXTENSION_NAME],
				weights: modelArtifacts.weightSpecs!
			}];

			const modelJSON = getModelJSONForModelArtifacts(modelArtifacts, weightsManifest);

			const zip = new JSZip();

			zip.file( // project_config file
				`${DEFAULT_PROJECT_JSON_NAME}${DEFAULT_PROJECT_JSON_EXTENSION_NAME}`,
				JSON.stringify(this.project_config, null, 2));

			if (this.is_built) {
				zip
					.file( // tfjs model json
						`${DEFAULT_MODEL_JSON_NAME}${DEFAULT_JSON_EXTENSION_NAME}`,
						JSON.stringify(modelJSON))
					.file( // tfjs weights buffer
						`${DEFAULT_WEIGHT_DATA_NAME}${DEFAULT_WEIGHT_DATA_EXTENSION_NAME}`,
						weightBuffer)
			}

			const content = await zip.generateAsync({ type: "blob" });

			return {
				modelArtifactsInfo: getModelArtifactsInfoForJSON(modelArtifacts),
				download_link: URL.createObjectURL(content),
			};
		}
	}
}


/**
 * Trigger a file download
 * 
 * @param link   URL to blob
 * @param filename   a name for the file to be downloaded
 */
export function saveAs(link: string, filename?: string) {
	const anchor = document.createElement("a");
	anchor.download = filename ? filename : "project";
	anchor.href = link;
	anchor.click();
	anchor.remove();
}


export interface ProjectUploadArgs {
	project_config?: { [key: string]: any };
	model_json?: File;
	weights_bin?: File;
}


/**
 * Parse a saved project zip file that contains a set of
 * ProjectConfig, model JSON, and weights bin files
 * 
 * @param uploaded_zip   the zip file containing the project and model files
 * @return {object}   an instance of ProjectConfig and the TFJS save files as File objects
 */
export async function parseProjectUpload(uploaded_zip: File): Promise<ProjectUploadArgs> {
	// find the project config file first, it will point
	// us to the model json and weights bin files

	let zip;

	try {
		zip = await JSZip.loadAsync(uploaded_zip);
	} catch {
		return {}
	}

	let project_config: BaseConfig | undefined = undefined;
	let model_json: File | undefined = undefined;
	let weights_bin: File | undefined = undefined;

	// find the project config file first which will lead us to
	// the model topology and model weights files

	const zip_files = Object.keys(zip.files);

	// search and validate that the project_config file is a ProjectConfig
	for (const file of zip_files) {
		// JSZip presents it as zip_file_name/actual_file_name,
		const names = file.split("/");

		if (names.pop()?.includes(`${DEFAULT_PROJECT_JSON_NAME}${DEFAULT_PROJECT_JSON_EXTENSION_NAME}`)) {
			try {
				project_config = JSON.parse(await zip.files[file].async("string"));
				break;
			} catch {
				continue;
			}
		}
	}

	if (!project_config) {
		return { project_config, model_json, weights_bin };
	}

	const model_json_name = `${DEFAULT_MODEL_JSON_NAME}${DEFAULT_JSON_EXTENSION_NAME}`;
	const weights_name = `${DEFAULT_WEIGHT_DATA_NAME}${DEFAULT_WEIGHT_DATA_EXTENSION_NAME}`;

	// find the model topology and weights buffer files
	for (const path_name in zip.files) {
		// file names are presented as zip_folder_name/actual_file_name
		const names = path_name.split("/");

		if (names.includes(model_json_name)) {
			model_json = new File([await zip.files[path_name].async("blob")], model_json_name);
		} else if (names.includes(weights_name)) {
			weights_bin = new File([await zip.files[path_name].async("blob")], weights_name);
		}
	}

	return {
		project_config, model_json, weights_bin,
	};
}


export interface ParseSerializedModelArgs {
	model_json: string;
	weights_bin: string;
}


export function parseSerializedModel({ model_json, weights_bin }: ParseSerializedModelArgs): {
	model_file: File;
	weights_file: File;
} {
	const model_buffer = Buffer.from(model_json);
	const weights_buffer = Buffer.from(weights_bin, "base64").buffer;

	const model_file = new File(
		[new Blob([model_buffer])],
		`${DEFAULT_MODEL_JSON_NAME}${DEFAULT_JSON_EXTENSION_NAME}`);

	const weights_file = new File(
		[new Blob([weights_buffer])],
		`${DEFAULT_WEIGHT_DATA_NAME}${DEFAULT_WEIGHT_DATA_EXTENSION_NAME}`);

	return { model_file, weights_file }
}