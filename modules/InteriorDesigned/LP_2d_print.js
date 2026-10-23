/**
 * LayoutPlanner 2D 出圖：尺寸標註與圖面版面（無 DOM 依賴，可單元測試）
 */

import { segmentLengthCmRounded, axisAlignedBoundsFromPoints } from './LP_core.js';
import { classifyPlacedCabinet3DKind } from './LP_3D_scene.js';
import {
    LP_3D_CATEGORY_COLORS,
    resolveFixtureDisplayCategory,
    resolveFixtureDisplayHeightCm,
} from './LP_3D_furniture.js';
import { LP_3D_DEFAULTS } from './LP_3D_scene.js';

/** @typedef {'wall' | 'cabinet' | 'opening'} DimensionKind */

/**
 * @typedef {object} PrintDimensionItem
 * @property {string} id
 * @property {DimensionKind} kind
 * @property {string} text
 * @property {number} anchorX
 * @property {number} anchorY
 * @property {number} [angleDeg]
 * @property {number} offsetTier
 */

export const LP_PRINT_SHEET_SPECS = {
    A4_LANDSCAPE: { id: 'A4_LANDSCAPE', label: 'A4 橫式', widthPx: 1123, heightPx: 794 },
    A3_LANDSCAPE: { id: 'A3_LANDSCAPE', label: 'A3 橫式', widthPx: 1587, heightPx: 1123 },
};

/** 與 `buildPrintSheetElement` 版面一致，供比例尺與縮放計算 */
export const LP_PRINT_LAYOUT = {
    marginPx: 48,
    titleBlockHeightPx: 120,
    legendWidthPx: 200,
    legendGapPx: 16,
};

/**
 * @param {string} sheetId
 * @returns {{ spec: object, drawableW: number, drawableH: number }}
 */
export function computePrintDrawableSize(sheetId) {
    const spec = resolvePrintSheetSpec(sheetId);
    const { marginPx, titleBlockHeightPx, legendWidthPx, legendGapPx } = LP_PRINT_LAYOUT;
    const drawableW = spec.widthPx - marginPx * 2 - legendWidthPx - legendGapPx;
    const drawableH = spec.heightPx - marginPx * 2 - titleBlockHeightPx;
    return { spec, drawableW, drawableH };
}

/**
 * @param {string} sheetId
 * @param {number} workspacePx
 */
export function computePrintSheetContentScale(sheetId, workspacePx) {
    const { drawableW, drawableH } = computePrintDrawableSize(sheetId);
    return computePrintContentScale(workspacePx, drawableW, drawableH);
}

export const LP_PRINT_TITLE_DEFAULTS = {
    projectNo: '案號：＿＿＿＿＿＿',
    projectName: '案名：＿＿＿＿＿＿',
    date: '日期：＿＿＿＿＿＿',
    scale: '比例：1:100',
    drawnBy: '繪圖：＿＿＿＿＿＿',
};

/** 圖例（與 3D 分色一致） */
export const LP_PRINT_LEGEND_ENTRIES = [
    { category: 'cabinet', label: '櫃體／系統櫃', color: LP_3D_CATEGORY_COLORS.cabinet },
    { category: 'wardrobe', label: '衣櫃', color: LP_3D_CATEGORY_COLORS.wardrobe },
    { category: 'kitchen', label: '廚具', color: LP_3D_CATEGORY_COLORS.kitchen },
    { category: 'sofa', label: '沙發', color: LP_3D_CATEGORY_COLORS.sofa },
    { category: 'bed', label: '床組', color: LP_3D_CATEGORY_COLORS.bed },
    { category: 'door', label: '門片', color: LP_3D_CATEGORY_COLORS.door },
    { category: 'window', label: '窗', color: LP_3D_CATEGORY_COLORS.window },
    { category: 'wallSegment', label: '牆片', color: LP_3D_CATEGORY_COLORS.wallSegment },
];

/**
 * @param {number} colorHex
 * @returns {string}
 */
export function categoryColorToCssHex(colorHex) {
    const n = Number(colorHex) >>> 0;
    return `#${n.toString(16).padStart(6, '0')}`;
}

/**
 * @param {{ x: number, y: number }} p
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
export function projectPointOnSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) {
        const dist = Math.hypot(p.x - a.x, p.y - a.y);
        return { t: 0, perpDist: dist, alongCm: 0, footX: a.x, footY: a.y };
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const footX = a.x + t * dx;
    const footY = a.y + t * dy;
    const perpDist = Math.hypot(p.x - footX, p.y - footY);
    const alongCm = Math.round(t * Math.sqrt(len2));
    return { t, perpDist, alongCm, footX, footY };
}

/**
 * @param {{ x: number, y: number }} point
 * @param {object[]} drawnAreas
 */
