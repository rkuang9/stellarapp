import { DATASET_CACHE_NAME } from "@/lib/data-processing/tokenization_pipeline";
import { downloadFile, listFiles, ListFileEntry } from "@huggingface/hub";


export const SupportedMimeTypes: Record<string, string> = {
    "txt": "text/plain",
    "json": "application/json",
    "jsonl": "application/jsonl",
    "parquet": "application/vnd.apache.parquet",
}


export function isSupportedFileType(extension: string) {
    if (!extension) {
        return false;
    }

    return SupportedMimeTypes[extension] != undefined;
}


export interface DatasetSchema {
    description: string,
    citation: string,
    homepage: string,
    license: string,
    features: {
        [field: string]: { dtype: string, _type: string } // flat structure
        | { feature: { dtype: string, _type: string } } |
        { [field: string]: { dtype: string, _type: string } }[], // conversation
    },
    builder_name: string,
    dataset_name: string,
    config_name: string;
    version: { version_str: string, major: number, minor: number, patch: number },
    splits: {
        train?: {
            name: "train",
            num_bytes: number,
            num_examples: number,
            dataset_name: string | null
        },
        validation?: {
            name: "validation",
            num_bytes: number,
            num_examples: number,
            dataset_name: string | null
        },
        test?: {
            name: "test",
            num_bytes: number,
            num_examples: number,
            dataset_name: string | null
        }

    },
    download_size: number,
    dataset_size: number,
}


export type FeatureDefinition = Exclude<DatasetSchema["features"][string], any[] | { feature: any }>;

export interface DatasetInfoResponse {
    dataset_info: {
        // If only 1, it'll be named `default`
        [dataset_name: string]: DatasetSchema
    }
    pending: [],
    failed: [],
    partial: boolean,
}


export type FeaturePath = string[]// { path: string[], dtype: string };


export function getFeaturesList(metadata: DatasetInfoResponse) {
    const feature_paths: string[][] = [];

    for (const subdataset in metadata.dataset_info) {
        const feature_list = metadata.dataset_info[subdataset].features;
        const feature_names = Object.keys(feature_list);

        for (const name of feature_names) {
            const feature = feature_list[name];

            if (Array.isArray(feature)) { // conversation structure
                const conversation_features = feature[0];

                for (const role_name in conversation_features) {
                    feature_paths.push([subdataset, name, role_name]);
                }
            } else if ("feature" in feature) { // nested object? So far only seen in parquet datasets
                feature_paths.push([subdataset, name, "feature"]);
            } else { // flat structure
                feature_paths.push([subdataset, name])
            }
        }
    }

    return feature_paths;
}


export async function getSchema(url: string): Promise<DatasetInfoResponse> {
    const { type, owner, name } = parseDatasetURL(url);

    if (type != "datasets" || !owner || !name) {
        throw Error(`The URL ${url} does not belong to a Huggingface dataset`);
    }

    const endpoint = `https://datasets-server.huggingface.co/info?dataset=${owner}/${name}`;
    const response = await fetch(endpoint, { method: "GET" });

    return await response.json();
}


/**
 * Get a list of dataset files from a Huggingface dataset URL or subfolder URL
 */
export async function getFileList(url: string) {
    const { type, owner, name, path } = parseDatasetURL(url);

    if (type != "datasets" || !owner || !name) {
        throw Error(`The URL ${url} does not belong to a Huggingface dataset`);
    }

    const files = listFiles({
        repo: `datasets/${owner}/${name}`,
        path,
        recursive: path == undefined
    });

    const file_list: ListFileEntry[] = [];

    let file = await files.next();

    while (!file.done) {
        file_list.push(file.value);
        file = await files.next();
    }

    return file_list;
}


export function parseDatasetURL(url: string): {
    type?: string;
    owner?: string;
    name?: string;
    git?: string;
    branch?: string;
    path?: string;
} {
    try {
        const link = new URL(url);

        if (link.hostname != "huggingface.co") {
            throw Error(`Not a Huggingface dataset URL: ${url}`);
        }

        const parts = link.pathname.split("/").filter(Boolean);

        if (parts.length == 3) {
            // url is the base repo address (no subfolders, no blob/tree/)
            const [type, owner, name] = parts;
            return { type, owner, name }
        }

        const [type, owner, name, git, branch, ...directory] = parts;

        if (branch && branch != "main") {
            throw Error(`Only main branches are supported`);
        }

        if (git && git != "tree" && git != "blob") {
            throw Error(`Unknown term "${git}" (did you mean "tree" or "blob"?) in the URL ${url}`);
        }


        const path = directory.join("/");

        return { type, owner, name, git, branch, path: path || undefined }
    } catch (error) {
        throw error;
    }
}


