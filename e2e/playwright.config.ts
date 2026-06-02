import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL of the running Angular app.
 * Set E2E_BASE_URL to point at an already-running stack (e.g. http://localhost:4300);
 * in that mode Playwright will NOT try to boot the servers itself.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const manageServers = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // When E2E_BASE_URL is not set, boot the backend and frontend automatically.
  // reuseExistingServer lets you keep your own dev servers running locally.
  webServer: manageServers
    ? [
        {
          command: 'dotnet run',
          cwd: '../backend',
          url: 'http://localhost:5080/api/accidents',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm start',
          cwd: '../frontend',
          url: 'http://localhost:4200',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ]
    : undefined,
});
