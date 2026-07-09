import { generateDataset } from "@/features/training/api/generate-dataset";
import ForgeFrame from "@/lib/data-processing/forgeframe";
import { getDummyColumns } from "@/lib/data-processing/preprocess";
import ProjectConfig from "@/lib/data-processing/project_config";
import { TrainMode } from "@/lib/webworker/worker_types";
import { ProjectType } from "@/types/project_types";


const dataframe = new ForgeFrame([
    { name: "orange", sweet: 7, price: 0.5, health: 0.895 },
    { name: "apple", sweet: 5, price: 0.3, health: 0.627 },
    { name: "peach", sweet: 13, price: 0.7, health: 0.481 },
    { name: "watermelon", sweet: NaN, price: NaN, health: NaN },
    {},
]);


describe("dataset generate", () => {
    beforeEach(() => {
        dataframe.reset();
    })

    it("tabular_regression with unconfigured project_config should have empty samples and labels", () => {
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;

        const { xs, ys, onehot_encoding, input_shape } = generateDataset(dataframe, project_config, "new");

        expect(xs.length).toBe(0);
        expect(ys.length).toBe(0);
        expect(onehot_encoding).toEqual({});
        expect(input_shape.length).toBe(0);

    });


    it("tabular regression with empty dataframe produces empty samples and labels", () => {
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        const empty_frame = new ForgeFrame();

        const { xs, ys, onehot_encoding, input_shape } = generateDataset(empty_frame, project_config, "new");

        expect(xs.length).toBe(0);
        expect(ys.length).toBe(0);
        expect(onehot_encoding).toEqual({});
        expect(input_shape.length).toBe(0);
    });


    it("should drop rows containing NaNs before generating samples and labels", () => {
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["sweet"];
        project_config.preprocessing.target_cols = ["price"];

        const dataframe_rows_before_clean = dataframe.shape[0];
        const { xs, ys, input_shape } = generateDataset(dataframe, project_config, "new");

        expect(xs.length).not.toBe(dataframe_rows_before_clean);
        expect(ys.length).not.toBe(dataframe_rows_before_clean);
        expect(input_shape.length).toBe(project_config.preprocessing.input_cols.length);
    });


    it("should generate tabular regression samples and labels with dummy columns", () => {
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.sentence_length = 1;
        project_config.preprocessing.input_cols = ["name", "sweet"];
        project_config.preprocessing.target_cols = ["name"];

        project_config.preprocessing.dummy_variables = getDummyColumns(dataframe, ["name"])
        const { xs } = generateDataset(dataframe, project_config, "new");

        // [0, 0, 7] orange is designated the trap, hence zeroes        
        expect(xs).toEqual([[0, 0, 7], [1, 0, 5], [0, 1, 13]]);
    });


    it("should generate tabular regression samples and labels, with the sweet column min-max scaled", () => {
        const mock = jest.spyOn(console, 'warn').mockImplementation(() => { });

        const to_scale = "sweet";
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["sweet", "health"];
        project_config.preprocessing.target_cols = ["price"];
        project_config.preprocessing.scale_cols = { [to_scale]: "placeholder" }

        const expected_min = dataframe.column(to_scale).min();
        const expected_max = dataframe.column(to_scale).max();

        const { xs, ys, input_shape, scale_cols } = generateDataset(dataframe, project_config, "resume");

        expect(scale_cols[to_scale]).not.toBe("placeholder");

        const scaled_column = scale_cols[to_scale] as { min: number; max: number; };
        expect(scaled_column.min).toEqual(expected_min);
        expect(scaled_column.max).toEqual(expected_max);

        expect(xs.flat().length).toBe(dataframe.shape[0] * project_config.preprocessing.input_cols.length);
        expect(Math.min(...xs.flat())).toBe(0);
        expect(Math.max(...xs.flat())).toBe(1);

        expect(input_shape).toEqual([project_config.preprocessing.input_cols.length]);
        expect(ys).toEqual(dataframe["price"].values.map((num: number) => [num]));

        mock.mockRestore();
    });


    // this is nearly an indentical normalization test except using a target column instead
    it("should generate tabular regression samples and labels, with the price column min-max scaled", () => {
        const mock = jest.spyOn(console, 'warn').mockImplementation(() => { });

        const to_scale = "price";
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["sweet", "health"];
        project_config.preprocessing.target_cols = ["price"];
        project_config.preprocessing.scale_cols = { [to_scale]: "placeholder" }

        const expected_min = dataframe.column(to_scale).min();
        const expected_max = dataframe.column(to_scale).max();

        const { xs, ys, input_shape, scale_cols } = generateDataset(dataframe, project_config, "resume");

        expect(scale_cols[to_scale]).not.toBe("placeholder");

        const scaled_column = scale_cols[to_scale] as { min: number; max: number; };

        //expect(scaled_column.min).toEqual(expected_min);
        expect(scaled_column.min).toBeCloseTo(expected_min, 6)
        //expect(scaled_column.max).toEqual(expected_max);
        expect(scaled_column.max).toBeCloseTo(expected_max, 6)

        expect(xs.flat().length).toBe(dataframe.shape[0] * project_config.preprocessing.input_cols.length);
        expect(Math.min(...ys.flat())).toBe(0);
        expect(Math.max(...ys.flat())).toBe(1);

        expect(input_shape).toEqual([project_config.preprocessing.input_cols.length]);

        mock.mockRestore();
    });


    it("should generate tabular regression samples and labels, with the sweet column z-score standardized", () => {
        const mock = jest.spyOn(console, 'warn').mockImplementation(() => { });

        const to_standardize = "sweet";
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["sweet", "health"];
        project_config.preprocessing.target_cols = ["price"];
        project_config.preprocessing.zscore_cols = {
            [to_standardize]: "placeholder",
            "should_be_gone1": "placeholder",
            "should_be_gone2": {
                mean: 1,
                std: 1
            }
        }

        const x_train = (dataframe.column(to_standardize).values.flat() as number[]).filter((num: number) => !isNaN(num));
        const x_train_normalized = calculateStandardizedValues(x_train);

        const modes: TrainMode[] = ["new", "resume"];

        for (const mode of modes) {
            const { xs, ys, input_shape, zscore_cols } = generateDataset(dataframe, project_config, mode);

            expect(zscore_cols[to_standardize]).not.toBe("placeholder");
            expect(zscore_cols[to_standardize]).not.toBe(undefined);

            // compare generated values with manually calculated values
            const zscore_column = zscore_cols[to_standardize] as { mean: number; std: number; };
            expect(zscore_column.mean).toBeCloseTo(calculateMean(x_train), 6);
            expect(zscore_column.std).toBeCloseTo(calculatePopulationSTD(x_train), 6);

            // compare the dataset's standardized values to our own standardization formula
            const std_index = project_config.preprocessing.input_cols.indexOf(to_standardize);
            const precision = 6;

            for (let i = 0; i < x_train_normalized.length; i++) {
                expect(xs[i][std_index]).toBeCloseTo(x_train_normalized[i], precision);
            }

            expect(xs.flat().length).toBe(dataframe.shape[0] * project_config.preprocessing.input_cols.length);

            expect(input_shape).toEqual([project_config.preprocessing.input_cols.length]);
            expect(ys).toEqual(dataframe["price"].values.map((num: number) => [num]));
            expect(zscore_cols["should_be_gone1"]).toBe(undefined);
            expect(zscore_cols["should_be_gone2"]).toBe(undefined);
        }

        mock.mockRestore();
    });


    // this is nearly an indentical standardizer test except using a target column instead
    it("should generate tabular regression samples and labels, with the price column z-score standardized", () => {
        const mock = jest.spyOn(console, 'warn').mockImplementation(() => { });

        const to_standardize = "price";
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["sweet", "health"];
        project_config.preprocessing.target_cols = ["price"];
        project_config.preprocessing.zscore_cols = { [to_standardize]: "placeholder" }

        const y_train = (dataframe.column(to_standardize).values.flat() as number[]).filter((num: number) => !isNaN(num));
        const y_train_normalized = calculateStandardizedValues(y_train);

        const { xs, ys, input_shape, zscore_cols } = generateDataset(dataframe, project_config, "resume");

        expect(zscore_cols[to_standardize]).not.toBe("placeholder");

        // compare generated values with manually calculated values
        const zscore_column = zscore_cols[to_standardize] as { mean: number; std: number; };
        expect(zscore_column.mean).toBeCloseTo(calculateMean(y_train), 6);
        expect(zscore_column.std).toBeCloseTo(calculatePopulationSTD(y_train), 6);

        // compare the dataset's standardized values to our own standardization formula
        const std_index = project_config.preprocessing.target_cols.indexOf(to_standardize);
        const precision = 6;

        for (let i = 0; i < y_train_normalized.length; i++) {
            expect(ys[i][std_index]).toBeCloseTo(y_train_normalized[i], precision);
        }

        expect(xs.flat().length).toBe(dataframe.shape[0] * project_config.preprocessing.input_cols.length);

        expect(input_shape).toEqual([project_config.preprocessing.input_cols.length]);

        mock.mockRestore();
    });
});


// get the standardized form of an array using population standard deviation
function calculateStandardizedValues(values: number[]) {
    const mean = calculateMean(values);
    const std = calculatePopulationSTD(values);

    return values.map(val => (val - mean) / std);
}


// https://stackoverflow.com/questions/7343890/standard-deviation-javascript
// this is population standard deviation and default for sklearn and pandas
function calculatePopulationSTD(values: number[]) {
    const n = values.length
    const mean = values.reduce((a, b) => a + b) / n
    return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}


function calculateMean(values: number[]) {
    return values.reduce((a, b) => a + b) / values.length;
}
