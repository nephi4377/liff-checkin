/** localStorage 快取文件（不含 token），依 role 分 key，stale-while-revalidate 用 */
const CACHE_PREFIX = 'employee-todo-doc-v1:';

export function documentCacheKey(role) {
  return `${CACHE_PREFIX}${role || 'hub'}`;
}

/**
 * @returns {{ tasks, officeTasks, assigners, updatedAt, cachedAt } | null}
 */
export function readDocumentCache(role) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(documentCacheKey(role));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeDocumentCache(role, doc) {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = {
      tasks: doc.tasks || [],
      officeTasks: doc.officeTasks || [],
      assigners: doc.assigners || [],
      updatedAt: doc.updatedAt || 0,
      cachedAt: Date.now(),
    };
    localStorage.setItem(documentCacheKey(role), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearDocumentCache(role) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(documentCacheKey(role));
  } catch {
    /* ignore */
  }
}
