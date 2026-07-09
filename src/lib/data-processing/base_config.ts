/* istanbul ignore file */
import { LayerConfig } from "@/features/training/regression/layers/layer-types";
import ProjectTypes, { ProjectType } from "@/types/project_types";
import { Backend, Loss, Metric, Optimizer } from "@/types/hyperparameters";


// https://stackoverflow.com/questions/61132262/typescript-deep-partial
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;


export type ModelInputShape = (number | null)[];


export interface ModelConfigArgs {
    loss_fn: `${Loss}` | "";
    optimizer: `${Optimizer}` | "";
    metrics: `${Metric}`[];
    learning_rate: number;
    epochs: number;
    batch_size: number;
    backend: Backend;
    input_shape: ModelInputShape, // unbatched input_shape, null means unlimited for that dimension
    validation_split: number; // percent of dataset withheld for validation
    layers: LayerConfig[];
}


export default abstract class BaseConfig {
    // project_parent parameters
    public project_type: ProjectType | "" = "";

    public metrics_history: { [key: string]: number }[] = [];

    abstract preprocessing: Record<string, any>;

    public model: ModelConfigArgs = {
        // model config
        loss_fn: "",
        optimizer: "",
        metrics: [],
        learning_rate: 0.001,
        epochs: 1,
        batch_size: 32,
        backend: "webgpu",
        input_shape: [], // unbatched input_shape
        validation_split: 0.2, // 80% for training, 20% for validation
        layers: [],
    }


    constructor() { }


    /**
     * Load configurations from another config or from database retrieves values.
     * The child class handles calls this but handles loading preprocessing values.
     */
    public load(from_config: BaseConfig | Record<string, any>): void {
        const config = from_config as any;

        for (const key in this.model) {
            const value = config[key] ?? config.model?.[key];

            // use undefined checks instead of truthy because some values are boolean or zero
            if (value != undefined) {
                (this.model as any)[key] = structuredClone(value);
            }
        }


        for (const key in this.preprocessing) {
            const value = config[key] ?? config.preprocessing?.[key];

            if (value != undefined) {
                (this.preprocessing as any)[key] = structuredClone(value);
            }
        }

        for (const key in this) {
            if (key == "model" || key == "preprocessing" || typeof this[key] == "function") {
                continue;
            }

            if (config[key] != undefined) {
                this[key] = structuredClone(config[key]);
            }
        }

        const valid_project_types = Object.keys(ProjectTypes);

        if (!valid_project_types.includes(this.project_type)) {
            this.project_type = "";
        }
    }

    /* istanbul ignore next */
    /**
     * Save the model configurations. This does not save the serialized model.
     */
    public upload(username: string, project_name: string) {
        return fetch(`/api/1/projects/user/${username}/project/${project_name}/branch/main`, {
            method: "POST",
            body: JSON.stringify({
                project_type: this.project_type,
                ...this.model, ...this.preprocessing,
                metrics_history: this.metrics_history
            }),
        });
    }


    /* istanbul ignore next */
    public fork({ source_username, project_name, include_model }: {
        source_username: string;
        project_name: string;
        include_model: boolean;
    }) {
        return fetch(`/api/1/projects/user/${source_username}/project/${project_name}/fork`, {
            method: "POST",
            body: JSON.stringify({ include_model })
        });
    }


    /* istanbul ignore next */
    public register({ username, project_name, public_access, project_description, }: {
        username: string;
        project_name: string;
        public_access: boolean;
        project_description?: string;
    }) {
        return fetch(`/api/1/projects/user/${username}/project/${project_name}`, {
            method: "PUT",
            body: JSON.stringify({
                project_name,
                public_access,
                project_description,
                project_type: this.project_type,
            })
        })
    }
}
