import { test, expect } from './fixtures/test-helpers';

test.describe('Database Loading', () => {
	test('loads database successfully', async ({ page }) => {
		await page.goto('/');

		// Wait for database to load
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {});

		// Should not show error state
		await expect(page.locator('[data-test-id="materials-grid-error"]')).not.toBeVisible();

		// Should show empty state (no bookmarks yet)
		await expect(page.locator('[data-test-id="materials-grid-empty"]')).toBeVisible();

		// App bar should be visible
		await expect(page.locator('[data-test-id="app-bar"]')).toBeVisible();

		// Search button should be enabled
		await expect(page.locator('[data-test-id="search-button"]')).toBeEnabled();
	});

	test('loading state transitions correctly', async ({ page }) => {
		await page.goto('/');

		// Loading state should appear initially (or have already passed)
		const loadingState = page.locator('[data-test-id="materials-grid-loading"]');

		// If loading state is still visible, wait for it to disappear
		if (await loadingState.isVisible()) {
			await loadingState.waitFor({ state: 'hidden', timeout: 15000 });
		}

		// After loading, should show empty state
		await expect(page.locator('[data-test-id="materials-grid-empty"]')).toBeVisible();
	});

	test('empty state shows when no bookmarks exist', async ({ page }) => {
		await page.goto('/');

		// Clear any existing bookmarks
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Wait for database to load
		await page
			.locator('[data-test-id="materials-grid-loading"]')
			.waitFor({ state: 'hidden', timeout: 15000 })
			.catch(() => {});

		// Empty state should be visible
		await expect(page.locator('[data-test-id="materials-grid-empty"]')).toBeVisible();

		// Should contain helpful text
		await expect(page.locator('[data-test-id="materials-grid-empty"]')).toContainText(
			'Get Started'
		);
	});
});
