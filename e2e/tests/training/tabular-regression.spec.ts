import { newModelURL, wait } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect } from '@playwright/test';
import {
    LOAD_DATASET_ID, LOAD_LOCAL_MODEL_ID,
    testURL,
    getAssetPath
} from "e2e/tests/test-utils";


const DATASET_NAME = "sum2num.csv";
const PROJECT_ZIP_NAME = "sum2num-trained.zip";

const TRAIN_NUM_EPOCHS = "2";
const TRAIN_BATCH_SIZE = "8";
const TRAIN_LOSS_FUNCTION = "Mean Absolute Error";
const TRAIN_METRICS = ["Mean Absolute Error", "Mean Absolute Percentage Error"]


test.describe("tabular regression train, save, load, and inference", () => {

    test("train a model, run inference, then save", async ({ page }) => {

        await page.goto(testURL(newModelURL(ProjectType.TABULAR_REGRESSION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load the dataset file
        await page.locator("#dataset").scrollIntoViewIfNeeded();
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));
        // input columns
        await page.locator('#input-cols').click();
        await page.locator('#input-0-num1').click();
        await page.locator('#input-1-num2').click();
        await page.locator('#input-cols-content').press('Escape');
        // target columns
        await page.locator('#target-cols').click();
        await page.locator('#target-2-sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum').click();
        await page.locator('#target-cols-content').press('Escape');

        // premature training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#train-model").click();
        await expect(page.getByRole('heading', { name: 'Not ready to train yet' })).toBeVisible();
        await page.locator('#dialogue-close').click();

        // layers
        await page.locator("#layers").scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'Dense' }).click();
        await page.getByRole('combobox').filter({ hasText: 'ReLU' }).click();
        await page.getByRole('option', { name: 'Linear' }).click();

        // hyperparameters
        await page.locator("#hyperparameters").scrollIntoViewIfNeeded();
        await page.locator("#hyperparameters-epochs").fill(TRAIN_NUM_EPOCHS);
        await page.locator("#hyperparameters-batch-size").fill(TRAIN_BATCH_SIZE);
        await page.locator("#hyperparameters-loss-function").click();
        await page.getByRole('option', { name: TRAIN_LOSS_FUNCTION }).click();
        await page.locator("#hyperparameters-metrics").click();
        for (const metric of TRAIN_METRICS) {
            await page.getByRole('menuitem', { name: metric }).click();
        }
        await page.locator('#hyperparameters-metrics-content').press('Escape');

        // training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'CPU', exact: true }).click();
        await page.locator("#train-model").click();
        await expect(page.getByText(`Epoch ${TRAIN_NUM_EPOCHS}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // inference
        await page.locator("#inference").scrollIntoViewIfNeeded();
        await page.locator("#inference-0-num1").click();
        await page.locator("#inference-0-num1").fill("1");
        await page.locator("#inference-1-num2").click();
        await page.locator("#inference-1-num2").fill("2");
        await wait(100); // wait for prediction to pass from worker to main thread
        expect(await page.locator("#prediction-0-sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum").inputValue()).toBeTruthy();

    });


    test("load a locally saved model, train 1 epoch, and run inference", async ({ page }) => {

        await page.goto(testURL(newModelURL(ProjectType.TABULAR_REGRESSION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(PROJECT_ZIP_NAME));
        await expect(page.getByText("Loaded model with")).toBeVisible({ timeout: 5_000 });

        // training progress displays the last epoch
        await expect(page.locator("#current-epoch")).toHaveText("Epoch 13");
        await expect(page.locator("#current-batch")).toHaveText("Batch 2,000/2,000");
        await expect(page.locator("#current-eta")).toHaveText("00:00:02");
        await expect(page.locator("#training-metrics-log")).toContainText("Loss:", { timeout: 5_000 });

        // set epochs
        await page.locator("#hyperparameters-epochs").fill("1");

        // resume training
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator("#training-backend").click();
        await page.getByRole('option', { name: 'CPU', exact: true }).click();
        await page.locator("#train-model").click();
        await expect(page.getByText(`Epoch 14`)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // run inference
        await page.locator("#inference-0-num1").click();
        await page.locator("#inference-0-num1").fill("1");
        await page.locator("#inference-1-num2").click();
        await page.locator("#inference-1-num2").fill("2");
        await wait(100); // wait for prediction to pass from worker to main thread
        expect(await page.locator("#prediction-0-sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum_sum").inputValue()).toBeTruthy();

    });

});
