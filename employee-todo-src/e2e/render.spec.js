import { expect, test } from '@playwright/test';

/**
 * e2e 對正式產物 `modules/projects/employee-todo/`（Mantle bundle + sheet-bridge）。
 * preview=1：bridge 示範資料，不打 GAS。
 */
test('hub renders Mantle entry', async ({ page }) => {
  await page.goto('index.html?preview=1');
  await expect(page.getByText('員工待辦', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /派工/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /恩德/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /阿勇/ })).toBeVisible();
});

test('paigong view shows mist sections', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'employee-todo-profile-v1',
      JSON.stringify({
        displayName: '羊',
        role: 'assistant',
        fieldPin: '2468',
        linkedAt: Date.now(),
      }),
    );
  });
  await page.goto('index.html?preview=1&role=paigong');
  await expect(page.getByText('派工', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('優先').first()).toBeVisible();
  await expect(page.getByText('提醒').first()).toBeVisible();
  await expect(page.getByText('待處理').first()).toBeVisible();
});

test('ende view renders worker board', async ({ page }) => {
  await page.goto('index.html?preview=1&role=ende');
  await expect(page.getByText(/恩德/).first()).toBeVisible();
  await expect(page.getByText('優先').first()).toBeVisible();
});
