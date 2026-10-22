const { test, expect } = require('@playwright/test');
const { mockOptions, prepareConsolePage } = require('./gas-mock');

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await prepareConsolePage(page);
});

test('hub SPA loads dashboard on localhost without LIFF', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('link', { name: '主控台' })).toBeVisible();
  await expect(page.getByText('開啟專案工作區')).toBeVisible({ timeout: 20_000 });
});

test('project board lists mocked projects', async ({ page }) => {
  await page.goto('/index.html#/project-board');
  await expect(page.getByRole('heading', { name: '專案看板' })).toBeVisible();
  await expect(page.getByText('E2E 測試專案')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /開啟.*工作區/ })).toBeVisible();
});

test('open project workspace iframe and switch main tabs', async ({ page }) => {
  await page.goto('/index.html#/project-board');
  await page.getByRole('button', { name: /開啟.*工作區/ }).click();
  await expect(page).toHaveURL(/#\/project-console\?id=E2E-001/);

  const consoleFrame = page.frameLocator('iframe[src*="managementconsole"]');
  await expect(consoleFrame.locator('#project-title')).toContainText('E2E 測試案場', {
    timeout: 25_000,
  });
  await expect(consoleFrame.getByText('E2E smoke 日誌內容')).toBeVisible();

  const scheduleTab = consoleFrame.locator('.main-nav .nav-button[data-view="schedule"]');
  await scheduleTab.click();
  await expect(scheduleTab).toHaveClass(/active/);
  await expect(consoleFrame.locator('#schedule-container')).toBeVisible();
  await expect(consoleFrame.locator('#schedule-container')).toContainText('泥作工程');

  await consoleFrame.getByRole('button', { name: '施工日誌' }).click();
  await expect(consoleFrame.getByText('E2E smoke 日誌內容')).toBeVisible();
});

test('hub project list API error shows user-facing message', async ({ page }) => {
  mockOptions.failHubProjects = true;
  await page.goto('/index.html#/project-board');
  await expect(page.getByText('專案清單暫時讀不到')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('button', { name: '再試一次' })).toBeVisible();
});

test('project console API error shows friendly error panel', async ({ page }) => {
  mockOptions.failProjectDetail = true;
  await page.goto(
    '/modules/projects/managementconsole.html?id=E2E-001&uid=U0000000000000000000000000000e2e1&name=E2E'
  );
  await expect(page.getByText('暫時打不開這個案場')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('E2E mock：案場資料失敗')).toBeVisible();
  await expect(page.getByRole('button', { name: '再試一次' })).toBeVisible();
});
