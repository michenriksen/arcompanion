import { test, expect, getCraftableItemId } from './fixtures/test-helpers';

test.describe('Settings and Filters', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Wait for database to load
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {});

		// Bookmark an item to enable filters
		const itemId = await getCraftableItemId(page);
		if (itemId) {
			await page.locator('[data-test-id="search-button"]').click();
			await page.locator('[data-test-id="search-input"]').fill('bandage');

			const firstItem = page.locator('[data-test-id="search-item"]').first();
			await firstItem.waitFor();
			const itemIdAttr = await firstItem.getAttribute('data-item-id');

			if (itemIdAttr) {
				const bookmarkBtn = page.locator(
					`[data-test-id="search-item-bookmark-btn-${itemIdAttr}"]`
				);
				await bookmarkBtn.click();
				await page.keyboard.press('Escape');
			}
		}
	});

	test('settings panel opens and closes', async ({ page }) => {
		// Panel should not be visible initially
		await expect(page.locator('[data-test-id="settings-panel"]')).not.toBeVisible();

		// Click settings button
		await page.locator('[data-test-id="settings-button"]').click();

		// Panel should be visible
		await expect(page.locator('[data-test-id="settings-panel"]')).toBeVisible();

		// Click close button
		await page.locator('[data-test-id="settings-close"]').click();

		// Panel should be hidden
		await expect(page.locator('[data-test-id="settings-panel"]')).not.toBeVisible();
	});

	test('scoring method toggles work', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Max yield should be checked by default
		await expect(page.locator('[data-test-id="scoring-max-yield"]')).toBeChecked();

		// Click weight conscious
		await page.locator('[data-test-id="scoring-weight-conscious"]').click();

		// Weight conscious should now be checked
		await expect(page.locator('[data-test-id="scoring-weight-conscious"]')).toBeChecked();
		await expect(page.locator('[data-test-id="scoring-max-yield"]')).not.toBeChecked();

		// Click max yield again
		await page.locator('[data-test-id="scoring-max-yield"]').click();

		// Max yield should be checked again
		await expect(page.locator('[data-test-id="scoring-max-yield"]')).toBeChecked();
		await expect(page.locator('[data-test-id="scoring-weight-conscious"]')).not.toBeChecked();
	});

	test('hide scrappy toggle works', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Get initial state
		const initialState = await page
			.locator('[data-test-id="hide-scrappy-toggle"]')
			.getAttribute('data-state');

		// Click toggle
		await page.locator('[data-test-id="hide-scrappy-toggle"]').click();

		// State should have changed
		const newState = await page
			.locator('[data-test-id="hide-scrappy-toggle"]')
			.getAttribute('data-state');

		expect(newState).not.toBe(initialState);
	});

	test('hide expensive toggle works', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Get initial state
		const initialState = await page
			.locator('[data-test-id="hide-expensive-toggle"]')
			.getAttribute('data-state');

		// Click toggle
		await page.locator('[data-test-id="hide-expensive-toggle"]').click();

		// State should have changed
		const newState = await page
			.locator('[data-test-id="hide-expensive-toggle"]')
			.getAttribute('data-state');

		expect(newState).not.toBe(initialState);

		// Max value input should now be visible
		await expect(page.locator('[data-test-id="max-value-input"]')).toBeVisible();
	});

	test('max value input works', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Enable hide expensive
		await page.locator('[data-test-id="hide-expensive-toggle"]').click();

		// Max value input should be visible
		const input = page.locator('[data-test-id="max-value-input"]');
		await expect(input).toBeVisible();

		// Type a value
		await input.fill('100');

		// Value should be set
		await expect(input).toHaveValue('100');
	});

	test('rarity filters work', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Common rarity filter should exist
		const commonFilter = page.locator('[data-test-id="rarity-filter-common"]');
		await expect(commonFilter).toBeVisible();

		// Click to toggle
		await commonFilter.click();

		// Other rarities should also exist
		await expect(page.locator('[data-test-id="rarity-filter-uncommon"]')).toBeVisible();
		await expect(page.locator('[data-test-id="rarity-filter-rare"]')).toBeVisible();
		await expect(page.locator('[data-test-id="rarity-filter-epic"]')).toBeVisible();
		await expect(page.locator('[data-test-id="rarity-filter-legendary"]')).toBeVisible();
	});

	test('settings persist across reload', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Wait for panel to be visible
		await page.locator('[data-test-id="settings-panel"]').waitFor({ state: 'visible' });

		// Change scoring method
		await page.locator('[data-test-id="scoring-weight-conscious"]').click();

		// Verify it's checked before closing
		await expect(page.locator('[data-test-id="scoring-weight-conscious"]')).toBeChecked();

		// Close settings
		await page.locator('[data-test-id="settings-close"]').click();

		// Wait for panel to close
		await page.locator('[data-test-id="settings-panel"]').waitFor({ state: 'hidden' });

		// Give time for localStorage to save
		await page.waitForTimeout(500);

		// Reload page
		await page.reload();

		// Wait for database to load
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {});

		// Open settings again
		await page.locator('[data-test-id="settings-button"]').click();

		// Wait for panel to be visible
		await page.locator('[data-test-id="settings-panel"]').waitFor({ state: 'visible' });

		// Weight conscious should still be checked
		await expect(page.locator('[data-test-id="scoring-weight-conscious"]')).toBeChecked();
	});

	test('export settings downloads JSON', async ({ page }) => {
		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Setup download handler
		const downloadPromise = page.waitForEvent('download');

		// Click export button
		await page.locator('[data-test-id="settings-export-btn"]').click();

		// Wait for download
		const download = await downloadPromise;

		// Verify filename contains 'arcompanion-settings'
		expect(download.suggestedFilename()).toContain('arcompanion-settings');
		expect(download.suggestedFilename()).toContain('.json');
	});

	test('filter badge updates correctly', async ({ page }) => {
		// Badge should not be visible initially (all filters default)
		await expect(page.locator('[data-test-id="settings-filter-badge"]')).not.toBeVisible();

		// Open settings
		await page.locator('[data-test-id="settings-button"]').click();

		// Change a filter (hide scrappy)
		await page.locator('[data-test-id="hide-scrappy-toggle"]').click();

		// Close settings
		await page.locator('[data-test-id="settings-close"]').click();

		// Badge should now be visible
		await expect(page.locator('[data-test-id="settings-filter-badge"]')).toBeVisible();

		// Badge should show at least 1
		const badgeText = await page.locator('[data-test-id="settings-filter-badge"]').textContent();
		const badgeNumber = parseInt(badgeText || '0');
		expect(badgeNumber).toBeGreaterThan(0);
	});
});
