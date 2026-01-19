import { test, expect, getCraftableItemId } from './fixtures/test-helpers';

test.describe('Item Details', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Wait for database to load
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {});
	});

	test('clicking item opens drawer', async ({ page }) => {
		// Open search and click an item
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Drawer should be visible
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();
	});

	test('drawer shows item information', async ({ page }) => {
		// Open search and click an item
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Drawer should show item title
		await expect(page.locator('[data-test-id="item-drawer-title"]')).toBeVisible();

		// Title should not be empty
		const titleText = await page.locator('[data-test-id="item-drawer-title"]').textContent();
		expect(titleText).toBeTruthy();
		expect(titleText?.length).toBeGreaterThan(0);
	});

	test('clicking ingredients navigates to them', async ({ page }) => {
		// Get a craftable item
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		// Open search and find craftable item
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Wait for drawer to open
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

		// Check if there are ingredients
		const ingredient = page.locator('[data-test-id^="item-ingredient-"]').first();

		if (await ingredient.isVisible()) {
			const originalTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();

			// Click ingredient
			await ingredient.click();

			// Drawer should still be visible
			await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

			// Title should have changed
			const newTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();
			expect(newTitle).not.toBe(originalTitle);
		}
	});

	test('clicking salvage outputs navigates', async ({ page }) => {
		// Find an item with salvage outputs
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('a');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Wait for drawer
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

		// Check if there are salvage outputs
		const salvageOutput = page.locator('[data-test-id^="item-salvage-output-"]').first();

		if (await salvageOutput.isVisible()) {
			const originalTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();

			// Click salvage output
			await salvageOutput.click();

			// Drawer should still be visible
			await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

			// Title should have changed
			const newTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();
			expect(newTitle).not.toBe(originalTitle);
		}
	});

	test('clicking recycle outputs navigates', async ({ page }) => {
		// Find an item with recycle outputs
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('a');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Wait for drawer
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

		// Check if there are recycle outputs
		const recycleOutput = page.locator('[data-test-id^="item-recycle-output-"]').first();

		if (await recycleOutput.isVisible()) {
			const originalTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();

			// Click recycle output
			await recycleOutput.click();

			// Drawer should still be visible
			await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

			// Title should have changed
			const newTitle = await page.locator('[data-test-id="item-drawer-title"]').textContent();
			expect(newTitle).not.toBe(originalTitle);
		}
	});

	test('bookmark button works in drawer', async ({ page }) => {
		// Get craftable item
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		// Open search and click craftable item
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		const itemIdAttr = await firstItem.getAttribute('data-item-id');
		await firstItem.click();

		// Wait for drawer
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

		// Click bookmark button
		await page.locator('[data-test-id="item-drawer-bookmark-btn"]').click();

		// Close drawer
		await page.locator('[data-test-id="item-drawer-close"]').click();

		// Item should be in bookmarks bar
		if (itemIdAttr) {
			await expect(page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`)).toBeVisible();
		}
	});

	test('close button closes drawer', async ({ page }) => {
		// Open item drawer
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		await firstItem.click();

		// Drawer should be visible
		await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();

		// Click close button
		await page.locator('[data-test-id="item-drawer-close"]').click();

		// Drawer should be hidden
		await expect(page.locator('[data-test-id="item-drawer"]')).not.toBeVisible();
	});
});
