import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { findDuplicateItemIds } from './LP_budgetweb_cloud_sync.js';

const require = createRequire(import.meta.url);
const { migrateDuplicateItemIdsOnly } = require('../../tools/quotation-item-id-migrate.js');

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

        const curtain = migrated.find((i) => i.name === '窗簾盒拆除');
        expect(curtain.id).toBe('ITEM_1228_窗簾盒拆除');
        expect(curtain.completion_percent).toBe(22);

        expect(findDuplicateItemIds(migrated)).toEqual([]);

        migrated.forEach((row, idx) => {
            expect(row.completion_percent).toBe(items[idx].completion_percent);
            expect(row.verification).toEqual(items[idx].verification);
        });
    });
});
