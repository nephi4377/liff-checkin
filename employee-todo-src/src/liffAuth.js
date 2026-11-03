import {
  missingEmployeeTodoLiffMessage,
  resolveEmployeeTodoLiffId,
} from './config.js';
import { isEmployeeTodoPreviewMode } from './localDev.js';
import { waitForLiffSdk } from './liffSdk.js';
import {
  buildEmployeeTodoLoginRedirectUri,
} from './liffRedirectUri.js';

const TEST_TOKEN = 'test-liff-token-for-vitest';
const LOGIN_ATTEMPT_KEY = 'et-liff-login-attempt-v1';

function clearLoginAttemptFlag() {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
  } catch {
    /* ignore */
  }
}

function triggerLoginOnce(liff, redirectUri) {
  try {
    if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY) === '1') {
      return { blocked: true };
    }
    sessionStorage.setItem(LOGIN_ATTEMPT_KEY, '1');
  } catch {
    /* ignore */
  }
  liff.login({ redirectUri });
  return { blocked: false };
}

/**
 * 初始化 LIFF 並取得 id token（專用派工待辦 LIFF app，非主控台 LIFF）
 */
export async function ensureLiffSession() {
  if (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST) {
    return { idToken: TEST_TOKEN, displayName: '測試員', loggedIn: true };
  }

  if (isEmployeeTodoPreviewMode()) {
    return {
      idToken: TEST_TOKEN,
      displayName: '預覽模式（不寫入正式資料）',
      loggedIn: true,
      preview: true,
    };
  }

  const liffId = resolveEmployeeTodoLiffId();
  if (!liffId) {
    return {
      idToken: '',
      displayName: '',
      loggedIn: false,
      configMissing: true,
      error: missingEmployeeTodoLiffMessage(),
    };
  }

  const liff = await waitForLiffSdk();
  if (!liff) throw new Error('LIFF SDK 未載入');

  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    const redirectUri = buildEmployeeTodoLoginRedirectUri(window.location);
    const attempt = triggerLoginOnce(liff, redirectUri);
    return {
      idToken: '',
      displayName: '',
      loggedIn: false,
      pendingLogin: !attempt.blocked,
      loginLoopBlocked: attempt.blocked,
    };
  }
  clearLoginAttemptFlag();
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

export { clearLoginAttemptFlag, LOGIN_ATTEMPT_KEY };

export async function refreshIdToken() {
  if (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST) return TEST_TOKEN;
  if (isEmployeeTodoPreviewMode()) return TEST_TOKEN;
  if (!resolveEmployeeTodoLiffId()) return '';
  await waitForLiffSdk().catch(() => null);
  const liff = window.liff;
  if (!liff || !liff.isLoggedIn()) return '';
  return liff.getIDToken() || '';
}
