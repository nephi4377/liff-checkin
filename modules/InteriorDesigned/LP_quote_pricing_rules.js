/**
 * LayoutPlanner → 報價草稿：集中計價規則（單價由豪哥填表，預設不帶數字單價）
 * @see docs/FLOORPLAN_QUOTE_IMPORT_PLAN.md
 */

import { cmToFeet } from './LP_core.js';

/** 未設定單價時的顯示與匯出標記（不得自行填數字） */
export const PENDING_PRICE_LABEL = '待豪哥定價';

export const LP_QUOTE_PRICING_RULES_VERSION = 'layout-planner-pricing-rules-v1';

/**
 * 計價方式：quantityFrom 決定數量怎麼從幾何算出；unitPrice 一律 null 直到規則表填入數字
 * @type {Record<string, {
 *   label: string,
 *   unit: string,
 *   quantityFrom: 'width_feet'|'depth_feet'|'area_cai'|'fixed_one'|'number_one'|'cm_width'|'cai_sheet'|'zero',
 *   unitPrice: number|null,
 *   priceStatus: string,
 * }>}
 */
export const PRICING_RULES_BY_TYPE = {
    width: {
        label: '櫃體寬邊（尺）',
        unit: '尺',
        quantityFrom: 'width_feet',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    depth: {
        label: '櫃體深邊（尺）',
        unit: '尺',
        quantityFrom: 'depth_feet',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    area: {
        label: '立面才數（寬×高換算才）',
        unit: '才',
        quantityFrom: 'area_cai',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    cai: {
        label: '才（試算表才數欄）',
        unit: '才',
        quantityFrom: 'cai_sheet',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    fixed: {
        label: '一式',
        unit: '式',
        quantityFrom: 'fixed_one',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    number: {
        label: '按件',
        unit: '個',
        quantityFrom: 'number_one',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    cm: {
        label: '公分長度',
        unit: 'cm',
        quantityFrom: 'cm_width',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
    none: {
        label: '不計價（僅列項）',
        unit: '',
        quantityFrom: 'zero',
        unitPrice: null,
        priceStatus: PENDING_PRICE_LABEL,
    },
};

/** 副屬性：單位沿用元件表，單價待填 */
export const ADDON_PRICING_RULE = {
    label: '櫃體副屬性',
    unit: null,
    quantityFrom: 'addon_qty',
    unitPrice: null,
    priceStatus: PENDING_PRICE_LABEL,
};

/** 平面櫃體預設高度（cm），與 3D CABINET_HEIGHT_CM 一致 */
export const DEFAULT_CABINET_ELEVATION_CM = 90;

/**
 * @param {object} cab placed cabinet
 * @returns {typeof PRICING_RULES_BY_TYPE['width']}
 */
export function resolveCabinetPricingRule(cab) {
    const pt = String(cab?.data?.pricingType || 'width').trim();
    return PRICING_RULES_BY_TYPE[pt] || PRICING_RULES_BY_TYPE.width;
}

/**
 * @param {object} cab
 * @param {ReturnType<typeof resolveCabinetPricingRule>} rule
 */
export function computeQuantityFromPricingRule(cab, rule) {
    const w = Number(cab?.currentW) || Number(cab?.data?.width) || 0;
    const d = Number(cab?.currentH) || Number(cab?.data?.depth) || 0;
    switch (rule.quantityFrom) {
        case 'width_feet':
            return Math.round(cmToFeet(w) * 100) / 100;
        case 'depth_feet':
            return Math.round(cmToFeet(d) * 100) / 100;
        case 'area_cai':
            return Math.round(cmToFeet(w) * cmToFeet(d) * 100) / 100;
        case 'cai_sheet':
            return Number(cab?.caiQty) || 0;
        case 'fixed_one':
        case 'number_one':
            return 1;
        case 'cm_width':
            return w;
        case 'zero':
            return 0;
        default:
            return Math.round(cmToFeet(w) * 100) / 100;
    }
}

export function cabinetElevationHeightCm(cab) {
    const h = Number(cab?.data?.height);
    if (h > 0) return h;
    return DEFAULT_CABINET_ELEVATION_CM;
}

/** 寬×深×高（平面寬深＋立面高度） */
export function formatCabinetWdhSpec(cab) {
    const w = Math.round(Number(cab?.currentW) || Number(cab?.data?.width) || 0);
    const dep = Math.round(Number(cab?.currentH) || Number(cab?.data?.depth) || 0);
    const h = Math.round(cabinetElevationHeightCm(cab));
    return `寬${w}×深${dep}×高${h}cm`;
}

/**
 * 豪哥需決定的計價項目清單（供 PR／文件回報）
 * @returns {Array<{ pricingType: string, label: string, unit: string, priceStatus: string }>}
 */
export function listPricingDecisionsForOwner() {
    const rows = Object.entries(PRICING_RULES_BY_TYPE).map(([pricingType, r]) => ({
        pricingType,
        label: r.label,
        unit: r.unit,
        priceStatus: r.priceStatus,
        unitPriceConfigured: r.unitPrice != null,
    }));
    rows.push({
        pricingType: 'addon',
        label: ADDON_PRICING_RULE.label,
        unit: '（依元件表副屬性）',
        priceStatus: ADDON_PRICING_RULE.priceStatus,
        unitPriceConfigured: false,
    });
    return rows;
}

/**
 * 列總價：有設定 unitPrice 才計算，否則空字串（不捏造）
 */
export function computeLineTotalPrice(rule, quantity) {
    if (rule.unitPrice == null || rule.unitPrice === '') return '';
    const q = Number(quantity) || 0;
    return String(Math.round(rule.unitPrice * q));
}
