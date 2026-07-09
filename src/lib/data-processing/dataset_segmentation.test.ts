import SegmentationDataset from "@/lib/data-processing/dataset_segmentation";
import * as fs from "fs/promises"

const image_folder = "e2e/assets/segmentation_images";

const images_dir = `${image_folder}/images`;
const masks_dir = `${image_folder}/masks`;


// tiff and fast-png don't work with Jest so they are mocked out,
// just test with jpg
jest.mock('tiff', () => ({
    __esModule: true,
    decode: jest.fn(),
}));


jest.mock('fast-png', () => ({
    __esModule: true,
    encode: jest.fn(),
}));


describe("load segmentation images", () => {

    it("should load the image and masks as pairs, can reset to empty", async () => {
        const dataset = new SegmentationDataset();

        const inputs = (await fs.readdir(images_dir)).filter(name => name.includes("jpg") || name.includes("png"));
        const targets = (await fs.readdir(masks_dir)).filter(name => name.includes("jpg") || name.includes("png"));;

        for (let i = 0; i < inputs.length; i++) {
            const image = new File([
                new Blob([(await fs.readFile(`${images_dir}/${inputs[i]}`)).buffer])
            ], inputs[i], { type: "image/jpg" });

            const mask = new File([
                new Blob([(await fs.readFile(`${masks_dir}/${targets[i]}`)).buffer])
            ], targets[i], { type: "image/png" });

            dataset.loadImage(image);
            dataset.loadMask(mask);

            expect(dataset.size).toEqual(i + 1);
        }

        expect(dataset.size).toEqual(inputs.length);

        dataset.reset();
        expect(dataset.size).toEqual(0);
    });


    it("should return the images and masks in array form", async () => {
        const dataset = new SegmentationDataset();

        const inputs = (await fs.readdir(images_dir)).filter(name => name.includes("jpg") || name.includes("png"));
        const targets = (await fs.readdir(masks_dir)).filter(name => name.includes("jpg") || name.includes("png"));;

        for (let i = 0; i < inputs.length; i++) {
            const image = new File([
                new Blob([(await fs.readFile(`${images_dir}/${inputs[i]}`)).buffer])
            ], inputs[i], { type: "image/jpg" });

            const mask = new File([
                new Blob([(await fs.readFile(`${masks_dir}/${targets[i]}`)).buffer])
            ], targets[i], { type: "image/png" });

            dataset.loadImage(image);
            dataset.loadMask(mask);
        }

        const image_mask_dataset = await dataset.dataset();

        expect(image_mask_dataset.x_train.length).toEqual(inputs.length);
        expect(image_mask_dataset.y_train.length).toEqual(targets.length);
    })
});
