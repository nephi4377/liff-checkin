/**
 * 施工日誌「編輯文字」樂觀更新／失敗還原（純資料，無 DOM）。
 * 失敗必須把快取裡的內文還原成儲存前，不能讓人以為已經改好。
 */

export const LOG_TEXT_SAVE_FAIL_MESSAGE =
  '文字沒存到，畫面已還原成儲存前。請再按「編輯文字」改一次後儲存。';

function dailyLogsOf(cacheData) {
  if (!cacheData || typeof cacheData !== 'object') return null;
  const logs = cacheData.data && cacheData.data.dailyLogs;
  return Array.isArray(logs) ? logs : null;
}

export function findDailyLog(cacheData, logId) {
  const logs = dailyLogsOf(cacheData);
  if (!logs || logId == null || logId === '') return null;
  return logs.find((log) => log && String(log.LogID) === String(logId)) || null;
}

/** 寫入前先拍下舊內文；找不到該則則 found=false */
export function snapshotLogText(cacheData, logId) {
  const log = findDailyLog(cacheData, logId);
  if (!log) return { found: false, previousText: null };
  return { found: true, previousText: log.Content };
}

/** 把該則內文改成 newText；找不到則回 false，不丟錯 */
export function writeLogText(cacheData, logId, newText) {
  const log = findDailyLog(cacheData, logId);
  if (!log) return false;
  log.Content = newText;
  return true;
}

export function restoreLogText(cacheData, logId, previousText) {
  return writeLogText(cacheData, logId, previousText);
}

/** 記憶體中的日誌列（state.currentLogsData）同樣要樂觀改、失敗還原 */
export function snapshotLogTextInList(logs, logId) {
  if (!Array.isArray(logs) || logId == null || logId === '') {
    return { found: false, previousText: null };
  }
  const log = logs.find((row) => row && String(row.LogID) === String(logId));
  if (!log) return { found: false, previousText: null };
  return { found: true, previousText: log.Content };
}

export function writeLogTextInList(logs, logId, newText) {
  if (!Array.isArray(logs)) return false;
  const log = logs.find((row) => row && String(row.LogID) === String(logId));
  if (!log) return false;
  log.Content = newText;
  return true;
}
