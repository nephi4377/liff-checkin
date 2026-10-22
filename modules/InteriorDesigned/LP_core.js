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

/** 多邊形有向面積（畫布座標，1px = 1cm） */
export function polygonSignedArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let area = 0;
    let j = points.length - 1;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[j];
        area += p1.x * p2.y - p2.x * p1.y;
        j = i;
    }
    return area / 2;
}

/** 由多邊形頂點推算坪數（與繪製／拖頂點後寫入 areaInPing 的公式一致） */
export function areaInPingFromPolygonPoints(points) {
    return Math.ceil(Math.abs(polygonSignedArea(points)) / 30000);
}

/** 地板坪數含 20% 損耗，向上取到 0.5 坪 */
export function calculateFloorAreaWithLoss(originalPing) {
    const ping = typeof originalPing === 'number' ? originalPing : Number(originalPing);
    if (!Number.isFinite(ping) || ping < 0) return 0;
    const areaWithLoss = ping * 1.2;
    return Math.ceil(areaWithLoss * 2) / 2;
}

/** 匯入 JSON 時補齊舊備份缺少的 areaInPing */
export function normalizeDrawnAreaForImport(area) {
    if (!area || typeof area !== 'object') return area;
    if (typeof area.areaInPing === 'number' && Number.isFinite(area.areaInPing)) {
        return area;
    }
    const points = area.points;
    if (Array.isArray(points) && points.length >= 3) {
        return { ...area, areaInPing: areaInPingFromPolygonPoints(points) };
    }
    return { ...area, areaInPing: 0 };
}

/**
 * 由平面點集計算軸對齊外框（畫布座標 1px ≈ 1cm）。
 * @param {{ x: number, y: number }[]} points
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function axisAlignedBoundsFromPoints(points) {
    if (!points || points.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
}

/**
 * 將移動中物件的外框邊／中心吸附至其他參考外框（邊與中心），在 threshold 內取最近一組。
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} moving
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }[]} references
 * @param {number} threshold
 * @returns {{ dx: number, dy: number }}
 */
export function computeObjectSnapDelta(moving, references, threshold) {
    if (!references.length || threshold <= 0) {
        return { dx: 0, dy: 0 };
    }
    const xTargets = [];
    const yTargets = [];
    for (const r of references) {
        xTargets.push(r.minX, r.maxX, (r.minX + r.maxX) / 2);
        yTargets.push(r.minY, r.maxY, (r.minY + r.maxY) / 2);
    }
    return {
        dx: snapAlongAxis(moving.minX, moving.maxX, xTargets, threshold),
        dy: snapAlongAxis(moving.minY, moving.maxY, yTargets, threshold),
    };
}

/**
 * 將拖曳位移吸附至格線步距（畫布 1px ≈ 1cm）。
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {number} gridStepCm 步距（cm）；≤0 時不吸附
 * @returns {{ dx: number, dy: number }}
 */
export function snapTranslationToGrid(deltaX, deltaY, gridStepCm) {
    const step = gridStepCm > 0 ? gridStepCm : 1;
    return {
        dx: Math.round(deltaX / step) * step,
        dy: Math.round(deltaY / step) * step,
    };
}

function snapAlongAxis(min, max, targets, threshold) {
    const center = (min + max) / 2;
    const probes = [min, max, center];
    let bestDelta = 0;
    let bestAbs = threshold + 1;
    for (const edge of probes) {
        for (const target of targets) {
            const delta = target - edge;
            const abs = Math.abs(delta);
            if (abs <= threshold && abs < bestAbs) {
                bestAbs = abs;
                bestDelta = delta;
            }
        }
    }
    return bestDelta;
}

/**
 * 從已繪製區域收集所有頂點（畫布座標 ≈ cm）。
 * @param {{ points?: { x: number, y: number }[] }[]} drawnAreas
 * @returns {{ x: number, y: number }[]}
 */
