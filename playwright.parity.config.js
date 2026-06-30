import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'parity.spec.js',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60000,
  globalTimeout: 300000,
  expect: { timeout: 15000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/parity', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1600, height: 1100 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview:test',
    url: 'http://127.0.0.1:4173/legacy-preview.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
