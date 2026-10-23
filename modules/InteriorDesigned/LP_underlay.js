/**
 * 平面底圖（underlay）匯入、比例與旋轉校正（無 LayoutPlanner DOM 依賴部分可單測）
 */

/** 佈局 JSON 內嵌 data URL 建議上限（約 3.5MB） */
export const UNDERLAY_MAX_DATA_URL_BYTES = 3_500_000;

/** JPEG 壓縮預設 */
export const UNDERLAY_COMPRESS_MAX_EDGE_PX = 2400;
export const UNDERLAY_COMPRESS_QUALITY = 0.82;

/**
 * @param {number} measuredCm 兩點在畫布上的距離（cm，1px=1cm）
 * @param {number} realCm 實際長度（cm）
 * @param {number} currentScale 目前底圖 scale
 */
export function computeScaleFromTwoPointCalibration(measuredCm, realCm, currentScale = 1) {
    if (!Number.isFinite(measuredCm) || measuredCm <= 0) return currentScale;
    if (!Number.isFinite(realCm) || realCm <= 0) return currentScale;
    const safe = Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1;
    return safe * (realCm / measuredCm);
}

/**
 * 使 p1→p2 連線趨近水平：回傳要累加到底圖 rotation 的角度（度）
 * @param {{ x: number, y: number }} p1
 * @param {{ x: number, y: number }} p2
 */
export function computeRotationDeltaToHorizontalDeg(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.hypot(dx, dy) < 1e-6) return 0;
    const angleRad = Math.atan2(dy, dx);
    return -(angleRad * 180) / Math.PI;
}

/**
 * 沿 last→target 方向放置固定長度端點
 * @param {{ x: number, y: number }} last
 * @param {{ x: number, y: number }} target
 * @param {number} lengthCm
 */
export function pointAtSegmentLength(last, target, lengthCm) {
    const dx = target.x - last.x;
    const dy = target.y - last.y;
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(lengthCm) || lengthCm <= 0 || dist < 1e-6) {
        return { x: target.x, y: target.y };
    }
    const s = lengthCm / dist;
    return { x: last.x + dx * s, y: last.y + dy * s };
}

/**
 * @param {string} dataUrl
 */
export function estimateDataUrlBytes(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Math.floor((b64.length * 3) / 4);
}

/**
 * @param {string} dataUrl
 * @param {{ maxBytes?: number, maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function compressImageDataUrlIfNeeded(dataUrl, opts = {}) {
    const maxBytes = opts.maxBytes ?? UNDERLAY_MAX_DATA_URL_BYTES;
    const maxEdge = opts.maxEdge ?? UNDERLAY_COMPRESS_MAX_EDGE_PX;
    const quality = opts.quality ?? UNDERLAY_COMPRESS_QUALITY;
    if (!dataUrl?.startsWith('data:image')) return dataUrl;
    if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

    if (typeof document === 'undefined') return dataUrl;

    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/jpeg', quality);
    if (estimateDataUrlBytes(out) > maxBytes) {
        out = canvas.toDataURL('image/jpeg', Math.max(0.5, quality - 0.15));
    }
    return out;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('底圖影像載入失敗'));
        img.src = src;
    });
}

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168';

/**
 * PDF 第一頁 → JPEG data URL（僅前端，不上傳）
 * @param {ArrayBuffer} arrayBuffer
 */
export async function renderPdfFirstPageToDataUrl(arrayBuffer) {
    if (typeof window === 'undefined') {
        throw new Error('PDF 轉圖需在瀏覽器環境執行');
    }
    const pdfjsLib = await import(/* @vite-ignore */ `${PDFJS_CDN}/build/pdf.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/build/pdf.worker.mjs`;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法建立 canvas');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', UNDERLAY_COMPRESS_QUALITY);
}

/**
 * @param {File} file
 */
export function isPdfFile(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    return file.type === 'application/pdf' || name.endsWith('.pdf');
}

/**
 * @param {object} [bg]
 */
export function normalizeLayoutBackground(bg) {
    if (!bg || typeof bg !== 'object') {
        return {
            position: { x: 0, y: 0 },
            scale: 1,
            rotationDeg: 0,
            opacity: 0.75,
            locked: false,
            hidden: false,
            src: '',
        };
    }
    return {
        position: bg.position && typeof bg.position === 'object'
            ? { x: Number(bg.position.x) || 0, y: Number(bg.position.y) || 0 }
            : { x: 0, y: 0 },
        scale: Number(bg.scale) > 0 ? Number(bg.scale) : 1,
        rotationDeg: Number(bg.rotationDeg) || 0,
        opacity: Number.isFinite(Number(bg.opacity)) ? Math.min(1, Math.max(0.1, Number(bg.opacity))) : 0.75,
        locked: !!bg.locked,
        hidden: !!bg.hidden,
        src: typeof bg.src === 'string' ? bg.src : '',
    };
}