export function collectVerticesFromDrawnAreas(drawnAreas) {
    const out = [];
    if (!Array.isArray(drawnAreas)) return out;
    for (const area of drawnAreas) {
        if (!Array.isArray(area.points)) continue;
        for (const p of area.points) {
            if (typeof p.x === 'number' && typeof p.y === 'number') {
                out.push({ x: p.x, y: p.y });
            }
        }
    }
    return out;
}

/**
 * 將指標吸附至最近頂點（閾值內）。
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }[]} vertices
 * @param {number} threshold
 * @param {{ x: number, y: number } | null} [excludeNear]
 */
export function snapPointToNearestVertex(point, vertices, threshold, excludeNear = null) {
    let best = null;
    let bestDist = threshold + 1;
    for (const v of vertices) {
        if (excludeNear) {
            const skipDist = Math.hypot(v.x - excludeNear.x, v.y - excludeNear.y);
            if (skipDist < 0.5) continue;
        }
        const d = Math.hypot(point.x - v.x, point.y - v.y);
        if (d <= threshold && d < bestDist) {
            bestDist = d;
            best = v;
        }
    }
    if (!best) {
        return { x: point.x, y: point.y, snapped: false };
    }
    return { x: best.x, y: best.y, snapped: true };
}

/** 兩點距離（cm，四捨五入至整數） */
export function segmentLengthCmRounded(p1, p2) {
    return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
}

/**
 * 繪製區域時：起點閉合吸附 → 既有頂點吸附（成功則跳過正交鎖定）→ 正交鎖定（Alt 跳過頂點與正交）。
 * @param {object} opts
 * @returns {{ x: number, y: number, snapToStart: boolean }}
 */
export function resolveDrawingPointerPosition(opts) {
    const {
        x,
        y,
        altKey = false,
        currentDrawingPoints = [],
        areaVertices = [],
        startCloseThreshold = 20,
        vertexSnapThreshold = 12,
    } = opts;

    let px = x;
    let py = y;
    let snapToStart = false;

    if (currentDrawingPoints.length > 2) {
        const start = currentDrawingPoints[0];
        const dist = Math.hypot(px - start.x, py - start.y);
        if (dist < startCloseThreshold) {
            px = start.x;
            py = start.y;
            snapToStart = true;
        }
    }

    let vertexSnapped = false;
    if (!snapToStart && !altKey && areaVertices.length > 0) {
        const last = currentDrawingPoints.length > 0
            ? currentDrawingPoints[currentDrawingPoints.length - 1]
            : null;
        const snapped = snapPointToNearestVertex(
            { x: px, y: py },
            areaVertices,
            vertexSnapThreshold,
            last,
        );
        px = snapped.x;
        py = snapped.y;
        vertexSnapped = snapped.snapped;
    }

    if (!snapToStart && !altKey && !vertexSnapped && currentDrawingPoints.length > 0) {
        const last = currentDrawingPoints[currentDrawingPoints.length - 1];
        const dx = Math.abs(px - last.x);
        const dy = Math.abs(py - last.y);
        if (dx > dy) {
            py = last.y;
        } else {
            px = last.x;
        }
    }

    return { x: px, y: py, snapToStart };
}

/**
 * 鏡像後 DOM 控點方向與視覺邊不一致時，將 w/e 對調（n/s 不受 scaleX 影響）。
 * @param {'w'|'e'|'n'|'s'|string|null} direction
 * @param {boolean} mirrored
 */
export function mirrorAwareResizeDirection(direction, mirrored) {
    if (!mirrored || !direction) return direction;
    if (direction === 'w') return 'e';
    if (direction === 'e') return 'w';
    return direction;
}

/**
 * 依旋轉後的局部滑鼠位移，計算櫃體縮放後的 top-left 與尺寸（純函式，供 Vitest／鏡像修正）。
 * @param {{
 *   startX: number, startY: number, startW: number, startH: number,
 *   rotationDeg: number, mirrored?: boolean, direction: string,
 *   localDx: number, localDy: number, adjustable?: string, minSize?: number
 * }} params
 * @returns {{ x: number, y: number, currentW: number, currentH: number }}
 */
