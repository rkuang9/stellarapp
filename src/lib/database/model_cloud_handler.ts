import { type AxiosProgressEvent } from "axios";


interface UploadProgress {
    loaded: number;
    total: number;
    part: number;
}


export async function uploadModel({ username, project_name, model_json, weights_bin, callback }: {
    username: string;
    project_name: string;
    model_json: File;
    weights_bin: File;
    callback?: (event: UploadProgress) => void;
}) {
    throw Error("Model uploading not supported");
}


export async function downloadModel({ username, project_name, callback }: {
    username: string;
    project_name: string;
    callback?: (event: AxiosProgressEvent) => void;
}) {
    throw Error("Model downloading not supported");
}