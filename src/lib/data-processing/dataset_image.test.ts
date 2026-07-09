import ImageDataset from "@/lib/data-processing/dataset_image";
import * as fs from "fs/promises"

const image_folder_path = "e2e/assets/CIFAR-10-unit-test-dataset.zip";

/**
 * These tests load a Buffer instead of File because the latter won't work
 * in NodeJS.
 */
describe("dataset generate", () => {

    it("should load the zip folder reocgnize the categories", async () => {
        const image_folder = await fs.readFile(image_folder_path) as any;
        const imageset = await ImageDataset.load(image_folder, true);

        expect(imageset.categories.length).toBeGreaterThan(1);

        expect(imageset.category("_invalid_category_").length).toBeCloseTo(0);
        expect(imageset.category(imageset.categories[0]).length).toBeGreaterThan(0);

        expect(imageset.size).toBeGreaterThan(2);
        expect((await imageset.arrayBuffer()).byteLength).not.toBe(0);
    });


    it("should be empty after reset", async () => {
        const image_folder = await fs.readFile(image_folder_path) as any;
        const imageset = await ImageDataset.load(image_folder);
        imageset.reset();

        expect(imageset.categories.length).toBe(0);
        expect(imageset.size).toBe(0);
    });


    it("should return a blob", async () => {
        const image_folder = await fs.readFile(image_folder_path) as any;
        const imageset = await ImageDataset.load(image_folder, true);

        const image_view = await imageset.images(imageset.categories[0], 0, 1);

        const blob = await imageset.blob(image_view[0].path);
        expect(blob).toBeInstanceOf(Blob);
    })


    it("should return an array of blobs and string categories", async () => {
        const image_folder = await fs.readFile(image_folder_path) as any;
        const imageset = await ImageDataset.load(image_folder, true);
        const { x_train, y_train } = await imageset.dataset(imageset.categories);

        expect(x_train.length).toBe(y_train.length);

        for (const sample of x_train) {
            expect(sample).toBeInstanceOf(Blob);
        }

        for (const label of y_train) {
            expect(typeof label).toBe("string");
        }
    });


    it("should load from an existing imageset", async () => {
        const imageset = new ImageDataset();
        const existing = await ImageDataset.load(await fs.readFile(image_folder_path) as any);

        imageset.from(existing);

        expect(imageset.image_categories).toEqual(existing.image_categories);
        expect(imageset.size).toBe(existing.size);
        expect(imageset.categories).toEqual(existing.categories);
    });


    it("should throw and return empty array due to empty dataset", async () => {
        const imageset = new ImageDataset();
        expect(async () => await imageset.dataset(imageset.categories)).rejects.toThrow();

        imageset.from(await ImageDataset.load(await fs.readFile(image_folder_path) as any));
        expect(async () => imageset.dataset(["_invalid_category"])).rejects.toThrow();

        const image_view = await imageset.images("_invalid_category_", 0);
        expect(image_view.length).toBe(0);
    })
});
