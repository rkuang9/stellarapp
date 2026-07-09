import { newModelURL } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect } from '@playwright/test';
import {
    LOAD_DATASET_ID, LOAD_LOCAL_MODEL_ID, getAssetPath, testURL
} from "e2e/tests/test-utils";


const IMAGE_DATASET_NAME = "CIFAR-10-unit-test-dataset.zip";
const IMAGE_PROJECT_ZIP = "CIFAR-10-trained.zip";
const IMAGE_PROJECT_ZIP_MISNAMED = "CIFAR-10-dog123.zip";

const REGRESSION_DATASET_NAME = "sum2num.csv";
const REGRESSION_PROJECT_ZIP = "sum2num-trained.zip";
const REGRESSION_PROJECT_ZIP_MISNAMED = "sum2num-num000.zip";

test.describe("load datasets and projects", () => {

    test("tabular regression: successful dataset and project load", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.TABULAR_REGRESSION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load project
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(REGRESSION_PROJECT_ZIP));
        await expect(page.getByText(`Loaded model with`)).toBeVisible({ timeout: 5_000 });

        // load dataset
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(REGRESSION_DATASET_NAME));
        await expect(page.getByText(`Loaded dataset with`)).toBeVisible({ timeout: 5_000 });
    });


    test("tabular regression: load local project, then dataset, expect a popup warning", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.TABULAR_REGRESSION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load project
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(REGRESSION_PROJECT_ZIP_MISNAMED));

        // load dataset
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(REGRESSION_DATASET_NAME));

        // popup warning
        await expect(page.getByText('Invalid columns: num000')).toBeVisible();
    });


    test("tabular regression: load dataset, then local project, expect a popup warning", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.TABULAR_REGRESSION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load dataset
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(REGRESSION_DATASET_NAME));

        // load project
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(REGRESSION_PROJECT_ZIP_MISNAMED));

        // popup warning
        await expect(page.getByText('Invalid columns: num000')).toBeVisible();
    });


    test("image classification: successful dataset and project load", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load project
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(IMAGE_PROJECT_ZIP));
        await expect(page.getByText(`Loaded model with`)).toBeVisible({ timeout: 5_000 });

        // load dataset
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(IMAGE_DATASET_NAME));
        await expect(page.getByText(`Loaded image dataset with`)).toBeVisible({ timeout: 5_000 });
    });


    test("image classification: load local project, then dataset, expect a popup warning", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load project, then dataset and expect warning
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(IMAGE_PROJECT_ZIP_MISNAMED));
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(IMAGE_DATASET_NAME));
        await page.getByText('Invalid image categories: dog123').click();
    });


    test("image classification: load dataset, then local project, expect a popup warning", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load dataset, then project and expect a slightly different warning
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(IMAGE_DATASET_NAME));
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(IMAGE_PROJECT_ZIP_MISNAMED));
        await page.getByText("Invalid image categories: dog123").click();
    });
});
