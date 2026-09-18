/**
 * 對話重點板：列表載入合併規則。
 * 失敗不可把空陣列當成「目前沒有項目」。
 */

/**
 * @param {Array|null|undefined} previous
 * @param {{ ok?: boolean, skipped?: boolean, items?: Array, message?: string }} result
 * @returns {{ items: Array, error: string, saveCache: boolean, emptyConfirmed: boolean }}
 */
export function mergeDigestBoardListFetch(previous, result) {
  const prev = Array.isArray(previous) ? previous : [];

  if (!result || result.skipped) {
    return { items: prev, error: '', saveCache: false, emptyConfirmed: false };
  }

  if (result.ok) {
    const items = Array.isArray(result.items) ? result.items : [];
    return {
      items,
      error: '',
      saveCache: true,
      emptyConfirmed: items.length === 0
    };
  }

  const hasPrev = prev.length > 0;
  return {
    items: hasPrev ? prev : [],
    error: result.message || '更新失敗，可再試',
    saveCache: false,
    emptyConfirmed: false
  };
}

/**
 * 樂觀改狀態：回傳新列表與還原用快照。
 */
export function applyOptimisticStatus(items, itemId, nextStatus) {
  const list = Array.isArray(items) ? items : [];
  const idx = list.findIndex((it) => String(it.item_id) === String(itemId));
  if (idx < 0) {
    return { items: list, snapshot: null };
  }
  const snapshot = { ...list[idx] };
  const next = list.slice();
  next[idx] = { ...list[idx], status: nextStatus, _optimistic: true };
  return { items: next, snapshot };
}

/**
 * 失敗時還原單一列。
 */
export function rollbackOptimisticStatus(items, snapshot) {
  if (!snapshot || !snapshot.item_id) {
    return Array.isArray(items) ? items : [];
  }
  const list = Array.isArray(items) ? items.slice() : [];
  const idx = list.findIndex((it) => String(it.item_id) === String(snapshot.item_id));
  if (idx < 0) {
    return [...list, snapshot];
  }
  const restored = { ...snapshot };
  delete restored._optimistic;
  list[idx] = restored;
  return list;
}

/**
 * 成功載入後，用伺服器資料覆寫樂觀列（或整表置換）。
 */
export function partitionOpenAndClosed(items) {
  const list = Array.isArray(items) ? items : [];
  const open = [];
  const closed = [];
  for (const it of list) {
    if (it.status === '已回覆' || it.status === '取消') {
      closed.push(it);
    } else {
      open.push(it);
    }
  }
  return { open, closed };
}
