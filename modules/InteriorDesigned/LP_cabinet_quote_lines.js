/**
 * 從畫布櫃體產生報價草稿列（名稱、類別、寬深高、數量、空間）
 */
import { inferCategoryTag } from './LP_quotation_budgetweb_export.js';
import { filterPlacedCabinetsForQuoteExport } from './LP_cabinet_quote_filter.js';
import {
    resolveCabinetPricingRule,
    computeQuantityFromPricingRule,
    computeLineTotalPrice,
    formatCabinetWdhSpec,
    PENDING_PRICE_LABEL,
    ADDON_PRICING_RULE,
} from './LP_quote_pricing_rules.js';

function collectAddonLines(cab, groupName, parentLineKey) {
    const lines = [];
    const addons = cab.addons || {};
    const config = cab.data?.addonsConfig || [];
    config.forEach((cfg) => {
        const qty = Number(addons[cfg.name]) || 0;
        if (qty <= 0) return;
        const unit = cfg.unit || '式';
        lines.push({
            isAddon: true,
            lineKey: `${parentLineKey}_addon_${cfg.name}`,
            sourceType: 'cabinet_addon',
            name: `└ ${cfg.name}`,
            group: groupName,
            categoryTag: inferCategoryTag(cfg.name, ''),
            unit,
            quantity: qty,
            totalPrice: '',
            priceStatus: ADDON_PRICING_RULE.priceStatus,
            sizeLabel: '',
            note: `單價：${PENDING_PRICE_LABEL}`,
            specNote: `單價：${PENDING_PRICE_LABEL}`,
        });
    });
    return lines;
}

/**
 * @param {Array} placedCabinets
 * @returns {Array} lineItems 含 isHeader、與 buildLayoutPlannerQuoteDraft 相容
 */
export function buildCabinetQuoteLineItemsFromLayout(placedCabinets) {
    const cabs = filterPlacedCabinetsForQuoteExport(Array.isArray(placedCabinets) ? placedCabinets : []);
    const byGroup = new Map();
    cabs.forEach((cab) => {
        const g = String(cab.data?.group || '未分類').trim() || '未分類';
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(cab);
    });

    const groupNames = [...byGroup.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const lineItems = [];

    groupNames.forEach((groupName) => {
        const list = byGroup.get(groupName) || [];
        if (!list.length) return;
        lineItems.push({ isHeader: true, lineKey: `hdr_${groupName}`, name: groupName });
        list.sort((a, b) => String(a.data?.name || '').localeCompare(String(b.data?.name || ''), 'zh-Hant'));

        list.forEach((cab) => {
            const rule = resolveCabinetPricingRule(cab);
            const qty = computeQuantityFromPricingRule(cab, rule);
            const wdh = formatCabinetWdhSpec(cab);
            const name = String(cab.data?.name || '未命名櫃體').trim();
            const categoryTag = inferCategoryTag(name, wdh);
            const priceNote = `單價：${rule.priceStatus}`;
            const specNote = `${wdh} ${priceNote}`.trim();
            const lineKey = `cabinet_${cab.id}`;

            lineItems.push({
                isAddon: false,
                lineKey,
                sourceType: 'cabinet',
                name,
                group: groupName,
                categoryTag,
                unit: rule.unit,
                quantity: qty,
                totalPrice: computeLineTotalPrice(rule, qty),
                priceStatus: rule.priceStatus,
                pricingType: cab.data?.pricingType || 'width',
                sizeLabel: wdh,
                note: cab.note || '',
                specNote,
            });

            collectAddonLines(cab, groupName, lineKey).forEach((ln) => lineItems.push(ln));
        });
    });

    return lineItems;
}
