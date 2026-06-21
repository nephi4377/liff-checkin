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
    const validated = findings && findings.validated ? findings.validated : null;
    const acceptanceLine = validated && validated.acceptance_line ? validated.acceptance_line : '';
    const reviewed = String(report.AI_HumanReviewed || '').trim();

    const logId = opts.logId || report.LogID || '';
    const showDetails = (signal === 'yellow' || signal === 'red') && findings;
    const detailId = `ai-detail-${logId}`;
    let detailsHtml = '';

    if (showDetails && findings) {
        const parts = [];
        if (findings.raw && findings.raw.limitations && findings.raw.limitations.length) {
            parts.push('<p class="text-[11px] text-gray-600 mt-1"><span class="font-semibold">限制：</span>'
                + escapeAiHtml(findings.raw.limitations.join('；')) + '</p>');
        }
        if (validated && validated.accepted_quality_flags && validated.accepted_quality_flags.length) {
            const flags = validated.accepted_quality_flags.map(f => escapeAiHtml(f.issue)).join('、');
            parts.push('<p class="text-[11px] mt-1"><span class="font-semibold">品質留意：</span>' + flags + '</p>');
        }
        if (acceptanceLine) {
            parts.push('<p class="text-[11px] mt-1"><span class="font-semibold">驗收對照：</span>'
                + escapeAiHtml(acceptanceLine) + '</p>');
        }
        if (parts.length) {
            detailsHtml = `
                <button type="button" class="text-[11px] font-semibold ${meta.text} underline mt-1.5"
                    onclick="document.getElementById('${detailId}').classList.toggle('hidden')">
                    展開細項
                </button>
                <div id="${detailId}" class="hidden mt-1 pl-2 border-l-2 ${meta.border}">
                    ${parts.join('')}
                </div>`;
        }
    } else if (acceptanceLine) {
        detailsHtml = `<p class="text-[11px] mt-1 text-gray-600">${escapeAiHtml(acceptanceLine)}</p>`;
    }

    const reviewedHtml = reviewed
        ? `<p class="text-[10px] text-emerald-700 mt-1 font-medium">✓ 已人工覆核：${escapeAiHtml(reviewed)}</p>`
        : '';

    const markBtnHtml = (opts.console && !reviewed && summary)
        ? `<button type="button" class="btn btn-primary mt-2 text-xs py-1 px-2" data-action="markAiReviewed" data-log-id="${escapeAiHtml(logId)}">標記已人工看過</button>`
        : '';

    const disclaimerClass = opts.console ? 'text-[10px] text-gray-400 mt-1.5' : 'text-[10px] text-gray-400 mt-1.5';

    return `
        <div class="site-ai-block mt-3 p-2.5 rounded-lg border ${meta.border} ${meta.bg}">
            <div class="flex items-center gap-1.5 text-xs font-bold ${meta.text}">
                <span>${meta.emoji}</span>
                <span>AI 現場分析 · ${meta.label}</span>
            </div>
            ${summary ? `<p class="text-xs mt-1.5 ${meta.text} leading-relaxed">${escapeAiHtml(summary)}</p>` : ''}
            ${detailsHtml}
            ${reviewedHtml}
            ${markBtnHtml}
            <p class="${disclaimerClass}">僅供內部參考，非正式驗收簽核</p>
        </div>`;
}
