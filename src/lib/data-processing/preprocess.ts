import { concat, MinMaxScaler, StandardScaler } from "danfojs";
import type { DataFrame, Series } from "danfojs";


import ForgeFrame from "@/lib/data-processing/forgeframe";
//import { TextVectorization } from "@/lib/tfjs-custom/forgenn";
import OneHotEncoder from "@/lib/data-processing/onehot_encoder";
import { DummyArgs, MinMaxScaleArgs, ZScoreArgs } from "@/lib/data-processing/project_config";


/**
 * Create a value-integer mapping
 * 
 * @param df danfo dataframe 
 * @param column column in the danfo dataframe containing the data to one-hot encode
 * @returns an object containing the column-value-to-encoding mapping
 */
export function oneHotMapping(
    df: ForgeFrame | DataFrame,
    column: string,
    options = { sort: true }): { [key: string]: number } {

    const unique = Object.keys(df.groupby([column]).colDict);

    if (options.sort) {
        unique.sort();
    }

    const mapping: { [key: string]: number } = {};

    for (let i = 0; i < unique.length; i++) {
        mapping[unique[i]] = i;
    }

    return mapping;
}


/**
 * Transform the values of a column into one-hot encoding
 * 
 * @param df a DataFrame or ForgeFrame
 * @param column dataframe column to one-hot encode
 * @param onehot_mapping OPTIONAL: an existing onehot mapping object
 * @returns a 2D array where each element is a one-hot encoded array
 */
export function oneHotEncode(df: ForgeFrame | DataFrame, column: string, onehot_mapping?: { [key: string]: number }): number[][] {
    if (!df.columns.includes(column)) {
        throw Error(`preprocess.oneHotEncode ParamError: '${column}' not found in ${df.columns}`);
    }

    const onehot_array: number[][] = [];

    const onehot_map = onehot_mapping ? onehot_mapping : oneHotMapping(df, column);
    const label_length = Object.keys(onehot_map).length;
    const col_index = df.columns.indexOf(column);

    for (let i = 0; i < df.shape[0]; i++) {
        const value = onehot_map[df.iat(i, col_index) as number | string];

        if (value == undefined) {
            throw Error(`preprocess.oneHotEncode ParamError: ${df.iat(i, col_index) as number | string} was not found in the onehot mapping`);
        }

        onehot_array.push(Array(label_length).fill(0));
        onehot_array[i][value] = 1;
    }

    return onehot_array;
}


export function sparseOneHotEncode(df: ForgeFrame | DataFrame, column: string, onehot_mapping?: { [key: string]: number }): number[][] {
    if (!df.columns.includes(column)) {
        throw Error(`preprocess.sparseOneHotEncode ParamError: '${column}' not found in ${df.columns}`);
    }

    const labels: number[][] = [];

    const onehot_map = onehot_mapping ? onehot_mapping : oneHotMapping(df, column);
    const col_index = df.columns.indexOf(column);

    for (let i = 0; i < df.shape[0]; i++) {
        const value = onehot_map[df.iat(i, col_index) as number | string];

        if (value == undefined) {
            throw Error(`preprocess.oneHotEncode ParamError: ${df.iat(i, col_index) as number | string} was not found in the onehot mapping`);
        }

        labels.push([value]);
    }

    return labels;
}


/**
 * Create 2D array of numbers (rank 2 tensor) from a dataframe's column
 * where each array is the tokenized form of a sentence.
 * 
 * @returns 
 */
export function createTextSamples({
    dataframe, columns, vocab_size, sentence_length
}: {
    dataframe: ForgeFrame;
    columns: string[];
    vocab_size: number;
    sentence_length: number;
}): {
    xs: number[][];
    input_shape: number[];
} {
    throw Error("replace TextVectorization with BPE tokenization");

    if (vocab_size < 1 || sentence_length < 1) {
        throw new Error(`preprocess.createTextSamples` +
            ` vocab_size and sentence_length must be greater than 1`);
    }

    if (columns.length == 0) {
        throw new Error(`preprocess.createTextSamples` +
            ` dataframe does not contain any columns`);
    }

    // create dataframe with all unspecified columns dropped
    let x_dataframe = dataframe.drop({
        columns: dataframe.columns.filter(col => !columns.includes(col)),
        inplace: false,
    });

    x_dataframe.rearrange({ columns, inplace: true });

    if (columns.length > 1) {
        // combine all columns into one
        x_dataframe = x_dataframe
            .concatColumns(columns, { inplace: true })
            .drop({ columns, inplace: false });
    }

    /* const tokenizer = new TextVectorization({
        maxTokens: vocab_size,
        outputSequenceLength: sentence_length
    });

    const xs = tokenizer.adaptAndTokenize(x_dataframe.dataset() as string[][]); */

    return {
        xs: [],
        input_shape: [sentence_length],
    };
}


