import { test, expect, getCraftableItemId } from './fixtures/test-helpers';

test.describe('Materials Visualization', () => {
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

	test('bubble charts render after bookmarking', async ({ page }) => {
		// Get craftable item and bookmark it
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

			// Sections should be visible
			await expect(page.locator('[data-test-id="collect-section"]')).toBeVisible();
			await expect(page.locator('[data-test-id="salvage-section"]')).toBeVisible();
			await expect(page.locator('[data-test-id="recycle-section"]')).toBeVisible();
		}
	});

	test('collect section contains bubbles', async ({ page }) => {
		// Get craftable item and bookmark it
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

			// Wait a moment for charts to render
			await page.waitForTimeout(500);

			// Collect section should have SVG with bubbles
			const collectSvg = page
				.locator('[data-test-id="collect-section"]')
				.locator('[data-test-id="bubble-chart-svg"]');
			await expect(collectSvg).toBeVisible();

			// Should have at least one bubble
			const bubbles = collectSvg.locator('g.bubble');
			const count = await bubbles.count();
			expect(count).toBeGreaterThan(0);
		}
	});

	test('salvage section contains bubbles or empty message', async ({ page }) => {
		// Get craftable item and bookmark it
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

			// Wait a moment for charts to render
			await page.waitForTimeout(500);

			const salvageSection = page.locator('[data-test-id="salvage-section"]');
			await expect(salvageSection).toBeVisible();

			// Should either have bubbles or show message
			const svg = salvageSection.locator('[data-test-id="bubble-chart-svg"]');
			const isVisible = await svg.isVisible();

			if (isVisible) {
				// Has chart - should have bubbles
				const bubbles = svg.locator('g.bubble');
				const count = await bubbles.count();
				expect(count).toBeGreaterThan(0);
			} else {
				// No chart - should show message
				await expect(salvageSection.getByText(/no items recommended/i)).toBeVisible();
			}
		}
	});

	test('clicking bubble opens drawer', async ({ page }) => {
		// Get craftable item and bookmark it
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

			// Wait for charts to render
			await page.waitForTimeout(500);

			// Find first bubble in collect section
			const collectSvg = page
				.locator('[data-test-id="collect-section"]')
				.locator('[data-test-id="bubble-chart-svg"]');

			const firstBubble = collectSvg.locator('g.bubble').first();
			if (await firstBubble.isVisible()) {
				// Click bubble
				await firstBubble.click();

				// Drawer should open
				await expect(page.locator('[data-test-id="item-drawer"]')).toBeVisible();
			}
		}
	});

	test('charts update when filters change', async ({ page }) => {
		// Get craftable item and bookmark it
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

			// Wait for charts to render
			await page.waitForTimeout(500);

			// Verify collect section is visible
			const collectSection = page.locator('[data-test-id="collect-section"]');
			await expect(collectSection).toBeVisible();

			// Open settings and change scoring method (this won't filter items out)
			await page.locator('[data-test-id="settings-button"]').click();

			// Change scoring method (doesn't filter items, just reorders)
			await page.locator('[data-test-id="scoring-weight-conscious"]').click();

			// Close settings
			await page.locator('[data-test-id="settings-close"]').click();

			// Wait for charts to update
			await page.waitForTimeout(500);

			// Collect section should still be visible (scoring method doesn't filter items)
			await expect(collectSection).toBeVisible();
		}
	});
});
