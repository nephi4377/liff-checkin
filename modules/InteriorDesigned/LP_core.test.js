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
    mirrorAwareResizeDirection,
    computeCabinetResizeGeometry,
    rotateCabinetAroundPivot,
    mirrorCabinetsAsGroupAboutVerticalAxis,
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
    it('中心吸附至參考中心（52–152 vs 0–100，閾值 5）', () => {
        const moving = { minX: 52, minY: 0, maxX: 152, maxY: 100 };
        const refs = [{ minX: 0, minY: 0, maxX: 100, maxY: 100 }];
        const { dx, dy } = computeObjectSnapDelta(moving, refs, 5);
        expect(dx).toBe(-2);
        expect(dy).toBe(0);
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

describe('mirrorAwareResizeDirection', () => {
    it('鏡像時 w/e 對調', () => {
        expect(mirrorAwareResizeDirection('w', true)).toBe('e');
        expect(mirrorAwareResizeDirection('e', true)).toBe('w');
        expect(mirrorAwareResizeDirection('n', true)).toBe('n');
    });
});

describe('computeCabinetResizeGeometry', () => {
    const base = {
        startX: 100,
        startY: 50,
        startW: 200,
        startH: 80,
        rotationDeg: 0,
        adjustable: 'both',
    };

    it('未鏡像：拉東側控點增加寬度', () => {
        const r = computeCabinetResizeGeometry({
            ...base,
            mirrored: false,
            direction: 'e',
            localDx: 20,
            localDy: 0,
        });
        expect(r.currentW).toBe(220);
        expect(r.x).toBe(100);
    });

    it('已鏡像：DOM 西側控點對應視覺東側，加寬與未鏡像拉東一致', () => {
        const normal = computeCabinetResizeGeometry({
            ...base,
            mirrored: false,
            direction: 'e',
            localDx: 20,
            localDy: 0,
        });
        const mirrored = computeCabinetResizeGeometry({
            ...base,
            mirrored: true,
            direction: 'w',
            localDx: 20,
            localDy: 0,
        });
        expect(mirrored.currentW).toBe(normal.currentW);
        expect(mirrored.x).toBe(normal.x);
    });

    it('旋轉 90° 且鏡像：DOM 西控點拖曳加寬', () => {
        const r = computeCabinetResizeGeometry({
            ...base,
            rotationDeg: 90,
            mirrored: true,
            direction: 'w',
            localDx: 0,
            localDy: 25,
        });
        expect(r.currentW).toBe(225);
    });
});

describe('mirrorCabinetsAsGroupAboutVerticalAxis', () => {
    const rectVerts = (cab) => [
        { x: cab.x, y: cab.y },
        { x: cab.x + cab.currentW, y: cab.y },
        { x: cab.x + cab.currentW, y: cab.y + cab.currentH },
        { x: cab.x, y: cab.y + cab.currentH },
    ];

    it('兩物件以外框垂直中心線交換位置並切換 mirrored', () => {
        const a = { x: 100, y: 50, currentW: 40, currentH: 20, mirrored: false };
        const b = { x: 200, y: 50, currentW: 40, currentH: 20, mirrored: true };
        const out = mirrorCabinetsAsGroupAboutVerticalAxis([a, b], rectVerts);
        expect(out[0].x).toBe(200);
        expect(out[1].x).toBe(100);
        expect(out[0].mirrored).toBe(true);
        expect(out[1].mirrored).toBe(false);
    });

    it('連續兩次群組鏡像回到原位與 mirrored', () => {
        const a = { x: 100, y: 50, currentW: 40, currentH: 20, mirrored: false };
        const b = { x: 200, y: 50, currentW: 40, currentH: 20, mirrored: false };
        const once = mirrorCabinetsAsGroupAboutVerticalAxis([a, b], rectVerts);
        const a2 = { ...a, x: once[0].x, mirrored: once[0].mirrored };
        const b2 = { ...b, x: once[1].x, mirrored: once[1].mirrored };
        const twice = mirrorCabinetsAsGroupAboutVerticalAxis([a2, b2], rectVerts);
        expect(twice[0].x).toBe(100);
        expect(twice[1].x).toBe(200);
        expect(twice[0].mirrored).toBe(false);
        expect(twice[1].mirrored).toBe(false);
    });
});

describe('rotateCabinetAroundPivot', () => {
    it('繞自身中心旋轉 90° 位置不變', () => {
        const cab = { x: 10, y: 20, currentW: 100, currentH: 40, rotation: 0 };
        const next = rotateCabinetAroundPivot(cab, 60, 40, 90);
        expect(Math.round(next.x)).toBe(10);
        expect(Math.round(next.y)).toBe(20);
        expect(next.rotation).toBe(90);
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
