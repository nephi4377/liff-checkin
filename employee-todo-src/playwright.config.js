import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3456/modules/projects/employee-todo/',
    headless: true,
  },
  webServer: {
    command: 'npx --yes serve@14 -l 3456 ..',
    url: 'http://127.0.0.1:3456',
    reuseExistingServer: !process.env.CI,
  },
});
