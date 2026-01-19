import { test as base, expect, type Page } from '@playwright/test';

/**
 * Extended Playwright test with custom fixtures for ARCompanion E2E tests
 */
export const test = base.extend<{
	/**
	 * Waits for database to finish loading before starting test
	 */
	readyDb: void;

	/**
	 * Clears localStorage before each test to ensure clean state
	 */
	cleanState: void;
}>({
	/**
	 * Database ready fixture - waits for loading state to complete
	 */
	readyDb: async ({ page }, use) => {
		await page.goto('/');

		// Wait for database loading to complete (max 15s)
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {
				// Ignore error if element doesn't exist (might already be loaded)
			});

		await use();
	},

	/**
	 * Clean state fixture - clears localStorage before test
	 */
	cleanState: async ({ page }, use) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await use();
	}
});

export { expect };

/**
 * Get any item ID from the database for testing
 */
export async function getAnyItemId(page: Page): Promise<string | null> {
	await page.goto('/');

	// Wait for database to load
	await page.locator('[data-test-id="search-button"]').waitFor({ timeout: 10000 });

	// Open search dialog
	await page.locator('[data-test-id="search-button"]').click();
	await page.locator('[data-test-id="search-input"]').waitFor();

	// Search for common term to get results
	await page.locator('[data-test-id="search-input"]').fill('a');

	// Wait for results
	const firstItem = page.locator('[data-test-id="search-item"]').first();
	await firstItem.waitFor({ timeout: 5000 }).catch(() => null);

	const itemId = await firstItem.getAttribute('data-item-id');

	// Close dialog
	await page.keyboard.press('Escape');

	return itemId;
}

/**
 * Get a craftable item ID from the database for testing
 */
export async function getCraftableItemId(page: Page): Promise<string | null> {
	await page.goto('/');

	// Wait for database to load
	await page.locator('[data-test-id="search-button"]').waitFor({ timeout: 10000 });

	// Open search dialog
	await page.locator('[data-test-id="search-button"]').click();
	await page.locator('[data-test-id="search-input"]').waitFor();

	// Search for common craftable items
	await page.locator('[data-test-id="search-input"]').fill('bandage');

	// Wait for results
	const firstItem = page.locator('[data-test-id="search-item"]').first();
	await firstItem.waitFor({ timeout: 5000 }).catch(() => null);

	const itemId = await firstItem.getAttribute('data-item-id');

	// Close dialog
	await page.keyboard.press('Escape');

	return itemId;
}
