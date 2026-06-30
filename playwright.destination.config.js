import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'destination.spec.js',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60000,
  globalTimeout: 360000,
  expect: { timeout: 15000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview:test',
    url: 'http://127.0.0.1:4173/tests/fixtures/layout-harness.html',
    reuseExistingServer: true,
    timeout: 30000
  }
});
