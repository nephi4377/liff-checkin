// @ts-check
const path = require('path');

/** BudgetWeb RTDB 登入層 E2E（根目錄 serve；console smoke 見 playwright.console.config.cjs） */
module.exports = {
  testDir: path.join(__dirname, 'e2e'),
  testIgnore: ['**/console/**'],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 1024, height: 720 },
  },
  webServer: {
    command: 'npx --yes serve@14 -l 8080 .',
    port: 8080,
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
  },
};
