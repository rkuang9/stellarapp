import { newModelURL } from '@/lib/utility';
import { ProjectType } from '@/types/project_types';
import { test, expect } from '@playwright/test';
import {
    LOAD_LOCAL_MODEL_ID,
    testURL,
    getAssetPath
} from "e2e/tests/test-utils";

const PROJECT_ZIP_NAME = "Gundam-Wiki-LLM-Test.zip";
const WIKI_LINK = "https://en.wikipedia.org/wiki/Gundam";
const LOCAL_TEXT_DOCUMENT = "Gundam-Wiki-Article.txt";
const LOCAL_PDF_DOCUMENT = "Gundam-Wiki-Article.pdf";
const TRAINING_BACKEND = "WebGPU (GPU)";
const NUM_LAYERS = "1";
const NUM_HEADS = "2";
const SEQUENCE_LENGTH = "64";
const EMBED_SIZE = "32";
const TRAIN_EPOCHS = "1";
const BATCH_SIZE = "1";
const LEARNING_RATE = "0.001";


test.describe("gpt train, load, and inference", () => {

    test("train a model, run inference, then save", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.TEXT_GENERATION)), { waitUntil: "networkidle" });

        // add pre-training Wikipedia article        
        await page.getByRole('button', { name: 'Add pre-training dataset' }).click();
        await page.getByRole('tab', { name: 'Wikipedia' }).click();
        await page.getByRole('textbox', { name: 'Example (one URL per line)' }).click();
        await page.getByRole('textbox', { name: 'Example (one URL per line)' }).fill(WIKI_LINK);
        await page.getByRole('button', { name: 'Add' }).click();
        await page.getByRole('button', { name: 'Download pending datasets' }).click();
        await page.getByRole('button', { name: 'Download' }).click();
        await expect(page.locator(`[data-url="dataset-[${WIKI_LINK}]"]`)).toBeVisible();

        // model size section, use the smallest size possible for quicker testing
        await page.getByRole('button', { name: 'micro' }).click();
        await page.locator('#tokenizer').click();
        await page.getByLabel('HuggingFaceTB/SmolLM2-1.7B-').getByText('HuggingFaceTB/SmolLM2-1.7B-').click();
        await page.locator('#epochs').click();
        await page.locator('#epochs').press('ControlOrMeta+a');
        await page.locator('#epochs').fill('1');
        await page.locator('#epochs').press('ControlOrMeta+a');
        await page.locator('#batch-size').click();
        await page.locator('#batch-size').fill('1');
        // default backend is webgpu
        await expect(page.locator('#training-backend')).toContainText('WebGPU (GPU)');

        // set some wrong fields, it should prevent the user from training
        await page.locator("#num-heads").fill("3");
        await expect(page.locator("#model-size-error-msg")).toBeVisible();
        await expect(page.locator("#model-size-error-msg")).toContainText("The embedding size (32) must be divisible by the number of heads per layer (3)");
        await page.getByRole('button', { name: 'Train', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Pre-train model' }).click();
        await expect(page.getByRole('heading', { name: 'Not ready to train yet' })).toBeVisible();
        await page.locator('#dialogue-close').click();
        // restore correct values
        await page.getByRole('button', { name: 'micro' }).click();

        // start training
        await page.getByRole('button', { name: 'Train', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Pre-train model' }).click();
        await expect(page.getByText('Loss:')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Accuracy:')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Perplexity:')).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Pause' }).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // inference
        await expect(page.locator('#kv-cache-size')).toBeVisible();
        await page.locator("#inference").scrollIntoViewIfNeeded();
        await page.locator("#chat-input").click();
        await page.locator("#chat-input").fill("gundam");
        // send chat by clicking the up arrow button
        await expect(page.locator("#chat-control-button")).toBeVisible()
        await expect(page.locator("#chat-control-button-start")).toBeVisible()
        await page.locator("#chat-control-button-start").click();
        // user's prompt is displayed in the chat interface
        await expect(page.locator('#chat-msg-content-0')).not.toBeEmpty();
        // tokens are being generated and displayed in the chat interface
        expect(await page.locator("#chat-msg-container-1").textContent()).not.toBeNull();
        // stop chat by clicking the square button
        await expect(page.locator("#chat-control-button-stop")).toBeVisible();
        await page.locator("#chat-control-button").click();
        // the send and stop buttons are no longer visible
        await expect(page.locator("#chat-control-button")).not.toBeVisible()

        // new chat clears old chat
        await expect(page.locator("#start-new-chat")).toBeVisible();
        await page.locator("#start-new-chat").click();
        await expect(page.locator('#chat-msg-content-0')).not.toBeVisible();
        await expect(page.locator('#chat-msg-content-1')).not.toBeVisible();

        // save, but this cannot properly test without throttling the browser network speed
        //await saveNewTestModel(page);
    });


    test("load a locally saved model, train 1 epoch using a local text document, and run inference", async ({ page }) => {
        await page.goto(testURL(newModelURL(ProjectType.TEXT_GENERATION)));
        await page.waitForLoadState("networkidle"); // wait for web worker to fully load

        // load model and remove the dataset
        await page.locator(`#${LOAD_LOCAL_MODEL_ID}`).setInputFiles(getAssetPath(PROJECT_ZIP_NAME));
        await expect(page.getByText("Loaded model with")).toBeVisible({ timeout: 5_000 });
        await page.locator(`[data-remove="dataset-[${WIKI_LINK}]-remove"]`).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await expect(page.locator(`[data-url="dataset-[${WIKI_LINK}]"]`)).not.toBeVisible();

        // add to dataset some local txt and pdf documents
        for (const filename of [LOCAL_TEXT_DOCUMENT, LOCAL_PDF_DOCUMENT]) {
            await page.getByRole('button', { name: 'Add pre-training dataset' }).click();
            await page.getByRole('tab', { name: 'Load File' }).click();
            await page.locator("#llm-dataset-file-input").setInputFiles(getAssetPath(filename));
            await page.getByRole('button', { name: 'Add' }).click();
            await expect(page.locator(`[data-url="dataset-[https://localhost/files/${filename}]"]`)).toBeVisible();
        }

        // training progress displays the last epoch
        await expect(page.locator("#current-epoch")).toHaveText("Epoch 1");
        await expect(page.locator("#current-batch")).toHaveText("Batch 43/43");
        await expect(page.locator("#current-eta")).toHaveText("00:00:03");
        await expect(page.locator("#training-metrics-log")).toContainText("Loss: 9.97581", { timeout: 5_000 });

        // model size section
        expect(await page.locator("#num-layers").inputValue()).toBe(NUM_LAYERS);
        expect(await page.locator("#num-heads").inputValue()).toBe(NUM_HEADS);
        expect(await page.locator('#sequence-length').textContent()).toBe(SEQUENCE_LENGTH);
        expect(await page.locator("#embed-size").textContent()).toBe(EMBED_SIZE);

        // training section
        expect(await page.locator("#epochs").inputValue()).toBe(TRAIN_EPOCHS);
        expect(await page.locator("#batch-size").inputValue()).toBe(BATCH_SIZE);
        expect(await page.locator("#learning-rate").inputValue()).toBe(LEARNING_RATE);
        await expect(page.locator("#training-backend")).toHaveText(TRAINING_BACKEND, { useInnerText: true })

        // verify select fields
        await expect(page.locator("#training-backend")).toHaveText("WebGPU (GPU)", { useInnerText: true })

        // verify resume training works
        await page.locator("#training").scrollIntoViewIfNeeded();
        await page.locator('#train-model').click();
        await page.locator('#train').click();
        await expect(page.getByText('Loss:')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Accuracy:')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Perplexity:')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(`Epoch 2`)).toBeVisible({ timeout: 10_000 });
        // stop training
        await page.locator('#train-model').click();
        await page.locator('#dialogue-yes').click();
        await expect(page.locator('#train-model')).toContainText("Train", { timeout: 5_000 });

        // inference
        await page.locator("#inference").scrollIntoViewIfNeeded();
        await expect(page.locator('#kv-cache-size')).toBeVisible();
        await page.locator("#inference").scrollIntoViewIfNeeded();
        await page.locator("#chat-input").click();
        await page.locator("#chat-input").fill("gundam");
        // send chat by clicking the up arrow button
        await expect(page.locator("#chat-control-button")).toBeVisible()
        await expect(page.locator("#chat-control-button-start")).toBeVisible()
        await page.locator("#chat-control-button-start").click();
        // user's prompt is displayed in the chat interface
        await expect(page.locator('#chat-msg-content-0')).not.toBeEmpty();
        // tokens are being generated and displayed in the chat interface
        expect(await page.locator("#chat-msg-container-1").textContent()).not.toBeNull();
        // stop chat by clicking the square button
        await expect(page.locator("#chat-control-button-stop")).toBeVisible();
        await page.locator("#chat-control-button").click();
        // the send and stop buttons are no longer visible
        await expect(page.locator("#chat-control-button")).not.toBeVisible()

        // new chat clears old chat
        await expect(page.locator("#start-new-chat")).toBeVisible();
        await page.locator("#start-new-chat").click();
        await expect(page.locator('#chat-msg-content-0')).not.toBeVisible();
        await expect(page.locator('#chat-msg-content-1')).not.toBeVisible();
    });

});
