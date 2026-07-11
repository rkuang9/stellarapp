import { type AxiosProgressEvent } from "axios";


interface UploadProgress {
    loaded: number;
    total: number;
    part: number;
}


export const uploadModel: undefined | (({ username, project_name, model_json, weights_bin, callback }: {
    username: string;
    project_name: string;
    model_json: File;
    weights_bin: File;
    callback?: (event: UploadProgress) => void;
}) => Promise<boolean>) = undefined;


export const downloadModel: undefined | ((({ username, project_name, callback }: {
    username: string;
    project_name: string;
    callback?: ((event: AxiosProgressEvent) => void) | undefined;
}) => Promise<{ model_json: File, weights_bin: File | undefined; }>)) = undefined;
