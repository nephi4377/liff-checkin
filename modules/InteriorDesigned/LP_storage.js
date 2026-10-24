/**
 * LayoutPlanner 本機持久化：IndexedDB（配置＋底圖 Blob）＋ localStorage 輕量索引
 */

export const LP_STORAGE_INDEX_KEY = 'layoutPlanner_storage_index_v1';
export const LP_LEGACY_AUTOSAVE_KEY = 'layoutPlanner_autosave_v1';
export const LP_PROJECT_FORMAT = 'layout-planner-project-1';
export const LP_LAYOUT_VERSION = '3.0';
export const LP_DB_NAME = 'layout-planner-storage-v1';
export const LP_DB_VERSION = 1;

const SESSION_KEY = 'default';

/** @typedef {{ idbReady?: boolean, migratedFromLegacy?: boolean, lastSavedAt?: number, lastError?: string }} LpStorageIndex */

/**
 * @param {string} dataUrl
 */
export function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new Error('無效的 data URL');
    const header = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1);
    const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/jpeg';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/**
 * @param {Blob} blob
 */
export async function blobToDataUrl(blob) {
    let b = blob;
    if (!(b instanceof Blob)) {
        if (b && typeof b.arrayBuffer === 'function') {
            b = new Blob([await b.arrayBuffer()], { type: b.type || 'application/octet-stream' });
        } else {
            throw new Error('無效的 Blob');
        }
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Blob 讀取失敗'));
        reader.readAsDataURL(b);
    });
}

export function readStorageIndex() {
    try {
        const raw = localStorage.getItem(LP_STORAGE_INDEX_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export function writeStorageIndex(patch) {
    const next = { ...readStorageIndex(), ...patch };
    localStorage.setItem(LP_STORAGE_INDEX_KEY, JSON.stringify(next));
    return next;
}

export function isIndexedDBAvailable() {
    return typeof indexedDB !== 'undefined';
}

export function readLegacyAutosaveRaw() {
    try {
        return localStorage.getItem(LP_LEGACY_AUTOSAVE_KEY);
    } catch {
        return null;
    }
}

function openDatabase() {
    if (!isIndexedDBAvailable()) {
        return Promise.reject(new LayoutPlannerStorageError('此環境不支援 IndexedDB，請改用匯出專案檔備份。', 'IDB_UNAVAILABLE'));
    }
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(LP_DB_NAME, LP_DB_VERSION);
        req.onerror = () => reject(req.error || new Error('IndexedDB 開啟失敗'));
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('blobs')) {
                db.createObjectStore('blobs');
            }
            if (!db.objectStoreNames.contains('sessions')) {
                db.createObjectStore('sessions');
            }
        };
        req.onsuccess = () => resolve(req.result);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 * @param {Blob} blob
 */
function idbPutBlob(db, id, blob) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('blobs').put(blob, id);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 */
function idbGetBlob(db, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readonly');
        tx.onerror = () => reject(tx.error);
        const req = tx.objectStore('blobs').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {object} session
 */
function idbPutSession(db, session) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('sessions').put(session, SESSION_KEY);
    });
}

/**
 * @param {IDBDatabase} db
 */
