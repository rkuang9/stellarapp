import { createRegressionSamples, createRegressionLabels, createTextSamples, createCategoricalLabels, getDummyColumns } from "@/lib/data-processing/preprocess";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { InputShapeArgs, MinMaxScaleArgs, OneHotEncodingArgs, ZScoreArgs } from "@/lib/data-processing/project_config";
import type ForgeFrame from "@/lib/data-processing/forgeframe";
import { ProjectType } from "@/types/project_types";
import { TrainMode } from "@/lib/webworker/worker_types";


/**
 * Generate a dataset from the dataframe and perform secondary
 * actions like setting the input_shape
 * 
 * @param dataframe
 * @param project_config 
 */
export function generateDataset(dataframe: ForgeFrame, project_config: ProjectConfig, mode: TrainMode): {
    xs: number[][],
    ys: number[][],
    input_shape: InputShapeArgs,
    onehot_encoding: OneHotEncodingArgs,
    scale_cols: MinMaxScaleArgs;
    zscore_cols: ZScoreArgs;
} {
    let xs: number[][] = [];
    let ys: number[][] = [];
    let onehot_encoding: OneHotEncodingArgs = {};
    let input_shape: InputShapeArgs = [];
    let scale_cols: MinMaxScaleArgs = project_config.preprocessing.scale_cols;
    let zscore_cols: ZScoreArgs = project_config.preprocessing.zscore_cols;

    if (project_config.preprocessing.input_cols.length == 0 ||
        project_config.preprocessing.target_cols.length == 0) {
        return { xs, ys, input_shape, onehot_encoding, scale_cols, zscore_cols };
    }

    dataframe.dropNaRows({ inplace: true });

    // generating samples
    if (project_config.project_type == ProjectType.TEXT_CLASSIFICATION) {
        throw Error(`generateDataset: text classification is not supported`);
        /* const samples = createTextSamples({
            dataframe,
            columns: project_config.preprocessing.input_cols,
            vocab_size: project_config.preprocessing.vocab_size,
            sentence_length: project_config.preprocessing.sentence_length,
        });

        xs = samples.xs;
        input_shape = samples.input_shape; */
    } else {
        const string_cols = project_config.preprocessing.input_cols.filter(col => dataframe.types[col] == "string");
        const dummy_variables = mode == "new"
            ? getDummyColumns(dataframe, string_cols)
            : project_config.preprocessing.dummy_variables;

        const samples = createRegressionSamples({
            dataframe,
            columns: project_config.preprocessing.input_cols,
            scale_cols,
            zscore_cols,
            dummy_variables,
        });

        xs = samples.xs;
        input_shape = samples.input_shape;

        if (samples.scale_cols) {
            scale_cols = { ...scale_cols, ...samples.scale_cols }
        }

        if (samples.zscore_cols) {
            zscore_cols = { ...zscore_cols, ...samples.zscore_cols }
        }

        for (const col in scale_cols) {
            if (!project_config.preprocessing.input_cols.includes(col) && !project_config.preprocessing.target_cols.includes(col)) {
                delete scale_cols[col];
            }
        }

        for (const col in zscore_cols) {
            if (!project_config.preprocessing.input_cols.includes(col) && !project_config.preprocessing.target_cols.includes(col)) {
                delete zscore_cols[col];
            }
        }
    }

    // generating labels
    if (//project_config.project_type == ProjectType.TEXT_CLASSIFICATION ||
        (project_config.preprocessing.target_cols.length == 1 &&
            dataframe.types[project_config.preprocessing.target_cols[0]] == "string")) {
        // when output cols is string, it is categorical where
        // the unique values are the values to be predicted
        ({ ys, onehot_encoding } = createCategoricalLabels({ dataframe, column: project_config.preprocessing.target_cols[0] }));
    } else {
        const samples = createRegressionLabels({
            dataframe,
            columns: project_config.preprocessing.target_cols,
            scale_cols,
            zscore_cols
        });

        ys = samples.ys;

        if (samples.scale_cols) {
            scale_cols = { ...scale_cols, ...samples.scale_cols }
        }

        if (samples.zscore_cols) {
            zscore_cols = { ...zscore_cols, ...samples.zscore_cols }
        }
    }

    return { xs, ys, input_shape, onehot_encoding, scale_cols, zscore_cols };
}
