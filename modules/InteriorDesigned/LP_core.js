/**
 * LayoutPlanner 共用邏輯（原 LP_utils + LP_sanitizeSvg + lib/LP_geometry 收斂為單檔）。
 * 主程式請自 ./LP_core.js 一次 import 所需符號。
 */

// --- 幾何／換算（純函式） -------------------------------------------------

export function cmToFeet(cm) {
    const rawFeet = cm / 30;
    return Math.ceil(rawFeet * 2) / 2;
}

export function getAxes(vertices) {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[i + 1 === vertices.length ? 0 : i + 1];
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        const length = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        if (length < 1e-9) continue;
        const normal = { x: -edge.y / length, y: edge.x / length };
        axes.push(normal);
    }
    return axes;
}

export function project(vertices, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const vertex of vertices) {
        const dotProduct = vertex.x * axis.x + vertex.y * axis.y;
        min = Math.min(min, dotProduct);
        max = Math.max(max, dotProduct);
    }
    return { min, max };
}

export function overlap(p1, p2) {
    return p1.max > p2.min + 0.01 && p2.max > p1.min + 0.01;
}

// --- SVG 消毒 -------------------------------------------------------------

/**
 * Sheet I 欄內嵌 SVG 注入 DOM 前移除危險內容（script、事件屬性、javascript: 連結等）。
 */
export function sanitizeSvgString(svgStr) {
    if (!svgStr || typeof svgStr !== 'string') return '';
    let s = svgStr;
    s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<\/script>/gi, '');
    s = s.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
    s = s.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');
    s = s.replace(/(\s(?:href|xlink:href)\s*=\s*["'])\s*javascript:[^"']*["']/gi, '$1#sanitized"');
    s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
    return s;
}

// --- UI／DOM 工具 ---------------------------------------------------------

/**
 * @param {string} message
 * @param {number} duration
 * @param {'info'|'success'|'error'|'warning'} type
 */
export function showGlobalNotification(message, duration = 3000, type = 'info') {
    let container = document.getElementById('global-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'global-notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');

    let bgClass = 'bg-gray-800';
    let icon = 'ℹ️';

    if (type === 'success') {
        bgClass = 'bg-green-600';
        icon = '✅';
    } else if (type === 'error') {
        bgClass = 'bg-red-600';
        icon = '❌';
    } else if (type === 'warning') {
        bgClass = 'bg-yellow-600';
        icon = '⚠️';
    }

    notification.className = `${bgClass} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform translate-y-[-20px] opacity-0`;
    notification.innerHTML = `
        <span class="text-xl">${icon}</span>
        <span class="font-medium">${message}</span>
    `;

    if (!window.tailwind) {
        notification.style.backgroundColor = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#1f2937';
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.gap = '12px';
    }

    container.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    });

    setTimeout(() => {
        notification.style.transform = 'translateY(-20px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

/**
 * 非同步批次載入圖片。
 */
export async function loadImageInBatches(imageUrls, { batchSize = 5, delay = 100, onImageLoad, onImageError, onComplete }) {
    for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);

        const promises = batch.map((url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    if (onImageLoad) onImageLoad(url, img);
                    resolve();
                };
                img.onerror = () => {
                    if (onImageError) onImageError(url, new Error('Image failed to load'));
                    resolve();
                };
                img.src = url;
            });
        });

        await Promise.all(promises);

        if (i + batchSize < imageUrls.length) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    if (onComplete) onComplete();
}
