import { getLayer } from "@/features/training/regression/layers/layer-types";
import ProjectConfig from "@/lib/data-processing/project_config";
import { ProjectType } from "@/types/project_types";
import * as fs from "fs/promises"
import JSZip from "jszip";


const REGRESSION_PROJECT_ZIP = "e2e/assets/sum2num-trained.zip";
const PROJECT_CONFIG_ZIP_PATH = "project/project.json";


describe("dataset generate", () => {
    it("fixColumns() should remove columns from the project_config", async () => {
        const project_zip = await fs.readFile(REGRESSION_PROJECT_ZIP) as any;

        const zip = await JSZip.loadAsync(project_zip);

        const loaded_project_config = new ProjectConfig({
            load: JSON.parse(await zip.files[PROJECT_CONFIG_ZIP_PATH].async("string"))
        });

        expect(loaded_project_config).toBeDefined();

        let project_config = new ProjectConfig({ load: loaded_project_config });
        expect(project_config).toEqual(loaded_project_config);

        const invalid_cols = ["invalid_scal1", "invalid_scale2"];
        project_config.preprocessing.scale_cols = Object.fromEntries(invalid_cols.map(k => [k, "placeholder"]))
        project_config.preprocessing.zscore_cols = Object.fromEntries(invalid_cols.map(k => [k, "placeholder"]))
        project_config.preprocessing.dummy_variables = Object.fromEntries(invalid_cols.map(k => [k, { uniques: ["val1", "val2", ""] }]))

        project_config.fixColumns({ pretrain: true });
        expect(Object.keys(project_config.preprocessing.scale_cols).length).toBe(0);
        expect(Object.keys(project_config.preprocessing.zscore_cols).length).toBe(0);
        expect(Object.keys(project_config.preprocessing.dummy_variables).length).toBe(0);

        // for text classification, if target has a string column, it must be the only column
        project_config = new ProjectConfig({ load: loaded_project_config });
        project_config.project_type = ProjectType.TEXT_CLASSIFICATION;
        project_config.preprocessing.target_cols = ["num1", "num2"];
        project_config.fixColumns({
            dtypes: {
                num1: "float32",
                num2: "string",
            }
        });
        expect(project_config.preprocessing.target_cols.length).toBe(0);

        project_config.preprocessing.target_cols = ["num1", "num2"];
        project_config.fixColumns({
            dtypes: {
                num1: "string",
                num2: "string",
            }
        });
        expect(project_config.preprocessing.target_cols.length).toBe(0);

        // for text classification, there should be no dummy variables
        project_config = new ProjectConfig({ load: loaded_project_config });
        project_config.preprocessing.dummy_variables = {
            num1: {
                uniques: ["1", "two", ""],
                trap_drop: "0"
            }
        }

        project_config.project_type = ProjectType.TEXT_CLASSIFICATION;
        project_config.fixColumns();
        expect(Object.keys(project_config.preprocessing.dummy_variables).length).toBe(0);


        // no dummy variables when there are no string input columns
        project_config = new ProjectConfig({ load: loaded_project_config });
        project_config.preprocessing.dummy_variables = {
            num1: {
                uniques: ["1", "two", ""],
                trap_drop: "0"
            }
        }

        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.fixColumns({
            dtypes: {
                num1: "float32",
                num2: "float32",
            }
        });
        expect(Object.keys(project_config.preprocessing.dummy_variables).length).toBe(0);
    });


    it("should throw if the source copy value is a function", async () => {
        const project_zip = await fs.readFile(REGRESSION_PROJECT_ZIP) as any;
        const zip = await JSZip.loadAsync(project_zip);

        let source_config = JSON.parse(await zip.files[PROJECT_CONFIG_ZIP_PATH].async("string"));
        (source_config as any).project_type = function () { };
        expect(() => new ProjectConfig({ load: source_config })).toThrow();

        source_config = JSON.parse(await zip.files[PROJECT_CONFIG_ZIP_PATH].async("string"));
        (source_config as any).model.batch_size = function () { };
        expect(() => new ProjectConfig({ load: source_config })).toThrow();

        source_config = JSON.parse(await zip.files[PROJECT_CONFIG_ZIP_PATH].async("string"));
        (source_config as any).preprocessing.input_cols = function () { };
        expect(() => new ProjectConfig({ load: source_config })).toThrow();
    });


    it("resolvePlaceholders() should fill in placeholders", async () => {
        const project_config = new ProjectConfig();
        project_config.project_type = ProjectType.TABULAR_REGRESSION;
        project_config.preprocessing.input_cols = ["apple", "orange"];
        project_config.preprocessing.target_cols = ["superbness", "yumness"];

        project_config.model.layers.push(getLayer("embedding", "SUPER_UNIQUE_ID"));

        const dense_layer = getLayer("dense", "ULTRA_UNIQUE_ID");
        dense_layer.auto = true;
        project_config.model.layers.push(dense_layer);

        project_config.resolvePlaceholders({});
        expect(project_config.model.layers.at(-1)?.config.units).toBe(project_config.preprocessing.target_cols.length);

        project_config.project_type = ProjectType.TEXT_CLASSIFICATION;
        project_config.preprocessing.target_cols = ["superbness"];
        project_config.preprocessing.onehot_encoding = {
            "ok": 0,
            "good": 1,
            "great": 2,
            "awesome": 3
        }
        project_config.resolvePlaceholders({
            superbness: "string"
        });
        expect(project_config.model.layers.at(-1)?.config.units).toBe(Object.keys(project_config.preprocessing.onehot_encoding).length);

        project_config.project_type = ProjectType.IMAGE_CLASSIFICATION;
        project_config.resolvePlaceholders({});
        expect(project_config.model.layers.at(-1)?.config.units).toBe(project_config.preprocessing.input_cols.length);
    });


    it("resetColumns() clears out all preprocessing configurations that involve columns", async () => {
        const project_zip = await fs.readFile(REGRESSION_PROJECT_ZIP) as any;
        const zip = await JSZip.loadAsync(project_zip);

        const project_config = new ProjectConfig({ load: JSON.parse(await zip.files[PROJECT_CONFIG_ZIP_PATH].async("string")) });

        expect(project_config).toBeDefined();
        project_config.resetColumns();

        for (const i in project_config.preprocessing) {
            expect(Object.keys((project_config.preprocessing as any)[i]).length).toBe(0);
        }
    });
});
