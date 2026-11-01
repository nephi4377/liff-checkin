import { describe, it, expect } from 'vitest';
import { detachSelectedFromExistingLayoutGroups } from './LP_layout_group_logic.js';

describe('detachSelectedFromExistingLayoutGroups', () => {
    it('只移出被選成員，剩餘成員保留原群組', () => {
        const cabs = [
            { id: 'a', layoutGroupId: 'g1' },
            { id: 'b', layoutGroupId: 'g1' },
            { id: 'c', layoutGroupId: 'g1' },
            { id: 'd', layoutGroupId: 'g1' },
        ];
        detachSelectedFromExistingLayoutGroups(cabs, new Set(['a', 'b']));
        expect(cabs.find((c) => c.id === 'a').layoutGroupId).toBeUndefined();
        expect(cabs.find((c) => c.id === 'b').layoutGroupId).toBeUndefined();
        expect(cabs.find((c) => c.id === 'c').layoutGroupId).toBe('g1');
        expect(cabs.find((c) => c.id === 'd').layoutGroupId).toBe('g1');
    });

    it('原群組只剩一人時解散', () => {
        const cabs = [
            { id: 'a', layoutGroupId: 'g1' },
            { id: 'b', layoutGroupId: 'g1' },
        ];
        detachSelectedFromExistingLayoutGroups(cabs, new Set(['a']));
        expect(cabs.find((c) => c.id === 'a').layoutGroupId).toBeUndefined();
        expect(cabs.find((c) => c.id === 'b').layoutGroupId).toBeUndefined();
    });
});
