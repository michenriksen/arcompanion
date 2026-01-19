import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for ARCompanion E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 30000, // 30s to handle database loading

	use: {
		baseURL: 'http://localhost:4173/arcompanion',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	webServer: {
		command: 'npm run preview -- --host',
		url: 'http://localhost:4173/arcompanion',
		reuseExistingServer: !process.env.CI,
		timeout: 30000
	}
});