export function findNearestWallEdge(point, drawnAreas) {
    let best = null;
    for (const area of drawnAreas || []) {
        if (area.type !== 'wall' || !area.points?.length) continue;
        const pts = area.points;
        const closed = pts.length >= 3;
        const segCount = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segCount; i += 1) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const proj = projectPointOnSegment(point, a, b);
            if (!best || proj.perpDist < best.perpDist) {
                best = {
                    ...proj,
                    areaId: area.id,
                    segIndex: i,
                    a,
                    b,
                };
            }
        }
    }
    return best;
}

/**
 * @param {number} index
 * @param {number} [base]
 */
export function staggerDimensionOffsetPx(index, base = 22) {
    const tier = index % 4;
    return base + tier * 16;
}

/**
 * @param {object[]} drawnAreas
 * @returns {PrintDimensionItem[]}
 */
export function buildWallSegmentDimensions(drawnAreas) {
    const items = [];
    let idx = 0;
    for (const area of drawnAreas || []) {
        if (area.type !== 'wall' || !area.points?.length) continue;
        const pts = area.points;
        const closed = pts.length >= 3;
        const segCount = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segCount; i += 1) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const len = segmentLengthCmRounded(a, b);
            if (len < 1) continue;
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const angleDeg = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
            const nx = -(b.y - a.y);
            const ny = b.x - a.x;
            const nlen = Math.hypot(nx, ny) || 1;
            const off = staggerDimensionOffsetPx(idx);
            items.push({
                id: `wall-${area.id}-${i}`,
                kind: 'wall',
                text: `${len} cm`,
                anchorX: midX + (nx / nlen) * off,
                anchorY: midY + (ny / nlen) * off,
                angleDeg,
                offsetTier: idx % 4,
            });
            idx += 1;
        }
    }
    return items;
}

/**
 * @param {object[]} placedCabinets
 * @returns {PrintDimensionItem[]}
 */
export function buildCabinetDimensions(placedCabinets) {
    const items = [];
    let idx = 0;
    for (const cab of placedCabinets || []) {
        const kind = classifyPlacedCabinet3DKind(cab);
        if (kind === 'door' || kind === 'window' || kind === 'wallSegment') continue;
        const w = Math.round(cab.currentW || 0);
        const d = Math.round(cab.currentH || 0);
        if (w < 1 || d < 1) continue;
        const displayCategory = resolveFixtureDisplayCategory(cab, kind);
        const h = Math.round(resolveFixtureDisplayHeightCm(displayCategory, cab, LP_3D_DEFAULTS.CABINET_HEIGHT_CM));
        const cx = cab.x + w / 2;
        const cy = cab.y + d / 2;
        const off = staggerDimensionOffsetPx(idx, 14);
        items.push({
            id: `cab-${cab.id}`,
            kind: 'cabinet',
            text: `${w}×${d}×${h} cm`,
            anchorX: cx,
            anchorY: cy - off,
            angleDeg: 0,
            offsetTier: idx % 4,
        });
        idx += 1;
    }
    return items;
}

/**
 * @param {object[]} placedCabinets
 * @param {object[]} drawnAreas
 * @returns {PrintDimensionItem[]}
 */
export function buildOpeningDimensions(placedCabinets, drawnAreas) {
    const items = [];
    let idx = 0;
    for (const cab of placedCabinets || []) {
        const kind = classifyPlacedCabinet3DKind(cab);
        if (kind !== 'door' && kind !== 'window') continue;
        const width = Math.round(cab.currentW || 0);
        if (width < 1) continue;
        const cx = cab.x + (cab.currentW || 0) / 2;
        const cy = cab.y + (cab.currentH || 0) / 2;
        const edge = findNearestWallEdge({ x: cx, y: cy }, drawnAreas);
        const along = edge ? edge.alongCm : 0;
        const off = staggerDimensionOffsetPx(idx, 18);
        const kindLabel = kind === 'window' ? '窗' : '門';
        items.push({
            id: `open-${cab.id}`,
            kind: 'opening',
            text: `${kindLabel} 淨寬 ${width} cm · 離牆角 ${along} cm`,
            anchorX: cx,
            anchorY: cy + off,
            angleDeg: 0,
            offsetTier: idx % 4,
        });
        idx += 1;
    }
    return items;
}

/**
 * @param {{ drawnAreas?: object[], placedCabinets?: object[] }} layout
 * @returns {PrintDimensionItem[]}
 */
export function buildAllPrintDimensions(layout) {
    const drawnAreas = layout.drawnAreas || [];
    const placedCabinets = layout.placedCabinets || [];
    return [
        ...buildWallSegmentDimensions(drawnAreas),
        ...buildCabinetDimensions(placedCabinets),
        ...buildOpeningDimensions(placedCabinets, drawnAreas),
    ];
}

/**
 * @param {number} workspacePx
 * @param {number} drawableWidthPx
 * @param {number} drawableHeightPx
 * @param {number} [paddingPx]
 */
