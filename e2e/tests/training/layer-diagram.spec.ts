import { newModelURL } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect, devices } from '@playwright/test';
import { testURL, LOAD_DATASET_ID, getAssetPath } from "e2e/tests/test-utils";

const DATASET_NAME = "CIFAR-10-unit-test-dataset.zip";

test.describe("layers diagram", () => {

    test("reorder layers in mobile view", async ({ page }) => {
        await page.setViewportSize(devices["iPhone 11"].viewport);
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));

        // load dataset
        await page.locator("#dataset").scrollIntoViewIfNeeded();
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));

        // layers
        await page.getByRole('button', { name: 'Add layer' }).click();
        await page.getByRole('menuitem', { name: 'Convolution 2D' }).click();
        await page.getByRole('menuitem', { name: 'Dense' }).click();
        await page.getByRole('menuitem', { name: 'Flatten' }).click();
        await page.getByRole('menu').press('Escape');

        await expect(page.locator("#Conv2D-0-label")).toBeVisible();
        await expect(page.locator("#Dense-1-label")).toBeVisible();
        await expect(page.locator("#Flatten-2-label")).toBeVisible();

        // error messages are visible
        await expect(page.getByText('The previous layer outputs a rank 4 tensor, this layer expects a rank 2 tensor.')).toBeVisible();
        await expect(page.getByText('The previous layer outputs a rank 2 tensor, this layer expects a rank 3 or')).toBeVisible();

        // fix layer order
        await page.locator('#Flatten-2-move-up-mobile').click();

        // error messages are gone
        await expect(page.getByText('The previous layer outputs a rank 4 tensor, this layer expects a rank 2 tensor.')).not.toBeVisible();
        await expect(page.getByText('The previous layer outputs a rank 2 tensor, this layer expects a rank 3 or')).not.toBeVisible();

        // remove all layers
        await page.locator("#remove-all-layers").click();
        await expect(page.getByText('Are you sure you want to')).toBeVisible();
        await page.locator("#dialogue-yes").click();

        await expect(page.locator("#Conv2D-0-label")).not.toBeVisible();
        await expect(page.locator("#Flatten-1-label")).not.toBeVisible();
        await expect(page.locator("#Dense-2-label")).not.toBeVisible();
    });


    test("reorder layers in desktop view", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.IMAGE_CLASSIFICATION)));

        // load dataset
        await page.locator("#dataset").scrollIntoViewIfNeeded();
        await page.locator(`#${LOAD_DATASET_ID}`).setInputFiles(getAssetPath(DATASET_NAME));

        // layers
        await page.locator("#layers").scrollIntoViewIfNeeded();

        await page.locator('#kiosk-conv2d').click();
        await page.locator('#kiosk-dense').click();
        await page.locator('#kiosk-flatten').click();

        await expect(page.locator("#Conv2D-0-label")).toBeVisible();
        await expect(page.locator("#Dense-1-label")).toBeVisible();
        await expect(page.locator("#Flatten-2-label")).toBeVisible();

        // error messages are visible
        await expect(page.getByText('The previous layer outputs a rank 4 tensor, this layer expects a rank 2 tensor.')).toBeVisible();
        await expect(page.getByText('The previous layer outputs a rank 2 tensor, this layer expects a rank 3 or')).toBeVisible();

        // fix layer order
        await page.locator('#Flatten-2-move-up-desktop').click();

        // error messages are gone
        await expect(page.getByText('The previous layer outputs a rank 4 tensor, this layer expects a rank 2 tensor.')).not.toBeVisible();
        await expect(page.getByText('The previous layer outputs a rank 2 tensor, this layer expects a rank 3 or')).not.toBeVisible();


        // remove all layers
        await page.locator("#Conv2D-0-remove-desktop").click();
        await page.locator("#Flatten-0-remove-desktop").click();
        await page.locator("#Dense-0-remove-desktop").click();

        // diagram is empty
        await expect(page.locator("#Conv2D-0-label")).not.toBeVisible();
        await expect(page.locator("#Flatten-1-label")).not.toBeVisible();
        await expect(page.locator("#Dense-2-label")).not.toBeVisible();
    });

});
