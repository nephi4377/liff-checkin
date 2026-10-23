/**
 * Firebase compat SDK（BudgetWeb／BudgetAuditor 等）初始化與匿名登入。
 * 須先載入 firebase-rtdb-public-config.js 與 Firebase compat scripts。
 */
(function initTanxinFirebaseRtdbCompat(root) {
  const STORAGE_KEY = 'fb_audit_config';

  function readStoredConfig() {
    try {
      return JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function mergeConfig(extraDefaults) {
    const pub = root.FIREBASE_RTDB_WEB_PUBLIC || {};
    const stored = readStoredConfig();
    const pick = (key) => {
      const fromStored = stored[key] != null ? String(stored[key]).trim() : '';
      if (fromStored) return fromStored;
      const fromExtra = extraDefaults && extraDefaults[key] != null ? String(extraDefaults[key]).trim() : '';
      if (fromExtra) return fromExtra;
      const fromPub = pub[key] != null ? String(pub[key]).trim() : '';
      return fromPub;
    };
    return {
      databaseURL: pick('databaseURL'),
      apiKey: pick('apiKey'),
      authDomain: pick('authDomain'),
      projectId: pick('projectId'),
      gasURL:
        stored.gasURL != null
          ? String(stored.gasURL).trim()
          : extraDefaults && extraDefaults.gasURL != null
            ? String(extraDefaults.gasURL).trim()
            : '',
    };
  }

  function buildInitOptions(merged) {
    const o = { databaseURL: merged.databaseURL };
    if (merged.apiKey && merged.authDomain && merged.projectId) {
      o.apiKey = merged.apiKey;
      o.authDomain = merged.authDomain;
      o.projectId = merged.projectId;
    }
    return o;
  }

  let authReadyPromise = null;
  let lastMerged = null;

  function ensureAuth() {
    const fb = root.firebase;
    if (!fb || !fb.auth) {
      return Promise.reject(new Error('Firebase Auth 未載入'));
    }
    const auth = fb.auth();
    const existing = auth.currentUser;
    if (existing) return Promise.resolve(existing);

    if (!authReadyPromise) {
      authReadyPromise = new Promise((resolve, reject) => {
        const unsub = auth.onAuthStateChanged((user) => {
          if (user) {
            unsub();
            resolve(user);
          }
        });
        auth.signInAnonymously().catch((err) => {
          unsub();
          authReadyPromise = null;
          reject(err);
        });
      });
    }
    return authReadyPromise;
  }

  /**
   * @param {object} [extraDefaults] databaseURL、gasURL 等
   * @returns {{ config: object, db: firebase.database.Database }}
   */
  function init(extraDefaults) {
    const fb = root.firebase;
    if (!fb || !fb.initializeApp) {
      throw new Error('Firebase SDK 未載入');
    }
    lastMerged = mergeConfig(extraDefaults || {});
    if (!fb.apps.length) {
      fb.initializeApp(buildInitOptions(lastMerged));
    }
    if (lastMerged.apiKey && lastMerged.authDomain && lastMerged.projectId) {
      ensureAuth().catch((e) => {
        console.warn('[TanxinFirebaseRtdb] 匿名登入失敗:', e && e.message ? e.message : e);
      });
    }
    return { config: lastMerged, db: fb.database() };
  }

  function getMergedConfig() {
    return lastMerged || mergeConfig({});
  }

  root.TanxinFirebaseRtdb = {
    STORAGE_KEY,
    mergeConfig,
    buildInitOptions,
    init,
    ensureAuth,
    getMergedConfig,
    readStoredConfig,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
