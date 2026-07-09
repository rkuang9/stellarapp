import { ModelJsonName, ProjectType, WeightsBinName } from "@/types/project_types";

// https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
export function readableFileSize(size: number, decimals: number = 2): string {
    const i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return ((size / Math.pow(1024, i)) * 1).toFixed(decimals) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'][i];
}


export function abbreviatedCount(size: number, decimals: number = 2): string {
    const i = size < 1000 ? 0 : Math.floor(Math.log10(size) / Math.log10(1000));
    return Number((size / Math.pow(1000, i)).toFixed(decimals)) + ['', 'k', 'm', 'b', 't'][i];
}


// wait a set amount of milliseconds
export const wait = (milliseconds: number) => new Promise(res => setTimeout(res, milliseconds));


export function loginURL(redirect_to?: string) {
    return redirect_to ? `/login?redirect_to=${redirect_to}` : "/login";
}


export function userProfileURL(username: string) {
    return `/${username}`
}


export function userProfileModelsURL(username: string) {
    return `/${username}?tab=models`
}


export function userProfileStarsURL(username: string) {
    return `/${username}?tab=stars`
}


export function userProfileSettingsURL(username: string) {
    return `/${username}/settings`
}


export function modelProfileURL(username: string, project_name: string) {
    return `/${username}/${project_name}`;
}


export function modelSettingsURL(username: string, project_name: string) {
    return `/${username}/${project_name}/settings`;
}


export function modelTrainingURLGeneric(username: string, project_name: string) {
    return `/${username}/${project_name}/train`;
}


export function searchModelsURL() {
    return "/models";
}


export function newModelURL(project_type?: ProjectType) {
    return project_type ? `/new/${project_type}` : "/new";
}


export function modelTrainingURL(username: string, project_name: string, project_type: ProjectType) {
    return `/${username}/${project_name}/train/${project_type}`;
}


export function modelServingURL(username: string, project_name: string, project_type: ProjectType) {
    return `/${username}/${project_name}/train/${project_type}#inference`;
}


export function absoluteURL(relative_url: string) {
    return `${baseURL()}${relative_url}`;
}


export function isInternalURL(url: string) {
    const our_origin = process.env.NEXT_PUBLIC_WEBSITE_URL;

    if (url.startsWith('//')) {
        return false;
    }

    try {
        return new URL(url).origin == our_origin;
    } catch (error: any) {
        return true;
    }
}


export function safeURL(url: string, fallback?: string) {
    return isInternalURL(url) ? url : fallback ?? "/";
}


/* istanbul ignore next */
export function baseURL() {
    return process.env.SERVER_URL!;
}


export function discordURL() {
    return process.env.NEXT_PUBLIC_DISCORD_URL!;
}


const MODEL_SAVE_DIRECTORY: string = process.env.AWS_S3_MODELS_FOLDER as string;


export function getModelJsonPath(project_config_id: string) {
    return `${MODEL_SAVE_DIRECTORY}/${project_config_id}/${ModelJsonName}`;
}


export function getModelWeightsBinPath(project_config_id: string) {
    return `${MODEL_SAVE_DIRECTORY}/${project_config_id}/${WeightsBinName}`;
}


/**
 * Returns the index of the largest value in an array. If there are
 * multiple occurences of the max value, the first index is used.
 */
export function argMax(array: number[]): number {

    let max_position = -1;
    let max_value = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < array.length; i++) {
        if (array[i] > max_value) {
            max_value = array[i];
            max_position = i;
        }
    }

    return max_position;
}


/**
 * Returns the value clipped to a certain range. For example,
 * for min of 0 and max of 100, 9000 returns 100, -9000 returns 0,
 * and 50 returns 50
 */
export function clamp(min: number, num: number, max: number) {
    return Math.max(Math.min(num, max), min);
}


/**
 * Get a date in yyyy-mm-dd hh:mm:ss format
 */
export function toDateString(date?: Date | null, time: boolean = true) {
    if (!date) {
        return undefined;
    }

    return date.toISOString().replace("T", " ").substring(0, time ? 19 : 10);
}


export function toDateLocalString(date?: Date | null, time: boolean = true) {
    if (!date) {
        return undefined;
    }

    return (new Date(date.getTime() - (new Date()).getTimezoneOffset() * 60000))
        .toISOString().replace("T", " ").substring(0, time ? 19 : 10);
}


/* istanbul ignore next */
export function freeImage(blob_url: string): void {
    if (blob_url.startsWith("blob")) {
        URL.revokeObjectURL(blob_url);
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
    anchor.target = "_blank"
    anchor.href = link;
    anchor.click();
    anchor.remove();
}


export function getFileNameNoExtension(filename: string): string {
    const last_dot = filename.lastIndexOf(".");

    return last_dot <= 0
        ? filename // it's a nameless file like .config
        : filename.substring(0, last_dot);
}


export async function webgpuIsAvailable() {
    try {
        if (!navigator.gpu) {
            return {
                available: false,
                reason: "WebGPU is not supported by this browser"
            };
        }

        if (!await navigator.gpu.requestAdapter()) {
            return {
                available: false,
                reason: "Failed to request a WebGPU adapter. This browser supports WebGPU but may require a hidden flag to be enabled."
            };
        }

        return { available: true, reason: undefined };
    } catch (error: any) {
        return {
            available: false,
            reason: `WebGPU initialization failed: ${error.message}`
        };
    }
}