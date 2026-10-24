/**
 * LayoutPlanner 本機持久化：IndexedDB（配置＋底圖 Blob）＋ localStorage 輕量索引
 */

export const LP_STORAGE_INDEX_KEY = 'layoutPlanner_storage_index_v1';
export const LP_LEGACY_AUTOSAVE_KEY = 'layoutPlanner_autosave_v1';
export const LP_PROJECT_FORMAT = 'layout-planner-project-1';
export const LP_LAYOUT_VERSION = '3.0';
export const LP_DB_NAME = 'layout-planner-storage-v1';
export const LP_DB_VERSION = 1;

/** history 內最多保留的獨立底圖 blob 數（含當前 layout） */
export const LP_MAX_HISTORY_BG_BLOBS = 48;

const SESSION_KEY = 'default';

/** @type {Map<string, Promise<string>>} */
const hydrateDataUrlCache = new Map();

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
async function blobToUint8Array(blob) {
    let buf;
    if (blob && typeof blob.arrayBuffer === 'function') {
        buf = await blob.arrayBuffer();
    } else if (typeof Response !== 'undefined') {
        buf = await new Response(blob).arrayBuffer();
    } else {
        throw new Error('無法讀取 Blob 內容');
    }
    if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
    if (ArrayBuffer.isView(buf)) {
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    return new Uint8Array(buf);
}

/**
 * @param {Blob} blob
 */
export async function hashBlobContent(blob) {
    const bytes = await blobToUint8Array(blob);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
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
 * @param {string[]} storeNames
 * @param {IDBTransactionMode} mode
 * @param {(tx: IDBTransaction) => void} work
 */
function runIdbTransaction(db, storeNames, mode, work) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        let settled = false;
        const finish = (err) => {
            if (settled) return;
            settled = true;
            if (err) reject(err);
            else resolve();
        };
        tx.onabort = () => {
            finish(tx.error || new DOMException('Transaction aborted', 'AbortError'));
        };
        tx.onerror = () => {
            finish(tx.error || new Error('IndexedDB transaction failed'));
        };
        tx.oncomplete = () => finish();
        try {
            work(tx);
        } catch (err) {
            try {
                tx.abort();
            } catch {
                /* ignore */
            }
            finish(err);
        }
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 * @param {Blob} blob
 */
function idbPutBlob(db, id, blob) {
    return runIdbTransaction(db, ['blobs'], 'readwrite', (tx) => {
        if (globalThis.__LP_STORAGE_TEST__?.abortNextBlobPut) {
            globalThis.__LP_STORAGE_TEST__.abortNextBlobPut = false;
            tx.abort();
            return;
        }
        const req = tx.objectStore('blobs').put(blob, id);
        req.onerror = () => {
            try {
                tx.abort();
            } catch {
                /* ignore */
            }
        };
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 */
function idbGetBlob(db, id) {
    return new Promise((resolve, reject) => {
        runIdbTransaction(db, ['blobs'], 'readonly', (tx) => {
            const req = tx.objectStore('blobs').get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => {
                try {
                    tx.abort();
                } catch {
                    /* ignore */
                }
                reject(req.error);
            };
        }).catch(reject);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {string} id
 */
function idbDeleteBlob(db, id) {
    return runIdbTransaction(db, ['blobs'], 'readwrite', (tx) => {
        tx.objectStore('blobs').delete(id);
    });
}

/**
 * @param {IDBDatabase} db
 */
function idbListBlobKeys(db) {
    return new Promise((resolve, reject) => {
        runIdbTransaction(db, ['blobs'], 'readonly', (tx) => {
            const req = tx.objectStore('blobs').getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }).catch(reject);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {object} session
 */
function idbPutSession(db, session) {
    return runIdbTransaction(db, ['sessions'], 'readwrite', (tx) => {
        const req = tx.objectStore('sessions').put(session, SESSION_KEY);
        req.onerror = () => {
            try {
                tx.abort();
            } catch {
                /* ignore */
            }
        };
    });
}

/**
 * @param {IDBDatabase} db
 */
function idbGetSession(db) {
    return new Promise((resolve, reject) => {
        runIdbTransaction(db, ['sessions'], 'readonly', (tx) => {
            const req = tx.objectStore('sessions').get(SESSION_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }).catch(reject);
    });
}

/**
 * @param {IDBDatabase} db
 * @param {Set<string>} keepIds
 */
async function pruneOrphanBlobs(db, keepIds) {
    const keys = await idbListBlobKeys(db);
    for (const key of keys) {
        const id = String(key);
        if (!keepIds.has(id)) {
            await idbDeleteBlob(db, id);
        }
    }
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
    const out = {
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
    if (bg.srcOmitted) out.srcOmitted = true;
    return out;
}

/**
 * @param {string} blobId
 */
export async function backgroundBlobExists(blobId) {
    if (!blobId) return false;
    const db = await openDatabase();
    try {
        const raw = await idbGetBlob(db, blobId);
        return !!raw;
    } finally {
        db.close();
    }
}

export function clearHydrateBackgroundCache() {
    hydrateDataUrlCache.clear();
}

/**
 * @param {object} bg
 */
export async function hydrateLayoutBackground(bg) {
    if (!bg || typeof bg !== 'object') return bg;
    const blobId = bg.blobId;
    const hasSrc = typeof bg.src === 'string' && bg.src.startsWith('data:image');
    if (!blobId || hasSrc) return { ...bg };
    if (hydrateDataUrlCache.has(blobId)) {
        const src = await hydrateDataUrlCache.get(blobId);
        return { ...bg, src };
    }
    const loadPromise = loadBackgroundBlobAsDataUrl(blobId).then((src) => {
        if (!src) {
            hydrateDataUrlCache.delete(blobId);
        }
        return src;
    });
    hydrateDataUrlCache.set(blobId, loadPromise);
    const src = await loadPromise;
    if (blobId && !src) {
        return { ...bg, src: '', srcOmitted: true };
    }
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
    const srcToBlobId = new Map();
    const usedBlobIds = [];
    const out = [];
    for (const state of history) {
        const bg = state.background || {};
        let blobId = bg.blobId || null;
        const src = typeof bg.src === 'string' ? bg.src : '';
        if (src.startsWith('data:image')) {
            blobId = srcToBlobId.get(src);
            if (!blobId) {
                blobId = await persistBackgroundDataUrl(src);
                srcToBlobId.set(src, blobId);
            }
            if (!usedBlobIds.includes(blobId)) usedBlobIds.push(blobId);
        } else if (blobId && !usedBlobIds.includes(blobId)) {
            usedBlobIds.push(blobId);
        }
        const stripped = stripBackgroundForPersist({ ...bg, blobId, hasBackground: !!blobId });
        out.push({ ...state, background: stripped });
    }
    while (usedBlobIds.length > LP_MAX_HISTORY_BG_BLOBS) {
        const drop = usedBlobIds.shift();
        for (const entry of out) {
            if (entry.background?.blobId === drop) {
                entry.background = stripBackgroundForPersist({
                    ...entry.background,
                    blobId: null,
                    hasBackground: false,
                    srcOmitted: true,
                });
            }
        }
    }
    return out;
}

function collectReferencedBlobIds(layoutState, history) {
    const keep = new Set();
    const add = (bg) => {
        if (bg?.blobId) keep.add(bg.blobId);
    };
    add(layoutState?.background);
    for (const h of history || []) add(h.background);
    return keep;
}

/**
 * @param {object} layoutState
 * @param {{ history?: object[], historyIndex?: number, blobs?: Map<string, Blob> }} extras
 */
export async function saveLayoutSession(layoutState, extras = {}) {
    const db = await openDatabase();
    try {
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
        const keepIds = collectReferencedBlobIds(layoutState, session.history);
        for (const id of blobEntries.keys()) keepIds.add(id);
        await pruneOrphanBlobs(db, keepIds);
        writeStorageIndex({ idbReady: true, lastSavedAt: session.savedAt, lastError: '' });
        return session;
    } finally {
        db.close();
    }
}

/**
 * @returns {Promise<{ layout: object, history: object[], historyIndex: number } | null>}
 */
export async function loadLayoutSession() {
    const db = await openDatabase();
    try {
        const session = await idbGetSession(db);
        if (!session?.layout) return null;
        return {
            layout: session.layout,
            history: session.history || [],
            historyIndex: session.historyIndex || 0,
        };
    } finally {
        db.close();
    }
}

/**
 * @param {IDBDatabase} db
 * @param {*} raw
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
    try {
        const raw = await idbGetBlob(db, blobId);
        const blob = await normalizeStoredBlob(raw);
        if (!blob) return '';
        return blobToDataUrl(blob);
    } finally {
        db.close();
    }
}

/**
 * @param {string} dataUrl
 * @param {string} [existingId]
 */
export async function persistBackgroundDataUrl(dataUrl) {
    const blob = dataUrlToBlob(dataUrl);
    const contentHash = await hashBlobContent(blob);
    const id = `bg-${contentHash}`;
    const db = await openDatabase();
    try {
        const existing = await idbGetBlob(db, id);
        if (!existing) {
            await idbPutBlob(db, id, blob);
        }
    } finally {
        db.close();
    }
    return id;
}

/**
 * @param {object} legacyLayout
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function migrateLegacyLocalStorageAutosave(legacyLayout) {
    try {
        const bg = legacyLayout.background || {};
        let backgroundRef = stripBackgroundForPersist(bg);
        if (bg?.srcOmitted) {
            backgroundRef = { ...backgroundRef, srcOmitted: true };
        }
        if (bg?.src && String(bg.src).startsWith('data:image')) {
            const blobId = await persistBackgroundDataUrl(bg.src);
            backgroundRef = stripBackgroundForPersist({ ...bg, blobId, hasBackground: true });
        } else if (bg?.srcOmitted) {
            backgroundRef = stripBackgroundForPersist({
                ...bg,
                src: '',
                blobId: null,
                hasBackground: false,
                srcOmitted: true,
            });
        }
        const layout = {
            ...legacyLayout,
            version: LP_LAYOUT_VERSION,
            background: backgroundRef,
        };
        await saveLayoutSession(layout, { history: [], historyIndex: 0 });
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
/** Vitest／e2e：下一筆 blob put 會 abort transaction */
export function testAbortNextBlobPut() {
    globalThis.__LP_STORAGE_TEST__ = {
        ...(globalThis.__LP_STORAGE_TEST__ || {}),
        abortNextBlobPut: true,
    };
}

export async function runStorageWrite(fn) {
    try {
        await fn();
    } catch (err) {
        if (err instanceof LayoutPlannerStorageError) throw err;
        const name = err?.name || '';
        if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || name === 'AbortError') {
            throw new LayoutPlannerStorageError('本機儲存空間不足，請匯出專案檔備份後清理瀏覽器資料。', 'QUOTA_EXCEEDED');
        }
        const msg = String(err?.message || err);
        if (msg.includes('IndexedDB') || name === 'InvalidStateError' || name === 'UnknownError') {
            throw new LayoutPlannerStorageError('IndexedDB 無法寫入，請匯出專案檔備份。', 'IDB_WRITE_FAILED');
        }
        throw new LayoutPlannerStorageError(msg || '儲存失敗', 'WRITE_FAILED');
    }
}
