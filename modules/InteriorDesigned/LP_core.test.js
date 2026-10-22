import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    cmToFeet,
    overlap,
    project,
    getAxes,
    sanitizeSvgString,
    areaInPingFromPolygonPoints,
    calculateFloorAreaWithLoss,
    normalizeDrawnAreaForImport,
} from './LP_core.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const keyguardFixture = JSON.parse(
    readFileSync(join(fixtureDir, 'e2e/fixtures/lp-walk-keyguard.json'), 'utf8'),
);

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

describe('FLOORPLAN-AREA-NAN-1：匯入舊備份坪數', () => {
    it('lp-walk-keyguard 地板區僅 points 時可推算 12 坪', () => {
        const floor = keyguardFixture.drawnAreas.find((a) => a.type === 'floor');
        expect(floor.areaInPing).toBeUndefined();
        expect(areaInPingFromPolygonPoints(floor.points)).toBe(12);
    });

    it('normalizeDrawnAreaForImport 補 areaInPing', () => {
        const floor = keyguardFixture.drawnAreas[0];
        const normalized = normalizeDrawnAreaForImport(floor);
        expect(normalized.areaInPing).toBe(12);
    });

    it('calculateFloorAreaWithLoss 對非數值回傳 0', () => {
        expect(calculateFloorAreaWithLoss(undefined)).toBe(0);
        expect(calculateFloorAreaWithLoss(NaN)).toBe(0);
        expect(calculateFloorAreaWithLoss('x')).toBe(0);
    });

    it('calculateFloorAreaWithLoss(12) 含損耗為 14.5 坪', () => {
        expect(calculateFloorAreaWithLoss(12)).toBe(14.5);
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
