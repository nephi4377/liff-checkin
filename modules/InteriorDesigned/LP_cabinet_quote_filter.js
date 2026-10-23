/**
 * 報價匯出：僅「櫃體」計入明細，門／窗／牆體開口等排除（與 3D classify 一致）
 */
import { resolvePlacedCabinet3DKind } from './LP_3D_scene.js';

/**
 * @param {object} cab placedCabinets 元素
 * @returns {boolean}
 */
export function isQuoteExportablePlacedCabinet(cab) {
    const kind = resolvePlacedCabinet3DKind(cab);
    return kind === 'cabinet';
}

/**
 * @param {Array} placedCabinets
 * @returns {Array}
 */
export function filterPlacedCabinetsForQuoteExport(placedCabinets) {
    return (placedCabinets || []).filter(isQuoteExportablePlacedCabinet);
}
