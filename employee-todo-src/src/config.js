/** 與 liff-checkin shared/js/config.js 對齊（project-console Web App） */
export const GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';

/** 添心 LINE Login channel（各 LIFF app 共用 channel id 前綴） */
export const TANXIN_LINE_LOGIN_CHANNEL_PREFIX = '2007974938';

/**
 * 派工待辦專用 LIFF（同 channel 2007974938，Endpoint 見下）。
 * @see LINE Developers → LIFF app 2007974938-U374uwei
 */
export const EMPLOYEE_TODO_LIFF_ID = '2007974938-U374uwei';

/**
 * 新 LIFF 在 LINE Developers 登記的 Endpoint（liff.login redirectUri 須以此字串為前綴）。
 * @see https://developers.line.biz/en/reference/liff/#login
 */
export const EMPLOYEE_TODO_LIFF_ENDPOINT_URL =
  'https://info.tanxin.space/modules/projects/employee-todo/';

/** SEC-1 Google Sheet（GAS todo_*）；切換前需自 Mantle 匯入，勿覆寫 Mantle */
export const EMPLOYEE_TODO_SHEET_ID = '1QfVtsf7Pr9Nmn7wOmC-xYceNq7ChFclM2aoh5JvJ01Q';

/** MantleDB v2 room（正式回滾仍讀寫此處；SEC-1 不寫回） */
export const MANTLE_EMPLOYEE_TODO_ROOM = 'yang-employee-todo-v2-1792379200';

/** 輪詢間隔（舊 Mantle bundle 為 12e3；改 45s 減 GAS 負載） */
export const SYNC_INTERVAL_MS = 45_000;

export function resolveEmployeeTodoLiffId() {
  const id = (EMPLOYEE_TODO_LIFF_ID || '').trim();
  if (!id || /^TODO/i.test(id) || id.includes('REPLACE')) return null;
  return id;
}

export function missingEmployeeTodoLiffMessage() {
  return (
    '派工待辦 LIFF 尚未設定：請 Nephi 在 LINE Developers 建立 Endpoint 為 ' +
    EMPLOYEE_TODO_LIFF_ENDPOINT_URL +
    ' 的 LIFF，並將 EMPLOYEE_TODO_LIFF_ID 寫入 employee-todo-src/src/config.js。'
  );
}

/**
 * @param {string} [role] paigong | ende | ayong
 */
export function buildEmployeeTodoAppUrl(role = '', { origin } = {}) {
  const base = origin
    ? `${origin}/modules/projects/employee-todo/`
    : EMPLOYEE_TODO_LIFF_ENDPOINT_URL;
  const u = new URL(base, 'https://info.tanxin.space');
  if (role) u.searchParams.set('role', role);
  return u.href;
}