function idbGetSession(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly');
        tx.onerror = () => reject(tx.error);
        const req = tx.objectStore('sessions').get(SESSION_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

/**
 * @param {object} bg
 */
export function stripBackgroundForPersist(bg) {
    if (!bg || typeof bg !== 'object') {
        return {
            position: { x: 0, y: 0 },
            scale: 1,
            rotationDeg: 0,
            opacity: 0.75,
            locked: false,
            hidden: false,
            blobId: null,
            hasBackground: false,
        };
    }
    const blobId = bg.blobId || null;
    const hasBg = !!(blobId || (bg.src && String(bg.src).startsWith('data:image')));
    return {
        position: bg.position && typeof bg.position === 'object'
            ? { x: Number(bg.position.x) || 0, y: Number(bg.position.y) || 0 }
            : { x: 0, y: 0 },
        scale: Number(bg.scale) > 0 ? Number(bg.scale) : 1,
        rotationDeg: Number(bg.rotationDeg) || 0,
        opacity: Number.isFinite(Number(bg.opacity)) ? Number(bg.opacity) : 0.75,
        locked: !!bg.locked,
        hidden: !!bg.hidden,
        blobId,
        hasBackground: hasBg && !!blobId,
    };
}

/**
 * @param {object} bg
 */
export async function hydrateLayoutBackground(bg) {
    if (!bg || typeof bg !== 'object') return bg;
    const blobId = bg.blobId;
    const hasSrc = typeof bg.src === 'string' && bg.src.startsWith('data:image');
    if (!blobId || hasSrc) return { ...bg };
    const src = await loadBackgroundBlobAsDataUrl(blobId);
    return { ...bg, src };
}

/**
 * @param {object[]} history
 */
export async function hydrateHistoryEntries(history) {
    const list = Array.isArray(history) ? history : [];
    const out = [];
    for (const state of list) {
        out.push({
            ...state,
            background: await hydrateLayoutBackground(state.background || {}),
        });
    }
    return out;
}

/**
 * @param {object[]} history
 */
export async function collectHistoryForIndexedDb(history) {
    const blobCache = new Map();
    const out = [];
    for (const state of history) {
        const bg = state.background || {};
        let blobId = bg.blobId || null;
        const src = typeof bg.src === 'string' ? bg.src : '';
        if (src.startsWith('data:image')) {
            if (!blobId) {
                blobId = blobCache.get(src);
                if (!blobId) {
                    blobId = await persistBackgroundDataUrl(src);
                    blobCache.set(src, blobId);
                }
            }
        }
        const stripped = stripBackgroundForPersist({ ...bg, blobId, hasBackground: !!blobId });
        out.push({ ...state, background: stripped });
    }
    return out;
}

/**
 * @param {object} layoutState
 * @param {{ history?: object[], historyIndex?: number, blobs?: Map<string, Blob> }} extras
 */
export async function saveLayoutSession(layoutState, extras = {}) {
    const db = await openDatabase();
    const blobEntries = extras.blobs || new Map();
    for (const [id, blob] of blobEntries.entries()) {
        await idbPutBlob(db, id, blob);
    }
    const session = {
        version: LP_LAYOUT_VERSION,
        savedAt: Date.now(),
        layout: layoutState,
        history: extras.history || [],
        historyIndex: typeof extras.historyIndex === 'number' ? extras.historyIndex : 0,
    };
    await idbPutSession(db, session);
    db.close();
    writeStorageIndex({ idbReady: true, lastSavedAt: session.savedAt, lastError: '' });
    return session;
}

/**
 * @returns {Promise<{ layout: object, history: object[], historyIndex: number } | null>}
 */
export async function loadLayoutSession() {
    const db = await openDatabase();
    const session = await idbGetSession(db);
    db.close();
    if (!session?.layout) return null;
    return {
        layout: session.layout,
        history: session.history || [],
        historyIndex: session.historyIndex || 0,
    };
}

/**
 * @param {string} blobId
 */
async function normalizeStoredBlob(raw) {
    if (!raw) return null;
    if (raw instanceof Blob) return raw;
    if (typeof Response !== 'undefined') {
        try {
            return await new Response(raw).blob();
        } catch {
            /* fall through */
        }
    }
    if (raw instanceof ArrayBuffer) {
        return new Blob([raw], { type: 'image/png' });
    }
    if (typeof raw.arrayBuffer === 'function') {
        return new Blob([await raw.arrayBuffer()], { type: raw.type || 'image/png' });
    }
    return null;
}

export async function loadBackgroundBlobAsDataUrl(blobId) {
    if (!blobId) return '';
    const db = await openDatabase();
    const raw = await idbGetBlob(db, blobId);
    db.close();
    const blob = await normalizeStoredBlob(raw);
    if (!blob) return '';
    return blobToDataUrl(blob);
}

/**
 * @param {string} dataUrl
 * @param {string} [existingId]
 */
export async function persistBackgroundDataUrl(dataUrl, existingId) {
    const blob = dataUrlToBlob(dataUrl);
    const id = existingId || `bg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const db = await openDatabase();
    await idbPutBlob(db, id, blob);
    db.close();
    return id;
}

/**
 * @param {object} legacyLayout
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function migrateLegacyLocalStorageAutosave(legacyLayout) {
    try {
        const bg = legacyLayout.background;
        let backgroundRef = stripBackgroundForPersist(bg || {});
        const blobs = new Map();
        if (bg?.src && String(bg.src).startsWith('data:image')) {
            const blobId = await persistBackgroundDataUrl(bg.src);
            backgroundRef = stripBackgroundForPersist({ ...bg, blobId, hasBackground: true });
        }
        const layout = {
            ...legacyLayout,
            version: LP_LAYOUT_VERSION,
            background: backgroundRef,
        };
        await saveLayoutSession(layout, { history: [], historyIndex: 0, blobs });
        writeStorageIndex({
            migratedFromLegacy: true,
            idbReady: true,
            legacyKeyPreserved: true,
            legacyMigratedAt: Date.now(),
        });
        return { ok: true };
    } catch (err) {
        const code = err instanceof LayoutPlannerStorageError ? err.code : 'MIGRATE_FAILED';
        writeStorageIndex({ idbReady: false, lastError: String(err?.message || err), lastErrorCode: code });
        return { ok: false, error: String(err?.message || err) };
    }
}

/**
 * 首次啟動：嘗試搬移舊 localStorage autosave
 * @returns {Promise<{ migrated: boolean, legacyLayout?: object, error?: string }>}
 */
export async function tryMigrateFromLegacyLocalStorage() {
    const index = readStorageIndex();
    if (index.migratedFromLegacy) return { migrated: false };
    const raw = localStorage.getItem(LP_LEGACY_AUTOSAVE_KEY);
    if (!raw) {
        writeStorageIndex({ migratedFromLegacy: true });
        return { migrated: false };
    }
    let legacy;
    try {
        legacy = JSON.parse(raw);
    } catch {
        return { migrated: false, error: 'legacy JSON 無法解析' };
    }
    const result = await migrateLegacyLocalStorageAutosave(legacy);
    if (result.ok) return { migrated: true, legacyLayout: legacy };
    return { migrated: false, legacyLayout: legacy, error: result.error };
}

/**
 * @param {object} data
 */
export function validateProjectFile(data) {
    if (!data || typeof data !== 'object') {
        return { ok: false, code: 'INVALID_ROOT', message: '檔案不是有效的 JSON 物件' };
    }
    if (data.format !== LP_PROJECT_FORMAT) {
        return { ok: false, code: 'INVALID_FORMAT', message: 'format 必須為 layout-planner-project-1' };
    }
    const ver = String(data.version || '');
    if (!ver.startsWith('3.')) {
        return { ok: false, code: 'INVALID_VERSION', message: '僅支援 3.x 專案檔' };
    }
    const layout = data.layout;
    if (!layout || typeof layout !== 'object') {
        return { ok: false, code: 'MISSING_LAYOUT', message: '缺少 layout' };
    }
    if (!Array.isArray(layout.placedCabinets)) {
        return { ok: false, code: 'INVALID_CABINETS', message: 'placedCabinets 必須為陣列' };
    }
    if (!Array.isArray(layout.drawnAreas)) {
        return { ok: false, code: 'INVALID_AREAS', message: 'drawnAreas 必須為陣列' };
    }
    return { ok: true, layout, version: ver };
}

/**
 * @param {object} layoutWithEmbeddedBg
 */
export function buildProjectFileExport(layoutWithEmbeddedBg) {
    return {
        format: LP_PROJECT_FORMAT,
        version: LP_LAYOUT_VERSION,
        exportedAt: new Date().toISOString(),
        layout: layoutWithEmbeddedBg,
    };
}

export class LayoutPlannerStorageError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code || 'STORAGE_ERROR';
    }
}

/**
 * @param {() => Promise<void>} fn
 */
export async function runStorageWrite(fn) {
    try {
        await fn();
    } catch (err) {
        if (err instanceof LayoutPlannerStorageError) throw err;
        const name = err?.name || '';
        if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            throw new LayoutPlannerStorageError('本機儲存空間不足，請匯出專案檔備份後清理瀏覽器資料。', 'QUOTA_EXCEEDED');
        }
        const msg = String(err?.message || err);
        if (msg.includes('IndexedDB') || name === 'InvalidStateError' || name === 'UnknownError') {
            throw new LayoutPlannerStorageError('IndexedDB 無法寫入，請匯出專案檔備份。', 'IDB_WRITE_FAILED');
        }
        throw new LayoutPlannerStorageError(msg || '儲存失敗', 'WRITE_FAILED');
    }
}
