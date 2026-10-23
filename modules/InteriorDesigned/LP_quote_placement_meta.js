/**
 * 報價用 metadata：匯出時推斷，不寫入佈局檔（除非使用者明確設定 quoteFlagsUserSet）。
 */
import { resolveFixtureDisplayCategory } from './LP_3D_furniture.js';

export const QUOTE_EXCLUDED_GROUPS = new Set([
    '門窗工程',
    '家具家電',
    '家具',
    '家電',
]);

const OPENING_MODEL_KINDS = new Set(['door', 'window', 'wallSegment']);

export function isCabinetLikeProductName(name) {
    return /櫃|臥榻|收納/.test(String(name || ''));
}

/**
 * @param {object} data
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

    const name = String(data?.name || '');
    if (isCabinetLikeProductName(name)) return 'floorplan_cabinet';

    const displayCat = resolveFixtureDisplayCategory({ data }, 'cabinet');
    if (displayCat === 'sofa' || displayCat === 'bed') return 'furniture';
    if (displayCat === 'appliance') return 'appliance';

    return 'floorplan_cabinet';
}

/**
 * 存檔用：僅保留使用者明確設定的 quote 旗標
 * @param {object} cab
 */
export function serializePlacedCabinetForLayoutSave(cab) {
    const out = JSON.parse(JSON.stringify(cab));
    const userSet = Boolean(out.quoteFlagsUserSet);
    if (!userSet) {
        delete out.quoteSourceType;
        delete out.quoteExport;
        delete out.quoteFlagsUserSet;
        if (out.data) {
            delete out.data.quoteSourceType;
            delete out.data.quoteExport;
        }
    }
    return out;
}
