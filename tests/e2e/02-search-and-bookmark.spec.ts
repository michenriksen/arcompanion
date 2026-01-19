import { test, expect, getCraftableItemId } from './fixtures/test-helpers';

test.describe('Search and Bookmark', () => {
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

	test('opens search dialog with Cmd+K', async ({ page }) => {
		// Dialog should not be visible initially
		await expect(page.locator('[data-test-id="search-dialog"]')).not.toBeVisible();

		// Press Cmd+K (Meta+K)
		await page.keyboard.press('Meta+k');

		// Wait for dialog to appear
		await page.locator('[data-test-id="search-dialog"]').waitFor({ state: 'visible', timeout: 2000 });

		// Dialog should be visible
		await expect(page.locator('[data-test-id="search-dialog"]')).toBeVisible();
	});

	test('opens search dialog with search button', async ({ page }) => {
		// Click search button
		await page.locator('[data-test-id="search-button"]').click();

		// Dialog should be visible
		await expect(page.locator('[data-test-id="search-dialog"]')).toBeVisible();

		// Input should be focused
		await expect(page.locator('[data-test-id="search-input"]')).toBeFocused();
	});

	test('typing filters search results', async ({ page }) => {
		// Open search dialog
		await page.locator('[data-test-id="search-button"]').click();

		// Type search query
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		// Should show results
		const results = page.locator('[data-test-id="search-item"]');
		const count = await results.count();
		expect(count).toBeGreaterThan(0);
	});

	test('bookmarking adds item to bar', async ({ page }) => {
		// Get a craftable item
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		// Open search
		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		// Wait for results
		await page.locator('[data-test-id="search-item"]').first().waitFor();

		// Bookmark first result
		const firstItem = page.locator('[data-test-id="search-item"]').first();
		const itemIdAttr = await firstItem.getAttribute('data-item-id');

		if (itemIdAttr) {
			const bookmarkBtn = page.locator(`[data-test-id="search-item-bookmark-btn-${itemIdAttr}"]`);
			await bookmarkBtn.click();

			// Close dialog
			await page.keyboard.press('Escape');

			// Item should appear in bookmarked items bar
			await expect(page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`)).toBeVisible();

			// Count should show (1)
			await expect(page.locator('[data-test-id="bookmarked-items-count"]')).toContainText('1');
		}
	});

	test('bookmarks persist across reload', async ({ page }) => {
		// Get a craftable item and bookmark it
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		const itemIdAttr = await firstItem.getAttribute('data-item-id');

		if (itemIdAttr) {
			const bookmarkBtn = page.locator(`[data-test-id="search-item-bookmark-btn-${itemIdAttr}"]`);
			await bookmarkBtn.click();

			// Wait for bookmark to appear in bar before closing dialog
			await page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`).waitFor({ timeout: 2000 });

			await page.keyboard.press('Escape');

			// Give time for localStorage to save
			await page.waitForTimeout(500);

			// Reload page
			await page.reload();

			// Wait for database to load
			await page
				.locator('[data-test-id="materials-grid-loading"]')
				.waitFor({ state: 'hidden', timeout: 15000 })
				.catch(() => {});

			// Bookmark should still be visible
			await expect(page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`)).toBeVisible();
		}
	});

	test('clicking bookmark opens drawer', async ({ page }) => {
		// Get a craftable item and bookmark it
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		const itemIdAttr = await firstItem.getAttribute('data-item-id');

		if (itemIdAttr) {
			const bookmarkBtn = page.locator(`[data-test-id="search-item-bookmark-btn-${itemIdAttr}"]`);
			await bookmarkBtn.click();
			await page.keyboard.press('Escape');

			// Click bookmarked item
			await page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`).click();

			// Drawer should open
			await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();
		}
	});

	test('remove bookmark from drawer', async ({ page }) => {
		// Get a craftable item and bookmark it
		const itemId = await getCraftableItemId(page);
		if (!itemId) {
			test.skip();
			return;
		}

		await page.locator('[data-test-id="search-button"]').click();
		await page.locator('[data-test-id="search-input"]').fill('bandage');

		const firstItem = page.locator('[data-test-id="search-item"]').first();
		await firstItem.waitFor();
		const itemIdAttr = await firstItem.getAttribute('data-item-id');

		if (itemIdAttr) {
			const bookmarkBtn = page.locator(`[data-test-id="search-item-bookmark-btn-${itemIdAttr}"]`);
			await bookmarkBtn.click();

			// Wait for bookmark to appear in bar
			await page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`).waitFor({ timeout: 2000 });

			await page.keyboard.press('Escape');

			// Open drawer
			await page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`).click();

			// Wait for drawer to open
			await page.locator('[data-test-id="item-drawer"]').waitFor({ state: 'visible' });

			// Click bookmark button in drawer to remove
			await page.locator('[data-test-id="item-drawer-bookmark-btn"]').click();

			// Wait a moment for the bookmark to be removed
			await page.waitForTimeout(300);

			// Close drawer
			await page.locator('[data-test-id="item-drawer-close"]').click();

			// Wait for drawer to close
			await page.locator('[data-test-id="item-drawer"]').waitFor({ state: 'hidden' });

			// Item should no longer be in bookmarks bar
			await expect(page.locator(`[data-test-id="bookmarked-item-${itemIdAttr}"]`)).not.toBeVisible();

			// Bookmarked items bar should not be visible when empty
			// (it's only shown when there's aggregated data)
			await expect(page.locator('[data-test-id="bookmarked-items-bar"]')).not.toBeVisible();
		}
	});
});
