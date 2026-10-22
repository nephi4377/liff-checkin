/**
 * BudgetWeb 報價單解析核心（Browser + Node 共用）
 * BUDGET-PARSE-778：0 視為空白、分區關鍵字、項次可空、欄位右移一格、J 欄成本不外洩
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
    /** Excel 欄 J（0-based index 9）：內部成本，不得上雲 */
    const INTERNAL_COST_COL_IDX = 9;

    const ZONE_KEYWORD_RE = /樓|廳|房|區|工程|追加|增減|變更|玄關|廚房|衛浴|陽台|女兒|兒子|主臥|客浴|臥/;

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

    function isColJEmpty(row) {
        if (!row || row.length <= INTERNAL_COST_COL_IDX) return true;
        return cellIsBlankOrZero(row[INTERNAL_COST_COL_IDX]);
    }

    function parseMoney(val) {
        const s = String(val == null ? '' : val).replace(/,/g, '').trim();
        const n = parseFloat(s);
        return Number.isNaN(n) ? null : n;
    }

    function buildRawLine(row) {
        if (!row) return '';
        const trimmed = row.map((c, idx) => (idx === INTERNAL_COST_COL_IDX ? '' : c));
        let cleanRow = trimmed.filter(c => c !== '' && c != null && String(c).trim() !== '');
        if (cleanRow.length > 5) cleanRow = cleanRow.slice(0, cleanRow.length - 2);
        return cleanRow.map(c => String(c).trim()).join(' | ');
    }

    function detectColMappingFromHeaderRows(json) {
        let colMapping = { id: -1, name: -1, qty: -1, unit: -1, spec: -1, total_price: -1 };
        let startRow = 0;
        for (let i = 0; i < Math.min(json.length, 35); i++) {
            const row = json[i].map(c => String(c).trim());
            const nameIdx = row.findIndex(c => (c === '品項' || c === '項目' || c === '內容'));
            if (nameIdx === -1) continue;
            colMapping.name = nameIdx;
            colMapping.id = row.findIndex(c => c.includes('項次') || c === 'NO' || c === 'No.');
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

    function pickItemFields(row, colMapping) {
        for (const off of [0, 1]) {
            const name = String(row[colMapping.name + off] ?? '').trim();
            if (!name) continue;
            const unitVal = String(row[colMapping.unit + off] ?? '').trim();
            if (!unitVal || cellIsBlankOrZero(unitVal)) continue;
            const qtyVal = String(row[colMapping.qty + off] ?? '').trim();
            const totalPriceVal = String(row[colMapping.total_price + off] ?? '').trim();
            const hasQtyNum = cellHasMeaningfulNumber(qtyVal);
            const hasPriceNum = cellHasMeaningfulNumber(totalPriceVal) || totalPriceVal.includes('贈送');
            if (!hasQtyNum && !hasPriceNum) continue;
            return {
                off,
                name,
                unitVal,
                qtyVal,
                totalPriceVal,
                indexVal: String(row[colMapping.id + off] ?? '').trim(),
                spec: String(row[colMapping.spec + off] ?? '').trim()
            };
        }
        return null;
    }

    function isZoneHeaderRow(name, row, colMapping) {
        if (!name) return false;
        if (pickItemFields(row, colMapping)) return false;

        const rawQty = String(row[colMapping.qty] ?? '').trim();
        const rawPrice = String(row[colMapping.total_price] ?? '').trim();
        const rawUnit = String(row[colMapping.unit] ?? '').trim();
        const hasNumber = cellHasMeaningfulNumber(rawQty) || cellHasMeaningfulNumber(rawPrice);
        if (hasNumber) return false;

        const hasZoneKeyword = ZONE_KEYWORD_RE.test(name);
        const isUnitEmpty = cellIsBlankOrZero(rawUnit);
        const allAmountColsBlank = cellIsBlankOrZero(rawUnit) && cellIsBlankOrZero(rawQty) && cellIsBlankOrZero(rawPrice);
        const jEmpty = isColJEmpty(row);

        if (allAmountColsBlank && jEmpty && (hasZoneKeyword || name.length <= 8)) return true;
        if ((name.length <= 8 && hasZoneKeyword) || (isUnitEmpty && hasZoneKeyword)) return true;
        return false;
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

    /**
     * @param {Array<Array>} json sheet_to_json header:1
     * @param {string} sheetName
     * @param {{ getCategory?: Function, metadataKeywords?: string[] }} options
     */
    function parseSheetRows(json, sheetName, options) {
        const getCategory = options && options.getCategory ? options.getCategory : () => '其他';
        const metadataKeywords = (options && options.metadataKeywords) || [];
        const items = [];
        if (!json || json.length < 3) {
            return { items, taxInclusiveTotal: null };
        }

        const { colMapping, startRow } = detectColMappingFromHeaderRows(json);
        if (colMapping.name === -1) {
            return { items, taxInclusiveTotal: findTaxInclusiveTotal(json) };
        }

        let currentZone = '未分類';

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;
            const name = String(row[colMapping.name] ?? '').trim();
            const rawLine = buildRawLine(row);

            if (isZoneHeaderRow(name, row, colMapping)) {
                const isDuplicate = name === currentZone;
                currentZone = name;
                items.push({
                    type: 'header',
                    zone: currentZone,
                    raw: rawLine,
                    sheet_source: sheetName,
                    is_cancelled: isDuplicate
                });
                continue;
            }

            const picked = pickItemFields(row, colMapping);
            if (!picked || i < startRow) continue;

            if (metadataKeywords.some(kw => picked.name.includes(kw))) continue;

            items.push({
                type: 'item',
                zone: currentZone,
                raw: rawLine,
                data: {
                    id: picked.indexVal ? `ITEM_${sheetName}_${picked.indexVal}` : `ITEM_${sheetName}_R${i}`,
                    zone: currentZone,
                    name: picked.name,
                    spec: picked.spec,
                    qty: picked.qtyVal,
                    unit: picked.unitVal,
                    price: picked.totalPriceVal,
                    category_tag: getCategory(picked.name, picked.spec),
                    sheet_source: sheetName,
                    raw_line: rawLine
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

    function classifyItemCounts(items) {
        const itemRows = items.filter(it => it.type === 'item');
        let work = 0;
        let suggest = 0;
        let adjust = 0;
        itemRows.forEach(it => {
            const z = String(it.data && it.data.zone ? it.data.zone : '');
            if (/建議/.test(z)) suggest += 1;
            else if (/增減|簽約後續/.test(z)) adjust += 1;
            else work += 1;
        });
        return { work, suggest, adjust, total: itemRows.length };
    }

    /** 雲端／JSON 匯出：不含 J 欄成本與內部欄位 */
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
            raw_line: d.raw_line,
            sheet_source: d.sheet_source,
            status: d.status || 'PENDING',
            completion_percent: d.completion_percent != null ? d.completion_percent : 0,
            verification: d.verification || { is_ok: false }
        };
        return out;
    }

    function exportPayloadContainsForbiddenKeys(obj) {
        const forbidden = ['cost', 'internal_cost', 'cost_j', 'column_j'];
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
        ZONE_KEYWORD_RE,
        cellIsBlankOrZero,
        cellHasMeaningfulNumber,
        isColJEmpty,
        buildRawLine,
        detectColMappingFromHeaderRows,
        pickItemFields,
        isZoneHeaderRow,
        parseSheetRows,
        parseSelectedSheets,
        classifyItemCounts,
        findTaxInclusiveTotal,
        sanitizeItemForExport,
        exportPayloadContainsForbiddenKeys
    };
});
