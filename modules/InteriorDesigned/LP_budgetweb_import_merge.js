/**
 * LayoutPlanner 草稿 → BudgetWeb processedData 合併（僅追加，不刪既有列）
 */
import { LP_QUOTE_DRAFT_SCHEMA } from './LP_quotation_budgetweb_export.js';

/**
 * @param {object} draft layout-planner-quote-draft-v1
 * @returns {Array<{ type: string, raw: string, data: object }>}
 */
export function layoutPlannerDraftToBudgetWebRows(draft) {
    const items = draft?.items || [];
    return items.map((it) => ({
        type: 'item',
        raw: it.raw_line || `LayoutPlanner|${it.id}|${it.name}`,
        data: {
            id: it.id,
            zone: it.zone || '未分類',
            category_tag: it.category_tag || '其他',
            name: it.name || '',
            spec: it.spec || '',
            qty: it.qty != null ? String(it.qty) : '',
            unit: it.unit || '',
            price: it.price != null ? String(it.price) : '',
            raw_line: it.raw_line || '',
            sheet_source: it.sheet_source || 'LayoutPlanner',
            status: it.status || 'PENDING',
            completion_percent: it.completion_percent != null ? it.completion_percent : 0,
            verification: it.verification || { is_ok: false },
        },
    }));
}

/**
 * @param {object|null} processedData BudgetWeb processedData
 * @param {object} draft LP quote draft
 * @returns {{ merged: object, stats: { added: number, skippedDuplicate: number, previousItemCount: number } }}
 */
export function mergeLayoutPlannerDraftIntoProcessedData(processedData, draft) {
    if (!draft || draft.schema !== LP_QUOTE_DRAFT_SCHEMA) {
        throw new Error(`不支援的草稿格式（需要 ${LP_QUOTE_DRAFT_SCHEMA}）`);
    }
    const base = processedData && processedData.items
        ? processedData
        : { total_summary: {}, items: [] };

    const existingIds = new Set();
    base.items.forEach((row) => {
        if (row.type === 'item' && row.data?.id) existingIds.add(row.data.id);
    });

    const incoming = layoutPlannerDraftToBudgetWebRows(draft);
    const toAdd = [];
    let skippedDuplicate = 0;
    incoming.forEach((row) => {
        const id = row.data?.id;
        if (id && existingIds.has(id)) {
            skippedDuplicate += 1;
            return;
        }
        if (id) existingIds.add(id);
        toAdd.push(row);
    });

    const merged = {
        total_summary: {
            ...(base.total_summary || {}),
            ...(draft.total_summary || {}),
            source: 'LayoutPlanner+BudgetWeb',
            lp_draft_merged_at: new Date().toISOString(),
        },
        items: [...base.items, ...toAdd],
    };

    return {
        merged,
        stats: {
            added: toAdd.length,
            skippedDuplicate,
            previousItemCount: base.items.filter((r) => r.type === 'item').length,
        },
    };
}

export function validateLayoutPlannerQuoteDraft(draft) {
    if (!draft || typeof draft !== 'object') return { ok: false, error: '空檔案' };
    if (draft.schema !== LP_QUOTE_DRAFT_SCHEMA) {
        return { ok: false, error: `schema 須為 ${LP_QUOTE_DRAFT_SCHEMA}` };
    }
    if (!Array.isArray(draft.items)) return { ok: false, error: '缺少 items' };
    return { ok: true };
}
