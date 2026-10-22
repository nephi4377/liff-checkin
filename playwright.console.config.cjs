/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'e2e/console',
  testMatch: '**/*.spec.cjs',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8090/index.html',
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx --yes serve@14 -l 8090 .',
    cwd: __dirname,
    url: 'http://127.0.0.1:8090/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
};
