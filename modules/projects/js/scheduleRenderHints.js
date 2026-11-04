/**
 * 工程排程分頁：缺關鍵欄位時的純 DOM 提示（不依賴 API）。
 */

export const SCHEDULE_MISSING_START_DATE_MESSAGE =
  '此案場尚未設定專案起始日，無法排程。';

/**
 * @param {HTMLElement} container
 */
export function mountScheduleMissingStartDateHint(container) {
  container.innerHTML = '';
  container.style.display = '';

  const card = document.createElement('div');
  card.className = 'card schedule-missing-start-date mb-4';
  card.style.padding = '1rem 1.1rem';

  const p = document.createElement('p');
  p.className = 'muted';
  p.style.margin = '0';
  p.style.lineHeight = '1.45';
  p.textContent = SCHEDULE_MISSING_START_DATE_MESSAGE;

  card.appendChild(p);
  container.appendChild(card);
}
