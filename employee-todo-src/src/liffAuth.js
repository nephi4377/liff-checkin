import { PROJECT_CONSOLE_LIFF_ID } from './config.js';

const TEST_TOKEN = 'test-liff-token-for-vitest';

/**
 * 初始化 LIFF 並取得 id token（與主控台同一 LIFF app）
 */
export async function ensureLiffSession() {
  if (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST) {
    return { idToken: TEST_TOKEN, displayName: '測試員', loggedIn: true };
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === '1') {
    return { idToken: TEST_TOKEN, displayName: '預覽模式', loggedIn: true, preview: true };
  }

  const liff = window.liff;
  if (!liff) throw new Error('LIFF SDK 未載入');

  await liff.init({ liffId: PROJECT_CONSOLE_LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return { idToken: '', displayName: '', loggedIn: false, pendingLogin: true };
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LIFF id token');
  let displayName = '';
  try {
    const profile = await liff.getProfile();
    displayName = profile.displayName || '';
  } catch {
    displayName = '';
  }
  return { idToken, displayName, loggedIn: true };
}

export async function refreshIdToken() {
  if (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST) return TEST_TOKEN;
  if (new URLSearchParams(window.location.search).get('preview') === '1') return TEST_TOKEN;
  const liff = window.liff;
  if (!liff || !liff.isLoggedIn()) return '';
  return liff.getIDToken() || '';
}
