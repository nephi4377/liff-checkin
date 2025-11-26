// v3.0 - 2025-11-24 16:30 (Asia/Taipei)
// 修改內容: 新增動態計價系統、透明度控制、備註功能、施工面積輸入
import { showGlobalNotification } from './utils.js';

let placedCabinets = [];
let isBgEditMode = false;
let bgScale = 1.0;
let bgPosition = { x: 0, y: 0 };
let selectedCabId = null;

// [錯誤修正] 宣告遺漏的拖曳與縮放狀態變數
let isDraggingCab = false;
let currentDragCab = null;
let dragOffset = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };
let isResizing = false;
let resizeTarget = null;
let resizeStart = { x: 0, y: 0, w: 0, h: 0 };
let isDraggingBg = false;
let bgDragStart = { x: 0, y: 0 };
let bgStartPos = { x: 0, y: 0 };

// [新增] 區域繪製相關狀態
let isDrawing = false;
let currentDrawingType = null;
let currentDrawingPoints = [];
let drawnAreas = []; // 用來儲存所有已繪製的區域
let selectedAreaId = null; // [新增] 用來追蹤被選取的區域ID

// [您的要求] 新增：用於調整區域頂點的狀態
let isDraggingVertex = false;
let draggedAreaId = null;
let draggedVertexIndex = -1;

// [您的要求] 新增復原/重做功能所需的狀態堆疊
let history = [];
let historyIndex = -1;
const MAX_HISTORY_STATES = 50; // 最多儲存 50 步操作

const CANVAS_SIZE = 2000;

const svgStyle = 'width="100%" height="100%" preserveAspectRatio="none"';
const svgs = {
    sofa3: `<svg ${svgStyle} viewBox="0 0 210 90"><rect width="210" height="90" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/><rect x="10" y="10" width="190" height="20" fill="#d1d5db"/><rect x="10" y="35" width="60" height="45" rx="5" fill="#fff"/><rect x="75" y="35" width="60" height="45" rx="5" fill="#fff"/><rect x="140" y="35" width="60" height="45" rx="5" fill="#fff"/></svg>`,
    sofaL: `<svg ${svgStyle} viewBox="0 0 280 170"><path d="M0 0 H280 V90 H90 V170 H0 Z" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/><rect x="10" y="10" width="260" height="20" fill="#d1d5db"/><rect x="10" y="90" width="70" height="70" rx="5" fill="#fff"/></svg>`,
    tv: `<svg ${svgStyle} viewBox="0 0 240 45"><rect width="240" height="45" fill="#4b5563"/><rect x="10" y="5" width="220" height="35" fill="#1f2937"/></svg>`,
    door: `<svg ${svgStyle} viewBox="0 0 90 90"><path d="M5,85 L5,5 L85,5" fill="none" stroke="#333" stroke-width="2"/><path d="M5,85 A80,80 0 0,1 85,5" fill="none" stroke="#999" stroke-dasharray="4,4"/></svg>`,
    ruler: `<svg ${svgStyle} viewBox="0 0 300 10"><rect width="300" height="10" fill="#fef08a" stroke="#eab308"/><path d="M0,0 v10 M50,0 v10 M100,0 v10 M150,0 v10 M200,0 v10 M250,0 v10 M300,0 v10" stroke="#000"/></svg>`,
    // [最終修正] 讓 default 函式只回傳純粹的 SVG 標籤字串
    default: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f3f4f6"/><text x="50" y="50" font-family="Arial" font-size="12" fill="#374151" text-anchor="middle" dy=".3em">${t}</text></svg>`
};
const getSvg = (k) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs[k])}`;

// 移除內建元件，改為由 Google Sheet 動態載入
let cabinetCategories = {};

// [您的要求] 尺寸轉換函式 (1尺=30cm)，無條件進位到 0.5 尺
function cmToFeet(cm) {
    const rawFeet = cm / 30;
    // 將尺數乘以 2，無條件進位到整數，再除以 2，即可得到最接近的 0.5 單位
    return Math.ceil(rawFeet * 2) / 2;
}

// 價格計算函式
function calculatePrice(cabinet) {
    const { unitPrice, pricingType } = cabinet.data;
    const { currentW, currentH } = cabinet;

    if (pricingType === 'fixed') {
        return unitPrice;
    }

    const widthFeet = cmToFeet(currentW);
    const depthFeet = cmToFeet(currentH);

    switch (pricingType) {
        case 'width':
            return unitPrice * widthFeet;
        case 'depth':
            return unitPrice * depthFeet;
        case 'area':
            return unitPrice * widthFeet * depthFeet;
        default:
            return 0;
    }
}

// [新增] LINE 聯繫相關常數
const LINE_ID = '@uis9604v';
const LINE_OFFICIAL_URL = 'https://line.me/R/ti/p/@uis9604v'; // LINE 官方帳號加入連結

// 簡單開啟 LINE 官方帳號
function openLineOfficialAccount() {
    window.open(LINE_OFFICIAL_URL, '_blank');
    showGlobalNotification(`已開啟 LINE 官方帳號，請點擊「加入」按鈕`, 2000, 'info');
}

// 複製 LINE ID 到剪貼簿
function copyLineId() {
    if (!navigator.clipboard) {
        showGlobalNotification(`LINE ID: ${LINE_ID}`, 3000, 'info');
        return;
    }
    navigator.clipboard.writeText(LINE_ID).then(() => {
        showGlobalNotification(`已複製 LINE ID: ${LINE_ID}`, 3000, 'success');
    }).catch(() => {
        showGlobalNotification(`請手動複製 LINE ID: ${LINE_ID}`, 3000, 'warning');
    });
}

// Google Sheets 載入
async function loadFromSheets() {
    // 將您的 Sheet ID 直接寫在程式碼中
    const sheetId = '1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q';

    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=0`;
        const response = await fetch(url);
        const text = await response.text();
        const jsonString = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonString);
        const rows = data.table.rows;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row.c || !row.c[0]) continue;

            const name = row.c[0]?.v || '';
            const width = row.c[1]?.v || 0;
            const depth = row.c[2]?.v || 0;
            const unitPrice = parseInt(row.c[3]?.v) || 0; // [修正] 確保單價是數字
            const pricingType = row.c[4]?.v || 'fixed';
            const adjustable = row.c[5]?.v || 'both';
            const depthOptions = row.c[6]?.v || '';
            const defaultOpacity = row.c[7]?.v || 80;
            const img = row.c[8]?.v || '';
            // 讀取 J 欄 (索引為 9) 的組別，若為空則預設為 '未分類'
            const group = row.c[9]?.v || '未分類';
            // [您的要求] 讀取 K 欄 (索引為 10) 作為預設備註
            const note = row.c[10]?.v || '';
            // [您的要求] 讀取 M 欄 (索引為 12) 作為 '允許重疊' 屬性
            const allowOverlap = row.c[12]?.v === true;

            if (name && width && depth) {
                // 如果該組別還不存在，就建立一個空陣列
                if (!cabinetCategories[group]) {
                    cabinetCategories[group] = [];
                }

                // [CONSOLE] 記錄從 Google Sheet 讀取到的原始圖片 URL
                console.log(`[Input] 元件: "${name}", 從Sheet讀取的原始img值:`, img);

                cabinetCategories[group].push({
                    id: `sheets-${Date.now()}-${i}`,
                    name: String(name),
                    width: parseInt(width),
                    depth: parseInt(depth),
                    unitPrice: unitPrice,
                    pricingType: pricingType,
                    adjustable: adjustable,
                    depthOptions: depthOptions,
                    defaultOpacity: parseInt(defaultOpacity) || 80,
                    note: note, // [您的要求] 將 K 欄的備註存入元件資料
                    allowOverlap: allowOverlap, // [您的要求] 將屬性存入元件資料
                    // [最終修正] 當 Sheet 的 img 為空時，就讓它保持為空。後續渲染邏輯會自動處理 onerror 事件。
                    img: img
                });
            }
        }

        renderComponentList();
        showGlobalNotification(`✅ 成功載入 ${Object.values(cabinetCategories).flat().length} 個元件`, 3000, 'success');
    } catch (error) {
        console.error('載入錯誤:', error);
        showGlobalNotification(`❌ 載入失敗: ${error.message}`, 8000, 'error');
    }
}

/**
 * [您的要求] 新增輔助函式：從 SVG 字串中偵測其 viewBox 的長寬比
 * @param {string} svgString - SVG 原始碼
 * @returns {string|null} - 返回 CSS aspect-ratio 字串 (e.g., "210 / 90") 或 null
 */
