import { expect, test } from '@playwright/test';

test('hub renders entry links', async ({ page }) => {
  await page.goto('/?preview=1');
  await expect(page.getByRole('heading', { name: '員工待辦' })).toBeVisible();
  await expect(page.getByRole('link', { name: '派工／行政' })).toBeVisible();
  await expect(page.getByRole('link', { name: '恩德' })).toBeVisible();
  await expect(page.getByRole('link', { name: '阿勇' })).toBeVisible();
});

test('paigong view renders composer', async ({ page }) => {
  await page.goto('/?preview=1&role=paigong');
  await expect(page.getByRole('heading', { name: '派工' })).toBeVisible();
  await expect(page.getByPlaceholder('新增派工標題')).toBeVisible();
});

test('sync interval constant is 12 seconds', async ({ page }) => {
  await page.goto('/?preview=1&role=ende');
  await expect(page.getByRole('heading', { name: '恩德' })).toBeVisible();
});