/**
 * Create a 2D array where each element is a onehot encoded array. This is suitable
 * for tasks like NLP or ones with a softmax output and categorical crossentropy loss.
 * 
 * @param dataframe  a ForgeFrame containing columns to generate labels from
 * @param column     the label column
 * @param onehot_encoding   OPTIONAL: a onehot encoding that maps each unique value to an integer
 * @returns 
 */
export function createCategoricalLabels({
    dataframe, column, onehot_encoding
}: {
    dataframe: ForgeFrame;
    column: string;
    onehot_encoding?: { [key: string]: number };
}): {
    ys: number[][];
    onehot_encoding: { [key: string]: number };
} {

    if (onehot_encoding && Object.keys(onehot_encoding).length < 1) {
        throw new Error(`preprocess.createCategoricalLabels` +
            ` onehot_encoding is empty, don't specify it if intentional`);
    }

    if (!onehot_encoding) {
        onehot_encoding = oneHotMapping(dataframe, column);
    }

    return {
        ys: sparseOneHotEncode(dataframe, column, onehot_encoding),
        onehot_encoding
    }
}


export function createRegressionSamples({ dataframe, columns, scale_cols = {}, zscore_cols = {}, dummy_variables }: {
    dataframe: ForgeFrame;
    columns: string[];
    scale_cols?: MinMaxScaleArgs;
    zscore_cols?: ZScoreArgs;
    dummy_variables?: DummyArgs;
}): {
    xs: number[][];
    input_shape: number[];
    scale_cols?: MinMaxScaleArgs;
    zscore_cols?: ZScoreArgs;
} {
    // create dataframe with all unspecified columns dropped
    let x_dataframe = dataframe.drop({
        columns: dataframe.columns.filter(col => !columns.includes(col)),
        inplace: false
    });

    // rearrange columns to user's desired order
    x_dataframe.rearrange({ columns, inplace: true });

    // sometimes danfojs dataframes values' datatype aren't accurate e.g.
    // column is float32 but value is a string number,
    // we always convert to the correct dtype
    for (let i = 0; i < x_dataframe.columns.length; i++) {
        x_dataframe.asType(
            x_dataframe.columns[i],
            x_dataframe.dtypes[i] as any, { inplace: true });
    }

    if (dummy_variables) {
        x_dataframe = dummifyDataframe(x_dataframe, dummy_variables);
    }

    // handle scaling, either reuse existing or get a new pair of min-max values
    const scale_cols_config: MinMaxScaleArgs = {};

    if (scale_cols && Object.keys(scale_cols).length > 0) {
        for (const col in scale_cols) {
            if (!x_dataframe.columns.includes(col) || !columns.includes(col)) {
                continue;
            }

            const scaler = new MinMaxScaler();

            if (scale_cols[col] && scale_cols[col] != "placeholder") {
                // reuse min-max
                scaler.fit([scale_cols[col].min, scale_cols[col].max]);
            } else {
                // new min-max
                scaler.fit(x_dataframe[col].values);
            }

            scale_cols_config[col] = { // Danfo.js stores min max as a tf.Tensor scalar
                min: scaler["$min"].arraySync(),
                max: scaler["$max"].arraySync()
            }

            x_dataframe[col] = scaler.transform(x_dataframe[col]);
        }
    }

    // handle z-score standardization, either reuse existing or get a new set of mean & stdev values
    const zscore_cols_config: ZScoreArgs = {};

    if (zscore_cols && Object.keys(zscore_cols).length > 0) {
        for (const col in zscore_cols) {
            if (!x_dataframe.columns.includes(col) || !columns.includes(col)) {
                continue;
            }

            const standardizer = new StandardScaler();

            if (zscore_cols[col] && zscore_cols[col] != "placeholder") {
                // reuse mean and stdev
                standardizer["$mean"] = zscore_cols[col].mean
                standardizer["$std"] = zscore_cols[col].std;

                zscore_cols_config[col] = { // Danfo.js stores mean stdev as a tf.Tensor scalar
                    mean: standardizer["$mean"],
                    std: standardizer["$std"]
                }
            } else {
                // new mean and stdev
                standardizer.fit(x_dataframe[col].values);

                zscore_cols_config[col] = { // Danfo.js stores mean stdev as a tf.Tensor scalar
                    mean: standardizer["$mean"].arraySync(),
                    std: standardizer["$std"].arraySync()
                }
            }

            x_dataframe[col] = standardizer.transform(x_dataframe[col]);
        }
    }

    return {
        xs: x_dataframe.dataset() as number[][],
        input_shape: [x_dataframe.columns.length],
        scale_cols: Object.keys(scale_cols_config).length > 0 ? scale_cols_config : undefined,
        zscore_cols: Object.keys(zscore_cols_config).length > 0 ? zscore_cols_config : undefined
    }
}


