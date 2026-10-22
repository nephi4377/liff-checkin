/**
 * LayoutPlanner → BudgetWeb／BudgetAuditor 草稿工項（僅前端匯出，不寫雲端）
 * @see docs/FLOORPLAN_QUOTE_IMPORT_PLAN.md
 */

export const LP_QUOTE_DRAFT_SCHEMA = 'layout-planner-quote-draft-v1';

/** 與 BudgetWeb_Standalone CATEGORY_RULES 對齊（精簡關鍵字） */
const CATEGORY_RULES = {
    施工保護: ['保護', 'pp板', '養護'],
    拆除工程: ['拆除', '敲除', '清運'],
    泥作工程: ['泥作', '砌磚', '粉刷', '防水'],
    油漆工程: ['油漆', '乳膠漆', '批土', '噴漆'],
    水電工程: ['插座', '配線', '開關', '燈具', '迴路', '弱電', '水電'],
    木作工程: ['天花板', '隔間', '門', '層板', '木', '包管', '平釘', '間照', '封板', '電視牆', '壁板'],
    系統櫃體: ['櫃', '櫥', '衣', '鞋', '高櫃', '矮櫃', '抽屜'],
    廚具設備: ['廚具', '水槽', '烘碗機', '瓦斯爐'],
    地板工程: ['超耐磨', '地板', '卡扣', 'spc'],
    清潔工程: ['粗清', '細清', '廢棄物'],
};

export function inferCategoryTag(name, spec = '') {
    const text = `${name || ''}${spec || ''}`.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_RULES)) {
        if (keywords.some((kw) => text.includes(kw))) return cat;
    }
    return '其他';
}

/**
 * @param {object} row LayoutPlanner 顯示列（含 specNote、group、lineKey 等）
 * @param {string} zone 目前區段（群組標題或 group）
 * @param {number} seq 序號（用於穩定 id）
 */
export function layoutLineToBudgetWebItem(row, zone, seq) {
    const spec = String(row.specNote ?? row.sizeLabel ?? row.note ?? '').trim();
    const qty = row.quantity;
    const qtyStr = qty === '' || qty == null ? '' : String(qty);
    const priceNum = Number(row.totalPrice);
    const priceStr = priceNum > 0 ? String(Math.round(priceNum)) : '';
    const safeKey = String(row.lineKey || `row_${seq}`).replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
        id: `LP_${safeKey}`,
        zone: zone || row.group || '未分類',
        category_tag: inferCategoryTag(row.name, spec),
        name: String(row.name || '').trim(),
        spec,
        qty: qtyStr,
        unit: String(row.unit || '').trim(),
        price: priceStr,
        raw_line: `LayoutPlanner|${row.lineKey || seq}|${row.name || ''}`,
        sheet_source: 'LayoutPlanner',
        status: 'PENDING',
        completion_percent: 0,
        verification: { is_ok: false },
        layoutPlanner: {
            lineKey: row.lineKey || null,
            sourceType: row.sourceType || null,
            isAddon: Boolean(row.isAddon),
            group: row.group || null,
        },
    };
}

/**
 * @param {{ lineItems: Array, grandTotal?: number, meta?: object }} input
 * @returns {object} BudgetWeb 相容草稿（不含 Firebase／案號必填）
 */
export function buildLayoutPlannerQuoteDraft(input) {
    const lineItems = input?.lineItems || [];
    const items = [];
    let currentZone = '未分類';
    let seq = 0;

    lineItems.forEach((row) => {
        if (row.isHeader) {
            currentZone = String(row.name || '未分類').trim() || '未分類';
            return;
        }
        if (row.isAddon === undefined && (row.name || '').startsWith('└')) {
            row = { ...row, isAddon: true };
        }
        const specNote = row.specNote != null
            ? row.specNote
            : [row.sizeLabel, row.note].filter(Boolean).join(' ').trim();
        items.push(layoutLineToBudgetWebItem({ ...row, specNote }, currentZone, seq++));
    });

    const grandTotal = Number(input?.grandTotal) || items.reduce((s, it) => s + (parseFloat(it.price) || 0), 0);

    return {
        schema: LP_QUOTE_DRAFT_SCHEMA,
        generatedAt: new Date().toISOString(),
        案號: '',
        total_summary: {
            siteName: '（平面規劃草稿）',
            source: 'LayoutPlanner',
            overall_completion: 0,
            item_count: items.length,
            grand_total: Math.round(grandTotal),
            ...(input?.meta || {}),
        },
        items,
    };
}

/** BudgetWeb sanitizeItemForExport 同等欄位（瀏覽器端不依賴 tools/） */
export function sanitizeDraftItemForBudgetWeb(d) {
    if (!d) return d;
    return {
        id: d.id,
        zone: d.zone,
        category_tag: d.category_tag,
        name: d.name,
        spec: d.spec,
        qty: d.qty,
        unit: d.unit,
        price: d.price != null && d.price !== '' ? d.price : '',
        raw_line: d.raw_line,
        sheet_source: d.sheet_source,
        status: d.status || 'PENDING',
        completion_percent: d.completion_percent != null ? d.completion_percent : 0,
        verification: d.verification || { is_ok: false },
    };
}

export function budgetWebDraftToCsv(draft) {
    const headers = ['區段', '分類', '品項', '規格備註', '單位', '數量', '總價', '來源', 'id'];
    const rows = (draft?.items || []).map((it) => [
        it.zone,
        it.category_tag,
        it.name,
        it.spec,
        it.unit,
        it.qty,
        it.price,
        it.sheet_source,
        it.id,
    ]);
    const escape = (v) => {
        const s = String(v == null ? '' : v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}
