import { describe, it, expect } from 'vitest';
import { cmToFeet, overlap, project, getAxes, sanitizeSvgString } from './LP_core.js';
import {
    cmPointToWorldXZ,
    getWallRingPolygons,
    layoutTo3DModel,
    cabinetToBoxPrimitive,
    LP_3D_DEFAULTS,
} from './LP_layout3d.js';

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

describe('layoutTo3DModel (2D→3D)', () => {
    it('畫布中心對應 world 原點', () => {
        const p = cmPointToWorldXZ(1000, 1000, 2000);
        expect(p.x).toBe(0);
        expect(p.z).toBe(0);
    });

    it('牆體外圈比內圈更外擴', () => {
        const pts = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }];
        const { inner, outer } = getWallRingPolygons(pts, 15);
        expect(outer.length).toBe(inner.length);
        const innerMinX = Math.min(...inner.map((p) => p.x));
        const outerMinX = Math.min(...outer.map((p) => p.x));
        expect(outerMinX).toBeLessThan(innerMinX);
    });

    it('家具轉為 box 且中心與尺寸正確', () => {
        const cab = {
            id: 'cab-1',
            data: { name: '書桌', width: 120, depth: 60 },
            x: 100,
            y: 200,
            currentW: 120,
            currentH: 60,
            rotation: 90,
            mirrored: false,
        };
        const box = cabinetToBoxPrimitive(cab, 2000);
        expect(box.size.x).toBe(120);
        expect(box.size.z).toBe(60);
        expect(box.size.y).toBe(LP_3D_DEFAULTS.tableHeightCm);
        expect(box.center.x).toBe(100 + 60 - 1000);
        expect(box.center.z).toBe(200 + 30 - 1000);
    });

    it('layoutTo3DModel 產出地板與牆環', () => {
        const model = layoutTo3DModel({
            workspaceSizeCm: 2000,
            placedCabinets: [],
            drawnAreas: [
                { id: 'f1', type: 'floor', points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }] },
                {
                    id: 'w1',
                    type: 'wall',
                    thickness: 15,
                    points: [{ x: 600, y: 600 }, { x: 800, y: 600 }, { x: 800, y: 800 }, { x: 600, y: 800 }],
                },
            ],
        });
        expect(model.floorSlabs).toHaveLength(1);
        expect(model.wallRings).toHaveLength(1);
        expect(model.wallRings[0].heightCm).toBe(LP_3D_DEFAULTS.wallHeightCm);
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