export function createRegressionLabels({ dataframe, columns, scale_cols = {}, zscore_cols = {} }: {
    dataframe: ForgeFrame, columns: string[], scale_cols?: MinMaxScaleArgs, zscore_cols?: ZScoreArgs
}): {
    ys: number[][];
    scale_cols?: MinMaxScaleArgs;
    zscore_cols?: ZScoreArgs;
} {
    const labels = createRegressionSamples({ dataframe, columns, scale_cols, zscore_cols });

    return {
        ys: labels.xs,
        scale_cols: labels.scale_cols,
        zscore_cols: labels.zscore_cols
    }
}


/**
 * Get the dataframe columns that should be converted to dummy variables as well as
 * the unique values for that column so that the dummy encoding process can be recreated.
 * 
 * @param dataframe the dataset dataframe
 * @param columns columns to be converted to dummy variables, typically all string columns
 * @returns {DummyArgs}
 */
export function getDummyColumns(dataframe: ForgeFrame, columns: string[]): DummyArgs {
    const dummies: DummyArgs = {}

    if (columns.length == 0) {
        return {};
    }

    for (const col of columns) {
        const uniques = dataframe.column(col).unique().values as string[];

        dummies[col] = {
            uniques,
            trap_drop: uniques.length < 2 ? undefined : uniques[0]
        }
    }

    return dummies;
}


/**
 * Convert columns of a dataframe into dummy encoded form.
 * 
 * @param dataframe  the dataset dataframe
 * @param dummy_variables an object containing which columns to dummy encode and their unique values
 * @returns {ForgeFrame}
 */
export function dummifyDataframe(dataframe: ForgeFrame, dummy_variables: DummyArgs): ForgeFrame {
    const non_string_cols = Object.keys(dummy_variables)
        .filter(col => dataframe.types[col] != "string");

    if (non_string_cols.length > 0) {
        throw new Error(`preprocess.dummifyDataframe: Columns ${non_string_cols.toString()} ` +
            `are not of string type and cannot be converted to dummies`);
    }

    const extracted_cols: (Series | DataFrame | ForgeFrame)[] = [];

    for (const col of dataframe.columns) {
        if (!dataframe.columns.includes(col)) {
            throw new Error(`preprocess.dummifyDataframe: The ordered column ${col} was not found in the dataframe.`);
        }

        if (dataframe.types[col] != "string") {
            extracted_cols.push(dataframe.column(col));
            continue;
        }

        if (!dummy_variables[col]) {
            throw new Error(`preprocess.dummifyDataframe: The string column ${col} was not set to be a dummy variable.`);
        }

        const fit = dummy_variables[col].trap_drop
            ? dummy_variables[col].uniques.filter(val => val != dummy_variables[col].trap_drop)
            : dummy_variables[col].uniques;

        extracted_cols.push(new OneHotEncoder(fit).transform(dataframe.column(col)) as DataFrame);

        // set column names to <col>_<unique value>, this ensures the column order set by the user
        // otherwise
        extracted_cols[extracted_cols.length - 1].$setColumnNames(
            dummy_variables[col].uniques
                .filter(unique => unique != dummy_variables[col].trap_drop)
                .map(unique => `${col}_${unique}`)
        );
    }

    const dummified_df = concat({ dfList: extracted_cols, axis: 1 });
    return new ForgeFrame(dummified_df.values, { columns: dummified_df.columns });
}