function getSvgAspectRatio(svgString) {
    if (!svgString || typeof svgString !== 'string') return null;
    // 使用正規表達式匹配 viewBox 屬性中的數字
    const viewBoxMatch = svgString.match(/viewBox\s*=\s*["']\s*(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s*["']/);
    if (viewBoxMatch && viewBoxMatch.length === 5) {
        const width = parseFloat(viewBoxMatch[3]);
        const height = parseFloat(viewBoxMatch[4]);
        if (width > 0 && height > 0) {
            return `${width} / ${height}`;
        }
    }
    return null; // 如果找不到或尺寸無效，返回 null
}

function renderComponentList() {
    const container = document.getElementById('cabinet-components');
    container.innerHTML = '';
    for (const [cat, items] of Object.entries(cabinetCategories)) {
        if (!items || items.length === 0) continue;
        const title = document.createElement('div');
        title.className = 'col-span-2 font-bold text-gray-500 mt-2 text-xs';
        title.innerText = cat;
        container.appendChild(title);
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'border rounded p-1 bg-white hover:shadow cursor-grab flex flex-col items-center text-center';
            el.draggable = true;
            el.dataset.json = JSON.stringify(item);

            // [您的要求] 組合出標準的 Data URI，用於圖片載入失敗時的替代方案
            const defaultSvgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs.default(item.name))}`;
            const rawImgSrc = item.img;
            const isSvgCode = rawImgSrc && typeof rawImgSrc === 'string' && rawImgSrc.trim().startsWith('<svg');
            let imageHtml = '';

            // 容器使用 w-full h-12 確保佈局一致，內部圖示使用 max-w/h-full 確保等比縮放
            if (isSvgCode) {
 
                // 替換掉會導致拉伸的屬性
                let safeSvg = rawImgSrc.replace(/preserveAspectRatio\s*=\s*["']none["']/gi, 'preserveAspectRatio="xMidYMid meet"');
                if (!safeSvg.includes('width=')) {
                    safeSvg = safeSvg.replace('<svg', '<svg width="100%" height="100%"');
                }                // [您的要求] 容器嚴格限制高度為 h-12，內部 SVG 使用 max-h-full 適應容器
                imageHtml = `
                     <div class="w-12 h-12 flex items-center justify-center mb-1 p-1">
                        ${safeSvg}
                    </div>`;
            } else {
                // === 方案 B: 針對普通圖片連結 (http...) 或無圖片 (Fallback) ===
                imageHtml = rawImgSrc
                    ? `<div class="w-full h-12 flex items-center justify-center mb-1"><img src="${rawImgSrc}" class="max-w-full max-h-full object-contain" onerror="this.onerror=null; this.src='${defaultSvgDataUri}';"></div>`
                // 對於一般圖片，也使用同樣的容器邏輯
                    : `<div class="w-full h-12 flex items-center justify-center border-b"><div class="w-10 h-10 bg-gray-100 border rounded"></div></div>`;
            }

            el.innerHTML = `${imageHtml}<div class="text-[10px] truncate w-full mt-1" title="${item.name}">${item.name}</div><div class="text-[10px] text-gray-400">${item.width}x${item.depth}</div>`;
            el.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', el.dataset.json));
            container.appendChild(el);
        });
    }
}

const canvas = document.getElementById('design-canvas');

function addCabinet(data, x, y) {
    const cab = {
        id: `cab-${Date.now()}`,
        data,
        x,
        y,
        rotation: 0,
        currentW: data.width,
        currentH: data.depth,
        opacity: data.defaultOpacity || 80,
        note: data.note || '' // [您的要求] 新增元件時，帶入從 Sheet 讀取的預設備註
    };
    if (checkCollision(cab)) return showGlobalNotification("位置重疊，請更換位置", 3000, 'error');
    placedCabinets.push(cab);
    renderAllCabinets();
    selectCabinet(cab.id); // 選取新元件
    updateQuotation();
    saveState(); // [修正] 新增元件後保存狀態
}

function renderAllCabinets() {
    // 移除畫布上除了底圖和格線外的所有元件
    const existingCabinets = canvas.querySelectorAll('.placed-cabinet');
    existingCabinets.forEach(el => el.remove());

    // 根據 placedCabinets 陣列重新渲染所有元件
    placedCabinets.forEach(cab => {
        renderCabinet(cab);
    });

    // 確保 placeholder 的可見性正確
    document.getElementById('canvas-placeholder').style.display = placedCabinets.length > 0 ? 'none' : 'block';
}

// [新增] 渲染所有已繪製的區域
function renderAllDrawnAreas() {
    const layer = document.getElementById('drawn-areas-layer');
    layer.innerHTML = ''; // 清空舊的圖形

    // [v5.0 新增] 取得顯示選項的狀態
    const showCeilings = document.getElementById('show-ceilings-toggle').checked;
    const showFloors = document.getElementById('show-floors-toggle').checked;

    // [您的要求] 清除舊的頂點調整控點
    clearVertexHandles();

    const unselectedAreas = drawnAreas.filter(area => area.id !== selectedAreaId);
    const selectedArea = drawnAreas.find(area => area.id === selectedAreaId);

    // 先渲染所有未選取的區域
    unselectedAreas.forEach(area => {
        if ((area.type === 'ceiling' && showCeilings) || (area.type === 'floor' && showFloors)) {
            renderSingleArea(layer, area, false);
        }
    });

    // 最後再渲染選取的區域，確保它在最上層
    if (selectedArea) {
        if ((selectedArea.type === 'ceiling' && showCeilings) || (selectedArea.type === 'floor' && showFloors)) {
            renderSingleArea(layer, selectedArea, true);
            // [您的要求] 為選取的區域產生可拖曳的頂點
            renderVertexHandles(selectedArea);
        }
    }
}

// [您的要求] 新增輔助函式，用於渲染單一區域，避免程式碼重複
function renderSingleArea(layer, area, isSelected) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.id = area.id;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const pointsStr = area.points.map(p => `${p.x},${p.y}`).join(' ');

    const colors = {
        ceiling: { fill: 'rgba(139, 92, 246, 0.4)', stroke: 'rgba(139, 92, 246, 0.8)' },
        floor: { fill: 'rgba(251, 191, 36, 0.4)', stroke: 'rgba(217, 119, 6, 0.8)' }
    };
    const areaColor = colors[area.type] || colors.ceiling;

    polygon.setAttribute('points', pointsStr);
    polygon.setAttribute('fill', areaColor.fill);
    polygon.setAttribute('stroke', areaColor.stroke);
    polygon.setAttribute('stroke-width', '1');
    group.style.pointerEvents = document.getElementById('lock-drawn-areas').checked ? 'none' : 'auto';

    if (isSelected) {
        polygon.classList.add('selected');
    }

    group.addEventListener('click', (e) => {
        e.stopPropagation();
        selectArea(area.id);
    });
    group.appendChild(polygon);

    const centroid = getPolygonCentroid(area.points);
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', centroid.x);
    textElement.setAttribute('y', centroid.y);
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('font-size', '16');
    textElement.setAttribute('font-weight', 'bold');
    textElement.setAttribute('fill', '#ffffff');
    textElement.style.pointerEvents = 'none';
    textElement.style.textShadow = '0 0 3px rgba(0,0,0,0.5)';

    const areaTypeText = area.type === 'floor' ? '地板' : '天花板';
    const areaInPingText = area.type === 'floor'
        ? `${calculateFloorAreaWithLoss(area.areaInPing)} 坪 (含損耗)`
        : `${area.areaInPing} 坪`; // [您的要求] 天花板坪數顯示為整數

    const noteTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    noteTspan.setAttribute('x', centroid.x);
    noteTspan.setAttribute('dy', area.note ? '-0.6em' : '0.35em');
    noteTspan.textContent = area.note || `${areaTypeText} ${areaInPingText}`;
    textElement.appendChild(noteTspan);

    if (area.note) {
        const areaTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        areaTspan.setAttribute('x', centroid.x);
        areaTspan.setAttribute('dy', '1.2em');
        areaTspan.textContent = `(${areaInPingText})`;
        textElement.appendChild(areaTspan);
    }
    group.appendChild(textElement);

    layer.appendChild(group);
}

// [您的要求] 新增：渲染可拖曳的頂點控點
function renderVertexHandles(area) {
    // [您的要求] 核心修正：將控點渲染到最上層的預覽圖層，才能接收滑鼠事件
    const layer = document.getElementById('drawing-preview-layer');
    layer.style.display = 'block'; // 確保圖層可見
    layer.style.pointerEvents = 'all'; // 讓這個圖層可以接收滑鼠事件

    // 建立一個專門放控點的群組，方便管理
    let handleGroup = document.getElementById('area-vertex-handles');
    if (!handleGroup) {
        handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handleGroup.id = 'area-vertex-handles';
        layer.appendChild(handleGroup);
    }
    handleGroup.innerHTML = ''; // 清空舊的控點

    area.points.forEach((point, index) => {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', point.x);
        handle.setAttribute('cy', point.y);
        handle.setAttribute('r', '6'); // 控點大小
        handle.setAttribute('fill', '#ffffff');
        handle.setAttribute('stroke', '#3b82f6'); // [您的要求] 修正拼寫錯誤
        handle.setAttribute('stroke-width', '2');
        handle.style.cursor = 'move';
        
        // 為每個控點綁定 mousedown 事件
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingVertex = true;
            draggedAreaId = area.id;
            draggedVertexIndex = index;
        });
        handleGroup.appendChild(handle);
    });
}

// [您的要求] 新增：清除頂點控點
function clearVertexHandles() {
    const handleGroup = document.getElementById('area-vertex-handles');
    const previewLayer = document.getElementById('drawing-preview-layer');
    if (handleGroup) {
        handleGroup.innerHTML = '';
        // 如果不是在繪圖模式，就隱藏整個預覽圖層
        if (!isDrawing) previewLayer.style.display = 'none';
    }
}

function renderCabinet(cab) {
    const el = document.createElement('div');
    el.className = 'placed-cabinet';
    el.id = cab.id;
    updateCabStyle(el, cab);

    // [您的要求] 根據 adjustable 屬性決定是否產生拉伸控點
    const resizeHandleHtml = (cab.data.adjustable !== 'none' && cab.data.adjustable !== false)
        ? `<div class="resize-handle"></div>`
        : '';

    el.innerHTML = `
        ${resizeHandleHtml}
        <div class="size-label">${cab.currentW}x${cab.currentH} cm (${cmToFeet(cab.currentW)}x${cmToFeet(cab.currentH)}尺)</div>
    `;
    el.onmousedown = (e) => startCabDrag(e, cab);
    const resizeHandle = el.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => startResize(cab.id, e));
    }

    canvas.appendChild(el);
    if (cab.id === selectedCabId) {
        el.classList.add('selected');
    }
}

function updateCabStyle(el, cab) {
    el.style.left = cab.x + 'px';
    el.style.top = cab.y + 'px';
    el.style.width = cab.currentW + 'px';
    el.style.height = cab.currentH + 'px';
    // 檢查是否有圖片，沒有則使用預設背景色
    const defaultSvgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs.default(cab.data.name))}`;
    let finalImageSrc = '';

    if (cab.data.img && cab.data.img.trim().startsWith('<svg')) {
        // [您的要求] 如果是 SVG 程式碼，直接轉換為 Data URI
        finalImageSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cab.data.img)}`;
        el.style.backgroundImage = `url("${finalImageSrc}")`;
    } else if (cab.data.img) {
        // [您的要求] 如果是 URL，使用 Image 物件來處理載入與錯誤
        const img = new Image();
        img.src = cab.data.img;
        img.onload = () => { el.style.backgroundImage = `url('${cab.data.img}')`; };
        img.onerror = () => { el.style.backgroundImage = `url("${defaultSvgDataUri}")`; };
    } else {
        // 沒有圖片時，使用預設背景色
        el.style.backgroundImage = 'none';
        el.style.backgroundColor = '#f3f4f6'; // 淺灰色背景
    }
    el.style.transform = `rotate(${cab.rotation}deg)`;
    el.style.opacity = (cab.opacity / 100);
}


function handleGlobalClick(e) {
    // [新增] 如果正在繪圖模式，則處理點擊事件
    if (isDrawing && e.target.closest('#design-canvas')) {
        handleDrawingClick(e);
        return; // 阻止取消選取等其他點擊事件
    }
    // [新增] 如果點擊的不是繪製區域，則取消選取
    if (!e.target.closest('polygon')) {
        deselectAllAreas();
    }

    if (!e.target.closest('.placed-cabinet') && !e.target.closest('.floating-window') && !e.target.closest('.modal')) {
        deselectAll();
    }
}

function selectCabinet(id) {
    deselectAll();
    deselectAllAreas(); // [v6.0 核心修正] 確保在選取元件時，取消對區域的選取
    selectedCabId = id;
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');

    const cab = placedCabinets.find(c => c.id === id);
    if (cab) {
        document.getElementById('selected-info').style.display = 'block';
        document.getElementById('selected-name').innerText = cab.data.name;

        // [您的要求] 將尺寸填入新的輸入框
        document.getElementById('selected-width').value = cab.currentW;
        document.getElementById('selected-height').value = cab.currentH;
        document.getElementById('selected-size-inputs').style.display = 'grid';

        const price = calculatePrice(cab);
        let priceText = `單價: $${cab.data.unitPrice.toLocaleString()}`;
        if (cab.data.pricingType === 'width') {
            priceText += `/尺 | 總價: $${price.toLocaleString()}`;
        } else if (cab.data.pricingType === 'fixed') {
            priceText = `總價: $${price.toLocaleString()}`;
        }
        document.getElementById('selected-price').innerText = priceText;

        document.getElementById('opacity-slider').value = cab.opacity;
        document.getElementById('opacity-value').innerText = cab.opacity + '%';
        document.getElementById('opacity-slider').parentElement.style.display = 'block'; // [v6.0 UX優化] 確保透明度滑桿可見
        document.getElementById('note-input').parentElement.style.display = 'block'; // [v6.0 UX優化] 確保備註欄可見
        document.getElementById('note-input').value = cab.note || '';
        document.getElementById('selected-cab-actions').style.display = 'flex'; // [您的要求] 顯示元件操作按鈕
    }
}

function deselectAll() {
    selectedCabId = null;
    document.querySelectorAll('.placed-cabinet.selected').forEach(e => e.classList.remove('selected'));
    document.getElementById('selected-info').style.display = 'none';
    document.getElementById('selected-size-inputs').style.display = 'none';
    document.getElementById('selected-cab-actions').style.display = 'none'; // [您的要求] 隱藏元件操作按鈕
}

function updateOpacity(value) {
    if (!selectedCabId) return;
    const cab = placedCabinets.find(c => c.id === selectedCabId);
    if (cab) {
        cab.opacity = parseInt(value);
        updateCabStyle(document.getElementById(cab.id), cab);
        saveState(); // [您的要求] 儲存狀態
        document.getElementById('opacity-value').innerText = value + '%';
    }
}

function updateNote() {
    // [v5.0 核心修正] 修正備註儲存邏輯
    if (selectedCabId) {
        const cab = placedCabinets.find(c => c.id === selectedCabId);
        if (cab) {
            cab.note = document.getElementById('note-input').value;
            saveState(); // [您的要求] 儲存狀態
        }
    } else if (selectedAreaId) {
        const area = drawnAreas.find(a => a.id === selectedAreaId); // 修正: 這裡的 cab 變數是錯的
        if (area) {
            area.note = document.getElementById('note-input').value;
            renderAllDrawnAreas(); // [v4.0 新增] 更新備註後，立即重繪以顯示標籤
            saveState(); // [您的要求] 儲存狀態
        }
    }
}

function handleKeyDown(e) {
    // [新增] 如果按下 Escape 鍵，則取消目前的繪圖
    if (e.key === 'Escape' && isDrawing) {
        cancelDrawing();
        return;
    }
    // [新增] 如果正在繪圖，按下 'Enter' 鍵完成繪製
    if (e.key === 'Enter' && isDrawing) {
        e.preventDefault();
        finishDrawing();
        return;
    }
    
    // [您的要求] 複製功能 (Ctrl+D)
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedCab();
        return;
    }
    
    // [新增] 如果選取了區域，按下 'D' 鍵刪除
    if (selectedAreaId && (e.key.toLowerCase() === 'd' || e.key === 'Delete')) { // [您的要求] 增加 Delete 鍵支援
        e.preventDefault();
        deleteArea(selectedAreaId);
        return;
    }


    if (isDrawing || !selectedCabId || isBgEditMode || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const cab = placedCabinets.find(c => c.id === selectedCabId);
    if (!cab) return;
    if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        cab.rotation = (cab.rotation + 90) % 360;
        saveState(); // [您的要求] 儲存狀態
        renderAllCabinets();
        return;
    }
    if (e.key.toLowerCase() === 'd' || e.key === 'Delete') { // [您的要求] 增加 Delete 鍵支援
        e.preventDefault();
        const idToDelete = selectedCabId;
        deselectAll();
        deleteCabById(idToDelete);
        return;
    }
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowUp') dy = -step;
    if (e.key === 'ArrowDown') dy = step;
    if (e.key === 'ArrowLeft') dx = -step;
    if (e.key === 'ArrowRight') dx = step;
    if (dx || dy) {
        e.preventDefault();
        const oldX = cab.x, oldY = cab.y;
        cab.x += dx; cab.y += dy;
        if (checkCollision(cab, cab.id)) {
            cab.x = oldX; cab.y = oldY;
        } else {
            renderAllCabinets();
            saveState(); // [您的要求] 儲存狀態
        }
    }
}

function rotateSelectedCab() {
    const id = selectedCabId;
    const cab = placedCabinets.find(c => c.id === id);
    if (!cab) return;
    cab.rotation = (cab.rotation + 90) % 360;
    renderAllCabinets();
    saveState(); // [您的要求] 儲存狀態
}

// [您的要求] 新增：複製選取的元件
function duplicateSelectedCab() {
    if (!selectedCabId) return;
    const sourceCab = placedCabinets.find(c => c.id === selectedCabId);
    if (!sourceCab) return;

    // 深度複製一個新元件
    const newCab = JSON.parse(JSON.stringify(sourceCab));

    // 給予新 ID 和新位置
    newCab.id = `cab-${Date.now()}`;
    newCab.x += 20; // 向右偏移 20px
    newCab.y += 20; // 向下偏移 20px

    placedCabinets.push(newCab);
    saveState();
    renderAllCabinets();

    // 自動選取新複製的元件
    selectCabinet(newCab.id);
}

function deleteCabById(id) {
    placedCabinets = placedCabinets.filter(c => c.id !== id);
    if (selectedCabId === id) {
        selectedCabId = null;
        deselectAll();
    }
    renderAllCabinets();
    updateQuotation();
    saveState(); // [您的要求] 儲存狀態
}

// [v6.0 核心修正] 輔助函式：將角度轉換為弧度
function toRad(deg) {
    return deg * Math.PI / 180;
}

// [v6.0 核心修正] 輔助函式：旋轉點
function rotatePoint(x, y, cx, cy, angleDeg) {
    const rad = toRad(angleDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
}

function handleGlobalMove(e) {
    if (isDraggingCab && currentDragCab) {
        const nx = e.clientX - dragOffset.x, ny = e.clientY - dragOffset.y;
        currentDragCab.x = nx; currentDragCab.y = ny;
        const el = document.getElementById(currentDragCab.id);
        updateCabStyle(el, currentDragCab);
        if (checkCollision(currentDragCab, currentDragCab.id)) el.classList.add('collision-warning');
        else el.classList.remove('collision-warning');
    }
    if (isResizing && resizeTarget) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;

        // 1. 計算新的寬高 (在 Local 座標系)
        const rotation = resizeTarget.rotation % 360;
        const rad = toRad(rotation);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const localDW = dx * cos + dy * sin;
        const localDH = -dx * sin + dy * cos;

        // [您的要求] 還原遺失的元件拉伸邏輯
        const adjustable = resizeTarget.data.adjustable;
        let newW = resizeTarget.currentW;
        let newH = resizeTarget.currentH;

        if (adjustable === 'width' || adjustable === 'both' || adjustable === 'width-depth-select') {
            newW = Math.round(Math.max(20, resizeStart.w + localDW));
        }
        if (adjustable === 'depth' || adjustable === 'both') {
            newH = Math.round(Math.max(20, resizeStart.h + localDH));
        }

        // 2. [核心修正] 計算位置補償
        const oldCx = resizeTarget.x + resizeTarget.currentW / 2;
        const oldCy = resizeTarget.y + resizeTarget.currentH / 2;
        const oldLocal00_x = -resizeTarget.currentW / 2;
        const oldLocal00_y = -resizeTarget.currentH / 2;
        const fixedPointGlobal = rotatePoint(oldCx + oldLocal00_x, oldCy + oldLocal00_y, oldCx, oldCy, rotation);

        const newLocal00_x = -newW / 2;
        const newLocal00_y = -newH / 2;

        const vRotatedX = newLocal00_x * cos - newLocal00_y * sin;
        const vRotatedY = newLocal00_x * sin + newLocal00_y * cos;

        const newCx = fixedPointGlobal.x - vRotatedX;
        const newCy = fixedPointGlobal.y - vRotatedY;

        const newX = newCx - newW / 2;
        const newY = newCy - newH / 2;

        resizeTarget.currentW = newW;
        resizeTarget.currentH = newH;
        resizeTarget.x = newX;
        resizeTarget.y = newY;

        const el = document.getElementById(resizeTarget.id);
        updateCabStyle(el, resizeTarget);
        el.querySelector('.size-label').innerText = `${Math.round(resizeTarget.currentW)}x${Math.round(resizeTarget.currentH)} cm (${cmToFeet(resizeTarget.currentW)}x${cmToFeet(resizeTarget.currentH)}尺)`;
        selectCabinet(resizeTarget.id);

    // [您的要求] 新增：處理區域頂點拖曳
    } else if (isDraggingVertex && draggedAreaId !== null && draggedVertexIndex !== -1) {
        const area = drawnAreas.find(a => a.id === draggedAreaId);
        if (area) {
            const rect = canvas.getBoundingClientRect();
            const newX = e.clientX - rect.left;
            const newY = e.clientY - rect.top;
            
            // 更新頂點座標
            area.points[draggedVertexIndex] = { x: newX, y: newY };
            // 即時重繪
            renderAllDrawnAreas();
        }
    }
    if (isDraggingBg && isBgEditMode) {
        bgPosition.x = bgStartPos.x + (e.clientX - bgDragStart.x);
        bgPosition.y = bgStartPos.y + (e.clientY - bgDragStart.y);
        updateBgTransform();
    }
}

function endDrag() {
    if (isDraggingCab && currentDragCab) {
        if (checkCollision(currentDragCab, currentDragCab.id)) {
            currentDragCab.x = startPos.x; currentDragCab.y = startPos.y;
            updateCabStyle(document.getElementById(currentDragCab.id), currentDragCab);
            document.getElementById(currentDragCab.id).classList.remove('collision-warning');
        } else {
            saveState(); // [您的要求] 只有在移動成功後才儲存狀態
        }
    }
    // [您的要求] 修正：在結束拖曳時，將背景圖的滑鼠指標恢復為 grab
    if (isDraggingBg) {
        document.getElementById('bg-layer').style.cursor = 'grab';
    }
    // [您的要求] 新增：結束區域頂點拖曳
    if (isDraggingVertex) {
        const area = drawnAreas.find(a => a.id === draggedAreaId);
        if (area) {
            // 重新計算面積並更新
            const calculatedArea = getPolygonCentroid(area.points).area;
            area.areaInPing = Math.ceil(Math.abs(calculatedArea) / 32400);
            updateQuotation();
            saveState(); // 儲存變更
        }
        isDraggingVertex = false;
        draggedAreaId = null;
        draggedVertexIndex = -1;
    }
    isDraggingCab = false; isResizing = false; isDraggingBg = false; 
}

// [錯誤修正] 新增遺漏的 checkCollision 函式及相關輔助函式
function checkCollision(cab, excludeId = null) {
    const cab1Vertices = getVertices(cab);

    for (const otherCab of placedCabinets) {
        if (otherCab.id === cab.id || otherCab.id === excludeId) continue;

        // [您的要求] 如果任一元件允許重疊，則跳過這次碰撞檢查
        if (cab.data.allowOverlap || otherCab.data.allowOverlap) {
            continue;
        }

        const cab2Vertices = getVertices(otherCab);
        const axes = getAxes(cab1Vertices).concat(getAxes(cab2Vertices));
        
        // [優化] 增加一個旗標來追蹤是否碰撞
        let collided = true;

        for (const axis of axes) {
            const p1 = project(cab1Vertices, axis);
            const p2 = project(cab2Vertices, axis);

            if (!overlap(p1, p2)) {
                // 找到一個分離軸，表示這兩個物件「沒有」碰撞
                collided = false;
                break; // 跳出軸線檢查迴圈，繼續檢查下一個物件
            }
        }

        if (collided) {
            // 如果檢查完所有軸都沒有找到分離軸，表示發生碰撞，立刻回傳 true
            return true;
        }
    }
    // 沒有與任何其他物件碰撞
    return false;
}

// 輔助函式：取得矩形的四個頂點座標
function getVertices(cab) {
    const w = cab.currentW;
    const h = cab.currentH;
    const x = cab.x;
    const y = cab.y;
    const angle = cab.rotation;

    const cx = x + w / 2;
    const cy = y + h / 2;

    const points = [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
    ];

    return points.map(p => rotatePoint(p.x, p.y, cx, cy, angle));
}

// 輔助函式：取得多邊形的法向量（用於分離軸定理）
function getAxes(vertices) {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[i + 1 === vertices.length ? 0 : i + 1];
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        const normal = { x: -edge.y, y: edge.x }; // 取得垂直向量
        axes.push(normal);
    }
    return axes;
}

// 輔助函式：將多邊形投影到一個軸上
function project(vertices, axis) {
    let min = Infinity, max = -Infinity;
    for (const vertex of vertices) {
        const dotProduct = vertex.x * axis.x + vertex.y * axis.y;
        min = Math.min(min, dotProduct);
        max = Math.max(max, dotProduct);
    }
    return { min, max };
}

// 輔助函式：檢查兩個投影是否重疊
function overlap(p1, p2) {
    return p1.max >= p2.min && p2.max >= p1.min;
}

// [v5.0 新增] 計算地板面積含損耗 (乘以1.2，無條件進位到0.5坪)
function calculateFloorAreaWithLoss(originalPing) {
    // [您的要求] 修正：先加計 20% 損耗，再向上取到 0.5 坪
    const areaWithLoss = originalPing * 1.2; 
    return Math.ceil(areaWithLoss * 2) / 2; 
}

// [v3.0 核心新增] 計算多邊形的質心 (用於放置標籤)
function getPolygonCentroid(points) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    let j = points.length - 1;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[j];
        const factor = p1.x * p2.y - p2.x * p1.y;
        area += factor;
        cx += (p1.x + p2.x) * factor;
        cy += (p1.y + p2.y) * factor;
        j = i;
    }
    area /= 2;
    return area === 0 ? (points[0] || { x: 0, y: 0, area: 0 }) : { x: cx / (6 * area), y: cy / (6 * area), area: area };
}

function selectArea(id) {
    deselectAll(); // 取消選取其他元件
    deselectAllAreas(); // 取消選取其他區域
    selectedCabId = null; // [v6.0 核心修正] 確保在選取區域時，取消對元件的選取

    clearVertexHandles(); // [您的要求] 清除舊的頂點控點

    // [v4.0 核心改造] 選取區域時，顯示資訊面板並填入資料
    selectedAreaId = id;
    const area = drawnAreas.find(a => a.id === id);

    if (area) {
        const group = document.querySelector(`#drawn-areas-layer g[data-id="${id}"]`);
        if (group) {
            group.querySelector('polygon').classList.add('selected');
            // [您的要求] 為選取的區域產生可拖曳的頂點
            renderVertexHandles(area);
        }

        document.getElementById('selected-info').style.display = 'block';
        // [您的要求] 隱藏尺寸輸入框
        document.getElementById('selected-size-inputs').style.display = 'none';
        const areaTypeText = area.type === 'floor' ? '地板區域' : '天花板區域';
        const areaInPingText = area.type === 'floor'
            ? `${calculateFloorAreaWithLoss(area.areaInPing)} 坪 (含損耗)`
            : `${area.areaInPing} 坪`; // [您的要求] 天花板坪數顯示為整數

        document.getElementById('selected-name').innerText = areaTypeText;
        document.getElementById('selected-price').innerText = ''; // 區域沒有單價
        document.getElementById('opacity-slider').parentElement.style.display = 'none'; // 隱藏透明度滑桿
        document.getElementById('note-input').parentElement.style.display = 'block'; // [v5.0 新增] 確保備註欄可見
        document.getElementById('selected-cab-actions').style.display = 'none'; // [您的要求] 隱藏元件操作按鈕
        document.getElementById('note-input').value = area.note || '';

        showGlobalNotification('已選取繪圖區域，可編輯備註或按 "D" 鍵刪除。', 3000, 'info');
    }
}

