import { Page, expect } from "@playwright/test";

//import prisma from "@/lib/database/prisma_sys";
import path from "path";
import { ProjectType } from "@/types/project_types";
import { baseURL, newModelURL } from "@/lib/utility";


export const HOME_PAGE: string = baseURL();
export const TEST_USERNAME = "forge-test-user-938";
export const TEST_USERNAME_DEFAULT = "_user95546975";
export const TEST_MODEL_NAME = "playwright-test-model";
export const TEST_MODEL_DESCRIPTION = "This is an empty Playwright test model.";
export const TEST_MODEL_ABOUT = "Test model about";

// IDs for the dataset and project load button inputs
export const LOAD_DATASET_ID = "load-dataset";
export const LOAD_LOCAL_MODEL_ID = "load-local-project";
export const LOAD_IMAGES_ID = "load-inference-images";

export const MODEL_SAVE_ID = "model-save-button";

export const BREAKING_CHANGE_TITLE = "Breaking change found";


export function testURL(url: string) {
    return `${baseURL()}${url}`;
}


export function getAssetPath(filename: string) {
    return path.join(process.cwd(), "e2e/assets", filename);
}


interface createTestModelClientArgs {
    public_access?: boolean;
}


/**
 * Creates a test project. Upon submission, the browser is brought
 * to the project's profile page
 * 
 * @param page A Playwright Page object
 */
export async function createTestModelClient(
    page: Page,
    project_type: ProjectType,
    { public_access = false }: createTestModelClientArgs | undefined = {}) {
    // create a new project
    await page.goto(testURL(newModelURL(project_type)));
    await page.locator(`#${MODEL_SAVE_ID}`).click();
    await page.locator("#model-save-project-name").fill(TEST_MODEL_NAME);
    await page.locator(`#model-save-${public_access ? "public" : "private"}`).click();
    await page.locator("#model-save-submit").click();
    await expect(page.getByText("Project configurations saved")).toBeVisible();
}


export async function signInGoogle(page: Page, from_url: string = HOME_PAGE) {
    // sign in
    await page.goto(from_url);
    await page.locator("#guest-sign-in-desktop").click();
    await page.locator("#sign-in-google").click();
    // wait for browser to return to website
    await page.waitForLoadState("networkidle");

    if (page.url().startsWith(HOME_PAGE)) {
        // happens when recently signed out,
        // don't need to go through signing into Google
        return;
    }

    if (await page.getByText('Choose an account', { exact: true }).isVisible()) {
        // already logged in before (see the auth.setup.ts test)
        await page.getByRole('link', { name: 'test test forge.test.user01@' }).click();
    } else {
        // currently at google's sign-in page, fill out test account credentials
        await page.getByLabel('Email or phone').fill('forge.test.user01@gmail.com');
        await page.getByRole('button', { name: 'Next' }).click();
        await page.getByLabel('Enter your password').fill('aiforgetesting030!');
        await page.getByRole('button', { name: 'Next' }).click();
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.goto(from_url);
        await page.waitForURL(from_url);
    }
}
