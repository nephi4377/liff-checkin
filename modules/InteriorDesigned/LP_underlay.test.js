/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
    computeScaleFromTwoPointCalibration,
    computeRotationDeltaToHorizontalDeg,
    pointAtSegmentLength,
    estimateDataUrlBytes,
    normalizeLayoutBackground,
} from './LP_underlay.js';

describe('computeScaleFromTwoPointCalibration', () => {
    it('依實際長度調整 scale', () => {
        expect(computeScaleFromTwoPointCalibration(100, 300, 1)).toBeCloseTo(3, 5);
        expect(computeScaleFromTwoPointCalibration(0, 300, 2)).toBe(2);
    });
});

describe('computeRotationDeltaToHorizontalDeg', () => {
    it('45° 斜線應回傳約 -45°', () => {
        const d = computeRotationDeltaToHorizontalDeg({ x: 0, y: 0 }, { x: 100, y: 100 });
        expect(d).toBeCloseTo(-45, 1);
    });
});

describe('pointAtSegmentLength', () => {
    it('固定牆段長度', () => {
        const p = pointAtSegmentLength({ x: 0, y: 0 }, { x: 100, y: 0 }, 250);
        expect(p.x).toBeCloseTo(250, 3);
        expect(p.y).toBeCloseTo(0, 3);
    });
});

describe('normalizeLayoutBackground', () => {
    it('補齊缺欄', () => {
        const n = normalizeLayoutBackground({ scale: 1.2, rotationDeg: 5 });
        expect(n.scale).toBe(1.2);
        expect(n.rotationDeg).toBe(5);
        expect(n.opacity).toBeGreaterThan(0);
    });
});

describe('estimateDataUrlBytes', () => {
    it('估算 base64 長度', () => {
        const tiny = 'data:image/png;base64,AAAA';
        expect(estimateDataUrlBytes(tiny)).toBeGreaterThan(0);
    });
});