function deselectAllAreas() {
    selectedAreaId = null;
    document.querySelectorAll('#drawn-areas-layer polygon.selected').forEach(p => {
        p.classList.remove('selected'); // [v3.0 修正] 移除 polygon 上的 selected class
    });
    clearVertexHandles(); // [您的要求] 清除頂點控點
}

function deleteArea(id) {
    drawnAreas = drawnAreas.filter(area => area.id !== id);
    selectedAreaId = null;
    renderAllDrawnAreas();
    saveState(); // [您的要求] 儲存狀態
    updateQuotation();
}

function toggleDrawnAreasLock(isLocked) {
    const layer = document.getElementById('drawn-areas-layer');
    layer.querySelectorAll('polygon').forEach(p => {
        p.style.pointerEvents = isLocked ? 'none' : 'auto';
    });
    if (isLocked) deselectAllAreas();
}

// [錯誤修正] 新增遺漏的 handleBgUpload 函式
function handleBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const bgImg = document.getElementById('bg-img');
            bgImg.src = e.target.result;
            bgImg.style.display = 'block';
            // 啟用控制項
            document.getElementById('bg-controls').classList.remove('opacity-50', 'pointer-events-none');
        }
        reader.readAsDataURL(file);
    }
}

function updateBgTransform() {
    const bgLayer = document.getElementById('bg-layer');
    bgLayer.style.transform = `translate(-50%, -50%) translate(${bgPosition.x}px, ${bgPosition.y}px) scale(${bgScale})`;
}

