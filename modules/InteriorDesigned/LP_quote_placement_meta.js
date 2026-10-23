/**
 * 平面放置時寫入報價用 metadata（與 3D 顯示分類分離）
 */
import { resolveFixtureDisplayCategory } from './LP_3D_furniture.js';

export const QUOTE_EXCLUDED_GROUPS = new Set([
    '門窗工程',
    '家具家電',
    '家具',
    '家電',
]);

const OPENING_MODEL_KINDS = new Set(['door', 'window', 'wallSegment']);

/**
 * @param {object} data 元件 data（來自元件表或拖放）
 * @param {{ model3dKind?: string }} [cabShell]
 */
export function inferQuoteSourceTypeForPlacement(data, cabShell = {}) {
    const modelKind = cabShell.model3dKind ?? data?.model3dKind;
    if (modelKind && OPENING_MODEL_KINDS.has(modelKind)) {
        if (modelKind === 'door') return 'door';
        if (modelKind === 'window') return 'window';
        return 'opening';
    }

    const group = String(data?.group || '').trim();
    if (QUOTE_EXCLUDED_GROUPS.has(group)) {
        if (modelKind === 'window' || /窗/.test(String(data?.name || ''))) return 'window';
        if (modelKind === 'door' || group === '門窗工程') return 'door';
        return 'opening';
    }

    const displayCat = resolveFixtureDisplayCategory({ data }, 'cabinet');
    if (displayCat === 'sofa' || displayCat === 'bed') return 'furniture';
    if (displayCat === 'appliance') return 'appliance';

    return 'floorplan_cabinet';
}

/**
 * @param {object} cab placedCabinets 元素（會 mutate data / 頂層欄位）
 */
export function enrichPlacedCabinetQuoteMeta(cab) {
    if (!cab?.data) return cab;
    const explicit = cab.quoteSourceType ?? cab.data.quoteSourceType;
    if (!explicit) {
        const st = inferQuoteSourceTypeForPlacement(cab.data, cab);
        cab.quoteSourceType = st;
        cab.data.quoteSourceType = st;
    }
    if (cab.data.quoteExport === undefined && cab.quoteExport === undefined) {
        const st = cab.quoteSourceType || cab.data.quoteSourceType;
        const nonExport = new Set(['door', 'window', 'opening', 'furniture', 'appliance', 'wall', 'wallSegment']);
        if (nonExport.has(st)) {
            cab.quoteExport = false;
            cab.data.quoteExport = false;
        }
    }
    return cab;
}