export function computeCabinetResizeGeometry(params) {
    const {
        startX,
        startY,
        startW,
        startH,
        rotationDeg,
        mirrored = false,
        direction,
        localDx,
        localDy,
        adjustable = 'both',
        minSize = 20,
    } = params;

    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const projDx = localDx * cos + localDy * sin;
    const projDy = -localDx * sin + localDy * cos;

    const effectiveDir = mirrorAwareResizeDirection(direction, mirrored);
    let newW = startW;
    let newH = startH;
    let localShiftX = 0;
    let localShiftY = 0;

    switch (effectiveDir) {
        case 'w':
            newW = Math.max(minSize, startW - projDx);
            localShiftX = -(newW - startW) / 2;
            break;
        case 'e':
            newW = Math.max(minSize, startW + projDx);
            localShiftX = (newW - startW) / 2;
            break;
        case 'n':
            newH = Math.max(minSize, startH - projDy);
            localShiftY = -(newH - startH) / 2;
            break;
        case 's':
            newH = Math.max(minSize, startH + projDy);
            localShiftY = (newH - startH) / 2;
            break;
        default:
            break;
    }

    if (adjustable === 'width' && (effectiveDir === 'n' || effectiveDir === 's')) newH = startH;
    if (adjustable === 'depth' && (effectiveDir === 'w' || effectiveDir === 'e')) newW = startW;

    const globalShiftX = localShiftX * cos - localShiftY * sin;
    const globalShiftY = localShiftX * sin + localShiftY * cos;
    const oldCx = startX + startW / 2;
    const oldCy = startY + startH / 2;
    const newCx = oldCx + globalShiftX;
    const newCy = oldCy + globalShiftY;

    return {
        x: newCx - newW / 2,
        y: newCy - newH / 2,
        currentW: Math.round(newW),
        currentH: Math.round(newH),
    };
}

/**
 * 以群組外框之**垂直中心線**（畫布 X 軸反射）鏡像整組；不支援水平軸鏡像。
 * 各成員：位置反射、切換 mirrored、rotation 設為 `(360 - θ) % 360`。
 * @param {{ id?: string, x: number, y: number, currentW: number, currentH: number, rotation?: number, mirrored?: boolean }[]} cabinets
 * @param {(cab: object) => { x: number, y: number }[]} getWorldPoints
 * @returns {{ x: number, y: number, rotation: number, mirrored: boolean }[]}
 */
export function mirrorCabinetsAsGroupAboutVerticalAxis(cabinets, getWorldPoints) {
    if (!cabinets.length) return [];
    const union = [];
    for (const cab of cabinets) {
        union.push(...getWorldPoints(cab));
    }
    const groupBounds = axisAlignedBoundsFromPoints(union);
    const pivotX = (groupBounds.minX + groupBounds.maxX) / 2;

    return cabinets.map((cab) => {
        const cabPts = getWorldPoints(cab);
        const cabBounds = axisAlignedBoundsFromPoints(cabPts);
        const cx = (cabBounds.minX + cabBounds.maxX) / 2;
        const dx = (2 * pivotX - cx) - cx;
        const theta = cab.rotation || 0;
        let rotation = (360 - theta) % 360;
        if (rotation < 0) rotation += 360;
        return {
            x: cab.x + dx,
            y: cab.y,
            mirrored: !cab.mirrored,
            rotation,
        };
    });
}

/**
 * 將櫃體繞畫布點旋轉 deltaDeg，回傳新位置與角度（不變更尺寸）。
 * @param {{ x: number, y: number, currentW: number, currentH: number, rotation: number }} cab
 */
export function rotateCabinetAroundPivot(cab, pivotX, pivotY, deltaDeg) {
    const cx = cab.x + cab.currentW / 2;
    const cy = cab.y + cab.currentH / 2;
    const rad = (deltaDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = cx - pivotX;
    const dy = cy - pivotY;
    const ncx = pivotX + dx * cos - dy * sin;
    const ncy = pivotY + dx * sin + dy * cos;
    let rotation = (cab.rotation + deltaDeg) % 360;
    if (rotation < 0) rotation += 360;
    return {
        x: ncx - cab.currentW / 2,
        y: ncy - cab.currentH / 2,
        rotation,
    };
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
