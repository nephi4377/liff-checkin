import { describe, it, expect } from 'vitest';
import { cmToFeet, overlap, project, getAxes } from './LP_geometry.js';

describe('cmToFeet', () => {
    it('1 尺 = 30cm，進位 0.5 尺', () => {
        expect(cmToFeet(30)).toBe(1);
        expect(cmToFeet(45)).toBe(1.5);
    });
});

describe('overlap', () => {
    it('分離區間不重疊', () => {
        expect(overlap({ min: 0, max: 1 }, { min: 2, max: 3 })).toBe(false);
    });
    it('重疊區間為 true', () => {
        expect(overlap({ min: 0, max: 2 }, { min: 1, max: 3 })).toBe(true);
    });
});

describe('SAT 輔助', () => {
    it('getAxes + project 可對矩形頂點投影', () => {
        const v = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }];
        const axes = getAxes(v);
        expect(axes.length).toBeGreaterThan(0);
        const axis = axes[0];
        const p = project(v, axis);
        expect(p.max).toBeGreaterThan(p.min);
    });
});
