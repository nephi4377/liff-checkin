import { describe, it, expect } from 'vitest';
import {
    cmToFeet,
    overlap,
    project,
    getAxes,
    sanitizeSvgString,
    axisAlignedBoundsFromPoints,
    computeObjectSnapDelta,
    snapTranslationToGrid,
} from './LP_core.js';

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

describe('computeObjectSnapDelta', () => {
    it('左緣吸附至參考右緣', () => {
        const moving = { minX: 102, minY: 0, maxX: 200, maxY: 100 };
        const refs = [{ minX: 0, minY: 0, maxX: 100, maxY: 50 }];
        const { dx, dy } = computeObjectSnapDelta(moving, refs, 10);
        expect(dx).toBe(-2);
        expect(dy).toBe(0);
    });
    it('中心吸附至參考中心', () => {
        const moving = { minX: 48, minY: 48, maxX: 152, maxY: 152 };
        const refs = [{ minX: 0, minY: 0, maxX: 100, maxY: 100 }];
        const { dx } = computeObjectSnapDelta(moving, refs, 5);
        expect(dx).toBe(0);
    });
    it('超出閾值不吸附', () => {
        const moving = { minX: 120, minY: 0, maxX: 220, maxY: 100 };
        const refs = [{ minX: 0, minY: 0, maxX: 100, maxY: 50 }];
        const { dx } = computeObjectSnapDelta(moving, refs, 5);
        expect(dx).toBe(0);
    });
});

describe('snapTranslationToGrid', () => {
    it('預設 2cm 步距與舊版 GRID_SIZE=2 一致', () => {
        expect(snapTranslationToGrid(7, 13, 2)).toEqual({ dx: 8, dy: 14 });
    });
    it('5cm 步距', () => {
        expect(snapTranslationToGrid(7, 13, 5)).toEqual({ dx: 5, dy: 15 });
    });
    it('10cm 步距', () => {
        expect(snapTranslationToGrid(17, 23, 10)).toEqual({ dx: 20, dy: 20 });
    });
});

describe('axisAlignedBoundsFromPoints', () => {
    it('計算旋轉後點集外框', () => {
        const b = axisAlignedBoundsFromPoints([{ x: 10, y: 5 }, { x: 30, y: 25 }]);
        expect(b).toEqual({ minX: 10, minY: 5, maxX: 30, maxY: 25 });
    });
});

describe('sanitizeSvgString', () => {
    it('移除 script 區塊', () => {
        const s = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1"/></svg>';
        const out = sanitizeSvgString(s);
        expect(out.toLowerCase()).not.toContain('<script');
    });
    it('移除 onerror 等事件屬性', () => {
        const s = '<svg onload="evil()"><rect /></svg>';
        expect(sanitizeSvgString(s).toLowerCase()).not.toContain('onload');
    });
});
