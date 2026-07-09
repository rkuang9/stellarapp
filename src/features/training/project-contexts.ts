import React from "react";
import ProjectConfig, { type PreprocessingArgs } from "@/lib/data-processing/project_config";
import { ModelConfigArgs } from "@/lib/data-processing/base_config";
import BaseModelWorker from "@/lib/webworker/base_client";
import BaseConfig from "@/lib/data-processing/base_config";
import { type AxiosProgressEvent } from "axios";


export interface ProjectContextArgs {
    meta: {
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    };
    project_config: BaseConfig;
    worker?: BaseModelWorker;
    cache: {
        // load holds values just momentarily from project load and
        // the value must be cleared once used, it is used to avoid
        // fancy/complicated logic for loading project_config values
        // that exist as a React string state
        load: {
            [key in keyof (ModelConfigArgs & PreprocessingArgs & ProjectConfig)]?: (ModelConfigArgs & PreprocessingArgs & ProjectConfig)[key];
        }
        [key: string]: any;
        cloud_model_state?: "can_download" | "downloaded" | "declined" | "error"
    },
    full_render: () => void;
    /* downloadModel?: ({ username, project_name, callback }: {
        username: string; project_name: string; callback?: (event: AxiosProgressEvent) => void;
    }) => Promise<{ model_json: File, weights_bin: File | undefined }> */
}


export const ProjectContext = React.createContext<ProjectContextArgs>({
    meta: {},
    project_config: new ProjectConfig(),
    worker: undefined,
    cache: { load: {} },
    full_render: () => { }
});


export function useProject<C extends BaseConfig = BaseConfig, W extends BaseModelWorker = BaseModelWorker>() {
    const context = React.useContext(ProjectContext);

    if (!context) {
        throw new Error("useProject must be used within a ProjectContext");
    }

    return {
        meta: context.meta,
        project_config: context.project_config as C,
        worker: context.worker as W | undefined,
        cache: context.cache,
        full_render: context.full_render
    };
}
