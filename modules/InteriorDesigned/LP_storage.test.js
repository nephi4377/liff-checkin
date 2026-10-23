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
    LayoutPlannerStorageError,
    runStorageWrite,
    readStorageIndex,
} from './LP_storage.js';

const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
    it('成功搬移後清除舊 key', async () => {
        const legacy = {
            version: '2.0',
            timestamp: Date.now(),
            placedCabinets: [{ id: 'c1', x: 0, y: 0, data: {} }],
            drawnAreas: [],
            background: { src: TINY_PNG, scale: 1, position: { x: 0, y: 0 } },
        };
        localStorage.setItem(LP_LEGACY_AUTOSAVE_KEY, JSON.stringify(legacy));
        const result = await tryMigrateFromLegacyLocalStorage();
        expect(result.migrated).toBe(true);
        expect(localStorage.getItem(LP_LEGACY_AUTOSAVE_KEY)).toBeNull();
        const idx = readStorageIndex();
        expect(idx.migratedFromLegacy).toBe(true);
        const session = await loadLayoutSession();
        expect(session?.layout.placedCabinets.length).toBe(1);
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
});
