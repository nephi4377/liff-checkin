/** project-console Web App（與 CODING `shared/js/config.js` GAS_WEB_APP_URL 相同） */
export const PROJECT_CONSOLE_EXEC_URL =
  (import.meta.env.VITE_PROJECT_CONSOLE_URL as string | undefined)?.trim() ||
  'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec'

/** 僅本機預覽；正式站勿開。對齊 project-console dev_bypass 慣例。 */
export const TODO_DEV_BYPASS =
  import.meta.env.VITE_TODO_DEV_BYPASS === 'true' ||
  import.meta.env.VITE_TODO_DEV_BYPASS === '1'

export const TODO_DEV_USER_ID =
  (import.meta.env.VITE_TODO_DEV_USER_ID as string | undefined)?.trim() || ''
