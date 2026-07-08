/*
 * 施工回報 AI — 前端共用 UI（每日回報、主控台日誌卡）
 * 資料來源：ProjectLog AI_* 欄位
 */

export const AI_SIGNAL_META = {
    green: { emoji: '🟢', label: '正常', border: 'border-green-200', bg: 'bg-green-50/80', text: 'text-green-800' },
    yellow: { emoji: '🟡', label: '留意', border: 'border-amber-200', bg: 'bg-amber-50/80', text: 'text-amber-900' },
    red: { emoji: '🔴', label: '異常', border: 'border-red-200', bg: 'bg-red-50/80', text: 'text-red-800' },
    skipped: { emoji: '⚪', label: '未分析', border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-600' }
};

export function parseAiFindingsJson(report) {
    if (!report || !report.AI_FindingsJson) return null;
    try {
        return JSON.parse(report.AI_FindingsJson);
    } catch (e) {
        return null;
    }
}

export function escapeAiHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @returns {{ uid: string, name: string }[]} */
export function parseAiHumanReviewed(raw) {
    if (!raw || !String(raw).trim()) return [];
    try {
        const arr = JSON.parse(String(raw));
        if (!Array.isArray(arr)) return [];
        return arr
            .filter(x => x && String(x.uid || '').trim())
            .map(x => ({
                uid: String(x.uid).trim(),
                name: String(x.name || x.uid).trim(),
                verdict: String(x.verdict || x.feedback || x.type || '').trim()
            }));
    } catch (e) {
        return [];
    }
}

export function serializeAiHumanReviewed(list) {
    if (!list || !list.length) return '';
    return JSON.stringify(list);
}

export function isAiReviewedByUser(raw, userId) {
    const uid = String(userId || '').trim();
    if (!uid) return false;
    return parseAiHumanReviewed(raw).some(r => r.uid === uid);
}

export function getAiHumanFeedbackForUser(raw, userId) {
    const uid = String(userId || '').trim();
    if (!uid) return null;
    const item = parseAiHumanReviewed(raw).find(r => r.uid === uid);
    if (!item) return null;
    return {
        verdict: String(item.verdict || '').trim(),
        name: item.name || uid
    };
}

export function formatAiHumanReviewedLabel(raw) {
    const names = parseAiHumanReviewed(raw).map(r => r.name).filter(Boolean);
    if (!names.length) return '';
    return names.join('、');
}

export function addAiHumanReviewer(raw, uid, name) {
    const id = String(uid || '').trim();
    if (!id) return String(raw || '');
    const list = parseAiHumanReviewed(raw);
    if (list.some(r => r.uid === id)) return serializeAiHumanReviewed(list);
    list.push({ uid: id, name: String(name || id).trim() });
    return serializeAiHumanReviewed(list);
}

/** @returns {{ photoObservations: {index:number,description:string}[], handwrittenNotes: {index:number,transcription:string,meaning:string}[], workRecords: {title:string,detail:string,indices:number[],status:string}[], siteEntryStatus: string, limitations: string[], qualityFlags: string[], acceptanceLine: string } | null} */
export function getAiExpandableDetails(findings) {
    if (!findings) return null;
    const validated = findings.validated || {};
    const raw = findings.raw || {};
    const photoObservations = (raw.photo_observations || [])
        .slice()
        .sort((a, b) => (Number(a.photo_index) || 0) - (Number(b.photo_index) || 0))
        .map(o => ({
            index: Number(o.photo_index) || 0,
            description: String(o.description || '').trim()
        }))
        .filter(o => o.description);
    const handwrittenNotes = (raw.handwritten_notes || [])
        .slice()
        .sort((a, b) => (Number(a.photo_index) || 0) - (Number(b.photo_index) || 0))
        .map(o => ({
            index: Number(o.photo_index) || 0,
            transcription: String(o.transcription || '').trim(),
            meaning: String(o.meaning || '').trim()
        }))
        .filter(o => o.transcription || o.meaning);
    const workRecords = (raw.work_records || [])
        .map(w => ({
            title: String(w.title || '').trim(),
            detail: String(w.detail || '').trim(),
            indices: (w.photo_indices || []).map(i => Number(i) || 0).filter(Boolean),
            status: String(w.status || '').trim()
        }))
        .filter(w => w.title || w.detail);
    const siteEntryStatus = String(raw.site_entry_status || '').trim();
    const limitations = raw.limitations || [];
    const qualityFlags = (validated.accepted_quality_flags || [])
        .map(f => String(f.issue || '').trim())
        .filter(Boolean);
    const acceptanceLine = validated.acceptance_line ? String(validated.acceptance_line).trim() : '';
    if (!photoObservations.length && !handwrittenNotes.length && !workRecords.length
        && !siteEntryStatus && !limitations.length && !qualityFlags.length && !acceptanceLine) return null;
    return { photoObservations, handwrittenNotes, workRecords, siteEntryStatus, limitations, qualityFlags, acceptanceLine };
}

function buildAiDetailsPartsHtml(details) {
    const parts = [];
    if (details.siteEntryStatus) {
        parts.push('<p class="text-[11px] mt-1"><span class="font-semibold">工種進場現況：</span>'
            + escapeAiHtml(details.siteEntryStatus) + '</p>');
    }
    if (details.workRecords.length) {
        const items = details.workRecords.map(w => {
            const refs = w.indices.length ? ` <span class="text-gray-500">(#${w.indices.join('、#')})</span>` : '';
            const title = w.title ? `<span class="font-semibold">${escapeAiHtml(w.title)}</span>：` : '';
            return `<li class="ml-3 list-disc">${title}${escapeAiHtml(w.detail)}${refs}</li>`;
        }).join('');
        parts.push('<p class="text-[11px] mt-1 font-semibold">工況紀錄與建議修正：</p>'
            + '<ul class="text-[11px] text-gray-700 space-y-0.5">' + items + '</ul>');
    }
    if (details.handwrittenNotes.length) {
        const items = details.handwrittenNotes.map(o => {
            const meaning = o.meaning ? ` — ${escapeAiHtml(o.meaning)}` : '';
            return `<li class="ml-3 list-disc"><span class="font-semibold">#${o.index}</span> `
                + `${escapeAiHtml(o.transcription)}${meaning}</li>`;
        }).join('');
        parts.push('<p class="text-[11px] mt-1 font-semibold">手寫／標記註記：</p>'
            + '<ul class="text-[11px] text-gray-700 space-y-0.5">' + items + '</ul>');
    }
    if (details.photoObservations.length) {
        const items = details.photoObservations.map(o =>
            `<li class="ml-3 list-disc"><span class="font-semibold">#${o.index}</span> ${escapeAiHtml(o.description)}</li>`
        ).join('');
        parts.push('<p class="text-[11px] mt-1 font-semibold">重點照片：</p>'
            + '<ul class="text-[11px] text-gray-700 space-y-0.5">' + items + '</ul>');
    }
    if (details.limitations.length) {
        parts.push('<p class="text-[11px] text-gray-600 mt-1"><span class="font-semibold">限制：</span>'
            + escapeAiHtml(details.limitations.join('；')) + '</p>');
    }
    if (details.qualityFlags.length) {
        parts.push('<p class="text-[11px] mt-1"><span class="font-semibold">品質留意：</span>'
            + escapeAiHtml(details.qualityFlags.join('、')) + '</p>');
    }
    if (details.acceptanceLine) {
        parts.push('<p class="text-[11px] mt-1"><span class="font-semibold">驗收對照：</span>'
            + escapeAiHtml(details.acceptanceLine) + '</p>');
    }
    return parts;
}

/**
 * @param {object} report ProjectLog 列
 * @param {{ console?: boolean, logId?: string }} [opts]
 * @returns {string}
 */
export function buildAiAnalysisHtml(report, opts) {
    opts = opts || {};
    const signal = String(report.AI_Signal || '').toLowerCase();
    const summary = String(report.AI_Summary || '').trim();
    if (!signal && !summary) return '';

    const meta = AI_SIGNAL_META[signal] || AI_SIGNAL_META.skipped;
    const findings = parseAiFindingsJson(report);
    const expandable = getAiExpandableDetails(findings);
    const currentUserId = opts.currentUserId || '';
    const myFeedback = getAiHumanFeedbackForUser(report.AI_HumanReviewed, currentUserId);
    const reviewedByMe = isAiReviewedByUser(report.AI_HumanReviewed, currentUserId);

    const logId = opts.logId || report.LogID || '';
    const detailId = `ai-detail-${logId}`;
    let detailsHtml = '';

    if (expandable) {
        const parts = buildAiDetailsPartsHtml(expandable);
        detailsHtml = `
            <button type="button" class="text-[11px] font-semibold ${meta.text} underline mt-1.5"
                onclick="document.getElementById('${detailId}').classList.toggle('hidden')">
                展開細項
            </button>
            <div id="${detailId}" class="hidden mt-1 pl-2 border-l-2 ${meta.border}">
                ${parts.join('')}
            </div>`;
    }

    let reviewedHtml = '';
    if (myFeedback && myFeedback.verdict) {
        const verdictText = myFeedback.verdict === 'good' ? '好' : (myFeedback.verdict === 'bad' ? '需改' : myFeedback.verdict);
        reviewedHtml = `<p class="text-xs text-emerald-700 mt-1 font-medium">✓ 已回饋：${escapeAiHtml(verdictText)}</p>`;
    } else if (reviewedByMe) {
        // 適配舊資料：只有已讀，沒有 verdict
        const reviewedLabel = formatAiHumanReviewedLabel(report.AI_HumanReviewed);
        reviewedHtml = reviewedLabel
            ? `<p class="text-xs text-emerald-700 mt-1 font-medium">✓ 已讀：${escapeAiHtml(reviewedLabel)}</p>`
            : '';
    }

    const markBtnHtml = (opts.console && (!myFeedback || !myFeedback.verdict) && summary)
        ? `
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button type="button"
                class="btn btn-primary mt-2 text-xs py-1 px-2"
                data-action="markAiFeedback"
                data-log-id="${escapeAiHtml(logId)}"
                data-feedback="good">好</button>
              <button type="button"
                class="btn btn-ghost mt-2 text-xs py-1 px-2"
                data-action="markAiFeedback"
                data-log-id="${escapeAiHtml(logId)}"
                data-feedback="bad">需改</button>
            </div>`
        : '';

    const disclaimerClass = opts.console ? 'text-[10px] text-gray-400 mt-1.5' : 'text-[10px] text-gray-400 mt-1.5';

    return `
        <div class="site-ai-block mt-3 p-2.5 rounded-lg border ${meta.border} ${meta.bg}">
            <div class="flex items-center gap-1.5 text-xs font-bold ${meta.text}">
                <span>${meta.emoji}</span>
                <span>AI 現場分析 · ${meta.label}</span>
            </div>
            ${summary ? `<p class="text-xs mt-1.5 ${meta.text} leading-relaxed whitespace-pre-line">${escapeAiHtml(summary)}</p>` : ''}
            ${detailsHtml}
            ${reviewedHtml}
            ${markBtnHtml}
            <p class="${disclaimerClass}">僅供內部參考，非正式驗收簽核</p>
        </div>`;
}
