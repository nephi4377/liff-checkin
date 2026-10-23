import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrateDuplicateItemIdsOnly } from '../../tools/quotation-item-id-migrate.mjs';
import { findDuplicateItemIds } from './LP_budgetweb_cloud_sync.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');

function buildSheet1228LikeFixture() {
    const dupId = 'ITEM_1228_冷氣包管+窗簾盒';
    const items = [];
    for (let i = 0; i < 67; i++) {
        items.push({
            id: `ITEM_1228_ROW_${i}`,
            name: `工項_${i}`,
            spec: `S${i}`,
            completion_percent: i % 100,
            verification: { is_ok: i % 3 === 0 },
        });
    }
    items.push({
        id: 'ITEM_1228_2',
        name: '天花板線板拆除',
        spec: '區A',
        completion_percent: 11,
        verification: { is_ok: true },
    });
    items.push({
        id: 'ITEM_1228_窗簾盒拆除',
        name: '窗簾盒拆除',
        spec: '區B',
        completion_percent: 22,
        verification: { is_ok: false },
    });
    items.push({
        id: dupId,
        name: '冷氣包管+窗簾盒',
        spec: '1',
        completion_percent: 80,
        verification: { is_ok: true },
    });
    items.push({
        id: dupId,
        name: '冷氣包管+窗簾盒',
        spec: '2',
        completion_percent: 81,
        verification: { is_ok: true },
    });
    items.push({
        id: dupId,
        name: '冷氣包管+窗簾盒',
        spec: '3',
        completion_percent: 82,
        verification: { is_ok: false },
    });
    return items;
}

describe('migrateDuplicateItemIdsOnly', () => {
    it('不剝 ITEM_1228_2 等合法尾碼 id，只補真重複', () => {
        const items = buildSheet1228LikeFixture();
        expect(items).toHaveLength(72);

        const { items: migrated, changes } = migrateDuplicateItemIdsOnly(items);
        expect(changes).toHaveLength(2);
        expect(changes.map((c) => c.to)).toEqual([
            `${'ITEM_1228_冷氣包管+窗簾盒'}_2`,
            `${'ITEM_1228_冷氣包管+窗簾盒'}_3`,
        ]);

        const ceiling = migrated.find((i) => i.name === '天花板線板拆除');
        expect(ceiling.id).toBe('ITEM_1228_2');
        expect(ceiling.completion_percent).toBe(11);

        expect(findDuplicateItemIds(migrated)).toEqual([]);

        migrated.forEach((row, idx) => {
            expect(row.completion_percent).toBe(items[idx].completion_percent);
        });
    });

    it('已有 ITEM_X_2 時，重複 ITEM_X 的第 2 筆改為 _3，全表 id 唯一', () => {
        const items = [
            { id: 'ITEM_X', name: 'a' },
            { id: 'ITEM_X_2', name: 'existing suffix' },
            { id: 'ITEM_X', name: 'dup b' },
            { id: 'ITEM_X', name: 'dup c' },
            { id: 'UNIQUE_OK', name: 'unchanged' },
        ];
        const { items: migrated, changes } = migrateDuplicateItemIdsOnly(items);
        expect(findDuplicateItemIds(migrated)).toEqual([]);
        expect(migrated[0].id).toBe('ITEM_X');
        expect(migrated[1].id).toBe('ITEM_X_2');
        expect(migrated[4].id).toBe('UNIQUE_OK');
        expect(changes.map((c) => c.to)).toEqual(['ITEM_X_3', 'ITEM_X_4']);
    });
});

describe('migrate-quotation-item-ids.mjs CLI', () => {
    it('fixture dry-run 成功且輸出 changeCount', async () => {
        const fixture = path.join(REPO_ROOT, 'tools/fixtures/quotation-migrate-dup-demo.json');
        const script = path.join(REPO_ROOT, 'tools/scripts/migrate-quotation-item-ids.mjs');
        expect(fs.existsSync(fixture)).toBe(true);
        const { stdout } = await execFileAsync(process.execPath, [script, fixture], {
            cwd: REPO_ROOT,
        });
        const parsed = JSON.parse(stdout.trim());
        expect(parsed.dryRun).toBe(true);
        expect(parsed.changeCount).toBe(1);
        expect(parsed.changes[0].to).toBe('ITEM_DEMO_DUP_2');
    });
});
