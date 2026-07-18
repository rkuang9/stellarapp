import React from "react";

import { ListFileEntry } from "@huggingface/hub";
import {
    getFeaturesList,
    getFileList,
    getSchema,
    isSupportedFileType,
    parseDatasetURL
} from "@/lib/data-processing/huggingface_datasets";


export function useHuggingfaceDatasetSchema() {
    const request_id = React.useRef<number>(0); // to prevent stale updates on fast URL changes

    const [features, setFeatures] = React.useState<string[]>([]);
    const [files, setFiles] = React.useState<ListFileEntry[]>([]);

    const [loading_features, setLoadingFeatures] = React.useState<boolean>(false);
    const [loading_files, setLoadingFiles] = React.useState<boolean>(false);
    const [fetch_error, setFetchError] = React.useState<string>("");

    const clear = () => {
        setFetchError("");
        setFiles([]);
        setFeatures([]);
    }

    const load = async (new_url: string) => {
        const id = ++request_id.current;

        setFetchError("");
        setFiles([]);
        setFeatures([]);

        if (!new_url) {
            return;
        }

        const { type, owner, name } = parseDatasetURL(new_url);

        if (type != "datasets" || !owner || !name) {
            return
        };

        setLoadingFeatures(true);

        getSchema(new_url).then(schema => {
            if (id !== request_id.current) {
                // prevent stale update
                return;
            };

            const features = getFeaturesList(schema);

            if (!features.length) {
                throw Error("No features were found in this dataset");
            }

            // using <path> as a delimiter instead of "." because datasets use periods as a key
            setFeatures(features.map(feature => feature.join("<path>")));
        }).catch(error => {
            if (id !== request_id.current) {
                return;
            }

            setFetchError(error.toString());
        }).finally(() => {
            if (id === request_id.current) {
                setLoadingFeatures(false);
            }
        });

        setLoadingFiles(true);

        getFileList(new_url).then(file_list => {
            if (id !== request_id.current) {
                return;
            }

            const dataset_files = file_list.filter(file => {
                const extension = file.path.split(".").at(-1);
                return file.type == "file" && extension && isSupportedFileType(extension);
            });


            if (dataset_files.length == 0) {
                throw Error("No supported files were found in this dataset");
            }

            setFiles(dataset_files);
        }).catch(err => {
            if (id !== request_id.current) return;
            setFetchError(err.toString());
        }).finally(() => {
            if (id === request_id.current) {
                setLoadingFiles(false);
            }
        });
    };

    return {
        files, loading_files,
        features, loading_features,
        fetch_error,
        load,
        clear
    };
}
