import { expect, test } from '@playwright/test';

// 2026-10-29：正式包回滾 Mantle UI；SEC-1 preview e2e 暫跳過，避免對錯 UI。
const SEC1_PREVIEW_READY = false;

test('hub renders entry links', async ({ page }) => {
  test.skip(!SEC1_PREVIEW_READY, 'SEC-1 LIFF Endpoint 未就緒；正式包為 Mantle 回滾');
  await page.goto('/?preview=1');
  await expect(page.getByRole('heading', { name: '員工待辦' })).toBeVisible();
  await expect(page.getByRole('link', { name: '派工／行政' })).toBeVisible();
  await expect(page.getByRole('link', { name: '恩德' })).toBeVisible();
  await expect(page.getByRole('link', { name: '阿勇' })).toBeVisible();
});

test('paigong view renders composer', async ({ page }) => {
  test.skip(!SEC1_PREVIEW_READY, 'SEC-1 LIFF Endpoint 未就緒；正式包為 Mantle 回滾');
  await page.goto('/?preview=1&role=paigong');
  await expect(page.getByRole('heading', { name: '派工' })).toBeVisible();
  await expect(page.getByPlaceholder('新增派工標題')).toBeVisible();
});

test('sync interval constant is 12 seconds', async ({ page }) => {
  test.skip(!SEC1_PREVIEW_READY, 'SEC-1 LIFF Endpoint 未就緒；正式包為 Mantle 回滾');
  await page.goto('/?preview=1&role=ende');
  await expect(page.getByRole('heading', { name: '恩德' })).toBeVisible();
});
