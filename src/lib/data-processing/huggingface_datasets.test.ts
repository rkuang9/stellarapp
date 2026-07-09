import { cleanDatasetURL, datasetBaseURL, datasetFileURL, getFeaturesList, getFileList, getSchema, parseDatasetURL } from "@/lib/data-processing/huggingface_datasets";


describe("huggingface datasets (not testing downloads)", () => {
    test("parse dataset base URL", () => {
        const { type, owner, name, branch, path } = parseDatasetURL("https://huggingface.co/datasets/m-a-p/FineFineWeb");

        expect(type).toEqual("datasets");
        expect(owner).toEqual("m-a-p");
        expect(name).toEqual("FineFineWeb");
        expect(branch).toEqual(undefined);
        expect(path).toEqual(undefined);
    });


    test("parse dataset folder URL", () => {
        const { type, owner, name, branch, path } = parseDatasetURL("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace");

        expect(type).toEqual("datasets");
        expect(owner).toEqual("m-a-p");
        expect(name).toEqual("FineFineWeb");
        expect(branch).toEqual("main");
        expect(path).toEqual("aerospace");

        const { path: made_up_path } = parseDatasetURL("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace/made/up/fake/path");
        expect(made_up_path).toBe("aerospace/made/up/fake/path");

        // only main branch supported
        expect(() => parseDatasetURL("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/NOT_MAIN/aerospace")).toThrow();
    });


    test("clean dataset URL", () => {
        const base = "https://huggingface.co/datasets/m-a-p/FineFineWeb";
        const folder = "https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace";
        const file = "https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace/aerospace_000000.jsonl";

        const non_main_branch_file = "https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/NOT_MAIN/aerospace/aerospace_000000.jsonl";
        const tree = "https://huggingface.co/datasets/m-a-p/FineFineWeb/tree"

        expect(cleanDatasetURL(base)).toBe(base);
        expect(cleanDatasetURL(folder)).toBe(folder);
        expect(cleanDatasetURL(file)).toBe(folder);
        expect(cleanDatasetURL(tree)).toBe(base);
        expect(() => cleanDatasetURL(non_main_branch_file)).toThrow();
    });


    test("get dataset base URL", () => {
        const base_url = datasetBaseURL("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace");

        expect(base_url).toBe("https://huggingface.co/datasets/m-a-p/FineFineWeb");
    });


    test("get direct blob URL to file by converting to base URL and adding the file path", () => {
        const file_path = "aerospace/aerospace_000000.jsonl";
        const url = "https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace";

        expect(datasetFileURL(url, file_path)).toBe(`https://huggingface.co/datasets/m-a-p/FineFineWeb/blob/main/${file_path}`)
    });


    test("direct file blob URL results in the same URL", () => {
        expect(datasetFileURL(
            "https://huggingface.co/datasets/m-a-p/FineFineWeb/blob/main/aerospace/aerospace_000000.jsonl",
            "aerospace/aerospace_000000.jsonl")
        ).toBe(`https://huggingface.co/datasets/m-a-p/FineFineWeb/blob/main/aerospace/aerospace_000000.jsonl`)
    });


    test("invalid Huggingface dataset URL", () => {
        expect(() => datasetBaseURL("https://stellarapp.net")).toThrow();
        expect(() => parseDatasetURL("https://stellarapp.net")).toThrow();
    })


    // the following are disabled because they require an internet connection
    test("get file list", async () => {
        if (!(await fetch("https://google.com", { method: "GET" })).ok) {
            // no internet connection
            return;
        }

        const file_list = await getFileList("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace");
        const files = file_list.map(file => file.path);

        expect(files.length > 0);
        expect(files.filter(file => file.endsWith("jsonl")).length).toEqual(files.length);
    });


    test("get schema and features", async () => {
        if (!(await fetch("https://google.com", { method: "GET" })).ok) {
            // no internet connection
            return;
        }

        const schema = await getSchema("https://huggingface.co/datasets/m-a-p/FineFineWeb/tree/main/aerospace");
        const features = getFeaturesList(schema);

        expect(features).toEqual([
            ["default", "url"],
            ["default", "date"],
            ["default", "file_path"],
            ["default", "language_score"],
            ["default", "token_count"],
            ["default", "dump"],
            ["default", "global_id"],
            ["default", "lang"],
            ["default", "text"],
            ["default", "domain"],
            ["default", "round"]]
        );

        expect(schema.dataset_info.default.features).toEqual({
            "url": {
                "dtype": "string",
                "_type": "Value"
            },
            "date": {
                "dtype": "timestamp[s]",
                "_type": "Value"
            },
            "file_path": {
                "dtype": "string",
                "_type": "Value"
            },
            "language_score": {
                "dtype": "float64",
                "_type": "Value"
            },
            "token_count": {
                "dtype": "int64",
                "_type": "Value"
            },
            "dump": {
                "dtype": "string",
                "_type": "Value"
            },
            "global_id": {
                "dtype": "string",
                "_type": "Value"
            },
            "lang": {
                "dtype": "string",
                "_type": "Value"
            },
            "text": {
                "dtype": "string",
                "_type": "Value"
            },
            "domain": {
                "dtype": "string",
                "_type": "Value"
            },
            "round": {
                "dtype": "int64",
                "_type": "Value"
            }
        })
    });
});
