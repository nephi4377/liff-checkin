/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    LP_STORAGE_INDEX_KEY,
    LP_LEGACY_AUTOSAVE_KEY,
    LP_PROJECT_FORMAT,
    dataUrlToBlob,
    blobToDataUrl,
    stripBackgroundForPersist,
    saveLayoutSession,
    loadLayoutSession,
    persistBackgroundDataUrl,
    tryMigrateFromLegacyLocalStorage,
    validateProjectFile,
    buildProjectFileExport,
    collectHistoryForIndexedDb,
    hydrateLayoutBackground,
    hashBlobContent,
    LayoutPlannerStorageError,
    runStorageWrite,
    readStorageIndex,
    readLegacyAutosaveRaw,
    isIndexedDBAvailable,
    testAbortNextBlobPut,
    migrateLegacyLocalStorageAutosave,
    clearHydrateBackgroundCache,
} from './LP_storage.js';

const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_PNG_2 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z5+fgYGBgYGBgQEAAP//AwOKK8wAAAAASUVORK5CYII=';

beforeEach(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('layout-planner-storage-v1');
});

describe('dataUrlToBlob / blobToDataUrl', () => {
    it('往返不丟資料', async () => {
        const blob = dataUrlToBlob(TINY_PNG);
        expect(blob.type).toContain('image');
        const back = await blobToDataUrl(blob);
        expect(back.startsWith('data:image')).toBe(true);
    });
});

describe('stripBackgroundForPersist', () => {
    it('保留 srcOmitted', () => {
        const s = stripBackgroundForPersist({ blobId: null, srcOmitted: true, hasBackground: false });
        expect(s.srcOmitted).toBe(true);
    });

    it('移除 src 並保留 blobId', () => {
        const s = stripBackgroundForPersist({
            src: TINY_PNG,
            blobId: 'bg-1',
            scale: 2,
            position: { x: 1, y: 2 },
        });
        expect(s.src).toBeUndefined();
        expect(s.blobId).toBe('bg-1');
        expect(s.scale).toBe(2);
    });
});

describe('IndexedDB session', () => {
    it('可寫入並讀回', async () => {
        const blobId = await persistBackgroundDataUrl(TINY_PNG);
        const layout = {
            version: '3.0',
            placedCabinets: [],
            drawnAreas: [],
            background: stripBackgroundForPersist({ blobId, hasBackground: true }),
        };
        await saveLayoutSession(layout, { history: [], historyIndex: 0 });
        const loaded = await loadLayoutSession();
        expect(loaded?.layout.placedCabinets).toEqual([]);
        expect(loaded?.layout.background.blobId).toBe(blobId);
    });

    it('相同底圖內容重用 blob id', async () => {
        const a = await persistBackgroundDataUrl(TINY_PNG);
        const b = await persistBackgroundDataUrl(TINY_PNG);
        expect(a).toBe(b);
        expect(a.startsWith('bg-')).toBe(true);
    });

    it('abort transaction 會 reject 且可再寫入', async () => {
        testAbortNextBlobPut();
        await expect(persistBackgroundDataUrl(TINY_PNG)).rejects.toBeTruthy();
        const id = await persistBackgroundDataUrl(TINY_PNG);
        expect(id).toBeTruthy();
    });

    it('孤兒 blob 在 session 寫入後會刪除', async () => {
        const mainId = await persistBackgroundDataUrl(TINY_PNG);
        const orphanId = 'bg-orphan-e2e-unit';
        const layout = {
            version: '3.0',
            placedCabinets: [],
            drawnAreas: [],
            background: stripBackgroundForPersist({ blobId: mainId, hasBackground: true }),
        };
        await saveLayoutSession(layout, {
            history: [],
            historyIndex: 0,
            blobs: new Map([[orphanId, dataUrlToBlob(TINY_PNG_2)]]),
        });
        await saveLayoutSession(layout, { history: [], historyIndex: 0 });
        const dbReq = indexedDB.open('layout-planner-storage-v1');
        const keys = await new Promise((resolve, reject) => {
            dbReq.onsuccess = () => {
                const db = dbReq.result;
                const tx = db.transaction('blobs', 'readonly');
                const req = tx.objectStore('blobs').getAllKeys();
                req.onsuccess = () => {
                    db.close();
                    resolve(req.result.map(String));
                };
                req.onerror = () => reject(req.error);
            };
            dbReq.onerror = () => reject(dbReq.error);
        });
        expect(keys).toContain(mainId);
        expect(keys).not.toContain(orphanId);
    });

    it('hydrate 會快取 blob 讀取', async () => {
        const blobId = await persistBackgroundDataUrl(TINY_PNG);
        clearHydrateBackgroundCache();
        const bg = { blobId, scale: 1, position: { x: 0, y: 0 } };
        const first = await hydrateLayoutBackground(bg);
        const second = await hydrateLayoutBackground(bg);
        expect(first.src).toBeTruthy();
        expect(second.src).toBe(first.src);
    });

    it('history 只存 blob 參照', async () => {
        const history = [
            {
                placedCabinets: [],
                drawnAreas: [],
                background: { src: TINY_PNG, scale: 1, position: { x: 0, y: 0 } },
            },
        ];
        const forDb = await collectHistoryForIndexedDb(history);
        expect(forDb[0].background.src).toBeUndefined();
        expect(forDb[0].background.blobId).toBeTruthy();
        await saveLayoutSession(
            { version: '3.0', placedCabinets: [], drawnAreas: [], background: forDb[0].background },
            { history: forDb, historyIndex: 0 },
        );
        const session = await loadLayoutSession();
        expect(session.history[0].background.blobId).toBe(forDb[0].background.blobId);
        expect(session.history[0].background.src).toBeUndefined();
    });
});