// [錯誤修正] 新增遺漏的 saveCanvasAsImage 函式
function saveCanvasAsImage() {
    // 1. 暫時取消選取，隱藏 UI 元素
    const previouslySelectedCabId = selectedCabId;
    const previouslySelectedAreaId = selectedAreaId;
    deselectAll();
    deselectAllAreas();

    // [您的要求] 顯示浮水印
    const watermark = document.getElementById('canvas-watermark');
    watermark.style.display = 'flex';

    const canvasElement = document.getElementById('design-canvas');

    showGlobalNotification('正在產生圖片，請稍候...', 5000, 'info');

    // 2. 使用 html2canvas 進行截圖
    html2canvas(canvasElement, {
        logging: false, // 關閉 html2canvas 的 console log
        backgroundColor: '#ffffff', // 確保背景是白色
        useCORS: true, // 允許載入跨域圖片 (例如從 Google Sheet 來的圖片)
        scale: 1 // 使用 1:1 的比例，避免模糊
    }).then(canvas => {
        // 3. 建立下載連結
        const link = document.createElement('a');
        const date = new Date();
        const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        link.download = `layout-${dateString}.png`;
        link.href = canvas.toDataURL('image/png');
        
        // 4. 觸發下載並清理
        link.click();
        showGlobalNotification('圖片已開始下載！', 3000, 'success');

    }).catch(err => {
        console.error('另存圖片失敗:', err);
        showGlobalNotification(`圖片產生失敗: ${err.message}`, 8000, 'error');
    }).finally(() => {
        // [您的要求] 無論成功或失敗，都隱藏浮水印
        watermark.style.display = 'none';
        // 5. 無論成功或失敗，都恢復之前的選取狀態
        if (previouslySelectedCabId) selectCabinet(previouslySelectedCabId);
        if (previouslySelectedAreaId) selectArea(previouslySelectedAreaId);
    });
}

