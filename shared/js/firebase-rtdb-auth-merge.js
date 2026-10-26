/**
 * 合併 fb_audit_config 與內建 Web 公開設定（auth 欄位預設有值，避免未填 localStorage 時無法匿名登入）。
 */

export const FB_AUDIT_CONFIG_STORAGE_KEY = 'fb_audit_config';

/**
 * @param {object} [stored] localStorage 解析結果
 * @param {object} publicDefaults FIREBASE_RTDB_WEB_PUBLIC
 * @param {object} [extraDefaults] 例如 gasURL、databaseURL 覆寫預設
 */
export function mergeFbAuditConfig(stored, publicDefaults, extraDefaults = {}) {
  const s = stored && typeof stored === 'object' ? stored : {};
  const pub = publicDefaults && typeof publicDefaults === 'object' ? publicDefaults : {};
  const extra = extraDefaults && typeof extraDefaults === 'object' ? extraDefaults : {};

  const pick = (key) => {
    const fromStored = s[key] != null ? String(s[key]).trim() : '';
    if (fromStored) return fromStored;
    const fromExtra = extra[key] != null ? String(extra[key]).trim() : '';
    if (fromExtra) return fromExtra;
    const fromPub = pub[key] != null ? String(pub[key]).trim() : '';
    return fromPub;
  };

  return {
    databaseURL: pick('databaseURL'),
    apiKey: pick('apiKey'),
    authDomain: pick('authDomain'),
    projectId: pick('projectId'),
    gasURL: s.gasURL != null ? String(s.gasURL).trim() : (extra.gasURL != null ? String(extra.gasURL).trim() : ''),
  };
}

export function buildFirebaseWebInitOptions(merged) {
  const m = merged || {};
  const o = { databaseURL: m.databaseURL };
  if (m.apiKey && m.authDomain && m.projectId) {
    o.apiKey = m.apiKey;
    o.authDomain = m.authDomain;
    o.projectId = m.projectId;
  }
  return o;
}

export function firebaseWebAuthReady(merged) {
  const m = merged || {};
  return !!(String(m.apiKey || '').trim() && String(m.authDomain || '').trim() && String(m.projectId || '').trim());
}
