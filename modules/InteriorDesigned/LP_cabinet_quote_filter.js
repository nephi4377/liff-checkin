/**
 * 報價匯出篩選：依明確欄位（quoteExport / quoteSourceType / quoteCategory），
 * 不依 3D 分類或名稱猜門窗。
 */

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

    if (!cab.data) return false;

    return true;
}

/**
 * @param {Array} placedCabinets
 * @returns {Array}
 */
export function filterPlacedCabinetsForQuoteExport(placedCabinets) {
    return (placedCabinets || []).filter(isQuoteExportablePlacedCabinet);
}
