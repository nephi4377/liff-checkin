/**
 * BudgetWeb 報價單解析核心（Browser + Node 共用）
 * BUDGET-PARSE-778 / 778b / 778c
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

    function rowSignalsFooterBlock(row, colMapping) {
        if (!row) return false;
        for (const off of [0, 1]) {
            const name = String(row[colMapping.name + off] ?? '').trim();
            const id = String(row[colMapping.id + off] ?? '').trim();
            if (name && !cellIsBlankOrZero(name)) {
                if (isForbiddenZoneLabel(name)) return true;
                if (isPureNumericLabel(name) && Math.abs(parseFloat(name.replace(/,/g, ''))) >= 100) return true;
            } else if (id && !cellIsBlankOrZero(id) && isPureNumericLabel(id) && Math.abs(parseFloat(id.replace(/,/g, ''))) >= 100) {
                return true;
            }
        }
        const joined = row.map(c => String(c ?? '')).join('');
        if (/增減合計|含稅總計|含稅/.test(joined) && /合計|含稅/.test(joined)) return true;
        if (/5\s*%.*發票稅|發票稅/.test(joined)) return true;
        if (/訂購人簽名|客戶確認欄?/.test(joined)) return true;
        if (/^第[0-9０-９]+[點條項]/.test(joined) || /[。；]\s*[0-9]+[、．]/.test(joined)) return true;
        return false;
    }

    function isSheetMetadataAddress(name, rowIndex, startRow) {
        if (rowIndex < startRow) return true;
        return false;
    }

    function pickItemFields(row, colMapping) {
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
        if (pickItemFields(row, colMapping)) return false;

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

    /** 分區標題：支援品項欄或項次欄（off 0/1） */
    function resolveZoneHeaderName(row, colMapping, sheetFooterClosed) {
        if (sheetFooterClosed) return null;
        for (const off of [0, 1]) {
            const fromName = String(row[colMapping.name + off] ?? '').trim();
            const fromId = String(row[colMapping.id + off] ?? '').trim();
            const candidates = [];
            if (fromName) candidates.push(fromName);
            if (fromId && fromId !== fromName) candidates.push(fromId);
            for (const text of candidates) {
                if (isZoneHeaderCandidate(text, row, colMapping, off, sheetFooterClosed)) return text;
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
        let inAdjustSection = false;
        let sheetFooterClosed = false;

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;
            if (i < startRow) continue;

            if (rowSignalsFooterBlock(row, colMapping)) {
                if (ADJUST_SECTION_END_RE.test(row.map(c => String(c ?? '')).join(''))) {
                    inAdjustSection = false;
                }
                sheetFooterClosed = true;
            }

            const rawLine = buildRawLine(row);

            if (!sheetFooterClosed) {
                const zoneName = resolveZoneHeaderName(row, colMapping, sheetFooterClosed);
                if (zoneName) {
                    if (ADJUST_SECTION_START_RE.test(zoneName)) {
                        inAdjustSection = true;
                    } else if (ADJUST_SECTION_END_RE.test(zoneName)) {
                        inAdjustSection = false;
                        sheetFooterClosed = true;
                    } else if (!inAdjustSection) {
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
            }

            const picked = pickItemFields(row, colMapping);
            if (!picked) continue;

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
        resolveZoneHeaderName,
        isZoneHeaderRow,
        isSuggestItem,
        isAdjustItem,
        parseSheetRows,
        parseSelectedSheets,
        classifyItemCounts,
        findTaxInclusiveTotal,
        sanitizeItemForExport,
        exportPayloadContainsForbiddenKeys
    };
});