/**
 * Removes the file name and extension from the URL if it exists.
 * Ensures the URL is the base dataset path or a folder path.
 */
export function cleanDatasetURL(url: string) {
    const { owner, name, git, branch, path } = parseDatasetURL(url);

    let cleaned_url = url;

    if (path) {
        // check that the last path is a file, if the file extension is supported
        // then remove it form the URL, the user will manually select the file
        const path_segments = path.split("/");
        const file_extension = path_segments.at(-1)?.split(".").at(-1);

        if (file_extension && isSupportedFileType(file_extension)) {
            path_segments.pop();

            if (path_segments.length == 0) {
                // there is no folder, so just use the base path
                return `https://huggingface.co/datasets/${owner}/${name}`;
            }

            cleaned_url = cleaned_url.replace(path, path_segments.join("/"))
        }
    } else if (owner && name) {
        cleaned_url = `https://huggingface.co/datasets/${owner}/${name}`;

        if (git && branch) {
            cleaned_url = `${cleaned_url}/${git}/${branch}`;
        }
    }

    return cleaned_url;
}


export function datasetBaseURL(url: string) {
    const { type, owner, name } = parseDatasetURL(url);

    if (type != "datasets") {
        throw Error(`Not a Huggingface dataset URL: ${url}`);
    }

    return `https://huggingface.co/datasets/${owner}/${name}`;
}


export function datasetFileURL(url: string, path: string, branch?: string) {
    return `${datasetBaseURL(url)}/blob/${branch ?? "main"}/${path}`;
}


/**
 * Downloads a Huggingface dataset if it doesn't already exist in CacheStorage.
 * 
 * @param url the base URL of the huggingface dataset, ending with `/owner_name/dataset_name`
 * @param paths the paths of the individual files to download, typically after `/blob/main`
 * @param cache_name the cache name to store the downloaded Blob under
 * @param options.abort an Abort Controller to cancel an in-progress download
 */
export async function downloadHFDatasetToCache(url: string, paths: string[], options?: { abort?: AbortController, overwrite?: boolean, cacheName?: string }) {
    const { abort, overwrite, cacheName: cache_name = DATASET_CACHE_NAME } = options ?? {};

    for (const path of paths) {
        const link = datasetFileURL(url, path);

        if (cache_name && !overwrite) {
            // fetch from CacheStorage
            const cache = await caches.open(cache_name);
            const cached_file = await cache.match(link);

            if (cached_file) {
                continue;
            }
        }

        const { type, owner, name } = parseDatasetURL(link);

        if (type != "datasets" || !path) {
            throw Error(`Unable to download the Huggingface dataset ${link}. It is not a valid dataset file or the exact file path is invalid.`);
        }

        const extension = path.split(".").at(-1);

        if (!extension || !isSupportedFileType(extension)) {
            throw Error(`Unsupported dataset format. Supported formats are: ${Object.entries(SupportedMimeTypes).map(type => `${type[0]} (${type[1]})`).join(", ")}`);
        }

        try {
            const response = await downloadFile({
                repo: `datasets/${owner}/${name}`,
                path,
                fetch: (input, init) => {
                    return fetch(input, { ...init, signal: abort?.signal });
                }
            });

            if (response) {
                if (cache_name) {
                    // save to CacheStorage
                    const cache = await caches.open(cache_name);
                    const data_stream = response.stream();

                    await cache.put(link, new Response(data_stream, {
                        headers: {
                            "content-type": SupportedMimeTypes[extension],
                            retrieved: new Date().toISOString(),
                            "Tokenized": "false"
                        }
                    }));
                }
            }
        } catch (error: any) {
            throw Error(`Failed to download the Huggingface dataset ${link}. Error: ${error.toString()}`);
        }
    }
}
