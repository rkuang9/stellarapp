/* istanbul ignore file */
import { ProjectType } from "@/types/project_types";
import { FinetuneDataset, Tokenizer } from "@/lib/data-processing/nlp_sources";
import BaseConfig, { ModelInputShape } from "@/lib/data-processing/base_config";


export interface PreprocessingArgs {
    input_cols: string[];
    target_cols: string[];
    scale_cols: MinMaxScaleArgs;
    zscore_cols: ZScoreArgs;
    vocab_size: number;
    sentence_length: number;
    filters: { column: string, operator: string, value: string | number }[];
    dummy_variables: DummyArgs;
    onehot_encoding: { [key: string]: number };
    finetune: FinetuneDataset[];
    tokenizer: Tokenizer | "";
}


export interface OneHotEncodingArgs {
    [key: string]: number;
}


export interface DummyArgs {
    [key: string]: {
        uniques: string[];
        trap_drop?: string
    }
}


export interface MinMaxScaleArgs {
    [key: string]: {
        min: number,
        max: number
    } | "placeholder";
}


export interface ZScoreArgs {
    [key: string]: {
        mean: number,
        std: number // population standard deviation (not sample std`)
    } | "placeholder";
}


export type InputShapeArgs = ModelInputShape;

export const DEFAULT_VALIDATION_SPLIT = 0.2; // 80% train, 20% validation


export default class ProjectConfig extends BaseConfig {

    public override preprocessing: PreprocessingArgs = {
        input_cols: [],
        target_cols: [],
        scale_cols: {},
        zscore_cols: {},
        vocab_size: 0, // output_sequence_length in keras
        sentence_length: 100, // max_tokens in keras
        filters: [],
        dummy_variables: {},
        onehot_encoding: {}, // maps a class to an integer (e.g. { apple: 0, orange: 1, peach: 2 })
        finetune: [], // official name of the finetuning datasets supported in ./dataset_llm.ts
        tokenizer: ""
    }


    constructor({ load }: { load?: ProjectConfig | { [key: string]: any } } = {}) {
        super();

        if (load) {
            this.load(load);
        }
    }


    public load(project_config: ProjectConfig | { [key: string]: any }, dtypes?: { [key: string]: string }): void {
        super.load(project_config);
        this.fixColumns({ dtypes });
    }


    /**
     * Fix column inaccuracies in preprocessing such as removing scale columns
     * if they aren't selected as an input or target column
     * 
     * @param dtypes a column to data type mapping
     * @param pretrain indicates that this is running right before training
     */
    public fixColumns({ dtypes, pretrain }: { dtypes?: { [key: string]: string }, pretrain?: boolean } = {}): void {
        if (dtypes) {
            // ensure that if there is string output column is selected, it is the only one selected
            const string_output_cols = this.preprocessing.target_cols.filter(
                col => dtypes[col] == "string");

            if (string_output_cols.length > 1 ||
                string_output_cols.length == 1 && this.preprocessing.target_cols.length > 1) {
                // if multiple string columns or mixed with other types, reset it
                this.preprocessing.target_cols = [];
            }

            if (this.preprocessing.input_cols.filter(col => dtypes[col] == "string").length == 0) {
                this.preprocessing.dummy_variables = {};
            }
        }

        if (this.project_type != "tabular_regression") {
            this.preprocessing.dummy_variables = {};
        }

        // remove scale, zscore, and dummy columns that aren't used as input or target columns
        if (pretrain) {
            // remove scale columns
            const bad_scale_cols = Object.keys(this.preprocessing.scale_cols)
                .filter(col => !this.preprocessing.input_cols.includes(col) &&
                    !this.preprocessing.target_cols.includes(col));

            if (bad_scale_cols.length > 0) {
                for (const bad_scale_col of bad_scale_cols) {
                    delete this.preprocessing.scale_cols[bad_scale_col];
                }
            }

            // remove zscore columns
            const bad_zscore_cols = Object.keys(this.preprocessing.zscore_cols)
                .filter(col => !this.preprocessing.input_cols.includes(col) &&
                    !this.preprocessing.target_cols.includes(col));

            if (bad_zscore_cols.length > 0) {
                for (const bad_zscore_col of bad_zscore_cols) {
                    delete this.preprocessing.zscore_cols[bad_zscore_col];
                }
            }

            // remove dummy columns
            const bad_dummy_cols = Object.keys(this.preprocessing.dummy_variables)
                .filter(col => !this.preprocessing.input_cols.includes(col) &&
                    !this.preprocessing.target_cols.includes(col));

            if (bad_dummy_cols.length > 0) {
                for (const bad_dummy_col of bad_dummy_cols) {
                    delete this.preprocessing.dummy_variables[bad_dummy_col];
                }
            }
        }
    }


    public resetColumns(): void {
        this.preprocessing.input_cols = [];
        this.preprocessing.target_cols = [];
        this.preprocessing.filters = [];
        this.preprocessing.scale_cols = {};
        this.preprocessing.zscore_cols = {};
        this.preprocessing.dummy_variables = {};
        this.preprocessing.onehot_encoding = {};
    }


    /**
     * Fills in the placeholder values of the model's hyperparameters based on the rest
     * of the project's configurations dataset types. This ensures that everything
     * is ready for training.
     * 
     * @param dtypes column datatypes mapping
     */
    public resolvePlaceholders(dtypes?: { [key: string]: string }): void {
        const output_layer = this.model.layers.at(-1);

        if (output_layer && output_layer.identifier == "dense" && output_layer.auto) {
            if (dtypes && this.preprocessing.target_cols.length == 1 &&
                dtypes[this.preprocessing.target_cols[0]] == "string") {
                output_layer.config.units = Object.keys(this.preprocessing.onehot_encoding).length;
            } else if (this.project_type == ProjectType.IMAGE_CLASSIFICATION) {
                output_layer.config.units = this.preprocessing.input_cols.length;
            } else if (this.project_type == ProjectType.TEXT_CLASSIFICATION) {
                output_layer.config.units = Object.keys(this.preprocessing.onehot_encoding).length;
            } else {
                output_layer.config.units = this.preprocessing.target_cols.length;
            }
        }
    }
}
