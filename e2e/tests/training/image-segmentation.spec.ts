/**
 * WARNING:     This test must be done with a browser that supports WebGPU
 */
import * as fs from "fs/promises";

import { newModelURL } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
    testURL,
    getAssetPath,
    LOAD_LOCAL_MODEL_ID
} from "e2e/tests/test-utils";

const TRAIN_NUM_EPOCHS = "1";
const PROJECT_ZIP_NAME = "COCO-Stuff-184-Segmentation-Test.zip";
const LOAD_IMAGES_ID = "load-segmentation-images";
const PREDICT_IMAGE = "000000000139.jpg";
const PREDICT_IMAGE_PATH = `segmentation_images/images/${PREDICT_IMAGE}`;

const loadImages = async (type: "images" | "masks") => {
    return Promise.all((await fs.readdir(getAssetPath(`segmentation_images/${type}`)))
        .filter(filename => !filename.startsWith(".")) // ignore hidden system files like .DS_Store
        .map(async filename => ({
            buffer: await fs.readFile(getAssetPath(`segmentation_images/${type}/${filename}`)),
            mimeType: `image/${filename.split(".").at(-1)}`,
            name: filename
        })));
}


test.describe("image segmentation train, save, load, and inference", () => {

    test("train a model, run inference", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_SEGMENTATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load the dataset file
        await page.locator("#dataset").scrollIntoViewIfNeeded();
        await page.locator(`#load-image-folder-playwright`).setInputFiles(await loadImages("images"));
        await page.locator(`#load-mask-folder-playwright`).setInputFiles(await loadImages("masks"));

        // model setup
        await page.locator(`#segmentation-categories`).fill("184");

        await page.locator("#segmentation-depth").click();
        await page.getByRole('option', { name: '2' }).click();

        await page.locator("#segmentation-filters").click();
        await page.getByRole('option', { name: '4', exact: true }).click();

        await page.locator("#segmentation-width").fill("32");
        await page.locator("#segmentation-height").fill("32");

        // hyperparameters
        await page.locator(`#hyperparameters-epochs`).fill("1");

        // training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'WebGPU (GPU)', exact: true }).click();
        await page.locator("#train-model").click();

        await expect(page.getByText(`Epoch ${TRAIN_NUM_EPOCHS}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        await inference(page);
    });


    test("load a locally saved model, train 1 epoch, and run inference", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_SEGMENTATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load model and dataset
        await page.locator(`#load-image-folder-playwright`).setInputFiles(await loadImages("images"));
        await page.locator(`#load-mask-folder-playwright`).setInputFiles(await loadImages("masks"));
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(PROJECT_ZIP_NAME));
        await expect(page.getByText("Loaded model with")).toBeVisible({ timeout: 5_000 });

        // training progress displays the last epoch
        await expect(page.locator("#current-epoch")).toHaveText("Epoch 1");
        await expect(page.locator("#current-batch")).toHaveText("Batch 2/2");
        await expect(page.locator("#current-eta")).toHaveText("00:00:01");
        await expect(page.locator("#training-metrics-log")).toContainText("Loss:", { timeout: 5_000 });

        // set epochs
        await page.locator("#hyperparameters-epochs").fill("5");

        // resume training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'WebGPU (GPU)', exact: true }).click();
        await page.locator("#train-model").click();

        // Custom metrics are restored during model load, this tests that
        // they are used and return a value. If this step fails
        // it might be because the epoch finishes too quickly, try increasing it
        await expect(page.locator("#training-metrics-log")).toContainText("Precision");
        await expect(page.locator("#training-metrics-log")).toContainText("Recall");

        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });
        await expect(page.getByText(`Epoch 1`)).not.toBeVisible({ timeout: 10_000 });

        await inference(page);
    })

});


async function inference(page: Page) {
    // inference
    await page.locator(`#${LOAD_IMAGES_ID}`).setInputFiles(getAssetPath(PREDICT_IMAGE_PATH));

    await expect(page.locator(`[id="image-${PREDICT_IMAGE}"]`)).toBeVisible();
    await expect(page.locator(`[id="mask-${PREDICT_IMAGE}"]`)).toBeVisible();
}
