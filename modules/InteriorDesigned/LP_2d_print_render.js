/**
 * 2D 出圖 DOM／SVG 渲染（瀏覽器）
 */

import {
    buildAllPrintDimensions,
    buildScaleBarLabel,
    categoryColorToCssHex,
    computePrintContentScale,
    formatFloorplanPrintPngFilename,
    LP_PRINT_TITLE_DEFAULTS,
    resolveActiveLegendEntries,
    resolvePrintSheetSpec,
} from './LP_2d_print.js';

const LS_DIM_KEY = 'lp_2d_show_print_dimensions';

export function get2dPrintDimensionsEnabled() {
    try {
        return localStorage.getItem(LS_DIM_KEY) === '1';
    } catch {
        return false;
    }
}

export function set2dPrintDimensionsEnabled(on) {
    try {
        localStorage.setItem(LS_DIM_KEY, on ? '1' : '0');
    } catch {
        /* ignore */
    }
}

/**
 * @param {SVGSVGElement | null} layer
 * @param {import('./LP_2d_print.js').PrintDimensionItem[]} items
 * @param {boolean} visible
 */
export function renderPrintDimensionLayer(layer, items, visible) {
    if (!layer) return;
    layer.innerHTML = '';
    layer.style.display = visible ? 'block' : 'none';
    if (!visible || !items?.length) return;

    const ns = 'http://www.w3.org/2000/svg';
    for (const item of items) {
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', `lp-2d-dim lp-2d-dim-${item.kind}`);
        g.setAttribute('data-dim-id', item.id);

        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', String(item.anchorX));
        circle.setAttribute('cy', String(item.anchorY));
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', '#0f172a');
        circle.setAttribute('opacity', '0.35');

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', String(item.anchorX));
        text.setAttribute('y', String(item.anchorY - 4));
        text.setAttribute('fill', '#0f172a');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('stroke', '#ffffff');
        text.setAttribute('stroke-width', '3');
        if (item.angleDeg) {
            text.setAttribute('transform', `rotate(${item.angleDeg} ${item.anchorX} ${item.anchorY})`);
        }
        text.textContent = item.text;

        g.appendChild(circle);
        g.appendChild(text);
        layer.appendChild(g);
    }
}

/**
 * @param {HTMLElement} root
 * @param {object} opts
 */
export function buildPrintSheetElement(root, opts) {
    const {
        sheetId,
        workspacePx,
        titleBlock = {},
        scaleLabel,
        planMarkup,
        legendEntries,
        scaleBar,
    } = opts;
    const spec = resolvePrintSheetSpec(sheetId);
    const title = { ...LP_PRINT_TITLE_DEFAULTS, ...titleBlock };
    const margin = 48;
    const titleH = 120;
    const legendW = 200;
    const drawableW = spec.widthPx - margin * 2 - legendW - 16;
    const drawableH = spec.heightPx - margin * 2 - titleH;
    const contentScale = computePrintContentScale(workspacePx, drawableW, drawableH);

    root.innerHTML = '';
    root.className = 'lp-2d-print-sheet';
    root.style.width = `${spec.widthPx}px`;
    root.style.height = `${spec.heightPx}px`;

    const frame = document.createElement('div');
    frame.className = 'lp-2d-print-frame';
    frame.innerHTML = `
        <div class="lp-2d-print-title">
            <div class="lp-2d-print-title-row"><span>${escapeHtml(title.projectNo)}</span><span>${escapeHtml(title.projectName)}</span></div>
            <div class="lp-2d-print-title-row"><span>${escapeHtml(title.date)}</span><span>${escapeHtml(title.scale || scaleLabel || '')}</span><span>${escapeHtml(title.drawnBy)}</span></div>
        </div>
        <div class="lp-2d-print-body">
            <div class="lp-2d-print-plan-wrap" style="width:${drawableW}px;height:${drawableH}px">
                <div class="lp-2d-print-plan-scaler" style="transform:scale(${contentScale});width:${workspacePx}px;height:${workspacePx}px">
                    ${planMarkup}
                </div>
            </div>
            <aside class="lp-2d-print-side">
                <div class="lp-2d-print-north" title="方位佔位">N<br><span>↑</span></div>
                <div class="lp-2d-print-legend"></div>
                <div class="lp-2d-print-scalebar"></div>
            </aside>
        </div>
    `;
    root.appendChild(frame);

    const legendEl = root.querySelector('.lp-2d-print-legend');
    if (legendEl) {
        const h = document.createElement('p');
        h.className = 'lp-2d-print-legend-title';
        h.textContent = '圖例';
        legendEl.appendChild(h);
        for (const entry of legendEntries) {
            const row = document.createElement('div');
            row.className = 'lp-2d-print-legend-row';
            row.innerHTML = `<span class="lp-2d-print-swatch" style="background:${categoryColorToCssHex(entry.color)}"></span><span>${escapeHtml(entry.label)}</span>`;
            legendEl.appendChild(row);
        }
    }

    const barEl = root.querySelector('.lp-2d-print-scalebar');
    if (barEl && scaleBar) {
        barEl.innerHTML = `<div class="lp-2d-print-scale-line" style="width:${scaleBar.barPx}px"></div><span>${escapeHtml(scaleBar.label)}</span>`;
    }

    return { spec, contentScale };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {object} ctx
 */
export async function exportFloorplanPrintPng(ctx) {
    const {
        sheetRoot,
        sheetId,
        html2canvas,
    } = ctx;
    if (!sheetRoot || !html2canvas) throw new Error('missing print context');
    const canvas = await html2canvas(sheetRoot, {
        logging: false,
        backgroundColor: '#ffffff',
        scale: 1,
        width: sheetRoot.offsetWidth,
        height: sheetRoot.offsetHeight,
    });
    const spec = resolvePrintSheetSpec(sheetId);
    const link = document.createElement('a');
    link.download = formatFloorplanPrintPngFilename(spec.id.replace('_LANDSCAPE', ''));
    link.href = canvas.toDataURL('image/png');
    link.click();
    return {
        width: canvas.width,
        height: canvas.height,
        dataUrl: link.href,
    };
}

/**
 * @param {object} layoutState
 * @param {object} domRefs
 */
export function refreshPrintDimensions(layoutState, domRefs) {
    const items = buildAllPrintDimensions(layoutState);
    const on = get2dPrintDimensionsEnabled();
    renderPrintDimensionLayer(domRefs.dimensionLayer, items, on);
    if (domRefs.toggleInput) domRefs.toggleInput.checked = on;
    return items;
}

/**
 * @param {object} params
 */
export function assemblePrintSheetOptions(params) {
    const {
        sheetId,
        workspacePx,
        placedCabinets,
        titleBlock,
        scaleLabel,
        planCloneHtml,
    } = params;
    const pixelsPerCm = computePrintContentScale(workspacePx, 600, 400) * 1;
    const scaleBar = buildScaleBarLabel(Math.max(pixelsPerCm, 0.4), 100);
    return {
        sheetId,
        workspacePx,
        titleBlock,
        scaleLabel,
        planMarkup: planCloneHtml,
        legendEntries: resolveActiveLegendEntries(placedCabinets),
        scaleBar,
    };
}
