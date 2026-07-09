import { type AxiosProgressEvent } from "axios";

let uploadModel: undefined | (({ username, project_name, model_json, weights_bin, callback }: {
    username: string;
    project_name: string;
    model_json: File;
    weights_bin: File;
    callback?: ((event: { loaded: number, total: number, part: number }) => void) | undefined;
}) => Promise<boolean>)


let downloadModel: undefined | (({ username, project_name, callback }: {
    username: string;
    project_name: string;
    callback?: ((event: AxiosProgressEvent) => void) | undefined;
}) => Promise<{ model_json: File, weights_bin: File | undefined; }>)


try {
    const import_path = process.env.NEXT_PUBLIC_MODEL_IO_IMPORT!;
    const ModelIo = await import(import_path);

    downloadModel = ModelIo.downloadModel;
    uploadModel = ModelIo.uploadModel;
} catch { }


export { uploadModel, downloadModel }