export function computePrintContentScale(workspacePx, drawableWidthPx, drawableHeightPx, paddingPx = 24) {
    const innerW = Math.max(1, drawableWidthPx - paddingPx * 2);
    const innerH = Math.max(1, drawableHeightPx - paddingPx * 2);
    const scale = Math.min(innerW / workspacePx, innerH / workspacePx, 1);
    return Math.max(0.05, scale);
}

/**
 * @param {object[]} placedCabinets
 * @returns {typeof LP_PRINT_LEGEND_ENTRIES}
 */
export function resolveActiveLegendEntries(placedCabinets) {
    const used = new Set();
    for (const cab of placedCabinets || []) {
        const kind = classifyPlacedCabinet3DKind(cab);
        if (kind === 'door' || kind === 'window' || kind === 'wallSegment') {
            used.add(kind);
        } else {
            used.add(resolveFixtureDisplayCategory(cab, kind));
        }
    }
    if (!used.size) {
        return LP_PRINT_LEGEND_ENTRIES.filter((e) => e.category === 'cabinet' || e.category === 'door');
    }
    return LP_PRINT_LEGEND_ENTRIES.filter((e) => used.has(e.category));
}

/**
 * @param {number} pixelsPerCmOnSheet 圖面上 1cm 對應像素
 * @param {number} [barCm]
 */
export function buildScaleBarLabel(pixelsPerCmOnSheet, barCm = 100) {
    const barPx = Math.round(pixelsPerCmOnSheet * barCm);
    return { barCm, barPx, label: `${barCm} cm` };
}

const SCALE_BAR_CM_STEPS = [100, 200, 500];

/**
 * 依圖面像素密度選 100／200／500cm 刻度（不抬高 pixelsPerCm 下限）
 * @param {number} pixelsPerCmOnSheet
 * @param {{ minBarPx?: number, maxBarPx?: number }} [options]
 */
export function resolvePrintScaleBar(pixelsPerCmOnSheet, options = {}) {
    const maxBarPx = options.maxBarPx ?? 200;
    const ppc = Number(pixelsPerCmOnSheet);
    if (!Number.isFinite(ppc) || ppc <= 0) {
        return buildScaleBarLabel(0, 100);
    }
    let barCm = 100;
    if (ppc * 100 > maxBarPx) {
        for (const step of [200, 500]) {
            if (ppc * step <= maxBarPx) {
                barCm = step;
                break;
            }
        }
        if (ppc * barCm > maxBarPx) {
            barCm = 500;
        }
    }
    return buildScaleBarLabel(ppc, barCm);
}

/** 螢幕出圖 96dpi 假設下，圖紙比例分母（與比例尺 bar 一致） */
export function estimatePrintScaleRatioForSheet(sheetId, workspacePx) {
    const ppc = computePrintSheetContentScale(sheetId, workspacePx);
    if (!ppc || ppc <= 0) return '1:—';
    const pxPerCmPaper = 96 / 2.54;
    const planExtentPx = workspacePx * ppc;
    const paperCm = planExtentPx / pxPerCmPaper;
    if (paperCm <= 0) return '1:—';
    const denom = Math.max(1, Math.round(workspacePx / paperCm));
    return `1:${denom}`;
}

/**
 * @param {object[]} points
 * @param {number} workspacePx
 */
export function estimatePrintScaleRatio(points, workspacePx) {
    const bounds = axisAlignedBoundsFromPoints(points?.length ? points : [{ x: 0, y: 0 }, { x: workspacePx, y: workspacePx }]);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, workspacePx * 0.3);
    const ratio = Math.max(10, Math.round(workspacePx / span));
    return `1:${ratio}`;
}

/**
 * @param {string} sheetId
 */
export function resolvePrintSheetSpec(sheetId) {
    return LP_PRINT_SHEET_SPECS[sheetId] || LP_PRINT_SHEET_SPECS.A4_LANDSCAPE;
}

/**
 * PNG 輸出檔名
 * @param {string} [sheetId]
 */
export function formatFloorplanPrintPngFilename(sheetId = 'A4') {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `layout-2d-print-${sheetId}-${stamp}.png`;
}

/**
 * 簡單檢查 PNG 標頭與最小尺寸（測試用）
 * @param {Uint8Array} bytes
 * @param {number} minWidth
 * @param {number} minHeight
 */
export function validatePngBytesNonEmpty(bytes, minWidth = 200, minHeight = 150) {
    if (!bytes || bytes.length < 24) return { ok: false, reason: 'too_short' };
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < sig.length; i += 1) {
        if (bytes[i] !== sig[i]) return { ok: false, reason: 'bad_signature' };
    }
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (w < minWidth || h < minHeight) return { ok: false, reason: 'small_dimensions', width: w, height: h };
    const unique = new Set();
    for (let i = 0; i < Math.min(bytes.length, 4096); i += 16) unique.add(bytes[i]);
    if (unique.size < 3) return { ok: false, reason: 'likely_blank' };
    return { ok: true, width: w, height: h };
}