// [錯誤修正] 新增遺漏的 saveLayout 函式
function saveLayout() {
    try {
        // 1. 收集所有需要儲存的資料
        const layoutData = {
            version: '2.0', // 版本號，方便未來升級
            timestamp: new Date().toISOString(),
            placedCabinets: placedCabinets,
            drawnAreas: drawnAreas,
            background: {
                position: bgPosition,
                scale: bgScale,
                // [您的要求] 新增：儲存底圖的 src
                src: document.getElementById('bg-img').src
            },
            constructionArea: document.getElementById('construction-area').value
        };

        // 2. 轉換為 JSON 字串並建立 Blob
        const jsonString = JSON.stringify(layoutData, null, 2); // 使用 null, 2 進行格式化，方便閱讀
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 3. 建立並觸發下載連結
        const link = document.createElement('a');
        const dateString = new Date().toISOString().slice(0, 10);
        link.download = `layout-data-${dateString}.json`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url); // 釋放資源
        showGlobalNotification('佈局已儲存為 JSON 檔案！', 3000, 'success');
    } catch (error) {
        console.error('儲存佈局失敗:', error);
        showGlobalNotification(`儲存失敗: ${error.message}`, 8000, 'error');
    }
}

// [錯誤修正] 新增遺漏的 loadLayout 函式
function loadLayout(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const layoutData = JSON.parse(e.target.result);

            // 1. 基本驗證
            if (!layoutData.placedCabinets || !layoutData.drawnAreas || !layoutData.background) {
                throw new Error('無效的佈局檔案格式。');
            }

            // 2. 套用載入的資料
            placedCabinets = layoutData.placedCabinets || [];
            drawnAreas = layoutData.drawnAreas || [];
            // [您的要求] 新增：載入底圖的 src、位置和縮放
            if (layoutData.background) {
                bgPosition = layoutData.background.position || { x: 0, y: 0 };
                bgScale = layoutData.background.scale || 1.0;
                const bgImg = document.getElementById('bg-img');
                if (layoutData.background.src && layoutData.background.src.startsWith('data:image')) {
                    bgImg.src = layoutData.background.src;
                    bgImg.style.display = 'block';
                    document.getElementById('bg-controls').classList.remove('opacity-50', 'pointer-events-none');
                }
            }
            document.getElementById('construction-area').value = layoutData.constructionArea || '0';

            // 3. 重新渲染所有內容
            renderAllCabinets();
            renderAllDrawnAreas();
            updateBgTransform();
            saveState(); // [您的要求] 載入新佈局後，將其作為一個歷史狀態
            updateQuotation();
            
            deselectAll();
            deselectAllAreas();

            showGlobalNotification('佈局已成功載入！', 3000, 'success');
        } catch (error) {
            console.error('載入佈局失敗:', error);
            showGlobalNotification(`載入失敗: ${error.message}`, 8000, 'error');
        } finally {
            event.target.value = ''; // 清空 input，以便可以再次載入同一個檔案
        }
    };
    reader.readAsText(file);
}

/**
 * [您的要求] 核心重構：計價系統的計算引擎。
 * 這個函式只負責計算，不接觸任何 DOM 元素。
 * @returns {object} 一個包含所有計價資訊的物件 { lineItems, subtotals, grandTotal }
 */
function calculateFullQuotation() {
    const lineItems = [];
    let grandTotal = 0;

    // 1. 計算元件費用
    placedCabinets.forEach(cab => {
        const price = calculatePrice(cab);
        grandTotal += price;
        lineItems.push({
            isConstruction: false,
            name: cab.data.name,
            unit: cab.data.pricingType === 'fixed' ? '式' : '尺',
            quantity: cab.data.pricingType === 'fixed' ? 1 : cmToFeet(cab.currentW),
            totalPrice: price,
            note: cab.note || ''
        });
    });

    // 2. 計算施工項目費用
    const subtotals = {};

    // 天花板 & 油漆
    const ceilingArea = drawnAreas.filter(a => a.type === 'ceiling').reduce((sum, a) => sum + a.areaInPing, 0);
    if (ceilingArea > 0) {
        subtotals.ceilingCost = ceilingArea * 2150; // 假設天花板單價不含油漆
        grandTotal += subtotals.ceilingCost;
        lineItems.push({ isConstruction: true, name: '平釘天花板', unit: '坪', quantity: ceilingArea, totalPrice: subtotals.ceilingCost, note: '油漆工程另計' });
    } else {
        subtotals.ceilingCost = 0;
    }

    // 地板
    const floorArea = drawnAreas.filter(a => a.type === 'floor').reduce((sum, a) => sum + a.areaInPing, 0);
    if (floorArea > 0) {
        const floorAreaWithLoss = calculateFloorAreaWithLoss(floorArea);
        subtotals.floorCost = floorAreaWithLoss * 4200;
        grandTotal += subtotals.floorCost;
        lineItems.push({ isConstruction: true, name: '超耐磨地板 (含損耗)', unit: '坪', quantity: floorAreaWithLoss.toFixed(2), totalPrice: subtotals.floorCost, note: '' });
    } else {
        subtotals.floorCost = 0;
    }

    // 保護工程
    const protectionArea = parseFloat(document.getElementById('construction-area').value) || 0;
    if (protectionArea > 0) {
        subtotals.protectionCost = protectionArea * 800;
        grandTotal += subtotals.protectionCost;
        lineItems.push({ isConstruction: true, name: '現場保護工程', unit: '坪', quantity: protectionArea, totalPrice: subtotals.protectionCost, note: '' });
    } else {
        subtotals.protectionCost = 0;
    }

    return { lineItems, subtotals, grandTotal };
}


