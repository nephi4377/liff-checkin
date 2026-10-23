/**
 * BudgetWeb 報價單解析核心（Browser + Node 共用）
 * BUDGET-PARSE-778 / 778b–778e
 */
(function (root, factory) {
    const lib = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = lib;
    }
    if (root) {
        root.BudgetQuoteParser = lib;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    /** J、K 欄（0-based 9、10）：內部成本，不得上雲（位移列成本常在 K） */
    const INTERNAL_COST_COL_IDX = 9;
    const INTERNAL_COST_COL_IDX_SHIFTED = 10;
    const INTERNAL_COST_COL_IDXS = [INTERNAL_COST_COL_IDX, INTERNAL_COST_COL_IDX_SHIFTED];

    const ZONE_KEYWORD_RE = /樓|廳|房|區|工程|追加|增減|變更|玄關|廚房|衛浴|陽台|女兒|兒子|主臥|客浴|臥/;
    const NON_ITEM_LABEL_RE = /增減合計|合計\s*\(|未稅|含稅|小計|總計|稅額/;
    const SUGGEST_NAME_PREFIX_RE = /^建議方案[-－]/;
    const SHEET_ADDRESS_RE = /巷|弄|號|路|段|之\d|^\S{0,12}\d+樓/;
    const ADJUST_SECTION_START_RE = /簽約後續增減/;
    const ADJUST_SECTION_END_RE = /增減合計/;

    /** 增減區常見版面：品名 col0、單位 col3、數量 col4、合計 col5（可為負數） */
    const ADJUST_COMPACT_COL_MAPPING = { id: 0, name: 0, unit: 3, qty: 4, total_price: 5, spec: -1 };

    function cellIsBlankOrZero(val) {
        const s = String(val == null ? '' : val).trim();
        if (s === '') return true;
        if (/^贈送$/i.test(s)) return false;
        const normalized = s.replace(/,/g, '');
        if (/^-?0+(\.0+)?$/.test(normalized)) return true;
        const n = parseFloat(normalized);
        return !Number.isNaN(n) && n === 0;
    }

    function cellHasMeaningfulNumber(val) {
        const s = String(val == null ? '' : val).trim();
        if (s === '' || cellIsBlankOrZero(val)) return false;
        if (/贈送/.test(s)) return true;
        return /\d/.test(s);
    }

    function isInternalCostColEmpty(row) {
        if (!row) return true;
        return INTERNAL_COST_COL_IDXS.every((idx) => {
            if (row.length <= idx) return true;
            return cellIsBlankOrZero(row[idx]);
        });
    }

    function isColJEmpty(row) {
        return isInternalCostColEmpty(row);
    }

    function stripInternalCostFromRow(row) {
        if (!row) return [];
        return row.map((c, idx) => (INTERNAL_COST_COL_IDXS.includes(idx) ? '' : c));
    }

    function parseMoney(val) {
        const s = String(val == null ? '' : val).replace(/,/g, '').trim();
        const n = parseFloat(s);
        return Number.isNaN(n) ? null : n;
    }

    function buildRawLine(row) {
        if (!row) return '';
        const trimmed = stripInternalCostFromRow(row);
        let cleanRow = trimmed.filter(c => c !== '' && c != null && String(c).trim() !== '');
        if (cleanRow.length > 5) cleanRow = cleanRow.slice(0, cleanRow.length - 2);
        return cleanRow.map(c => String(c).trim()).join(' | ');
    }

    function rawLineContainsInternalCostValues(row, rawLine) {
        if (!row || !rawLine) return false;
        const line = String(rawLine);
        for (const idx of INTERNAL_COST_COL_IDXS) {
            if (row.length <= idx) continue;
            const v = row[idx];
            if (v == null || v === '') continue;
            if (cellIsBlankOrZero(v)) continue;
            const s = String(v).trim();
            if (s && line.includes(s)) return true;
        }
        return false;
    }

    function detectColMappingFromHeaderRows(json) {
        let colMapping = { id: -1, name: -1, qty: -1, unit: -1, spec: -1, total_price: -1 };
        let startRow = 0;
        for (let i = 0; i < Math.min(json.length, 35); i++) {
            const row = json[i].map(c => String(c).trim());
            const nameIdx = row.findIndex(c => (c === '品項' || c === '項目' || c === '內容'));
            if (nameIdx === -1) continue;
            colMapping.name = nameIdx;
            colMapping.id = row.findIndex(c => c.includes('项次') || c.includes('項次') || c === 'NO' || c === 'No.');
            colMapping.qty = row.findIndex(c => c.includes('數量'));
            colMapping.unit = row.findIndex(c => c.includes('單位'));
            colMapping.spec = row.findIndex(c => c.includes('備註') || c.includes('規格'));
            colMapping.total_price = row.findIndex(c => c.includes('總價') || c.includes('複價') || c.includes('小計'));
            if (colMapping.id === -1) colMapping.id = Math.max(0, colMapping.name - 1);
            if (colMapping.qty === -1) colMapping.qty = colMapping.name + 2;
            if (colMapping.unit === -1) colMapping.unit = colMapping.name + 1;
            if (colMapping.total_price === -1) colMapping.total_price = colMapping.name + 4;
            startRow = i + 1;
            break;
        }
        return { colMapping, startRow };
    }

    function isPureNumericLabel(text) {
        const s = String(text == null ? '' : text).trim().replace(/,/g, '');
        if (!s) return false;
        return /^-?\d+(\.\d+)?$/.test(s);
    }

    function isNonItemSummaryLabel(name) {
        const s = String(name || '').trim();
        if (!s) return false;
        if (s === '合計') return true;
        return NON_ITEM_LABEL_RE.test(s);
    }

    function isForbiddenZoneLabel(name) {
        const s = String(name || '').trim();
        if (!s) return true;
        if (isPureNumericLabel(s)) return true;
        if (/發票稅|%/.test(s) && /稅/.test(s)) return true;
        if (/訂購人簽名|客戶確認/.test(s)) return true;
        if (/^第[0-9０-９]+[點條項、．.]/.test(s) || /^[0-9]+[、．.]/.test(s)) return true;
        if (ADJUST_SECTION_END_RE.test(s)) return true;
        if (/^合計$/.test(s)) return true;
        return false;
    }

    const METADATA_HEADER_ROW_BAND = 25;

    function rowHasAdjustSectionStart(row) {
        if (!row) return false;
        return row.some((c) => ADJUST_SECTION_START_RE.test(String(c ?? '')));
    }

    function rowHasAdjustSectionEnd(row) {
        if (!row) return false;
        const joined = row.map((c) => String(c ?? '')).join('');
        return ADJUST_SECTION_END_RE.test(joined);
    }

    /** 僅最終條款／簽名／含稅等鎖表尾；中段付款條件、水電表不鎖 */
    function rowSignalsFinalFooterBlock(row, colMapping) {
        if (!row) return false;
        if (rowHasAdjustSectionStart(row)) return false;
        if (rowHasAdjustSectionEnd(row)) return false;
        const joined = row.map((c) => String(c ?? '')).join('');
        const trimmed = joined.trim();
        if (/含稅總計|含稅/.test(joined) && /含稅|合計/.test(joined)) return true;
        if (/5\s*%.*發票稅|發票稅/.test(joined)) return true;
        if (/訂購人簽名|客戶確認欄?/.test(joined)) return true;
        if (/^第[0-9０-９]+[點條項]/.test(trimmed)) return true;
        return false;
    }

    function isStandardWorkItemRow(row, colMapping) {
        const picked = pickItemFieldsFromMapping(row, colMapping);
        if (!picked) return false;
        const id = String(picked.indexVal ?? '').trim();
        return /^\d+$/.test(id);
    }

    function metadataBlocksItem(picked, rowIndex, startRow, metadataKeywords) {
        if (!metadataKeywords || !metadataKeywords.length || !picked) return false;
        const hit = metadataKeywords.some((kw) => picked.name.includes(kw));
        if (!hit) return false;
        const hasUnit = picked.unitVal && !cellIsBlankOrZero(picked.unitVal);
        const hasQty = cellHasMeaningfulNumber(picked.qtyVal);
        if (hasUnit && hasQty) return false;
        if (rowIndex < startRow + METADATA_HEADER_ROW_BAND) return true;
        return !hasUnit && !hasQty;
    }

    function isSheetMetadataAddress(name, rowIndex, startRow) {
        if (rowIndex < startRow) return true;
        return false;
    }

    function priceQualifiesAsItem(totalPriceVal) {
        const totalPriceStr = String(totalPriceVal ?? '').trim();
        return cellHasMeaningfulNumber(totalPriceStr) || totalPriceStr.includes('贈送');
    }

    function pickItemFieldsFromMapping(row, colMapping) {
        for (const off of [0, 1]) {
            const name = String(row[colMapping.name + off] ?? '').trim();
            if (!name || isNonItemSummaryLabel(name)) continue;
            if (name === '合計') continue;
            if (/發票稅/.test(name)) continue;
            if (isForbiddenZoneLabel(name) && !ZONE_KEYWORD_RE.test(name)) continue;
            const unitVal = String(row[colMapping.unit + off] ?? '').trim();
            if (!unitVal || cellIsBlankOrZero(unitVal)) continue;
            const qtyVal = String(row[colMapping.qty + off] ?? '').trim();
            const totalPriceVal = String(row[colMapping.total_price + off] ?? '').trim();
            if (!priceQualifiesAsItem(totalPriceVal)) continue;
            return {
                off,
                name,
                unitVal,
                qtyVal,
                totalPriceVal,
                indexVal: String(row[colMapping.id + off] ?? '').trim(),
                spec: colMapping.spec >= 0 ? String(row[colMapping.spec + off] ?? '').trim() : '',
                layout: 'standard'
            };
        }
        return null;
    }

    function pickItemFields(row, colMapping) {
        return pickItemFieldsFromMapping(row, colMapping);
    }

    function pickAdjustCompactItemFields(row) {
        return pickItemFieldsFromMapping(row, ADJUST_COMPACT_COL_MAPPING);
    }

    function zoneHeaderAmountsBlank(row, colMapping, off) {
        const rawUnit = String(row[colMapping.unit + off] ?? '').trim();
        const rawQty = String(row[colMapping.qty + off] ?? '').trim();
        const rawPrice = String(row[colMapping.total_price + off] ?? '').trim();
        return cellIsBlankOrZero(rawUnit) && cellIsBlankOrZero(rawQty) && cellIsBlankOrZero(rawPrice);
    }

    function looksLikeStreetAddress(name) {
        const s = String(name || '').trim();
        if (!s) return false;
        return (/號|巷|弄|路|段/.test(s) && /\d/.test(s)) || /\d+樓之\d/.test(s);
    }

    function isZoneHeaderCandidate(name, row, colMapping, off, sheetFooterClosed) {
        if (sheetFooterClosed) return false;
        if (!name || isNonItemSummaryLabel(name)) return false;
        if (isForbiddenZoneLabel(name)) return false;
        if (looksLikeStreetAddress(name)) return false;
        if (pickItemFieldsFromMapping(row, colMapping)) return false;
        if (pickAdjustCompactItemFields(row)) return false;

        const rawQty = String(row[colMapping.qty + off] ?? '').trim();
        const rawPrice = String(row[colMapping.total_price + off] ?? '').trim();
        const hasNumber = cellHasMeaningfulNumber(rawQty) || cellHasMeaningfulNumber(rawPrice);
        if (hasNumber) return false;

        const hasZoneKeyword = ZONE_KEYWORD_RE.test(name);
        const rawUnit = String(row[colMapping.unit + off] ?? '').trim();
        const isUnitEmpty = cellIsBlankOrZero(rawUnit);
        const allAmountColsBlank = zoneHeaderAmountsBlank(row, colMapping, off);
        const costColsEmpty = isInternalCostColEmpty(row);

        if (allAmountColsBlank && costColsEmpty && (hasZoneKeyword || name.length <= 8)) return true;
        if ((name.length <= 8 && hasZoneKeyword) || (isUnitEmpty && hasZoneKeyword)) return true;
        if (/簽約後續增減|建議方案/.test(name) && allAmountColsBlank) return true;
        return false;
    }

    /** 分區標題：支援品項欄或項次欄（off 0/1）；增減緊湊版面 col0 */
    function resolveZoneHeaderName(row, colMapping, sheetFooterClosed, inAdjustSection) {
        const allowDespiteFooter = rowHasAdjustSectionStart(row);
        if (sheetFooterClosed && !allowDespiteFooter) return null;

        const mappings = [colMapping];
        if (inAdjustSection || allowDespiteFooter) mappings.push(ADJUST_COMPACT_COL_MAPPING);

        for (const map of mappings) {
            for (const off of [0, 1]) {
                const fromName = String(row[map.name + off] ?? '').trim();
                const fromId = map.id >= 0 ? String(row[map.id + off] ?? '').trim() : '';
                const candidates = [];
                if (fromName) candidates.push(fromName);
                if (fromId && fromId !== fromName) candidates.push(fromId);
                for (const text of candidates) {
                    const closed = sheetFooterClosed && !allowDespiteFooter;
                    if (isZoneHeaderCandidate(text, row, map, off, closed)) return text;
                }
            }
        }
        return null;
    }

    function isZoneHeaderRow(name, row, colMapping, rowIndex, startRow) {
        if (rowIndex < startRow) return false;
        const resolved = resolveZoneHeaderName(row, colMapping, false);
        if (!resolved) return false;
        if (name && isSheetMetadataAddress(name, rowIndex, startRow)) return false;
        return resolved === name || !name;
    }

    function findTaxInclusiveTotal(json) {
        for (let i = json.length - 1; i >= 0; i--) {
            const row = json[i];
            if (!row) continue;
            const text = row.map(c => String(c ?? '')).join('');
            if (!/含稅/.test(text)) continue;
            let best = null;
            for (const c of row) {
                const n = parseMoney(c);
                if (n != null && n > 0) best = n;
            }
            if (best != null) return Math.round(best);
        }
        return null;
    }

    function isSuggestItem(it) {
        const name = String(it.data && it.data.name ? it.data.name : '');
        const z = String(it.data && it.data.zone ? it.data.zone : '');
        return SUGGEST_NAME_PREFIX_RE.test(name) || /建議/.test(z);
    }

    function isAdjustItem(it) {
        if (it.data && it.data.in_adjust_section) return true;
        const z = String(it.data && it.data.zone ? it.data.zone : '');
        return /增減|簽約後續/.test(z);
    }

    /**
     * @param {Array<Array>} json sheet_to_json header:1
     * @param {string} sheetName
     * @param {{ getCategory?: Function, metadataKeywords?: string[] }} options
     */
    /** 同表內重複 id：第 1 筆不變，第 2 筆起加 _2、_3… */
    function assignUniqueItemIdForSheet(sheetItemIdCounts, baseId) {
        const n = (sheetItemIdCounts.get(baseId) || 0) + 1;
        sheetItemIdCounts.set(baseId, n);
        if (n === 1) return baseId;
        return `${baseId}_${n}`;
    }

    function stableItemContentHash(data) {
        const parts = ['name', 'spec', 'qty', 'unit', 'zone', 'sheet_source'].map((f) =>
            String(data && data[f] != null ? data[f] : '').trim(),
        );
        const s = parts.join('\x1f');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
    }

    function parseSheetRows(json, sheetName, options) {
        const getCategory = options && options.getCategory ? options.getCategory : () => '其他';
        const metadataKeywords = (options && options.metadataKeywords) || [];
        const items = [];
        const sheetItemIdCounts = new Map();
        if (!json || json.length < 3) {
            return { items, taxInclusiveTotal: null };
        }

        const { colMapping, startRow } = detectColMappingFromHeaderRows(json);
        if (colMapping.name === -1) {
            return { items, taxInclusiveTotal: findTaxInclusiveTotal(json) };
        }

        let currentZone = '未分類';
        let inAdjustSection = false;
        let sheetFooterClosed = false;

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;
            if (i < startRow) continue;

            if (rowHasAdjustSectionStart(row)) {
                sheetFooterClosed = false;
            }

            if (rowHasAdjustSectionEnd(row)) {
                inAdjustSection = false;
            }

            if (rowSignalsFinalFooterBlock(row, colMapping)) {
                sheetFooterClosed = true;
            }

            if (isStandardWorkItemRow(row, colMapping)) {
                sheetFooterClosed = false;
            }

            const rawLine = buildRawLine(row);

            const zoneName = resolveZoneHeaderName(row, colMapping, sheetFooterClosed, inAdjustSection);
            if (zoneName) {
                if (ADJUST_SECTION_START_RE.test(zoneName)) {
                    inAdjustSection = true;
                    sheetFooterClosed = false;
                } else if (ADJUST_SECTION_END_RE.test(zoneName)) {
                    inAdjustSection = false;
                }

                const isDuplicate = zoneName === currentZone;
                currentZone = zoneName;
                items.push({
                    type: 'header',
                    zone: currentZone,
                    raw: rawLine,
                    sheet_source: sheetName,
                    is_cancelled: isDuplicate,
                    in_adjust_section: inAdjustSection
                });
                continue;
            }

            if (sheetFooterClosed && !inAdjustSection) continue;

            let picked = pickItemFields(row, colMapping);
            if (!picked && inAdjustSection) {
                picked = pickAdjustCompactItemFields(row);
            }
            if (!picked) continue;

            if (metadataBlocksItem(picked, i, startRow, metadataKeywords)) continue;

            const baseItemId = picked.indexVal
                ? `ITEM_${sheetName}_${picked.indexVal}`
                : `ITEM_${sheetName}_R${i}`;
            const itemId = assignUniqueItemIdForSheet(sheetItemIdCounts, baseItemId);

            items.push({
                type: 'item',
                zone: currentZone,
                raw: rawLine,
                data: {
                    id: itemId,
                    zone: currentZone,
                    name: picked.name,
                    spec: picked.spec,
                    qty: picked.qtyVal,
                    unit: picked.unitVal,
                    price: picked.totalPriceVal,
                    category_tag: getCategory(picked.name, picked.spec),
                    sheet_source: sheetName,
                    raw_line: rawLine,
                    is_suggest: SUGGEST_NAME_PREFIX_RE.test(picked.name),
                    in_adjust_section: inAdjustSection
                }
            });
        }

        return { items, taxInclusiveTotal: findTaxInclusiveTotal(json) };
    }

    function parseSelectedSheets(sheetPayloads, options) {
        const allItems = [];
        let taxInclusiveTotal = null;
        sheetPayloads.forEach(({ sheetName, json }) => {
            const result = parseSheetRows(json, sheetName, options);
            allItems.push(...result.items);
            if (result.taxInclusiveTotal != null) taxInclusiveTotal = result.taxInclusiveTotal;
        });
        return { items: allItems, total_summary: { tax_inclusive_total: taxInclusiveTotal } };
    }

    function sumAdjustItemPrices(items) {
        let sum = 0;
        items.filter((it) => it.type === 'item' && isAdjustItem(it)).forEach((it) => {
            const n = parseMoney(it.data && it.data.price);
            if (n != null) sum += n;
        });
        return Math.round(sum);
    }

    function classifyItemCounts(items) {
        const itemRows = items.filter(it => it.type === 'item');
        let work = 0;
        let suggest = 0;
        let adjust = 0;
        itemRows.forEach(it => {
            if (isSuggestItem(it)) suggest += 1;
            else if (isAdjustItem(it)) adjust += 1;
            else work += 1;
        });
        return { work, suggest, adjust, total: itemRows.length };
    }

    function scrubInternalCostFromText(text) {
        if (!text) return text;
        return String(text);
    }

    /** 雲端／JSON 匯出：不含 J/K 欄成本與內部欄位 */
    function sanitizeItemForExport(d) {
        if (!d) return d;
        const out = {
            id: d.id,
            zone: d.zone,
            category_tag: d.category_tag,
            name: d.name,
            spec: d.spec,
            qty: d.qty,
            unit: d.unit,
            price: d.price != null && d.price !== '' ? d.price : '',
            raw_line: scrubInternalCostFromText(d.raw_line),
            sheet_source: d.sheet_source,
            status: d.status || 'PENDING',
            completion_percent: d.completion_percent != null ? d.completion_percent : 0,
            verification: d.verification || { is_ok: false }
        };
        return out;
    }

    function exportPayloadContainsForbiddenKeys(obj) {
        const forbidden = ['cost', 'internal_cost', 'cost_j', 'column_j', 'column_k', 'is_suggest', 'in_adjust_section'];
        const stack = [obj];
        while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== 'object') continue;
            for (const key of Object.keys(cur)) {
                if (forbidden.includes(key)) return true;
                const val = cur[key];
                if (val && typeof val === 'object') stack.push(val);
            }
        }
        return false;
    }

    return {
        INTERNAL_COST_COL_IDX,
        INTERNAL_COST_COL_IDX_SHIFTED,
        INTERNAL_COST_COL_IDXS,
        ZONE_KEYWORD_RE,
        SUGGEST_NAME_PREFIX_RE,
        cellIsBlankOrZero,
        cellHasMeaningfulNumber,
        isColJEmpty,
        isInternalCostColEmpty,
        stripInternalCostFromRow,
        buildRawLine,
        rawLineContainsInternalCostValues,
        detectColMappingFromHeaderRows,
        pickItemFields,
        pickAdjustCompactItemFields,
        ADJUST_COMPACT_COL_MAPPING,
        rowHasAdjustSectionStart,
        rowHasAdjustSectionEnd,
        rowSignalsFinalFooterBlock,
        isStandardWorkItemRow,
        metadataBlocksItem,
        sumAdjustItemPrices,
        resolveZoneHeaderName,
        isZoneHeaderRow,
        isSuggestItem,
        isAdjustItem,
        parseSheetRows,
        parseSelectedSheets,
        classifyItemCounts,
        findTaxInclusiveTotal,
        sanitizeItemForExport,
        exportPayloadContainsForbiddenKeys,
        assignUniqueItemIdForSheet,
        stableItemContentHash,
    };
});
