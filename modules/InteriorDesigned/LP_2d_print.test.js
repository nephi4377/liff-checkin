import { describe, it, expect } from 'vitest';
import {
    buildAllPrintDimensions,
    buildWallSegmentDimensions,
    buildOpeningDimensions,
    computePrintContentScale,
    computePrintDrawableSize,
    computePrintSheetContentScale,
    resolvePrintScaleBar,
    estimatePrintScaleRatioForSheet,
    formatFloorplanPrintPngFilename,
    projectPointOnSegment,
    resolvePrintSheetSpec,
    validatePngBytesNonEmpty,
    staggerDimensionOffsetPx,
} from './LP_2d_print.js';
import { assemblePrintSheetOptions } from './LP_2d_print_render.js';

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

    it('computePrintDrawableSize 與 A3/A4 圖紙像素一致', () => {
        const a4 = computePrintDrawableSize('A4_LANDSCAPE');
        const a3 = computePrintDrawableSize('A3_LANDSCAPE');
        expect(a3.drawableW).toBeGreaterThan(a4.drawableW);
        expect(a3.drawableH).toBeGreaterThan(a4.drawableH);
    });

    it('computePrintSheetContentScale 使用圖紙可繪區而非固定 600×400', () => {
        const workspacePx = 2000;
        const { drawableW, drawableH } = computePrintDrawableSize('A4_LANDSCAPE');
        const fromSheet = computePrintSheetContentScale('A4_LANDSCAPE', workspacePx);
        const fromDrawable = computePrintContentScale(workspacePx, drawableW, drawableH);
        const fromFixed = computePrintContentScale(workspacePx, 600, 400);
        expect(fromSheet).toBe(fromDrawable);
        expect(fromSheet).not.toBe(fromFixed);
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

describe('resolvePrintScaleBar', () => {
    it('A4 2000px workspace 選 100cm 刻度', () => {
        const ppc = computePrintSheetContentScale('A4_LANDSCAPE', 2000);
        const bar = resolvePrintScaleBar(ppc);
        expect(bar.barCm).toBe(100);
        expect(bar.barPx).toBe(Math.round(ppc * 100));
        expect(bar.barPx).toBeGreaterThanOrEqual(25);
        expect(bar.barPx).toBeLessThanOrEqual(29);
    });

    it('A4 3000px workspace 選 100cm 刻度', () => {
        const ppc = computePrintSheetContentScale('A4_LANDSCAPE', 3000);
        const bar = resolvePrintScaleBar(ppc);
        expect(bar.barCm).toBe(100);
        expect(bar.barPx).toBe(Math.round(ppc * 100));
        expect(bar.barPx).toBeGreaterThanOrEqual(16);
        expect(bar.barPx).toBeLessThanOrEqual(20);
    });

    it('A3 3000px workspace 選 100cm 刻度', () => {
        const ppc = computePrintSheetContentScale('A3_LANDSCAPE', 3000);
        const bar = resolvePrintScaleBar(ppc);
        expect(bar.barCm).toBe(100);
        expect(bar.barPx).toBe(Math.round(ppc * 100));
        expect(bar.barPx).toBeGreaterThanOrEqual(27);
        expect(bar.barPx).toBeLessThanOrEqual(31);
    });
});

describe('estimatePrintScaleRatioForSheet', () => {
    it('與圖紙 contentScale 推算一致', () => {
        const workspacePx = 2000;
        const sheetId = 'A4_LANDSCAPE';
        const label = estimatePrintScaleRatioForSheet(sheetId, workspacePx);
        const ppc = computePrintSheetContentScale(sheetId, workspacePx);
        const pxPerCmPaper = 96 / 2.54;
        const planExtentPx = workspacePx * ppc;
        const paperCm = planExtentPx / pxPerCmPaper;
        const denom = Math.max(1, Math.round(workspacePx / paperCm));
        expect(label).toBe(`1:${denom}`);
    });
});

describe('resolvePrintScaleBar tier', () => {
    it('100cm 過短時升級 200／500（minBarPx）', () => {
        const bar = resolvePrintScaleBar(0.15, { minBarPx: 24, maxBarPx: 200 });
        expect(bar.barCm).toBe(200);
        expect(bar.barPx).toBe(30);
    });
});

describe('assemblePrintSheetOptions', () => {
    it('A3 可繪區較大時比例尺 bar 像素較 A4 長（同 workspace）', () => {
        const base = {
            workspacePx: 2000,
            placedCabinets: [],
            titleBlock: {},
            planCloneHtml: '<div></div>',
        };
        const a4 = assemblePrintSheetOptions({ ...base, sheetId: 'A4_LANDSCAPE' });
        const a3 = assemblePrintSheetOptions({ ...base, sheetId: 'A3_LANDSCAPE' });
        expect(a3.scaleBar.barPx).toBeGreaterThan(a4.scaleBar.barPx);
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
