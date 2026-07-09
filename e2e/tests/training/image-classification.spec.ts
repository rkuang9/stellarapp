import { newModelURL } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect } from '@playwright/test';
import {
    LOAD_DATASET_ID, LOAD_LOCAL_MODEL_ID,
    testURL,
    LOAD_IMAGES_ID,
    getAssetPath
} from "e2e/tests/test-utils";


const DATASET_NAME = "CIFAR-10-unit-test-dataset.zip";
const PROJECT_ZIP_NAME = "CIFAR-10-trained.zip";
const PREDICT_IMAGE_NAME = "sample-image-classification-predict.webp";

const TRAIN_NUM_EPOCHS = "2";
const TRAIN_BATCH_SIZE = "8";
const TRAIN_LOSS_FUNCTION = "Categorical Crossentropy";
const TRAIN_METRICS = ["Accuracy", "Mean Squared Error"]


test.describe("image classification train, load, and inference", () => {

    test("train a model, run inference", async ({ page }) => {

        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load the dataset file
        await page.locator("#dataset").scrollIntoViewIfNeeded();

        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));

        // target categories
        await expect(page.locator("#target-cols")).toHaveText("cat, dog, deer", { useInnerText: true, timeout: 5_000 });
        await page.locator('#target-cols').click();
        await page.getByRole('menuitem', { name: 'deer' }).click();
        await page.locator('#target-cols-content').press('Escape');
        await expect(page.locator("#target-cols")).toHaveText("cat, dog", { useInnerText: true })

        // premature training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#train-model").click();
        await expect(page.getByRole('heading', { name: 'Not ready to train yet' })).toBeVisible();
        await page.locator('#dialogue-close').click();

        // layers
        await page.locator("#layers").scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'Convolution 2D' }).click();
        await page.getByRole('button', { name: 'Max Pooling 2D' }).click();
        await page.getByRole('button', { name: 'Flatten' }).click();
        await page.getByRole('button', { name: 'Dense' }).click();
        await page.locator('#layer-3').getByRole('combobox').click();
        await page.getByText('Softmax').click();
        await page.getByRole('textbox', { name: 'Filters' }).click();
        await page.getByRole('textbox', { name: 'Filters' }).fill('1');
        await page.getByRole('textbox', { name: 'Kernel size' }).click();
        await page.getByRole('textbox', { name: 'Kernel size' }).fill('1');

        // hyperparameters
        await page.locator("#hyperparameters").scrollIntoViewIfNeeded();
        await page.locator("#hyperparameters-epochs").fill(TRAIN_NUM_EPOCHS);
        await page.locator("#hyperparameters-batch-size").fill(TRAIN_BATCH_SIZE);
        await page.locator("#hyperparameters-loss-function").click();
        await page.getByRole('option', { name: TRAIN_LOSS_FUNCTION }).click();
        // Accuracy should be preselected, just add Precision
        await page.locator("#hyperparameters-metrics").click();
        await page.getByRole('menuitem', { name: "Mean Squared Error" }).click();
        await page.locator('#hyperparameters-metrics-content').press('Escape');
        await expect(page.locator("#hyperparameters-metrics")).toHaveText(TRAIN_METRICS.join(", "), { useInnerText: true })

        // training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'CPU', exact: true }).click();
        await page.locator("#train-model").click();

        await expect(page.getByText(`Epoch ${TRAIN_NUM_EPOCHS}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // inference
        await page.locator(`#${LOAD_IMAGES_ID}`).setInputFiles(getAssetPath(PREDICT_IMAGE_NAME));
        await expect(page.locator("#prediction-0-category")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });
        await expect(page.locator("#prediction-0-score")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });

    });


    test("load a locally saved model, train 1 epoch, and run inference", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load model and dataset
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(PROJECT_ZIP_NAME));
        await expect(page.getByText("Loaded model with")).toBeVisible({ timeout: 5_000 });

        // training progress displays the last epoch
        await expect(page.locator("#current-epoch")).toHaveText("Epoch 2");
        await expect(page.locator("#current-batch")).toHaveText("Batch 1/1");
        await expect(page.locator("#current-eta")).toHaveText("00:00:01");
        await expect(page.locator("#training-metrics-log")).toContainText("Loss:", { timeout: 5_000 });

        // set epochs
        await page.locator("#hyperparameters-epochs").fill("1");

        // resume training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'CPU', exact: true }).click();
        await page.locator("#train-model").click();
        await expect(page.getByText(`Epoch 3`)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // run inference
        await page.locator("#inference").scrollIntoViewIfNeeded();
        await page.locator(`#${LOAD_IMAGES_ID}`).setInputFiles(getAssetPath(PREDICT_IMAGE_NAME));
        await expect(page.locator("#prediction-0-category")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });
        await expect(page.locator("#prediction-0-score")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });
        await page.locator(`#${LOAD_IMAGES_ID}`).setInputFiles(getAssetPath(PREDICT_IMAGE_NAME));
        await expect(page.locator("#prediction-1-category")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });
        await expect(page.locator("#prediction-1-score")).not.toHaveText("", { useInnerText: true, timeout: 1_000 });
    })

});
