import { describe, it, expect } from 'vitest';
import {
    buildAllPrintDimensions,
    buildWallSegmentDimensions,
    buildOpeningDimensions,
    computePrintContentScale,
    formatFloorplanPrintPngFilename,
    projectPointOnSegment,
    resolvePrintSheetSpec,
    validatePngBytesNonEmpty,
    staggerDimensionOffsetPx,
} from './LP_2d_print.js';

describe('LP_2d_print wall dimensions', () => {
    it('產生牆段長度標註（cm）', () => {
        const dims = buildWallSegmentDimensions([
            {
                id: 'w1',
                type: 'wall',
                points: [
                    { x: 0, y: 0 },
                    { x: 300, y: 0 },
                    { x: 300, y: 200 },
                ],
            },
        ]);
        expect(dims.length).toBeGreaterThanOrEqual(2);
        expect(dims[0].text).toMatch(/cm$/);
        expect(dims[0].kind).toBe('wall');
    });
});

describe('LP_2d_print openings', () => {
    it('門窗標註含淨寬與離牆角距離', () => {
        const drawnAreas = [{
            id: 'w1',
            type: 'wall',
            points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }],
        }];
        const placedCabinets = [{
            id: 'd1',
            x: 200,
            y: 0,
            currentW: 90,
            currentH: 15,
            data: { name: '房門', group: '門窗工程' },
        }];
        const dims = buildOpeningDimensions(placedCabinets, drawnAreas);
        expect(dims).toHaveLength(1);
        expect(dims[0].text).toContain('淨寬 90 cm');
        expect(dims[0].text).toMatch(/離牆角 \d+ cm/);
    });
});

describe('LP_2d_print helpers', () => {
    it('projectPointOnSegment 計算沿牆距離', () => {
        const p = projectPointOnSegment({ x: 250, y: 5 }, { x: 0, y: 0 }, { x: 1000, y: 0 });
        expect(p.alongCm).toBe(250);
    });

    it('staggerDimensionOffsetPx 遞增避讓', () => {
        expect(staggerDimensionOffsetPx(0)).toBeLessThan(staggerDimensionOffsetPx(1));
    });

    it('computePrintContentScale 限制在可視區', () => {
        const s = computePrintContentScale(2000, 800, 600);
        expect(s).toBeLessThanOrEqual(1);
        expect(s).toBeGreaterThan(0);
    });

    it('resolvePrintSheetSpec A3/A4', () => {
        expect(resolvePrintSheetSpec('A3_LANDSCAPE').widthPx).toBeGreaterThan(resolvePrintSheetSpec('A4_LANDSCAPE').widthPx);
    });

    it('formatFloorplanPrintPngFilename', () => {
        expect(formatFloorplanPrintPngFilename('A4')).toMatch(/^layout-2d-print-A4-\d{8}-\d{4}\.png$/);
    });

    it('validatePngBytesNonEmpty 拒絕過小', () => {
        const bad = new Uint8Array([1, 2, 3]);
        expect(validatePngBytesNonEmpty(bad).ok).toBe(false);
    });
});

describe('buildAllPrintDimensions', () => {
    it('合併牆、櫃、開口', () => {
        const all = buildAllPrintDimensions({
            drawnAreas: [{
                id: 'w',
                type: 'wall',
                points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            }],
            placedCabinets: [{
                id: 'c1',
                x: 10,
                y: 10,
                currentW: 60,
                currentH: 40,
                data: { name: '矮櫃', group: '系統櫃' },
            }],
        });
        expect(all.some((d) => d.kind === 'wall')).toBe(true);
        expect(all.some((d) => d.kind === 'cabinet')).toBe(true);
    });
});
