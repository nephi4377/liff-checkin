/**
 * BudgetWeb：內建匿名登入初始化 + 頁面可渲染（舊規則下亦相容）。
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACTS = process.env.RTDB_E2E_ARTIFACTS || '/opt/cursor/artifacts/screenshots';
const GITHACK_SHA = process.env.GITHACK_SHA || process.env.GITHUB_SHA || '';

function artifactPath(name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return path.join(ARTIFACTS, name);
}

test.describe('BudgetWeb RTDB auth layer', () => {
  test('本地 serve：TanxinFirebaseRtdb 載入且可匿名登入', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/tools/BudgetWeb_Standalone.html', { waitUntil: 'load' });
    await expect(page.locator('h1')).toContainText('報價單', { timeout: 15000 });

    const authProbe = await page.evaluate(async () => {
      if (!window.TanxinFirebaseRtdb) return { ok: false, reason: 'missing TanxinFirebaseRtdb' };
      try {
        const user = await window.TanxinFirebaseRtdb.ensureAuth();
        return { ok: !!user && !!user.uid, uid: user?.uid || null };
      } catch (e) {
        return { ok: false, reason: String(e?.message || e) };
      }
    });

    expect(authProbe.ok, JSON.stringify(authProbe)).toBe(true);
    expect(errors.filter((m) => !/permission_denied/i.test(m))).toHaveLength(0);

    await page.locator('#projectNoInput').fill('999');
    await page.waitForTimeout(800);
    await page.screenshot({ path: artifactPath('budgetweb-local-rtdb-auth.png'), fullPage: true });
  });

  test('raw.githack 預覽可渲染（完整 sha）', async ({ page }) => {
    test.skip(!GITHACK_SHA, '需設定 GITHACK_SHA 或 GITHUB_SHA');

    const url = `https://raw.githack.com/nephi4377/liff-checkin/${GITHACK_SHA}/tools/BudgetWeb_Standalone.html`;
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await expect(page.locator('h1')).toContainText('報價單', { timeout: 30000 });

    const hasRtdb = await page.evaluate(() => typeof window.TanxinFirebaseRtdb !== 'undefined');
    expect(hasRtdb).toBe(true);
    expect(errors).toHaveLength(0);

    await page.screenshot({ path: artifactPath('budgetweb-githack-rtdb-auth.png'), fullPage: true });
  });
});