// [錯誤修正] 新增遺漏的 showBudgetModal 和 closeBudgetModal 函式
function showBudgetModal() {
    // [您的要求] 核心重構：此函式現在只負責「顯示」
    const quotation = calculateFullQuotation();
    const tableBody = document.getElementById('budget-table-body');
    tableBody.innerHTML = '';
    let itemIndex = 1;

    const componentItems = quotation.lineItems.filter(item => !item.isConstruction);
    const constructionItems = quotation.lineItems.filter(item => item.isConstruction);

    componentItems.forEach(item => {
        const row = `
            <tr>
                <td class="px-2 py-2 border-b text-center">${itemIndex++}</td>
                <td class="px-2 py-2 border-b">${item.name}</td>
                <td class="px-2 py-2 border-b">${item.unit}</td>
                <td class="px-2 py-2 border-b text-center">${item.quantity}</td>
                <td class="px-2 py-2 border-b text-right">$${item.totalPrice.toLocaleString()}</td>
                <td class="px-2 py-2 border-b text-xs text-gray-600">${item.note}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    if (constructionItems.length > 0) {
        // [您的要求] 移除「施工項目」的分類標題
        constructionItems.forEach(item => {
            const row = `
                <tr>
                    <td class="px-2 py-2 border-b text-center">${itemIndex++}</td>
                    <td class="px-2 py-2 border-b">${item.name}</td>
                    <td class="px-2 py-2 border-b">${item.unit}</td>
                    <td class="px-2 py-2 border-b text-center">${item.quantity}</td>
                    <td class="px-2 py-2 border-b text-right">$${item.totalPrice.toLocaleString()}</td>
                    <td class="px-2 py-2 border-b text-xs text-gray-600">${item.note}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }

    document.getElementById('modal-total-price').innerText = `$${quotation.grandTotal.toLocaleString()}`;
    document.getElementById('budget-modal').style.display = 'flex';
}

function closeBudgetModal() {
    document.getElementById('budget-modal').style.display = 'none';
}

/**
 * [您的要求] 新增：將報價單匯出為 CSV 檔案
 */
function exportBudgetAsCSV() {
    const quotation = calculateFullQuotation();
    const headers = ['項次', '項目', '單位', '數量', '總價', '備註'];
    let csvContent = headers.join(',') + '\n';
    let itemIndex = 1;

    quotation.lineItems.forEach(item => {
        const row = [
            itemIndex++,
            `"${item.name.replace(/"/g, '""')}"`, // 處理項目名稱中的引號
            item.unit,
            item.quantity,
            item.totalPrice,
            `"${(item.note || '').replace(/"/g, '""')}"` // 處理備註中的引號
        ];
        csvContent += row.join(',') + '\n';
    });

    // 加上總計
    csvContent += `\n,,,總計,${quotation.grandTotal},`;

    // 建立並下載 Blob
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM，確保 Excel 正確讀取中文
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const dateString = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `budget-${dateString}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showGlobalNotification('CSV 已開始下載！', 'success');
}

// [錯誤修正] 新增遺漏的 updateQuotation 函式
function updateQuotation() {
    // [您的要求] 核心重構：此函式現在只負責「顯示」
    const quotation = calculateFullQuotation();
    const { subtotals, grandTotal } = quotation;

    document.getElementById('ceiling-cost').innerText = `$${Math.round(subtotals.ceilingCost || 0).toLocaleString()}`;
    // [您的要求] 移除油漆計價
    document.getElementById('floor-cost').innerText = `$${Math.round(subtotals.floorCost || 0).toLocaleString()}`;
    document.getElementById('protection-cost').innerText = `$${Math.round(subtotals.protectionCost || 0).toLocaleString()}`;
    document.getElementById('total-price-display').innerText = `$${Math.round(grandTotal).toLocaleString()}`;
}

// [錯誤修正] 新增遺漏的視窗與UI操作函式
function switchTab(tabName) {
    const settingsBtn = document.getElementById('tab-btn-settings');
    const componentsBtn = document.getElementById('tab-btn-components');
    const settingsContent = document.getElementById('tab-content-settings');
    const componentsContent = document.getElementById('tab-content-components');

    settingsBtn.classList.remove('active');
    componentsBtn.classList.remove('active');
    settingsContent.classList.add('hidden');
    componentsContent.classList.add('hidden');

    if (tabName === 'settings') {
        settingsBtn.classList.add('active');
        settingsContent.classList.remove('hidden');
    } else if (tabName === 'components') {
        componentsBtn.classList.add('active');
        componentsContent.classList.remove('hidden');
    }
}

function toggleWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) {
        console.warn('toggleWindow: element not found', windowId);
        return;
    }

    // 嘗試多種可能的按鈕 id 命名方式，以兼容現有 HTML
    const base = windowId.replace('-window', '');
    const candidateBtnIds = [
        `${base}-btn`,
        `toggle-${base}-btn`,
        `${base}-toggle-btn`,
        `toggle-${base}`
    ];

    let btn = null;
    for (const id of candidateBtnIds) {
        btn = document.getElementById(id);
        if (btn) break;
    }

    const isHidden = (win.style.display === 'none') || (getComputedStyle(win).display === 'none');
    if (isHidden) {
        win.style.display = 'flex';
        if (btn) btn.classList.add('hidden');
    } else {
        win.style.display = 'none';
        if (btn) btn.classList.remove('hidden');
    }
}

function initDraggable(windowId) {
    const win = document.getElementById(windowId);
    const header = win.querySelector('.window-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - win.offsetLeft;
        offsetY = e.clientY - win.offsetTop;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            win.style.left = `${e.clientX - offsetX}px`;
            win.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'grab';
    });
}

function startDrawing(type) {
    if (isDrawing) {
        showGlobalNotification('已在繪圖模式中，請先完成或取消。', 3000, 'warning');
        return;
    }
    isDrawing = true;
    currentDrawingType = type;
    currentDrawingPoints = [];
    document.getElementById('drawing-overlay').style.display = 'block';
    document.getElementById('design-canvas').style.cursor = 'crosshair';
    document.getElementById('design-canvas').style.zIndex = '99';
    showGlobalNotification('繪圖模式已啟用。點擊畫布以放置頂點，按 Enter 完成，按 Esc 取消。', 8000, 'info');

    // [您的要求] 進入繪圖模式時，調暗其他元件
    document.querySelectorAll('.placed-cabinet').forEach(el => {
        el.style.opacity = '0.3';
        el.style.pointerEvents = 'none';
    });
    // 根據繪圖類型，隱藏另一種類型的區域
    if (type === 'ceiling') {
        document.getElementById('show-floors-toggle').checked = false;
    } else if (type === 'floor') {
        document.getElementById('show-ceilings-toggle').checked = false;
    }
    renderAllDrawnAreas();
}

function handleDrawingClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentDrawingPoints.push({ x, y });
    // [您的要求] 新增：更新繪圖預覽
    updateDrawingPreview();
}

// [您的要求] 新增：更新繪圖預覽的函式
function updateDrawingPreview() {
    const polyline = document.getElementById('drawing-preview-polyline');
    const polygon = document.getElementById('drawing-preview-polygon');
    const pointsStr = currentDrawingPoints.map(p => `${p.x},${p.y}`).join(' ');
    const verticesGroup = document.getElementById('drawing-preview-vertices');

    if (polyline) {
        polyline.setAttribute('points', pointsStr);
    }
    // [您的要求] 新增：更新預覽頂點
    if (verticesGroup) {
        verticesGroup.innerHTML = ''; // 清空舊的點
        currentDrawingPoints.forEach(p => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', '4'); // 預覽點的大小
            circle.setAttribute('fill', '#3b82f6');
            verticesGroup.appendChild(circle);
        });
    }
    // 當有超過兩個點時，才顯示預覽的閉合區域
    if (polygon && currentDrawingPoints.length > 2) {
        polygon.setAttribute('points', pointsStr);
        polygon.style.display = 'block';
    } else if (polygon) {
        polygon.style.display = 'none';
    }
    document.getElementById('drawing-preview-layer').style.display = 'block';
}

function finishDrawing() {
    if (currentDrawingPoints.length < 3) {
        showGlobalNotification('至少需要 3 個頂點才能形成一個區域。', 3000, 'error');
        cancelDrawing();
        return;
    }
    // [您的要求] 修正面積計算與坪數進位
    const calculatedArea = getPolygonCentroid(currentDrawingPoints).area;
    const areaInPing = Math.ceil(Math.abs(calculatedArea) / 32400); // 無條件進位到整數坪

    drawnAreas.push({
        id: `area-${Date.now()}`,
        type: currentDrawingType,
        points: [...currentDrawingPoints],
        areaInPing: areaInPing,
        note: ''
    });
    renderAllDrawnAreas();
    updateQuotation();
    saveState(); // [您的要求] 儲存狀態
    cancelDrawing();
}

function cancelDrawing() {
    isDrawing = false;
    currentDrawingPoints = [];
    document.getElementById('drawing-overlay').style.display = 'none';
    canvas.style.cursor = 'default';
    // [您的要求] 新增：清除並隱藏預覽圖層
    document.getElementById('drawing-preview-layer').style.display = 'none';
    document.getElementById('drawing-preview-polyline').setAttribute('points', '');
    document.getElementById('drawing-preview-polygon').setAttribute('points', '');
    document.getElementById('drawing-preview-vertices').innerHTML = '';
    canvas.style.zIndex = 'auto';
}

// [錯誤修正] 新增遺漏的 startCabDrag, startResize, toggleBgMode, updateBgScale 函式
function startCabDrag(e, cab) {
    if (e.button !== 0 || isBgEditMode) return;
    e.stopPropagation();
    isDraggingCab = true;
    currentDragCab = cab;
    selectCabinet(cab.id);
    const rect = canvas.getBoundingClientRect();
    // 注意：拖曳開始時不儲存狀態，在 endDrag 時才儲存
    dragOffset = { x: e.clientX - cab.x, y: e.clientY - cab.y };
    startPos = { x: cab.x, y: cab.y };
}

function startResize(id, e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    isResizing = true;
    resizeTarget = placedCabinets.find(c => c.id === id);
    if (resizeTarget) {
        resizeStart = { x: e.clientX, y: e.clientY, w: resizeTarget.currentW, h: resizeTarget.currentH };
        // 注意：縮放開始時不儲存狀態，在 endDrag 時才儲存
    }
}

function toggleBgMode(checked) {
    isBgEditMode = checked;
    const bgLayer = document.getElementById('bg-layer');
    if (isBgEditMode) {
        bgLayer.style.zIndex = '60';
        bgLayer.style.cursor = 'grab';
        showGlobalNotification('底圖調整模式已啟用。', 3000, 'info');
    } else {
        bgLayer.style.zIndex = '1'; // [您的要求] 修正：取消模式時，將 z-index 降回，才不會擋住繪圖區域
        bgLayer.style.cursor = 'default';
    }
}

function updateBgScale(value) {
    if (isNaN(value) || value < 0.2 || value > 3.0) return;
    bgScale = value;
    document.getElementById('bg-scale').value = bgScale;
    document.getElementById('bg-scale-num').value = bgScale;
    updateBgTransform();
}

// [您的要求] 新增：處理手動輸入尺寸變更的函式
function handleDimensionChange() {
    if (!selectedCabId) return;
    const cab = placedCabinets.find(c => c.id === selectedCabId);
    if (!cab) return;

    const widthInput = document.getElementById('selected-width');
    const heightInput = document.getElementById('selected-height');

    const newW = parseInt(widthInput.value, 10);
    const newH = parseInt(heightInput.value, 10);

    if (isNaN(newW) || isNaN(newH) || newW <= 0 || newH <= 0) {
        showGlobalNotification('請輸入有效的尺寸數字。', 3000, 'error');
        // 還原為原始值
        widthInput.value = cab.currentW;
        heightInput.value = cab.currentH;
        return;
    }

    const oldW = cab.currentW;
    const oldH = cab.currentH;

    cab.currentW = newW;
    cab.currentH = newH;

    if (checkCollision(cab, cab.id)) {
        showGlobalNotification('尺寸修改後與其他物件重疊，操作已取消。', 4000, 'warning');
        cab.currentW = oldW; cab.currentH = oldH; // 還原尺寸
    }
    saveState();
    renderAllCabinets(); // 重繪以更新畫面
    selectCabinet(cab.id); // 重新選取以更新資訊面板上的所有資訊 (如價格)
}

// [您的要求] 新增復原/重做相關函式
/**
 * 儲存當前的畫布狀態到歷史紀錄中
 */
function saveState() {
    // 如果當前指針不在歷史紀錄的末尾 (表示已經執行過 undo)，
    // 則移除後續的所有 "redo" 狀態
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    // 深度複製當前狀態
    const currentState = {
        placedCabinets: JSON.parse(JSON.stringify(placedCabinets)),
        drawnAreas: JSON.parse(JSON.stringify(drawnAreas)),
        constructionArea: document.getElementById('construction-area').value
    };

    // 避免儲存與上一步完全相同的狀態
    if (history.length > 0 && JSON.stringify(currentState) === JSON.stringify(history[history.length - 1])) {
        return;
    }

    history.push(currentState);

    // 如果歷史紀錄超過最大限制，則移除最舊的紀錄
    if (history.length > MAX_HISTORY_STATES) {
        history.shift();
    }

    historyIndex = history.length - 1;
    updateUndoRedoButtons();
}

/**
 * 從歷史紀錄中載入一個指定的狀態
 * @param {object} state - 要載入的狀態物件
 */
function loadState(state) {
    placedCabinets = JSON.parse(JSON.stringify(state.placedCabinets));
    drawnAreas = JSON.parse(JSON.stringify(state.drawnAreas));
    document.getElementById('construction-area').value = state.constructionArea;

    renderAllCabinets();
    renderAllDrawnAreas();
    updateQuotation();
    deselectAll();
    deselectAllAreas();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        loadState(history[historyIndex]);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        loadState(history[historyIndex]);
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = historyIndex <= 0;
    document.getElementById('redo-btn').disabled = historyIndex >= history.length - 1;
}

function bindEventListeners() {
    // 全域事件
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('keydown', handleKeyDown);
    document.body.addEventListener('click', handleGlobalClick);

    // 畫布事件
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        if (isBgEditMode) return showGlobalNotification("請先關閉底圖模式", 3000, 'error');
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const rect = canvas.getBoundingClientRect();
        addCabinet(data, e.clientX - rect.left - data.width / 2, e.clientY - rect.top - data.depth / 2);
    });

    // 工具箱 - 設定頁
    document.getElementById('bg-upload').addEventListener('change', handleBgUpload);
    document.getElementById('bg-edit-mode').addEventListener('change', (e) => toggleBgMode(e.target.checked));
    document.getElementById('bg-scale').addEventListener('input', (e) => updateBgScale(parseFloat(e.target.value)));
    document.getElementById('bg-scale-num').addEventListener('input', (e) => updateBgScale(parseFloat(e.target.value)));
    document.getElementById('save-canvas-as-image-btn').addEventListener('click', saveCanvasAsImage);
    document.getElementById('save-layout-btn').addEventListener('click', saveLayout);
    document.getElementById('layout-upload-label').addEventListener('click', () => document.getElementById('layout-upload').click());
    document.getElementById('layout-upload').addEventListener('change', loadLayout);
    document.getElementById('draw-ceiling-btn').addEventListener('click', () => startDrawing('ceiling'));
    document.getElementById('draw-floor-btn').addEventListener('click', () => startDrawing('floor'));
    document.getElementById('show-ceilings-toggle').addEventListener('change', renderAllDrawnAreas);
    document.getElementById('show-floors-toggle').addEventListener('change', renderAllDrawnAreas);
    document.getElementById('lock-drawn-areas').addEventListener('change', (e) => toggleDrawnAreasLock(e.target.checked));
    // [您的要求] 綁定復原/重做按鈕事件
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);

    // 工具箱 - Tab 切換
    document.getElementById('tab-btn-settings').addEventListener('click', () => switchTab('settings'));
    document.getElementById('tab-btn-components').addEventListener('click', () => switchTab('components'));

    // 資訊視窗
    document.getElementById('opacity-slider').addEventListener('input', (e) => updateOpacity(e.target.value));
    document.getElementById('note-input').addEventListener('input', updateNote);
    // [您的要求] 為新的尺寸輸入框綁定 change 事件 (在失焦或按 Enter 時觸發)
    document.getElementById('selected-width').addEventListener('change', handleDimensionChange);
    document.getElementById('selected-height').addEventListener('change', handleDimensionChange);

    // [您的要求] 為資訊視窗中的新按鈕綁定事件
    document.getElementById('selected-rotate-btn').addEventListener('click', () => rotateSelectedCab());
    // [您的要求] 綁定新的複製按鈕事件
    document.getElementById('selected-duplicate-btn').addEventListener('click', () => duplicateSelectedCab());
    document.getElementById('selected-delete-btn').addEventListener('click', () => deleteCabById(selectedCabId));


    // 預算明細 Modal
    document.getElementById('budget-modal-close-btn').addEventListener('click', closeBudgetModal);
    // [您的要求] 簡化 PDF 儲存邏輯，改為呼叫瀏覽器內建的列印功能
    document.getElementById('save-pdf-btn').addEventListener('click', () => window.print());
    document.getElementById('export-csv-btn').addEventListener('click', exportBudgetAsCSV);

    // 最小化列
    document.getElementById('toggle-toolbox-btn').addEventListener('click', () => toggleWindow('toolbox-window'));
    document.getElementById('toggle-info-btn').addEventListener('click', () => toggleWindow('info-window'));
    document.getElementById('toggle-toolbox-btn-header').addEventListener('click', () => toggleWindow('toolbox-window'));
    document.getElementById('toggle-info-btn-header').addEventListener('click', () => toggleWindow('info-window'));

    // [新增] LINE 聯繫按鈕事件
    const contactBtn = document.getElementById('contact-designer-btn');
    if (contactBtn) contactBtn.addEventListener('click', openLineOfficialAccount);
    const modalContactBtn = document.getElementById('modal-contact-line-btn');
    if (modalContactBtn) modalContactBtn.addEventListener('click', openLineOfficialAccount);
    const mobileContactLineBtn = document.getElementById('mobile-contact-line-btn');
    if (mobileContactLineBtn) {
        mobileContactLineBtn.addEventListener('click', openLineOfficialAccount);
    }
    const mobileLineIdCopy = document.getElementById('mobile-line-id-copy');
    if (mobileLineIdCopy) {
        mobileLineIdCopy.addEventListener('click', copyLineId);
    }

    // [新增] 檔案下載按鈕事件（存在時綁定）
    const downloadDesignFilesBtn = document.getElementById('download-design-files-btn');
    if (downloadDesignFilesBtn) downloadDesignFilesBtn.addEventListener('click', downloadDesignFilesAsZip);
    const modalDownloadDesignFilesBtn = document.getElementById('modal-download-design-files-btn');
    if (modalDownloadDesignFilesBtn) modalDownloadDesignFilesBtn.addEventListener('click', downloadDesignFilesAsZip);

    // 聯繫 Modal 按鈕
    const openLineBtn = document.getElementById('open-line-btn');
    if (openLineBtn) openLineBtn.addEventListener('click', openLineOfficialAccount);
    const copyLineBtn = document.getElementById('copy-line-btn');
    if (copyLineBtn) copyLineBtn.addEventListener('click', copyLineId);

    // [您的要求] 新增底圖拖曳事件
    const bgLayer = document.getElementById('bg-layer');
    bgLayer.addEventListener('mousedown', (e) => {
        if (isBgEditMode) {
            e.preventDefault();
            e.stopPropagation();
            isDraggingBg = true;
            bgDragStart = { x: e.clientX, y: e.clientY };
            bgStartPos = { x: bgPosition.x, y: bgPosition.y };
            bgLayer.style.cursor = 'grabbing'; // 拖曳時變更指標
        }
    });

    // 預算與估價
    document.getElementById('show-budget-modal-btn').addEventListener('click', showBudgetModal);
    document.getElementById('construction-area').addEventListener('change', () => {
        updateQuotation();
        saveState(); // [您的要求] 修改施工面積後儲存狀態
    });

    // 視窗拖曳
    initDraggable('toolbox-window');
    initDraggable('info-window');
}

// ========== [新增] 檔案傳輸功能 ==========

// [新增] 下載設計檔案為 ZIP 格式（包含圖片、佈局、預算）
async function downloadDesignFilesAsZip() {
    showGlobalNotification('正在準備檔案...', 5000, 'info');

    try {
        const zip = new JSZip();
        const dateString = new Date().toISOString().slice(0, 10);
        
            // 1. 生成並加入設計圖片 (PNG)
            const previouslySelectedCabId = selectedCabId;
            const previouslySelectedAreaId = selectedAreaId;
            deselectAll();
            deselectAllAreas();
            const watermark = document.getElementById('canvas-watermark');
            watermark.style.display = 'flex';
        
            const canvasElement = document.getElementById('design-canvas');
            const canvas = await html2canvas(canvasElement, {
                logging: false,
                backgroundColor: '#ffffff',
                useCORS: true,
                scale: 1
            });
        
            const imageData = canvas.toDataURL('image/png').split(',')[1];
            zip.file(`設計圖面_${dateString}.png`, imageData, { base64: true });
        
            watermark.style.display = 'none';
            if (previouslySelectedCabId) selectCabinet(previouslySelectedCabId);
            if (previouslySelectedAreaId) selectArea(previouslySelectedAreaId);
        
            // 2. 加入佈局 JSON 檔案
            const layoutData = {
                createdAt: new Date().toISOString(),
                constructionArea: parseFloat(document.getElementById('construction-area').value) || 0,
                cabinets: placedCabinets.map(cab => ({
                    id: cab.id,
                    name: cab.name,
                    category: cab.category,
                    position: { x: cab.x, y: cab.y },
                    size: { width: cab.width, height: cab.height }
                })),
                areas: drawnAreas.map(area => ({
                    id: area.id,
                    type: area.type,
                    points: area.points
                }))
            };
            zip.file(`佈局資料_${dateString}.json`, JSON.stringify(layoutData, null, 2));
        
            // 3. 加入預算 CSV 檔案
            const quotation = calculateFullQuotation();
            const headers = ['項次', '項目', '單位', '數量', '總價', '備註'];
            let csvContent = headers.join(',') + '\n';
            let itemIndex = 1;
        
            quotation.lineItems.forEach(item => {
                const row = [
                    itemIndex++,
                    `"${item.name.replace(/"/g, '""')}"`,
                    item.unit,
                    item.quantity,
                    item.totalPrice,
                    `"${(item.note || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(',') + '\n';
            });
            csvContent += `\n,,,總計,${quotation.grandTotal},`;
        
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            zip.file(`預算明細_${dateString}.csv`, new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' }));
        
            // 4. 生成 ZIP 並下載
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `設計檔案_${dateString}.zip`;
            link.click();
        
            // 5. 提示使用者發送郵件
            showDesignFilesDownloadComplete(dateString);
        
        } catch (err) {
            console.error('檔案下載失敗:', err);
            showGlobalNotification(`檔案準備失敗: ${err.message}`, 8000, 'error');
        }
    }

// [新增] 顯示檔案下載完成提示及發送郵件指導
function showDesignFilesDownloadComplete(dateString) {
    showGlobalNotification('✅ 檔案已下載！', 3000, 'success');
    
    // 建立郵件提示 Modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 500px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    `;
    
    content.innerHTML = `
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">📧 下一步：發送給設計師</h2>
        <p style="color: #4b5563; margin-bottom: 12px; line-height: 1.6;">
            您已成功下載設計檔案！現在請按照以下步驟發送給我們：
        </p>
        <ol style="color: #4b5563; margin-bottom: 20px; line-height: 1.8; padding-left: 20px;">
            <li><strong>開啟電子郵件客戶端</strong>（Gmail、Outlook 等）</li>
            <li><strong>收件人</strong>：<span style="color: #2563eb; font-weight: bold;">tanxintainan002@gmail.com</span></li>
            <li><strong>附加檔案</strong>：剛下載的 <code>設計檔案_${dateString}.zip</code></li>
            <li><strong>在郵件中說明</strong>您的設計需求、聯絡電話或地址</li>
            <li><strong>點擊傳送</strong>！</li>
        </ol>
        <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
            <p style="font-size: 13px; color: #1e40af; margin: 0;">
                💡 <strong>提示：</strong> 我們通常會在 24 小時內回覆您的郵件，提供詳細的設計建議和施工報價。
            </p>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="email-copy-btn" style="flex: 1; background: #2563eb; color: white; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s;">
                📋 複製郵箱地址
            </button>
            <button id="email-close-btn" style="flex: 1; background: #e5e7eb; color: #1f2937; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s;">
                關閉
            </button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 事件處理
    document.getElementById('email-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText('tanxintainan002@gmail.com').then(() => {
            showGlobalNotification('✅ 郵箱地址已複製！', 2000, 'success');
        }).catch(() => {
            showGlobalNotification('❌ 複製失敗，請手動複製：tanxintainan002@gmail.com', 3000, 'warning');
        });
    });
    
    document.getElementById('email-close-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// 應用程式進入點
window.onload = () => {
    // 【核心修正】修正手機裝置偵測邏輯。
    // 舊邏輯 (window.innerWidth < 768) 在 iframe 中會因寬度不足而被誤判。
    // 新邏輯優先檢查 User Agent 是否包含 'Mobi' 關鍵字，這能更準確地判斷是否為真實的行動裝置，
    // 從而避免因 iframe 寬度造成的誤判。
    const isMobile = /Mobi/i.test(navigator.userAgent);
    if (isMobile) {
        // 如果是手機，則顯示提示訊息並停止後續所有程式碼的執行
        document.getElementById('mobile-warning').style.display = 'flex';
        // 隱藏所有其他介面元素
        document.querySelectorAll('body > *:not(#mobile-warning)').forEach(el => el.style.display = 'none');
        return; // 終止執行
    }

    // 只有在電腦版才會執行以下程式碼
    bindEventListeners();
    
    // [修改] 初始化視窗狀態：預設打開工具箱和預算視窗，隱藏對應的最小化按鈕
    document.getElementById('toolbox-window').style.display = 'flex';
    document.getElementById('info-window').style.display = 'flex';
    document.getElementById('toggle-toolbox-btn').classList.add('hidden');
    document.getElementById('toggle-info-btn').classList.add('hidden');
    
    loadFromSheets();
    switchTab('settings'); // 預設顯示設定頁籤
    saveState(); // [您的要求] 儲存初始狀態
};