describe('legacy migration', () => {
    it('srcOmitted 搬移不嵌入底圖', async () => {
        const legacy = {
            version: '2.0',
            timestamp: Date.now(),
            placedCabinets: [],
            drawnAreas: [],
            background: {
                src: '',
                srcOmitted: true,
                scale: 1,
                position: { x: 0, y: 0 },
            },
        };
        const result = await migrateLegacyLocalStorageAutosave(legacy);
        expect(result.ok).toBe(true);
        const session = await loadLayoutSession();
        expect(session?.layout.background.srcOmitted).toBe(true);
        expect(session?.layout.background.blobId).toBeFalsy();
    });

    it('成功搬移後保留舊 localStorage key（只讀遷移）', async () => {
        const legacy = {
            version: '2.0',
            timestamp: Date.now(),
            placedCabinets: [{ id: 'c1', x: 0, y: 0, data: {} }],
            drawnAreas: [],
            background: { src: TINY_PNG, scale: 1, position: { x: 0, y: 0 } },
        };
        const raw = JSON.stringify(legacy);
        localStorage.setItem(LP_LEGACY_AUTOSAVE_KEY, raw);
        const result = await tryMigrateFromLegacyLocalStorage();
        expect(result.migrated).toBe(true);
        expect(readLegacyAutosaveRaw()).toBe(raw);
        const idx = readStorageIndex();
        expect(idx.migratedFromLegacy).toBe(true);
        expect(idx.legacyKeyPreserved).toBe(true);
        const session = await loadLayoutSession();
        expect(session?.layout.placedCabinets.length).toBe(1);
    });
});

describe('isIndexedDBAvailable', () => {
    it('jsdom 環境應可用', () => {
        expect(isIndexedDBAvailable()).toBe(true);
    });
});

describe('project file', () => {
    it('驗證 format 與版本', () => {
        const bad = validateProjectFile({ format: 'x', layout: {} });
        expect(bad.ok).toBe(false);
        const good = validateProjectFile(
            buildProjectFileExport({
                version: '3.0',
                placedCabinets: [],
                drawnAreas: [],
                background: { src: TINY_PNG },
            }),
        );
        expect(good.ok).toBe(true);
    });

    it('拒絕 2.x layout 包裝', () => {
        const v = validateProjectFile({
            format: LP_PROJECT_FORMAT,
            version: '2.0',
            layout: { placedCabinets: [], drawnAreas: [] },
        });
        expect(v.ok).toBe(false);
    });
});

describe('LayoutPlannerStorageError', () => {
    it('可辨識錯誤類型', () => {
        const e = new LayoutPlannerStorageError('test', 'QUOTA_EXCEEDED');
        expect(e.code).toBe('QUOTA_EXCEEDED');
    });
});

describe('runStorageWrite', () => {
    it('QuotaExceededError 轉為 QUOTA_EXCEEDED', async () => {
        await expect(
            runStorageWrite(async () => {
                throw new DOMException('quota', 'QuotaExceededError');
            }),
        ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    });

    it('AbortError 轉為 QUOTA_EXCEEDED', async () => {
        await expect(
            runStorageWrite(async () => {
                throw new DOMException('aborted', 'AbortError');
            }),
        ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    });
});

describe('hashBlobContent', () => {
    it('相同內容相同雜湊', async () => {
        const blob = dataUrlToBlob(TINY_PNG);
        const h1 = await hashBlobContent(blob);
        const h2 = await hashBlobContent(blob);
        expect(h1).toBe(h2);
    });
});
