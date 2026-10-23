/**
 * 報價匯出篩選：明確旗標優先；無旗標時 legacy 規則（model3dKind 開口、排除分類）。
 */
import { QUOTE_EXCLUDED_GROUPS } from './LP_quote_placement_meta.js';
import { resolveFixtureDisplayCategory } from './LP_3D_furniture.js';

const NON_EXPORT_SOURCE_TYPES = new Set([
    'opening',
    'door',
    'window',
    'wall',
    'wallSegment',
    'furniture',
    'sofa',
    'bed',
    'appliance',
]);

const EXPORT_SOURCE_TYPES = new Set(['cabinet', 'floorplan_cabinet']);

const OPENING_MODEL_KINDS = new Set(['door', 'window', 'wallSegment']);

function readBoolFlag(cab, key) {
    if (cab?.[key] === true || cab?.[key] === false) return cab[key];
    if (cab?.data?.[key] === true || cab?.data?.[key] === false) return cab.data[key];
    return undefined;
}

function readStringField(cab, key) {
    const v = cab?.[key] ?? cab?.data?.[key];
    if (v == null || v === '') return '';
    return String(v).trim();
}

function readModel3dKind(cab) {
    const v = cab?.model3dKind ?? cab?.data?.model3dKind;
    return v ? String(v).trim() : '';
}

/** 舊佈局無 quote 旗標 */
function legacyShouldExcludeFromQuote(cab) {
    if (!cab?.data) return true;

    const kind = readModel3dKind(cab);
    if (kind && OPENING_MODEL_KINDS.has(kind)) return true;

    const group = String(cab.data.group || '').trim();
    if (QUOTE_EXCLUDED_GROUPS.has(group)) return true;

    const displayCat = resolveFixtureDisplayCategory(cab, 'cabinet');
    if (displayCat === 'sofa' || displayCat === 'bed' || displayCat === 'appliance') return true;

    return false;
}

/**
 * @param {object} cab placedCabinets 元素
 * @returns {boolean}
 */
export function isQuoteExportablePlacedCabinet(cab) {
    if (!cab) return false;

    const explicit = readBoolFlag(cab, 'quoteExport');
    if (explicit === false) return false;
    if (explicit === true) return true;

    const sourceType = readStringField(cab, 'quoteSourceType');
    if (sourceType) {
        if (NON_EXPORT_SOURCE_TYPES.has(sourceType)) return false;
        if (EXPORT_SOURCE_TYPES.has(sourceType)) return true;
    }

    const quoteCategory = readStringField(cab, 'quoteCategory');
    if (quoteCategory === 'opening' || quoteCategory === 'furniture') return false;
    if (quoteCategory === 'cabinet') return true;

    if (legacyShouldExcludeFromQuote(cab)) return false;

    return true;
}

/**
 * @param {Array} placedCabinets
 * @returns {Array}
 */
export function filterPlacedCabinetsForQuoteExport(placedCabinets) {
    return (placedCabinets || []).filter(isQuoteExportablePlacedCabinet);
}
