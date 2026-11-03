/** 任務文件不再寫入 localStorage（避免未驗證快取被 push 差異刪光 Sheet）。 */

export function documentCacheKey(role) {
  return `employee-todo-doc-v1:${role || 'hub'}`;
}

/** @returns {null} */
export function readDocumentCache(_role) {
  return null;
}

export function writeDocumentCache(_role, _doc) {
  /* no-op */
}

export function clearDocumentCache(role) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(documentCacheKey(role));
    localStorage.removeItem('employee-todo-sheet-bridge-v1');
  } catch {
    /* ignore */
  }
}
