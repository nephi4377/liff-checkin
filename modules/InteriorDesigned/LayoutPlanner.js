// v3.0 - 2025-11-24 16:30 (Asia/Taipei)
// 修改內容: 新增動態計價系統、透明度控制、備註功能、施工面積輸入
import { showGlobalNotification } from './utils.js';

let placedCabinets = [];
let isBgEditMode = false;
let bgScale = 1.0;
let bgPosition = { x: 0, y: 0 };
let placedAnnotations = []; // [新增] 工程標註資料陣列
let selectedCabId = null;

// [錯誤修正] 宣告遺漏的拖曳與縮放狀態變數
let isDraggingCab = false;
let currentDragCab = null;

let dragOffset = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };
// [v8.12 修復] 明確宣告 canvas 變數，避免依賴隱式全域變數導致的潛在錯誤
const canvas = document.getElementById('design-canvas');
// [v8.9 修復] 補回遺失的變數宣告
let isResizing = false;
let resizeTarget = null;
let resizeDirection = null; // [v9.0 新增] 記錄拉伸方向
let resizeStart = { x: 0, y: 0, w: 0, h: 0 };
let isDraggingBg = false;
let bgDragStart = { x: 0, y: 0 };
let bgStartPos = { x: 0, y: 0 };
let clipboardCab = null;
let isDrawing = false;
let currentDrawingType = null; // [v8.23 修復] 補回遺失的 global 變數
let drawingType = null;
let currentDrawingPoints = [];
let drawnAreas = [];
let selectedAreaId = null;
let isDraggingVertex = false;
let draggedAreaId = null;
let draggedVertexIndex = null;
// [新增] 標註拖曳相關變數
let isDraggingAnnotation = false;
let currentDragAnnotationId = null;
let annotationDragType = null; // 'box' or 'target'
let annotationDragOffset = { x: 0, y: 0 }; // [修正] 補上遺漏的變數宣告
// [v8.8 新增] 全局畫布縮放比列
let viewScale = 1.0;
// [v8.8 補回] 歷史紀錄堆疊
let history = [];
let historyIndex = -1;
const MAX_HISTORY_STATES = 50;
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
    let price = 0;

    const widthFeet = cmToFeet(currentW);
    const depthFeet = cmToFeet(currentH);

    // 1. 基礎價格計算
    if (pricingType === 'fixed' || pricingType === 'number') {
        price = unitPrice;
    } else {
        switch (pricingType) {
            case 'width': price = unitPrice * widthFeet; break;
            case 'depth': price = unitPrice * depthFeet; break;
            case 'area': price = unitPrice * widthFeet * depthFeet; break;
            case 'cai': price = unitPrice * (cabinet.caiQty || 0); break; // [修正] 變數名稱錯誤修正 (cab -> cabinet)
            case 'cm': price = unitPrice * currentW; break; // [新增] 公分計價 (通常指寬度)
            default: price = 0;
        }
    }

    // 2. 副屬性 (Addons) 加價計算
    if (cabinet.data.addonsConfig && cabinet.addons) {
        cabinet.data.addonsConfig.forEach((addon, idx) => {
            const qty = cabinet.addons[idx] || 0;
            if (qty > 0) {
                price += qty * addon.price;
            }
        });
    }

    // 3. 自訂副屬性 (Custom Addons) 加價計算
    if (cabinet.customAddons && cabinet.customAddons.length > 0) {
        cabinet.customAddons.forEach(addon => {
            if (addon.qty > 0) {
                price += addon.qty * (addon.price || 0);
            }
        });
    }

    return price;
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

/**
 * [自動修正] SVG 幾何校正函式
 * 偵測並修正填滿 ViewBox 的矩形，將其向內縮半個邊框寬度，避免邊框被切掉。
 */
function autoFixSvgGeometry(svgStr) {
    if (!svgStr || !svgStr.trim().startsWith('<svg')) return svgStr;

    // [v9.11 修正] 增強 SVG 清理邏輯，處理 Markdown 連結與雙重引號錯誤
    let cleanSvgStr = svgStr.replace(/xmlns="\[(.*?)\]\(.*?\)"/g, 'xmlns="$1"')
                            .replace(/xmlns=""(.*?)""/g, 'xmlns="$1"');

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanSvgStr, "image/svg+xml");
        const svg = doc.querySelector('svg');
        if (!svg) return svgStr;

        // [修正 1] 強制設定 preserveAspectRatio="none" 以填滿容器，避免因比例不符產生的白邊
        if (svg.getAttribute('preserveAspectRatio') !== 'none') {
            svg.setAttribute('preserveAspectRatio', 'none');
        }
        // [修正 2] 確保 width/height 為 100%
        if (svg.getAttribute('width') !== '100%') svg.setAttribute('width', '100%');
        if (svg.getAttribute('height') !== '100%') svg.setAttribute('height', '100%');

        // 1. 取得 ViewBox 資訊
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return new XMLSerializer().serializeToString(doc); // 回傳已修正屬性的 SVG

        const [vbX, vbY, vbW, vbH] = viewBox.split(/\s+|,/).map(parseFloat);
        if (isNaN(vbW) || isNaN(vbH)) return new XMLSerializer().serializeToString(doc);

        // 2. 尋找並修正矩形
        const rects = svg.querySelectorAll('rect');

        rects.forEach(rect => {
            // [重要修正] 若有 vector-effect="non-scaling-stroke"，則不進行內縮修正
            // 因為 non-scaling-stroke 的線條寬度不隨縮放改變，若依據 SVG 座標內縮，
            // 在放大元件時會產生明顯的白邊間隙 (Gap)。
            const vectorEffect = rect.getAttribute('vector-effect');
            const style = rect.getAttribute('style') || '';
            if (vectorEffect === 'non-scaling-stroke' || style.includes('non-scaling-stroke')) return;

            const x = parseFloat(rect.getAttribute('x')) || 0;
            const y = parseFloat(rect.getAttribute('y')) || 0;
            const w = parseFloat(rect.getAttribute('width')); // 假設是數字 (Sheet中的SVG通常是)
            const h = parseFloat(rect.getAttribute('height'));
            const stroke = rect.getAttribute('stroke');
            const strokeWidth = parseFloat(rect.getAttribute('stroke-width')) || 0;

            // 條件：有邊框、邊框寬度 > 0、且矩形尺寸等於 ViewBox 尺寸 (允許 0.1 的誤差)
            if (stroke && stroke !== 'none' && strokeWidth > 0 &&
                Math.abs(x - vbX) < 0.1 && Math.abs(y - vbY) < 0.1 &&
                Math.abs(w - vbW) < 0.1 && Math.abs(h - vbH) < 0.1) {

                const inset = strokeWidth / 2;
                // 向內縮：起點 + 0.5寬度，總長 - 1.0寬度
                rect.setAttribute('x', x + inset);
                rect.setAttribute('y', y + inset);
                rect.setAttribute('width', w - strokeWidth);
                rect.setAttribute('height', h - strokeWidth);
            }
        });

        return new XMLSerializer().serializeToString(doc);
    } catch (e) {
        console.warn('Auto-fix SVG failed:', e);
    }
    return svgStr;
}

// Google Sheets 載入
async function loadFromSheets() {
    // 將您的 Sheet ID 直接寫在程式碼中
    const sheetId = '1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q';

    // [修正] 每次載入前清空分類，避免重複或資料殘留
    cabinetCategories = {};

    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=0`;
        const response = await fetch(url);
        const text = await response.text();
        
        // [修正] 使用更穩健的方式擷取 JSON 字串，不依賴固定長度 (解決資料截斷或解析錯誤問題)
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('無法解析 Google Sheets 回傳的資料格式');
        const jsonString = text.substring(start, end + 1);
        
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
            // [自動修正] 讀取 SVG 時自動執行幾何校正
            let img = row.c[8]?.v || '';
            if (img && typeof img === 'string' && img.trim().startsWith('<svg')) {
                img = autoFixSvgGeometry(img);
            }

            // 讀取 J 欄 (索引為 9) 的組別，若為空則預設為 '未分類'
            const group = row.c[9]?.v || '未分類';
            // [您的要求] 讀取 K 欄 (索引為 10) 作為預設備註
            const note = row.c[10]?.v || '';
            // [您的要求] 讀取 M 欄 (索引為 12) 作為 '允許重疊' 屬性
            const allowOverlap = row.c[12]?.v === true;

            // [新增] 讀取副屬性 (13-21)
            const addonsConfig = [];
            // Group 1 (13, 14, 15)
            if (row.c[13]?.v) addonsConfig.push({ name: row.c[13].v, unit: row.c[14]?.v || '式', price: parseFloat(row.c[15]?.v) || 0 });
            // Group 2 (16, 17, 18)
            if (row.c[16]?.v) addonsConfig.push({ name: row.c[16].v, unit: row.c[17]?.v || '式', price: parseFloat(row.c[18]?.v) || 0 });
            // Group 3 (19, 20, 21)
            if (row.c[19]?.v) addonsConfig.push({ name: row.c[19].v, unit: row.c[20]?.v || '式', price: parseFloat(row.c[21]?.v) || 0 });

            if (name && width && depth) {
                // 如果該組別還不存在，就建立一個空陣列
                if (!cabinetCategories[group]) {
                    cabinetCategories[group] = [];
                }

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
                    addonsConfig: addonsConfig, // [新增] 儲存副屬性設定
                    group: group, // [新增] 儲存群組資訊，用於報價單分類
                    // [最終修正] 當 Sheet 的 img 為空時，就讓它保持為空。後續渲染邏輯會自動處理 onerror 事件。
                    img: img
                });
            }
        }

        renderComponentList();
        showGlobalNotification(`✅ 成功載入 ${Object.values(cabinetCategories).flat().length} 個元件`, 3000, 'success');
        console.log(`[Input] 成功載入 ${Object.values(cabinetCategories).flat().length} 個元件`);
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



/**
 * [v8.0 新增] SVG 內容處理核心
 * 強制 SVG 填滿容器，解決「邊緣留白」問題
 */
function processSvgStr(svgStr) {
    if (!svgStr) return '';
    let result = svgStr;

    // 1. 移除既有的 width/height/preserveAspectRatio 設定 (避免衝突)
    result = result.replace(/\s(width|height|preserveAspectRatio)=["'][^"']*["']/gi, '');

    // 2. 強制設定 width="100%" height="100%" preserveAspectRatio="none"
    // 這會讓 SVG 無視原本比例，強制拉伸填滿容器 (解決留白問題)
    // 插入到 <svg 標籤後的第一個空格處
    result = result.replace('<svg', '<svg width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible;"');

    return result;
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

            // [v8.6 修正] 依使用者要求，完全移除 safeScaleSvg，直接使用 rawImgSrc
            // 這會讓元件列表的顯示與 Sheet 中的原始 SVG 完全一致 (包含原有的寬高設定)
            if (isSvgCode) {
                imageHtml = `
                     <div class="w-12 h-12 flex items-center justify-center mb-1 p-1">
                        ${rawImgSrc}
                    </div>`;
            } else {
                imageHtml = rawImgSrc
                    ? `<div class="w-full h-12 flex items-center justify-center mb-1"><img src="${rawImgSrc}" class="max-w-full max-h-full object-contain" onerror="this.onerror=null; this.src='${defaultSvgDataUri}';"></div>`
                    : `<div class="w-full h-12 flex items-center justify-center border-b"><div class="w-10 h-10 bg-gray-100 border rounded"></div></div>`;
            }

            el.innerHTML = `${imageHtml}<div class="text-[10px] truncate w-full mt-1" title="${item.name}">${item.name}</div><div class="text-[10px] text-gray-400">${item.width}x${item.depth}</div>`;
            el.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', el.dataset.json));
            container.appendChild(el);
        });
    }
}



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
        note: data.note || '', // [您的要求] 新增元件時，帶入從 Sheet 讀取的預設備註
        caiQty: 0, // [新增] 才數計價的數量
        mirrored: false, // [新增] 鏡像狀態
        addons: data.addonsConfig ? new Array(data.addonsConfig.length).fill(0) : [], // [新增] 初始化副屬性數量
        customAddons: [] // [新增] 初始化自訂副屬性
    };
    if (checkCollision(cab)) return showGlobalNotification("位置重疊，請更換位置", 3000, 'error');
    placedCabinets.push(cab);
    renderAllCabinets();
    selectCabinet(cab.id); // 選取新元件
    deselectAllAnnotations(); // [新增] 取消選取標註
    updateQuotation();
    saveState(); // [修正] 新增元件後保存狀態
}

function renderAllCabinets() {
    // 移除畫布上除了底圖和格線外的所有元件
    const existingCabinets = canvas.querySelectorAll('.placed-cabinet');
    existingCabinets.forEach(el => el.remove());

    // [新增] 檢查是否顯示家具圖層
    const showCabinets = document.getElementById('show-cabinets-toggle') ? document.getElementById('show-cabinets-toggle').checked : true;
    if (!showCabinets) return;

    // 根據 placedCabinets 陣列重新渲染所有元件
    placedCabinets.forEach(cab => {
        renderCabinet(cab);
    });

    // 確保 placeholder 的可見性正確
    document.getElementById('canvas-placeholder').style.display = placedCabinets.length > 0 ? 'none' : 'block';
    console.log(`已渲染 ${placedCabinets.length} 個元件`);
}

// [新增] 渲染所有已繪製的區域
function renderAllDrawnAreas() {
    const layer = document.getElementById('drawn-areas-layer');
    layer.innerHTML = ''; // 清空舊的圖形

    // [v5.0 新增] 取得顯示選項的狀態
    const showCeilings = document.getElementById('show-ceilings-toggle').checked;
    const showFloors = document.getElementById('show-floors-toggle').checked;
    const showWalls = document.getElementById('show-walls-toggle') ? document.getElementById('show-walls-toggle').checked : true;

    // [您的要求] 清除舊的頂點調整控點
    clearVertexHandles();

    const unselectedAreas = drawnAreas.filter(area => area.id !== selectedAreaId);
    const selectedArea = drawnAreas.find(area => area.id === selectedAreaId);

    // [您的要求] 定義圖層順序：地板(底) -> 牆壁 -> 天花板(頂)
    const typeOrder = { 'floor': 1, 'wall': 2, 'ceiling': 3 };
    unselectedAreas.sort((a, b) => (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0));

    // 先渲染所有未選取的區域
    unselectedAreas.forEach(area => {
        if ((area.type === 'ceiling' && showCeilings) || (area.type === 'floor' && showFloors) || (area.type === 'wall' && showWalls)) {
            renderSingleArea(layer, area, false);
        }
    });

    // 最後再渲染選取的區域，確保它在最上層
    if (selectedArea) {
        if ((selectedArea.type === 'ceiling' && showCeilings) || (selectedArea.type === 'floor' && showFloors) || (selectedArea.type === 'wall' && showWalls)) {
            renderSingleArea(layer, selectedArea, true);
            // [您的要求] 為選取的區域產生可拖曳的頂點
            renderVertexHandles(selectedArea);
        }
    }
    console.log(`已渲染 ${drawnAreas.length} 個區域`);
}

// [您的要求] 新增輔助函式，用於渲染單一區域，避免程式碼重複


/* renderSingleArea(layer, area, isSelected)
    layer: SVG 元素
    area: 區域物件
    isSelected: 是否為選取狀態
    return: SVG 元素
    功能說明：渲染單一區域，包括多邊形和頂點
*/
function renderSingleArea(layer, area, isSelected) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.id = area.id;

    // [修正] 鎖定邏輯：同時檢查「鎖定繪圖」與「鎖定牆壁」
    const lockDrawnAreas = document.getElementById('lock-drawn-areas').checked;
    const lockWalls = document.getElementById('lock-walls-toggle') ? document.getElementById('lock-walls-toggle').checked : false;
    
    if (lockDrawnAreas) {
        group.style.pointerEvents = 'none';
    } else if (area.type === 'wall' && lockWalls) {
        group.style.pointerEvents = 'none';
    } else {
        group.style.pointerEvents = 'auto';
    }

    const colors = {
        ceiling: { fill: 'rgba(139, 92, 246, 0.4)', stroke: 'rgba(139, 92, 246, 0.8)' },
        floor: { fill: 'rgba(251, 191, 36, 0.4)', stroke: 'rgba(217, 119, 6, 0.8)' },
        wall: { fill: 'rgba(75, 85, 99, 0.9)', stroke: 'rgba(31, 41, 55, 1)' } // [新增] 牆壁樣式 (深灰色)
    };
    const areaColor = colors[area.type] || colors.ceiling;

    // [修正] 根據類型決定繪製 Path (牆壁) 或 Polygon (其他)
    if (area.type === 'wall' && area.pathData) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', area.pathData);
        path.setAttribute('fill-rule', 'evenodd'); // 關鍵！這才能正確填充內外圈之間的區域
        path.setAttribute('fill', areaColor.fill);
        
        if (isSelected) {
            path.setAttribute('stroke', '#3b82f6'); // 藍色高亮
            path.setAttribute('stroke-width', '3');
        } else {
            path.setAttribute('stroke', areaColor.stroke);
            path.setAttribute('stroke-width', '1');
        }
        group.appendChild(path);
    } else {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = area.points.map(p => `${p.x},${p.y}`).join(' ');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', areaColor.fill);
        polygon.setAttribute('stroke', areaColor.stroke);
        polygon.setAttribute('stroke-width', '1');

        if (isSelected) {
            polygon.classList.add('selected');
        }
        group.appendChild(polygon);
    }

    group.addEventListener('click', (e) => {
        e.stopPropagation();
        selectArea(area.id);
    });
 
    // [修正] 牆壁不顯示文字標籤
    if (area.type !== 'wall') {
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
    }

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

// [新增] 新增工程標註
function addAnnotation() {
    // 取得畫布中心點
    const rect = canvas.getBoundingClientRect();
    const centerX = (rect.width / 2 - 50) / viewScale; // 稍微偏移
    const centerY = (rect.height / 2 - 20) / viewScale;

    const anno = {
        id: `anno-${Date.now()}`,
        x: centerX,
        y: centerY,
        targetX: centerX + 100, // 指示點預設在右方 100px
        targetY: centerY + 50,
        data: { 
            name: '隱藏門', 
            unitPrice: 0, 
            pricingType: 'fixed',
            group: '木作工程' // 預設群組
        },
        addons: [],
        customAddons: [{ name: '', unit: '式', price: 0, qty: 1 }], // [修正] 預設加入主計價項目 (名稱留空，因會使用標註名稱)
        note: ''
    };

    placedAnnotations.push(anno);
    renderAllAnnotations();
    selectAnnotation(anno.id);
    saveState();
    updateQuotation();
    showGlobalNotification('已新增工程標註', 2000, 'success');
}

// [新增] 渲染所有工程標註
function renderAllAnnotations() {
    const layer = document.getElementById('annotation-layer');
    layer.innerHTML = '';

    // 檢查是否顯示標註圖層
    const showAnnotations = document.getElementById('show-annotations-toggle') ? document.getElementById('show-annotations-toggle').checked : true;
    if (!showAnnotations) return;

    // 1. 建立 SVG 容器用於繪製連接線 (在底層)
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none"; // 讓 SVG 不擋住下方的點擊
    layer.appendChild(svg);

    placedAnnotations.forEach(anno => {
        // A. 繪製連接線與指示點 (SVG)
        // 連接線
        const line = document.createElementNS(svgns, "line");
        // 計算方塊中心點 (假設方塊寬約 120px, 高約 40px，這裡做簡單估算，實際拖曳時會更新)
        // 為了美觀，線條從方塊中心連到目標點
        const boxCenterX = anno.x + 60; 
        const boxCenterY = anno.y + 20;
        
        line.setAttribute("x1", boxCenterX);
        line.setAttribute("y1", boxCenterY);
        line.setAttribute("x2", anno.targetX);
        line.setAttribute("y2", anno.targetY);
        line.setAttribute("stroke", "#f97316"); // Orange-500
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "5,5");
        svg.appendChild(line);

        // 指示點 (Target Dot)
        const targetDot = document.createElementNS(svgns, "circle");
        targetDot.setAttribute("cx", anno.targetX);
        targetDot.setAttribute("cy", anno.targetY);
        targetDot.setAttribute("r", "6");
        targetDot.setAttribute("fill", "#f97316");
        targetDot.setAttribute("stroke", "white");
        targetDot.setAttribute("stroke-width", "2");
        targetDot.style.cursor = "crosshair";
        targetDot.style.pointerEvents = "auto"; // 允許拖曳
        
        // 綁定指示點拖曳事件
        targetDot.addEventListener('mousedown', (e) => startAnnotationDrag(e, anno, 'target'));
        svg.appendChild(targetDot);

        // B. 繪製說明方塊 (HTML Div)
        const box = document.createElement('div');
        box.className = 'absolute bg-white border-2 border-orange-500 rounded shadow-md p-2 text-xs cursor-move flex flex-col items-center justify-center';
        box.style.left = `${anno.x}px`;
        box.style.top = `${anno.y}px`;
        box.style.width = '120px';
        box.style.minHeight = '40px';
        box.style.zIndex = '35'; // 比 SVG 高
        box.style.pointerEvents = 'auto';

        if (selectedCabId === anno.id) { // 借用 selectedCabId 變數來存標註 ID (或新增 selectedAnnotationId)
            box.classList.add('ring-2', 'ring-blue-500');
        }

        box.innerHTML = `
            <div class="font-bold text-orange-700">${anno.data.name}</div>
            ${anno.data.unitPrice > 0 ? `<div class="text-gray-500">$${anno.data.unitPrice}</div>` : ''}
        `;

        // 綁定方塊拖曳事件
        box.addEventListener('mousedown', (e) => startAnnotationDrag(e, anno, 'box'));
        
        layer.appendChild(box);
    });
}

/**
 * 渲染單個元件到畫布上
 * @param {Object} cab - 元件資料物件
 */
function renderCabinet(cab) {
    const el = document.createElement('div');
    el.className = 'placed-cabinet';
    if (cab.data.isWall) {
        // [v9.1] 牆壁顯示與鎖定控制
        const showWalls = document.getElementById('show-walls-toggle') ? document.getElementById('show-walls-toggle').checked : true;
        const lockWalls = document.getElementById('lock-walls-toggle') ? document.getElementById('lock-walls-toggle').checked : false;

        if (!showWalls) {
            el.style.display = 'none';
        }
        if (lockWalls) {
            el.style.pointerEvents = 'none';
        }
        el.classList.add('is-wall');
    }
    el.id = cab.id;
    updateCabStyle(el, cab);

    // [v9.0 重構] 根據 adjustable 屬性生成對應方向的拉伸控點
    // 支援: width (左右), depth (上下), both (四邊), none (無)
    const adjustable = cab.data.adjustable;
    let handlesHtml = '';

    // [v9.10 修正] 支援 Inline SVG 渲染，解決 Data URI 編碼問題與 vector-effect 失效問題
    let svgContent = '';
    if (!cab.data.isWall && cab.data.img && cab.data.img.trim().startsWith('<svg')) {
        // [v9.11 修正] 改為 overflow:visible 以避免邊界線條(stroke)被裁切
        svgContent = `<div class="cab-svg-content" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;overflow:visible;">${cab.data.img}</div>`;
    }

    if (adjustable !== 'none' && adjustable !== false) {
        // 左右拉伸點 (Width)
        if (adjustable === 'width' || adjustable === 'both' || adjustable === 'width-depth-select') {
            handlesHtml += `<div class="resize-handle resize-handle-w" data-dir="w"></div>`;
            handlesHtml += `<div class="resize-handle resize-handle-e" data-dir="e"></div>`;
        }
        // 上下拉伸點 (Depth)
        if (adjustable === 'depth' || adjustable === 'both' || adjustable === 'width-depth-select') {
            handlesHtml += `<div class="resize-handle resize-handle-n" data-dir="n"></div>`;
            handlesHtml += `<div class="resize-handle resize-handle-s" data-dir="s"></div>`;
        }
    }

    el.innerHTML = `
        ${svgContent}
        ${handlesHtml}
        <div class="size-label">${Math.round(cab.currentW)}x${Math.round(cab.currentH)} cm (${cmToFeet(cab.currentW)}x${cmToFeet(cab.currentH)}尺)</div>
    `;

    // 綁定元件拖曳事件
    el.onmousedown = (e) => startCabDrag(e, cab);

    // 綁定拉伸控點事件
    const handles = el.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            const direction = handle.dataset.dir;
            console.log(`[Resize] Start resizing cab ${cab.id}, direction: ${direction}`); // [Debug]
            startResize(cab.id, e, direction);
        });
    });

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

    if (cab.data.isWall) {
        el.style.backgroundColor = '#374151'; // dark gray
        el.style.backgroundImage = 'none';
    } else {
        if (cab.data.img && cab.data.img.trim().startsWith('<svg')) {
            // [v9.10 修正] 若為 SVG 則不設定背景圖 (已改為 Inline 渲染)
            el.style.backgroundImage = 'none';
        } else if (cab.data.img) {
            const defaultSvgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs.default(cab.data.name))}`;
            const img = new Image();
            img.src = cab.data.img;
            img.onload = () => { el.style.backgroundImage = `url('${cab.data.img}')`; };
            img.onerror = () => { el.style.backgroundImage = `url("${defaultSvgDataUri}")`; };
        } else {
            el.style.backgroundImage = 'none';
            el.style.backgroundColor = '#f3f4f6';
        }
    }
    el.style.transform = `rotate(${cab.rotation}deg) scaleX(${cab.mirrored ? -1 : 1})`; // [新增] 支援鏡像
    el.style.opacity = (cab.opacity / 100);
}


function handleGlobalClick(e) {
    // [v9.2 修正] 防止因 DOM 元素被移除導致的誤判 (例如點擊 "新增自訂項目" 按鈕後該按鈕被重繪移除)
    // 如果點擊的目標已經不在文件中，視為有效操作，不觸發取消選取
    if (!document.body.contains(e.target)) return;

    // [新增] 如果正在繪圖模式，則處理點擊事件
    if (isDrawing && e.target.closest('#design-canvas')) {
        // handleDrawingClick(e); // [修正] 避免與 canvas click 事件重複觸發導致產生雙重點
        return; // 阻止取消選取等其他點擊事件
    }
    // [新增] 如果點擊的不是繪製區域，則取消選取
    // [修正] 增加對 path 的檢查，避免點擊牆壁時被誤判為背景
    if (!e.target.closest('polygon') && !e.target.closest('path')) {
        deselectAllAreas();
    }

    // [修正] 增加對 annotation-layer 的檢查
    if (!e.target.closest('.placed-cabinet') && !e.target.closest('#annotation-layer') && !e.target.closest('.floating-window') && !e.target.closest('.modal')) {
        deselectAll();
        deselectAllAnnotations(); // [新增]
    }
}

// [v9.5 新增] 統一渲染副屬性面板的函式 (供 selectCabinet 與 selectArea 共用)
function renderAddonsPanel(targetId) {
    const container = document.getElementById('selected-addons');
    if (!container) return;
    container.innerHTML = '';

    let target = placedCabinets.find(c => c.id === targetId);
    let isArea = false;
    if (!target) {
        target = drawnAreas.find(a => a.id === targetId);
        isArea = true;
    }
    // [新增] 支援標註
    if (!target) {
        target = placedAnnotations.find(a => a.id === targetId);
    }
    if (!target) return;

    // 1. Sheet 定義的副屬性 (預設副屬性)
    let sheetAddons = [];
    let sheetAddonQtys = target.addons || [];
    let updateFuncName = '';

    if (isArea) {
        if (target.linkedComponent && target.linkedComponent.addonsConfig) {
            sheetAddons = target.linkedComponent.addonsConfig;
        }
        updateFuncName = 'window.updateAreaAddon';
    } else {
        if (target.data && target.data.addonsConfig) {
            sheetAddons = target.data.addonsConfig;
        }
        updateFuncName = 'window.updateCabinetAddon';
    }

    if (sheetAddons.length > 0) {
        sheetAddons.forEach((addon, idx) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center mb-2';
            row.innerHTML = `
                <span class="text-xs text-gray-600">${addon.name} ($${addon.price}/${addon.unit})</span>
                <input type="number" min="0" value="${sheetAddonQtys[idx] || 0}" class="w-12 text-xs border rounded text-center" onchange="${updateFuncName}('${target.id}', ${idx}, this.value)">
            `;
            container.appendChild(row);
        });
    }

    // 2. 自訂副屬性
    if (target.customAddons && target.customAddons.length > 0) {
        // 分隔線
        if (sheetAddons.length > 0) {
            const sep = document.createElement('div');
            sep.className = 'border-t border-gray-100 my-2';
            container.appendChild(sep);
        }

        // Header - [v9.7] 統一使用標準元件的簡潔版面 (移除分類欄位)
        const header = document.createElement('div');
        header.className = 'flex gap-1 mb-1 text-[10px] text-gray-500 font-bold';
        header.innerHTML = `
            <div class="flex-1 pl-1">項目</div>
            <div class="w-12 text-center">單位</div>
            <div class="w-16 text-right">單價</div>
            <div class="w-12 text-center">數量</div>
            <div class="w-5"></div>
        `;
        container.appendChild(header);

        // Datalists (共用 ID)
        const datalistUnit = document.createElement('datalist');
        datalistUnit.id = 'unit-options-shared';
        datalistUnit.innerHTML = `<option value="式"><option value="坪"><option value="尺"><option value="才"><option value="公分"><option value="口"><option value="個"><option value="組">`;
        container.appendChild(datalistUnit);

        target.customAddons.forEach((addon, idx) => {
            const row = document.createElement('div');
            row.className = 'flex gap-1 mb-1 items-center';
            
            // [修正] 針對標註的第一個項目(基本費用)，隱藏名稱輸入與刪除按鈕
            const isAnno = target.id.startsWith('anno-');
            let nameInputHtml = '';
            let deleteBtnHtml = '';

            if (isAnno && idx === 0) {
                nameInputHtml = `<div class="flex-1 text-xs border-0 p-1 text-gray-500 font-bold">主項目計價</div>`;
                deleteBtnHtml = `<div class="w-5"></div>`; // 佔位但不顯示刪除鈕
            } else {
                nameInputHtml = `<input type="text" value="${addon.name}" class="flex-1 text-xs border rounded p-1 min-w-0" placeholder="名稱" onchange="window.updateCustomAddon('${target.id}', ${idx}, 'name', this.value)">`;
                deleteBtnHtml = `<button class="w-5 text-red-500 hover:text-red-700 flex justify-center items-center" onclick="window.removeCustomAddon('${target.id}', ${idx})">×</button>`;
            }

            row.innerHTML = `
                ${nameInputHtml}
                <input type="text" value="${addon.unit}" list="unit-options-shared" class="w-12 text-xs border rounded p-1 text-center px-0" placeholder="式" onchange="window.updateCustomAddon('${target.id}', ${idx}, 'unit', this.value)">
                <input type="number" value="${addon.price}" step="100" class="w-16 text-xs border rounded p-1 text-right px-0" placeholder="0" onchange="window.updateCustomAddon('${target.id}', ${idx}, 'price', this.value)">
                <input type="number" value="${addon.qty}" class="w-12 text-xs border rounded p-1 text-center px-0" placeholder="1" onchange="window.updateCustomAddon('${target.id}', ${idx}, 'qty', this.value)">
                ${deleteBtnHtml}
            `;
            container.appendChild(row);
        });
    }

    // 3. Add Button
    const addBtn = document.createElement('button');
    addBtn.className = 'w-full mt-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-dashed border-blue-300 transition-colors flex justify-center items-center';
    addBtn.innerHTML = '<span class="text-lg leading-none mr-1">+</span> 新增自訂項目';
    addBtn.onclick = () => window.addCustomAddon(target.id);
    container.appendChild(addBtn);

    container.style.display = 'block';
}

function selectCabinet(id) {
    // [修正] 只有當選取的 ID 改變時，才執行 deselectAll (避免新增副屬性時畫面閃爍)
    if (selectedCabId !== id) {
        deselectAll();
        deselectAllAreas();
        deselectAllAnnotations(); // [新增]
    }
    selectedCabId = id;
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');

    const cab = placedCabinets.find(c => c.id === id);
    if (cab) {
        document.getElementById('selected-info').style.display = 'block';
        
        // [修正] 恢復顯示名稱文字，隱藏輸入框 (避免從標註切換過來時殘留)
        document.getElementById('selected-name').style.display = 'block';
        const nameInput = document.getElementById('selected-name-input');
        if (nameInput) nameInput.style.display = 'none';

        // [新增] 載入分類群組
        document.getElementById('selected-group-input').value = cab.data.group || '未分類';

        document.getElementById('selected-name').innerText = cab.data.name;

        // [您的要求] 將尺寸填入新的輸入框
        document.getElementById('selected-width').value = cab.currentW;
        document.getElementById('selected-height').value = cab.currentH;
        document.getElementById('selected-size-inputs').style.display = 'grid';

        let priceText = '此項目不計價';
        if (cab.data.pricingType !== 'none' && typeof cab.data.unitPrice === 'number') {
            const price = calculatePrice(cab);
            priceText = `單價: $${cab.data.unitPrice.toLocaleString()} `;
            if (cab.data.pricingType === 'width') {
                priceText += `/ 尺 | 總價: $${price.toLocaleString()}`;
            } else if (cab.data.pricingType === 'cai' || cab.data.pricingType === 'area') {
                priceText += `/ 才 | 總價: $${price.toLocaleString()}`;
            } else if (cab.data.pricingType === 'cm') {
                priceText += `/ cm | 總價: $${price.toLocaleString()}`;
            } else if (cab.data.pricingType === 'fixed' || cab.data.pricingType === 'number') {
                priceText = `總價: $${price.toLocaleString()}`;
            }
        }
        document.getElementById('selected-price').innerText = priceText;

        document.getElementById('opacity-slider').value = cab.opacity;
        document.getElementById('opacity-value').innerText = cab.opacity + '%';
        document.getElementById('opacity-slider').parentElement.style.display = 'block'; // [v6.0 UX優化] 確保透明度滑桿可見
        document.getElementById('note-input').parentElement.style.display = 'block'; // [v6.0 UX優化] 確保備註欄可見
        document.getElementById('note-input').value = cab.note || '';
        document.getElementById('selected-cab-actions').style.display = 'flex'; // [您的要求] 顯示元件操作按鈕

        // [修改] 顯示/隱藏才數輸入框
        const caiWrapper = document.getElementById('selected-cai-wrapper');
        if (cab.data.pricingType === 'cai') {
            caiWrapper.style.display = 'block';
            // 使用已儲存的才數
            document.getElementById('selected-cai-qty').value = cab.caiQty || 0;
        } else {
            caiWrapper.style.display = 'none';
        }

        // [新增] 渲染副屬性輸入框
        const addonContainer = document.getElementById('selected-addons');
        if (addonContainer) {
            addonContainer.innerHTML = '';
            // [v9.7] 使用統一函式渲染副屬性面板，確保與天花板/地板一致
            renderAddonsPanel(cab.id);
            addonContainer.style.display = 'block';
        }
    }
}

// [新增] 選取工程標註
function selectAnnotation(id) {
    if (selectedCabId !== id) {
        deselectAll();
        deselectAllAreas();
    }
    // 這裡我們借用 selectedCabId 來儲存選取的標註 ID，因為 UI 共用
    selectedCabId = id; 
    renderAllAnnotations(); // 重繪以顯示選取狀態

    const anno = placedAnnotations.find(a => a.id === id);
    if (anno) {
        document.getElementById('selected-info').style.display = 'block';
        
        // [修正] 標註支援修改名稱：隱藏文字，顯示輸入框
        document.getElementById('selected-name').style.display = 'none';
        let nameInput = document.getElementById('selected-name-input');
        if (!nameInput) {
            nameInput = document.createElement('input');
            nameInput.id = 'selected-name-input';
            nameInput.className = 'w-full text-sm border rounded p-1 font-bold mb-1';
            const pName = document.getElementById('selected-name');
            pName.parentNode.insertBefore(nameInput, pName);
            nameInput.addEventListener('input', (e) => {
                const currentAnno = placedAnnotations.find(a => a.id === selectedCabId);
                if (currentAnno) {
                    currentAnno.data.name = e.target.value;
                    renderAllAnnotations();
                    updateQuotation(); // 名稱改變可能影響分組
                    saveState();
                }
            });
        }
        nameInput.style.display = 'block';
        nameInput.value = anno.data.name;

        // [新增] 載入分類群組
        document.getElementById('selected-group-input').value = anno.data.group || '其他工程';

        // 標註通常不需要尺寸輸入，隱藏之
        document.getElementById('selected-size-inputs').style.display = 'none';
        document.getElementById('selected-cai-wrapper').style.display = 'none';

        // 顯示價格
        let priceText = '此項目不計價';
        const totalPrice = calculatePrice(anno);
        if (totalPrice > 0) {
            priceText = `總價: $${totalPrice.toLocaleString()}`;
        }
        document.getElementById('selected-price').innerText = priceText;

        // 隱藏透明度，顯示備註
        document.getElementById('opacity-slider').parentElement.style.display = 'none';
        document.getElementById('note-input').parentElement.style.display = 'block';
        document.getElementById('note-input').value = anno.note || '';
        
        // 顯示刪除按鈕，隱藏其他變形按鈕
        document.getElementById('selected-cab-actions').style.display = 'flex';
        // 隱藏旋轉、鏡像等不適用於標註的按鈕
        ['selected-rotate-btn', 'selected-mirror-btn', 'selected-layer-up-btn', 'selected-layer-down-btn'].forEach(btnId => {
            document.getElementById(btnId).style.display = 'none';
        });

        // 渲染副屬性
        const addonContainer = document.getElementById('selected-addons');
        if (addonContainer) {
            addonContainer.innerHTML = '';
            renderAddonsPanel(anno.id);
            addonContainer.style.display = 'block';
        }
    }
}

function deselectAll() {
    selectedCabId = null;
    document.querySelectorAll('.placed-cabinet.selected').forEach(e => e.classList.remove('selected'));
    document.getElementById('selected-info').style.display = 'none';
    document.getElementById('selected-size-inputs').style.display = 'none';
    // [修改] 隱藏才數輸入框
    document.getElementById('selected-cai-wrapper').style.display = 'none';
    // 清空副屬性區
    const addonContainer = document.getElementById('selected-addons');
    if (addonContainer) addonContainer.style.display = 'none';
    document.getElementById('selected-cab-actions').style.display = 'none'; // [您的要求] 隱藏元件操作按鈕
    
    // [修正] 恢復名稱顯示狀態
    document.getElementById('selected-name').style.display = 'block';
    const nameInput = document.getElementById('selected-name-input');
    if (nameInput) nameInput.style.display = 'none';

    // 恢復所有按鈕顯示 (因為 selectAnnotation 可能隱藏了部分)
    ['selected-rotate-btn', 'selected-mirror-btn', 'selected-layer-up-btn', 'selected-layer-down-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if(btn) btn.style.display = 'flex';
    });
}

// [新增] 取消選取所有標註
function deselectAllAnnotations() {
    // 由於我們共用 selectedCabId，deselectAll 已經處理了 ID 清空
    // 這裡主要負責重繪以移除視覺選取效果
    renderAllAnnotations();
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
    // [修正] 修正備註儲存邏輯，確保標註也能正確儲存
    const noteValue = document.getElementById('note-input').value;
    if (selectedCabId) {
        const cab = placedCabinets.find(c => c.id === selectedCabId);
        if (cab) {
            cab.note = noteValue;
            saveState(); // [您的要求] 儲存狀態
            return;
        }
        // [修正] 若找不到 cabinet，嘗試找 annotation
        const anno = placedAnnotations.find(a => a.id === selectedCabId);
        if (anno) {
            anno.note = noteValue;
            saveState();
            return;
        }
    } 
    
    if (selectedAreaId) {
        const area = drawnAreas.find(a => a.id === selectedAreaId);
        if (area) {
            area.note = noteValue;
            renderAllDrawnAreas(); // [v4.0 新增] 更新備註後，立即重繪以顯示標籤
            saveState(); // [您的要求] 儲存狀態
        }
    }
}

// [新增] 更新分類群組
function updateSelectedGroup() {
    const val = document.getElementById('selected-group-input').value;
    if (selectedCabId) {
        const cab = placedCabinets.find(c => c.id === selectedCabId);
        if (cab) {
            cab.data.group = val;
        } else {
            const anno = placedAnnotations.find(a => a.id === selectedCabId);
            if (anno) {
                anno.data.group = val;
            }
        }
    } else if (selectedAreaId) {
        const area = drawnAreas.find(a => a.id === selectedAreaId);
        if (area) {
            if (!area.linkedComponent) area.linkedComponent = {};
            area.linkedComponent.group = val;
        }
    }
    saveState();
    updateQuotation();
}

function handleKeyDown(e) {
    // [安全修正] 確保 e.key 存在，避免在某些特殊輸入狀態下 (如 IME) 導致 undefined 錯誤
    if (!e.key) return;

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
    
    // [新增] 鏡像功能 (M)
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey) {
        e.preventDefault();
        mirrorSelectedCab();
        return;
    }

    // [新增] 如果選取了區域，按下 'D' 鍵刪除
    if (selectedAreaId && (e.key.toLowerCase() === 'd' || e.key === 'Delete')) { // [您的要求] 增加 Delete 鍵支援
        e.preventDefault();
        deleteArea(selectedAreaId);
        return;
    }

    // [您的要求] 複製功能 (Ctrl+C)
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (selectedCabId) {
            e.preventDefault();
            const cab = placedCabinets.find(c => c.id === selectedCabId);
            if (cab) {
                clipboardCab = JSON.parse(JSON.stringify(cab));
                showGlobalNotification('已複製元件', 1000, 'info');
            }
        }
        return;
    }

    // [新增] 刪除標註
    const selectedAnno = placedAnnotations.find(a => a.id === selectedCabId);
    if (selectedAnno && (e.key.toLowerCase() === 'd' || e.key === 'Delete')) {
        e.preventDefault();
        deleteAnnotation(selectedCabId);
        return;
    }

    // [您的要求] 貼上功能 (Ctrl+V)
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        if (clipboardCab) {
            e.preventDefault();
            // 貼上時給予一點位移
            const newCab = JSON.parse(JSON.stringify(clipboardCab));
            newCab.id = `cab-${Date.now()}`;
            newCab.x += 20;
            newCab.y += 20;

            if (checkCollision(newCab)) {
                newCab.x += 20;
                newCab.y += 20;
            }

            placedCabinets.push(newCab);
            renderAllCabinets();
            selectCabinet(newCab.id);
            saveState();
            showGlobalNotification('已貼上元件', 1000, 'success');
        }
        return;
    }


    if (isDrawing || !selectedCabId || isBgEditMode || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const cab = placedCabinets.find(c => c.id === selectedCabId);
    if (!cab) return;

    // [您的要求] 圖層調整熱鍵 ([ 下移, ] 上移)
    if (e.key === ']') {
        e.preventDefault();
        moveSelectedCabLayer('up');
        return;
    }
    if (e.key === '[') {
        e.preventDefault();
        moveSelectedCabLayer('down');
        return;
    }

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

// [新增] 鏡像選取的元件
function mirrorSelectedCab() {
    const id = selectedCabId;
    const cab = placedCabinets.find(c => c.id === id);
    if (!cab) return;
    cab.mirrored = !cab.mirrored;
    renderAllCabinets();
    saveState();
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

// [新增] 調整元件圖層順序
function moveSelectedCabLayer(direction) {
    if (!selectedCabId) return;
    const index = placedCabinets.findIndex(c => c.id === selectedCabId);
    if (index === -1) return;

    if (direction === 'up') {
        // 往後移動 (DOM 順序越後面越上層)
        if (index < placedCabinets.length - 1) {
            const temp = placedCabinets[index];
            placedCabinets[index] = placedCabinets[index + 1];
            placedCabinets[index + 1] = temp;
            renderAllCabinets();
            saveState();
        }
    } else if (direction === 'down') {
        // 往前移動
        if (index > 0) {
            const temp = placedCabinets[index];
            placedCabinets[index] = placedCabinets[index - 1];
            placedCabinets[index - 1] = temp;
            renderAllCabinets();
            saveState();
        }
    }
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

// [新增] 刪除標註
function deleteAnnotation(id) {
    placedAnnotations = placedAnnotations.filter(a => a.id !== id);
    deselectAll();
    renderAllAnnotations();
    updateQuotation();
    saveState();
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

// [v6.1 新增] 取得投影軸的輔助函式 (抽出共用)
function getAxes(vertices) {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[i + 1 === vertices.length ? 0 : i + 1];
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        // 正規化向量
        const length = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        const normal = { x: -edge.y / length, y: edge.x / length };
        axes.push(normal);
    }
    return axes;
}

// [v6.1 新增] 計算兩物件間的 MTV (Minimum Translation Vector)
// 如果沒有碰撞，回傳 null
// 如果有碰撞，回傳 {x, y} 表示 cab1 需要移動多少距離才能離開 cab2
function getMTV(cab1, cab2) {
    const v1 = getVertices(cab1);
    const v2 = getVertices(cab2);
    const axes = [...getAxes(v1), ...getAxes(v2)];

    let minOverlap = Infinity;
    let smallestAxis = null;

    for (const axis of axes) {
        const p1 = project(v1, axis);
        const p2 = project(v2, axis);

        if (!overlap(p1, p2)) {
            return null; // 有分離軸，表示未碰撞
        } else {
            // 計算重疊量
            const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
            if (o < minOverlap) {
                minOverlap = o;
                smallestAxis = axis;
            }
        }
    }

    if (!smallestAxis) return null;

    // 確保推離方向是正確的 (從 cab2 推向 cab1)
    // 簡單判斷：計算兩中心點向量，看是否需反轉軸向
    const c1 = getCenter(cab1);
    const c2 = getCenter(cab2);
    const dir = { x: c1.x - c2.x, y: c1.y - c2.y };

    if (dotProduct(dir, smallestAxis) < 0) {
        smallestAxis = { x: -smallestAxis.x, y: -smallestAxis.y };
    }

    return {
        x: smallestAxis.x * minOverlap,
        y: smallestAxis.y * minOverlap
    };
}

// [v6.1 新增] 輔助函式：取得中心點
function getCenter(cab) {
    return {
        x: cab.x + cab.currentW / 2,
        y: cab.y + cab.currentH / 2
    };
}

// [v6.1 新增] 輔助函式：內積
function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

/**
 * 處理全域滑鼠移動事件 (拖曳元件、調整大小)
 * @param {MouseEvent} e - 滑鼠事件物件
 */
function handleGlobalMove(e) {
    // [v8.14 修復] 拖曳時必須考慮畫布的縮放與位移，與 startCabDrag 保持一致
    const rect = canvas.getBoundingClientRect();
    const safeScale = viewScale || 1.0;
    let mouseX = (e.clientX - rect.left) / safeScale;
    let mouseY = (e.clientY - rect.top) / safeScale;

    // [v9.1 新增] 繪圖時的即時預覽 (正交鎖定 + 自動吸附起點)
    if (isDrawing) {
        let snapToStart = false;
        // 1. 自動吸附起點 (Auto-close loop)
        if (currentDrawingPoints.length > 2) {
            const startPoint = currentDrawingPoints[0];
            const dist = Math.sqrt(Math.pow(mouseX - startPoint.x, 2) + Math.pow(mouseY - startPoint.y, 2));
            if (dist < 20) { // 20px 吸附半徑
                mouseX = startPoint.x;
                mouseY = startPoint.y;
                snapToStart = true;
            }
        }

        // 2. 正交鎖定 (Orthogonal Lock) - 適用於所有繪圖模式 (牆壁/天花/地板)
        // 如果沒有吸附到起點，且沒有按住 Alt 鍵，則執行正交鎖定
        if (!snapToStart && !e.altKey && currentDrawingPoints.length > 0) {
            const lastPoint = currentDrawingPoints[currentDrawingPoints.length - 1];
            const dx = Math.abs(mouseX - lastPoint.x);
            const dy = Math.abs(mouseY - lastPoint.y);
            if (dx > dy) {
                mouseY = lastPoint.y; // Snap Y (Horizontal)
            } else {
                mouseX = lastPoint.x; // Snap X (Vertical)
            }
        }
        updateDrawingPreview({ x: mouseX, y: mouseY });
        return; // 繪圖模式下不執行後續的拖曳邏輯
    }

    // --------------------------
    // 0. 處理標註拖曳 (Annotation)
    // --------------------------
    if (isDraggingAnnotation && currentDragAnnotationId) {
        const anno = placedAnnotations.find(a => a.id === currentDragAnnotationId);
        if (anno) {
            if (annotationDragType === 'box') {
                anno.x = mouseX - annotationDragOffset.x;
                anno.y = mouseY - annotationDragOffset.y;
            } else if (annotationDragType === 'target') {
                // 指示點直接跟隨滑鼠
                anno.targetX = mouseX;
                anno.targetY = mouseY;
            }
            renderAllAnnotations();
        }
        return; // 標註拖曳時不處理其他
    }

    // --------------------------
    // 1. 處理元件拖曳 (Move)
    // --------------------------
    if (isDraggingCab && currentDragCab) {
        let nx = mouseX - dragOffset.x;
        let ny = mouseY - dragOffset.y;

        // [v9.9 新增] 吸附對齊功能 (Snap to Grid/Object)
        // 按住 Shift 鍵可暫時停用吸附
        if (!e.shiftKey) {
            const SNAP_THRESHOLD = 10; // 吸附閾值 (px)
            const GRID_SIZE = 10;      // 網格大小 (px)

            // 1. 網格吸附
            nx = Math.round(nx / GRID_SIZE) * GRID_SIZE;
            ny = Math.round(ny / GRID_SIZE) * GRID_SIZE;

            // 2. 物件邊緣吸附
            const myW = currentDragCab.currentW;
            const myH = currentDragCab.currentH;
            
            for (const other of placedCabinets) {
                if (other.id === currentDragCab.id) continue;
                
                // X軸吸附 (左對左、左對右、右對左、右對右)
                if (Math.abs(nx - other.x) < SNAP_THRESHOLD) nx = other.x;
                else if (Math.abs(nx - (other.x + other.currentW)) < SNAP_THRESHOLD) nx = other.x + other.currentW;
                else if (Math.abs((nx + myW) - other.x) < SNAP_THRESHOLD) nx = other.x - myW;
                else if (Math.abs((nx + myW) - (other.x + other.currentW)) < SNAP_THRESHOLD) nx = other.x + other.currentW - myW;

                // Y軸吸附 (上對上、上對下、下對上、下對下)
                if (Math.abs(ny - other.y) < SNAP_THRESHOLD) ny = other.y;
                else if (Math.abs(ny - (other.y + other.currentH)) < SNAP_THRESHOLD) ny = other.y + other.currentH;
                else if (Math.abs((ny + myH) - other.y) < SNAP_THRESHOLD) ny = other.y - myH;
                else if (Math.abs((ny + myH) - (other.y + other.currentH)) < SNAP_THRESHOLD) ny = other.y + other.currentH - myH;
            }
        }

        // 先嘗試移動到新位置
        currentDragCab.x = nx;
        currentDragCab.y = ny;

        // [v6.1 核心升級] 碰撞反應機制
        // 不只是偵測 true/false，而是計算出 "修正向量" (MTV) 並應用它
        let totalCorrection = { x: 0, y: 0 };
        let hasCollision = false;

        // 檢查與所有其他元件的碰撞
        for (const other of placedCabinets) {
            if (other.id === currentDragCab.id) continue;
            if (currentDragCab.data.allowOverlap || other.data.allowOverlap) continue;

            const mtv = getMTV(currentDragCab, other);
            if (mtv) {
                hasCollision = true;
                // 累積修正量 (簡單處理：直接取最大的修正，避免抖動)
                if (Math.abs(mtv.x) > Math.abs(totalCorrection.x) || Math.abs(mtv.y) > Math.abs(totalCorrection.y)) {
                    totalCorrection = mtv;
                }
            }
        }

        // 應用修正：將物件「推」出碰撞區域，形成吸附/阻擋效果
        if (hasCollision) {
            currentDragCab.x += totalCorrection.x;
            currentDragCab.y += totalCorrection.y;
        }

        const el = document.getElementById(currentDragCab.id);
        updateCabStyle(el, currentDragCab);

        // 如果修正後仍有碰撞 (例如被夾在兩個物件中間)，才顯示紅框警告
        if (checkCollision(currentDragCab, currentDragCab.id)) {
            el.classList.add('collision-warning');
        } else {
            el.classList.remove('collision-warning');
        }
    }

    // --------------------------
    // 2. 處理元件縮放 (Resize)
    // --------------------------
    if (isResizing && resizeTarget) {
        // [v9.0] 使用原始記錄的滑鼠位置計算 delta
        const dx = e.clientX - resizeStart.checkX;
        const dy = e.clientY - resizeStart.checkY;

        // 轉換為畫布縮放後的 delta
        const safeScale = viewScale || 1.0;
        const localDx = dx / safeScale;
        const localDy = dy / safeScale;

        // 旋轉處理：將滑鼠位移投影到元件的局部座標系
        const rad = toRad(resizeTarget.rotation);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // 重新定義 localDx/Dy 為投影後的量
        const projDx = localDx * cos + localDy * sin;
        const projDy = -localDx * sin + localDy * cos;

        // 根據方向更新尺寸
        // 這裡使用 resizeStart 紀錄的原始尺寸
        let newW = resizeStart.w;
        let newH = resizeStart.h;
        let localShiftX = 0;
        let localShiftY = 0;

        // [v9.0 新增] 根據拉伸方向計算新的尺寸與中心點位移
        if (resizeDirection) {
            switch (resizeDirection) {
                case 'w': // 西 (左) - 寬度增加，中心向左移
                    newW = Math.max(20, resizeStart.w - projDx);
                    localShiftX = -(newW - resizeStart.w) / 2;
                    break;
                case 'e': // 東 (右) - 寬度增加，中心向右移
                    newW = Math.max(20, resizeStart.w + projDx);
                    localShiftX = (newW - resizeStart.w) / 2;
                    break;
                case 'n': // 北 (上) - 高度增加，中心向上移
                    newH = Math.max(20, resizeStart.h - projDy);
                    localShiftY = -(newH - resizeStart.h) / 2;
                    break;
                case 's': // 南 (下) - 高度增加，中心向下移
                    newH = Math.max(20, resizeStart.h + projDy);
                    localShiftY = (newH - resizeStart.h) / 2;
                    break;
            }
        }

        // [限制] 根據 adjustable 屬性最後把關
        const adjustable = resizeTarget.data.adjustable;
        if (adjustable === 'width' && (resizeDirection === 'n' || resizeDirection === 's')) newH = resizeStart.h;
        if (adjustable === 'depth' && (resizeDirection === 'w' || resizeDirection === 'e')) newW = resizeStart.w;

        // 3. 計算新的全域中心點
        // 將局部中心位移轉回全域
        const globalShiftX = localShiftX * cos - localShiftY * sin;
        const globalShiftY = localShiftX * sin + localShiftY * cos;

        // 原始中心點 (Start時)
        const oldCx = resizeStart.x + resizeStart.w / 2;
        const oldCy = resizeStart.y + resizeStart.h / 2;

        const newCx = oldCx + globalShiftX;
        const newCy = oldCy + globalShiftY;

        // 4. 更新元件狀態 (Top-Left 座標 = Center - Size/2)
        resizeTarget.currentW = Math.round(newW);
        resizeTarget.currentH = Math.round(newH);
        resizeTarget.x = newCx - resizeTarget.currentW / 2;
        resizeTarget.y = newCy - resizeTarget.currentH / 2;

        const el = document.getElementById(resizeTarget.id);
        updateCabStyle(el, resizeTarget);
        el.querySelector('.size-label').innerText = `${Math.round(resizeTarget.currentW)}x${Math.round(resizeTarget.currentH)} cm (${cmToFeet(resizeTarget.currentW)}x${cmToFeet(resizeTarget.currentH)}尺)`;
    }

    // --------------------------
    // 3. 處理區域頂點拖曳 (Vertex Move)
    // --------------------------
    if (isDraggingVertex && draggedAreaId !== null && draggedVertexIndex !== null) {
        const area = drawnAreas.find(a => a.id === draggedAreaId);
        if (area) {
            const rect = canvas.getBoundingClientRect();
            const safeScale = viewScale || 1.0;
            const newX = (e.clientX - rect.left) / safeScale;
            const newY = (e.clientY - rect.top) / safeScale;
            area.points[draggedVertexIndex] = { x: newX, y: newY };
            
            // [新增] 如果是牆壁，拖曳頂點時必須即時重新計算外擴路徑
            if (area.type === 'wall') {
                const thickness = area.thickness || 15;
                area.pathData = calculateWallPath(area.points, thickness);
            }
            
            renderAllDrawnAreas();
        }
    }

    // --------------------------
    // 4. 處理底圖拖曳
    // --------------------------
    if (isDraggingBg && isBgEditMode) {
        const safeScale = viewScale || 1.0;
        const deltaX = (e.clientX - bgDragStart.x) / safeScale;
        const deltaY = (e.clientY - bgDragStart.y) / safeScale;
        bgPosition.x = bgStartPos.x + deltaX;
        bgPosition.y = bgStartPos.y + deltaY;
        updateBgTransform();
    }
}

function endDrag() {
    if (isDraggingCab) saveState();
    if (isResizing) saveState();
    if (isDraggingVertex) {
        const area = drawnAreas.find(a => a.id === draggedAreaId);
        if (area) {
            const calculatedArea = getPolygonCentroid(area.points).area;
            area.areaInPing = Math.ceil(Math.abs(calculatedArea) / 30000);
            updateQuotation();
            saveState();
        }
    }

    isDraggingCab = false;
    currentDragCab = null;
    isResizing = false;
    resizeTarget = null;
    resizeDirection = null;
    isDraggingBg = false;
    isDraggingVertex = false;
    draggedAreaId = null;
    draggedVertexIndex = null;
    // [新增] 重置標註拖曳狀態
    if (isDraggingAnnotation) {
        saveState();
    }
    isDraggingAnnotation = false;
    currentDragAnnotationId = null;

    const bgLayer = document.getElementById('bg-layer');
    if (bgLayer) bgLayer.style.cursor = isBgEditMode ? 'grab' : 'default';
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
// [v6.1] 此函式已被移至上方共用區域，保留此空殼或移除以維持結構
/*
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
*/

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
    // [v8.3 核心修正] 使用 > 而非 >=，允許邊緣剛好接觸 (Touching is not overlapping)
    // 加入極小的 epsilon (0.01) 避免浮點數運算導致的誤判
    return p1.max > p2.min + 0.01 && p2.max > p1.min + 0.01;
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
    deselectAllAnnotations(); // [新增]
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
        
        // [修正] 恢復顯示名稱文字
        document.getElementById('selected-name').style.display = 'block';
        const nameInput = document.getElementById('selected-name-input');
        if (nameInput) nameInput.style.display = 'none';

        // [新增] 載入分類群組
        const comp = area.linkedComponent || {};
        document.getElementById('selected-group-input').value = comp.group || (area.type === 'floor' ? '地板工程' : '木作');

        // [您的要求] 隱藏尺寸輸入框
        document.getElementById('selected-size-inputs').style.display = 'none';
        const areaTypeText = area.type === 'floor' ? '地板區域' : '天花板區域';
        const areaInPingText = area.type === 'floor'
            ? `${calculateFloorAreaWithLoss(area.areaInPing)} 坪(含損耗)`
            : `${area.areaInPing} 坪`; // [您的要求] 天花板坪數顯示為整數

        document.getElementById('selected-name').innerText = areaTypeText;
        document.getElementById('selected-price').innerText = ''; // 區域沒有單價
        document.getElementById('opacity-slider').parentElement.style.display = 'none'; // 隱藏透明度滑桿
        document.getElementById('note-input').parentElement.style.display = 'block'; // [v5.0 新增] 確保備註欄可見
        document.getElementById('selected-cab-actions').style.display = 'none'; // [您的要求] 隱藏元件操作按鈕
        document.getElementById('note-input').value = area.note || '';

        // [v9.3 新增] 渲染區域的自訂副屬性 (如維修孔、迴風口)
        const addonContainer = document.getElementById('selected-addons');
        if (addonContainer) {
            addonContainer.innerHTML = '';
        // [v9.5] 使用統一函式渲染副屬性面板
        renderAddonsPanel(area.id);

        // [v9.6 修正] 移除重複的副屬性渲染程式碼
        // 舊有的手動渲染邏輯已由 renderAddonsPanel 取代
        // 這樣可以解決「天花板和地板的新增加工項目,輸入格不正確」的問題
        // 並確保所有元件使用統一的 UI 邏輯

            addonContainer.style.display = 'block';
        }

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
    // Lock SVG areas
    const layer = document.getElementById('drawn-areas-layer');
    layer.querySelectorAll('g').forEach(g => {
        g.style.pointerEvents = isLocked ? 'none' : 'auto';
    });

    if (isLocked) {
        deselectAllAreas();
        const selectedCab = placedCabinets.find(c => c.id === selectedCabId);
        if (selectedCab && selectedCab.data.isWall) {
            deselectAll();
        }
    }
}

// [錯誤修正] 新增遺漏的 handleBgUpload 函式
function handleBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const bgImg = document.getElementById('bg-img');
            bgImg.src = e.target.result;
            bgImg.style.display = 'block';
            document.getElementById('bg-controls').classList.remove('opacity-50', 'pointer-events-none');
            // Reset position and scale when new image loaded
            bgPosition = { x: 0, y: 0 };
            bgScale = 1.0;
            updateBgScale(1.0);
            updateBgTransform();
        };
        reader.readAsDataURL(file);
    }
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
        link.download = `design-layout-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();

        // 4. 恢復狀態
        watermark.style.display = 'none';
        if (previouslySelectedCabId) selectCabinet(previouslySelectedCabId);
        if (previouslySelectedAreaId) selectArea(previouslySelectedAreaId);
        showGlobalNotification('圖片下載完成', 3000, 'success');
    });
}

function saveLayout() {
    const constructionAreaEl = document.getElementById('construction-area');
    const layoutData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        placedCabinets: placedCabinets,
        drawnAreas: drawnAreas,
        placedAnnotations: placedAnnotations, // [修正] 加入標註資料
        background: {
            position: bgPosition,
            scale: bgScale,
            src: document.getElementById('bg-img').src
        },
        constructionArea: constructionAreaEl ? constructionAreaEl.value : ''
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layoutData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `layout-${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function loadLayout(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const layoutData = JSON.parse(e.target.result);
            loadLayoutFromData(layoutData);
            showGlobalNotification('佈局已成功載入！', 3000, 'success');
        } catch (error) {
            console.error('載入佈局失敗:', error);
            showGlobalNotification(`載入失敗: ${error.message} `, 8000, 'error');
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
    const subtotals = { ceilingCost: 0, floorCost: 0 }; // 保留相容性，雖然現在統一處理

    // 1. 準備統一的計價項目列表 (包含元件與繪製區域)
    const allItems = [];

    // A. 加入一般元件 (Cabinets)
    placedCabinets.forEach(cab => {
        const { unitPrice, pricingType, name } = cab.data;
        const { currentW, currentH } = cab;
        let qty = 0;
        let unit = '尺';

        // 計算數量與單位
        if (pricingType === 'number') { qty = 1; unit = '個'; }
        else if (pricingType === 'fixed') { qty = 1; unit = '式'; }
        else if (pricingType === 'cai') { qty = cab.caiQty || 0; unit = '才'; }
        else if (pricingType === 'area') { qty = Math.round((cmToFeet(currentW) * cmToFeet(currentH)) * 100) / 100; unit = '才'; }
        else if (pricingType === 'depth') { qty = cmToFeet(currentH); unit = '尺'; }
        else if (pricingType === 'cm') { qty = currentW; unit = 'cm'; }
        else if (pricingType === 'none') { qty = 0; unit = ''; }
        else { qty = cmToFeet(currentW); unit = '尺'; } // default width

        allItems.push({
            source: 'cabinet',
            id: cab.id,
            name: name,
            group: cab.data.group || '未分類',
            unit: unit,
            unitPrice: unitPrice,
            quantity: qty,
            pricingType: pricingType,
            addonsConfig: cab.data.addonsConfig,
            addons: cab.addons,
            customAddons: cab.customAddons,
            note: cab.note
        });
    });

    // B. 加入繪製區域 (Areas: 天花板/地板)
    drawnAreas.forEach(area => {
        if (area.type === 'wall') return; // 牆壁目前不計價

        const comp = area.linkedComponent || {};
        let name = comp.name || (area.type === 'floor' ? '超耐磨木地板' : '平釘天花板');
        let groupName = comp.group || (area.type === 'floor' ? '地板工程' : '木作');
        let qty = area.areaInPing;
        
        // 地板特殊處理：加計損耗
        if (area.type === 'floor') {
            qty = calculateFloorAreaWithLoss(qty);
            name = `${name} (含損耗)`;
        }

        allItems.push({
            source: 'area',
            id: area.id,
            name: name,
            group: groupName,
            unit: '坪',
            unitPrice: comp.unitPrice || (area.type === 'floor' ? 3950 : 3400), // 預設單價 fallback
            quantity: qty,
            pricingType: 'area',
            addonsConfig: comp.addonsConfig,
            addons: area.addons,
            customAddons: area.customAddons,
            note: area.note
        });
    });

    // C. 加入工程標註 (Annotations)
    placedAnnotations.forEach(anno => {
        allItems.push({
            source: 'annotation',
            id: anno.id,
            name: anno.data.name,
            group: anno.data.group || '其他工程',
            unit: '式', // 標註預設為式
            unitPrice: anno.data.unitPrice,
            quantity: 1,
            pricingType: 'fixed',
            addonsConfig: [],
            addons: [],
            customAddons: anno.customAddons,
            note: anno.note
        });
    });

    // 2. 統一處理計價與分組
    const groups = {};
    const groupOrder = [];

    allItems.forEach(item => {
        // [修正] 支援工程標註的主項目覆蓋邏輯
        let currentUnit = item.unit;
        let currentQty = item.quantity;
        let currentUnitPrice = item.unitPrice;
        let basePrice = currentQty * currentUnitPrice;
        
        // 收集所有副屬性 (Sheet定義 + 自訂)
        const itemAddons = [];
        let addonsTotal = 0;

        // Sheet 定義的副屬性
        if (item.addonsConfig && item.addons) {
            item.addonsConfig.forEach((addon, idx) => {
                const qty = item.addons[idx] || 0;
                if (qty > 0) {
                    const total = qty * addon.price;
                    addonsTotal += total;
                    itemAddons.push({ name: addon.name, unit: addon.unit, price: addon.price, qty: qty, total: total });
                }
            });
        }

        // 自訂副屬性
        if (item.customAddons) {
            item.customAddons.forEach((addon, idx) => {
                // [核心修正] 若為工程標註且是第一項，則覆蓋主項目的計價資訊，且不列入副屬性清單
                if (item.source === 'annotation' && idx === 0) {
                    currentUnitPrice = parseFloat(addon.price) || 0;
                    currentQty = parseFloat(addon.qty) || 0;
                    currentUnit = addon.unit || '式';
                    basePrice = currentUnitPrice * currentQty;
                } else {
                    // 其他項目照常處理
                    if (addon.qty > 0) {
                        const price = parseFloat(addon.price) || 0;
                        const total = addon.qty * price;
                        addonsTotal += total;
                        itemAddons.push({ name: addon.name, unit: addon.unit, price: price, qty: parseFloat(addon.qty), total: total });
                    }
                }
            });
        }

        // 若總價為 0 則不列入報價單
        if (basePrice + addonsTotal === 0) return;

        grandTotal += (basePrice + addonsTotal);

        // 更新舊版相容的 subtotals (僅供參考)
        if (item.group === '天花板工程') subtotals.ceilingCost += (basePrice + addonsTotal);
        if (item.group === '地板工程') subtotals.floorCost += (basePrice + addonsTotal);

        // 產生分組 Key
        // 規則：名稱、單價、備註、副屬性內容完全相同者合併
        // [修正] 為了符合「併入一般元件流程」的要求，我們放寬分組限制，
        // 只要屬性相同就合併，不再區分是 Cabinet 還是 Area
        const addonsKey = JSON.stringify(itemAddons.map(a => `${a.name}-${a.qty}`));
        const key = `${item.name}_${currentUnitPrice}_${item.note || ''}_${addonsKey}`;

        if (!groups[key]) {
            groups[key] = {
                isConstruction: item.source === 'area', // 標記來源
                name: item.name,
                group: item.group,
                unit: currentUnit,
                quantity: 0,
                totalPrice: 0,
                note: item.note || '',
                addons: {} 
            };
            groupOrder.push(key);
        }

        const group = groups[key];
        group.quantity += currentQty;
        group.totalPrice += basePrice;

        // 合併副屬性到群組中
        itemAddons.forEach(addon => {
            const addonKey = `${addon.name}_${addon.unit}_${addon.price}`;
            if (!group.addons[addonKey]) {
                group.addons[addonKey] = {
                    name: `└ ${addon.name}`,
                    unit: addon.unit,
                    quantity: 0,
                    totalPrice: 0
                };
            }
            group.addons[addonKey].quantity += addon.qty;
            group.addons[addonKey].totalPrice += addon.total;
        });
    });

    // 3. 將群組轉換回 lineItems 陣列
    groupOrder.forEach(key => {
        const group = groups[key];
        lineItems.push({
            isConstruction: group.isConstruction,
            name: group.name,
            unit: group.unit,
            group: group.group, // [新增] 傳遞群組
            quantity: group.quantity,
            totalPrice: group.totalPrice,
            note: group.note
        });

        // 加入該項目的副屬性
        if (group.addons) {
            Object.values(group.addons).forEach(addon => {
                lineItems.push({
                    isConstruction: false,
                    name: addon.name,
                    unit: addon.unit,
                    group: group.group, // [新增] 副屬性跟隨主項目的群組
                    quantity: addon.quantity,
                    totalPrice: addon.totalPrice,
                    note: ''
                });
            });
        }
    });

    // [新增] 報價單分組排序邏輯
    const groupedLineItems = [];
    const itemGroups = {};
    
    lineItems.forEach(item => {
        const g = item.group || '其他';
        if (!itemGroups[g]) itemGroups[g] = [];
        itemGroups[g].push(item);
    });

    // 定義群組顯示順序
    // [修正] 擴充排序清單，整合 Google Sheet 的分類名稱 (簡稱) 與系統自動產生的分類 (全稱)
    const preferredOrder = [
        '保護工程', 
        '拆除工程', 
        '其他工程', // [新增]
        '水電', '水電工程', 
        '泥作工程', 
        '木作', '木作工程', 
        '天花板工程', 
        '油漆工程', 
        '櫃體', '系統櫃', 
        '地板工程', 
        '門片', '門窗工程',
        '玻璃工程', 
        '衛浴', '衛浴設備',
        '家具家電', '家具', '家電',
        '雜項工程', 
        '清潔工程'
    ];
    
    const sortedGroupNames = Object.keys(itemGroups).sort((a, b) => {
        const idxA = preferredOrder.indexOf(a);
        const idxB = preferredOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    sortedGroupNames.forEach(gName => {
        // 加入標題列 (Header)
        groupedLineItems.push({ isHeader: true, name: gName });
        // 加入該群組的項目
        itemGroups[gName].forEach(item => groupedLineItems.push(item));
    });

    return { lineItems: groupedLineItems, subtotals, grandTotal };
}


// [錯誤修正] 新增遺漏的 showBudgetModal 和 closeBudgetModal 函式
function showBudgetModal() {
    // [您的要求] 核心重構：此函式現在只負責「顯示」
    const quotation = calculateFullQuotation();
    const tableBody = document.getElementById('budget-table-body');
    tableBody.innerHTML = '';
    let itemIndex = 1;

    quotation.lineItems.forEach(item => {
        if (item.isHeader) {
            // [新增] 渲染標題列
            const row = `
                <tr class="bg-gray-100 font-bold">
                    <td class="px-2 py-2 border-b text-center"></td>
                    <td class="px-2 py-2 border-b text-gray-700" colspan="5">${item.name}</td>
                </tr>`;
            tableBody.innerHTML += row;
        } else {
            const row = `
                <tr>
                    <td class="px-2 py-2 border-b text-center">${itemIndex++}</td>
                    <td class="px-2 py-2 border-b">${item.name}</td>
                    <td class="px-2 py-2 border-b">${item.unit}</td>
                    <td class="px-2 py-2 border-b text-center">${item.quantity > 0 ? item.quantity : ''}</td>
                    <td class="px-2 py-2 border-b text-right">${item.totalPrice > 0 ? '$' + item.totalPrice.toLocaleString() : ''}</td>
                    <td class="px-2 py-2 border-b text-xs text-gray-600">${item.note}</td>
                </tr>`;
            tableBody.innerHTML += row;
        }
    });

    document.getElementById('modal-total-price').innerText = `$${quotation.grandTotal.toLocaleString()} `;
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
        if (item.isHeader) {
            // [新增] CSV 標題列
            csvContent += `,"${item.name}",,,,\n`;
        } else {
            const row = [
                itemIndex++,
                `"${item.name.replace(/"/g, '""')}"`, // 處理項目名稱中的引號
                item.unit,
                item.quantity > 0 ? item.quantity : '', // [修正] 0不顯示
                item.totalPrice > 0 ? item.totalPrice : '', // [修正] 0元不顯示
                `"${(item.note || '').replace(/"/g, '""')}"` // 處理備註中的引號
            ];
            csvContent += row.join(',') + '\n';
        }
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
    } else if (type === 'wall') {
        // 繪製牆壁時，通常不需要隱藏其他層，或者可以選擇隱藏天花板以便看清牆壁位置
    }
    renderAllDrawnAreas();
}

function handleDrawingClick(e) {
    const rect = canvas.getBoundingClientRect();
    // [v8.16 修復] 繪圖點擊座標也必須考慮 viewScale，否則縮放後畫出來的點會偏離
    const safeScale = viewScale || 1.0;
    let x = (e.clientX - rect.left) / safeScale;
    let y = (e.clientY - rect.top) / safeScale;

    // [v9.1] 點擊時也應用相同的吸附與正交邏輯
    if (isDrawing) {
        // 1. 吸附起點
        if (currentDrawingPoints.length > 2) {
            const startPoint = currentDrawingPoints[0];
            const dist = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
            if (dist < 20) {
                finishDrawing(); // 點擊起點直接完成
                return;
            }
        }
        // 2. 正交鎖定
        if (!e.altKey && currentDrawingPoints.length > 0) {
            const lastPoint = currentDrawingPoints[currentDrawingPoints.length - 1];
            const dx = Math.abs(x - lastPoint.x);
            const dy = Math.abs(y - lastPoint.y);
            if (dx > dy) {
                y = lastPoint.y;
            } else {
                x = lastPoint.x;
            }
        }
    }

    currentDrawingPoints.push({ x, y });
    // [您的要求] 新增：更新繪圖預覽
    updateDrawingPreview();
}

// [您的要求] 新增：更新繪圖預覽的函式
function updateDrawingPreview(tempNextPoint = null) {
    const polyline = document.getElementById('drawing-preview-polyline');
    const polygon = document.getElementById('drawing-preview-polygon');
    const verticesGroup = document.getElementById('drawing-preview-vertices');

    let previewPoints = [...currentDrawingPoints];
    if (tempNextPoint) {
        previewPoints.push(tempNextPoint);
    }
    const pointsStr = previewPoints.map(p => `${p.x},${p.y}`).join(' ');

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
    // [您的要求] 繪製牆壁時不顯示預覽填充
    if (currentDrawingType === 'wall') {
        polygon.style.display = 'none';
    } else {
        // 當有超過兩個點時，才顯示預覽的閉合區域
        if (polygon && previewPoints.length > 2) {
            polygon.setAttribute('points', pointsStr);
            polygon.style.display = 'block';
        } else if (polygon) {
            polygon.style.display = 'none';
        }
    }
    document.getElementById('drawing-preview-layer').style.display = 'block';
}

function finishDrawing() {
    console.log('finishDrawing called. Points:', currentDrawingPoints.length); // [Debug]

    // [核心重構] 根據您的需求，修改牆壁繪製邏輯
    if (currentDrawingType === 'wall') { // 牆壁繪製模式
        if (currentDrawingPoints.length < 3) {
            showGlobalNotification('至少需要 3 個頂點才能形成閉合牆體。', 3000, 'error');
            cancelDrawing();
            return;
        }

        // 1. 自動閉合與校正
        const firstPoint = currentDrawingPoints[0];
        let lastPoint = currentDrawingPoints[currentDrawingPoints.length - 1];

        // 檢查最後一點與第一點的垂直/水平對齊 (Ortho Snap)
        if (Math.abs(lastPoint.x - firstPoint.x) < 10) { // 10px 容錯
            lastPoint.x = firstPoint.x;
        }
        if (Math.abs(lastPoint.y - firstPoint.y) < 10) {
            lastPoint.y = firstPoint.y;
        }

        // [修正] 保持頂點唯一性：如果最後一點與第一點重合（使用者點擊起點結束），則移除最後一點
        // 這樣可以避免雙重頂點導致拖曳時的問題，且 SVG polygon 會自動閉合
        if (lastPoint.x === firstPoint.x && lastPoint.y === firstPoint.y) {
            currentDrawingPoints.pop();
        }

        const wallThickness = parseInt(document.getElementById('wall-thickness-input').value) || 15;
        
        // [修正] 使用新的輔助函式計算路徑，自動判斷方向確保向外擴
        const finalPathData = calculateWallPath(currentDrawingPoints, wallThickness);

        // 4. 建立新的 Area 物件，存入 drawnAreas 陣列
        const newWallArea = {
            id: `area-${Date.now()}`,
            type: 'wall',
            points: currentDrawingPoints, // 儲存原始點位以便後續編輯
            thickness: wallThickness, // [新增] 儲存牆壁厚度，以便後續編輯時重算
            pathData: finalPathData, // 儲存計算好的 SVG 路徑
            areaInPing: 0, // 牆壁通常不算坪數，但保留欄位
            note: ''
        };

        drawnAreas.push(newWallArea);
        renderAllDrawnAreas();
        saveState();
        updateQuotation();
        cancelDrawing();

    } else { // 原有的天花板/地板邏輯
        if (currentDrawingPoints.length < 3) {
            showGlobalNotification('至少需要 3 個頂點才能形成一個區域。', 3000, 'error');
            cancelDrawing();
            return;
        }
        try {
            const centroidData = getPolygonCentroid(currentDrawingPoints);
            const calculatedArea = centroidData.area;
            const areaInPing = Math.ceil(Math.abs(calculatedArea) / 30000);

            // [v9.4 修正] 嘗試連結元件資料 (支援天花板與地板)
            let linkedComponent = null;
            let targetName = '';

            // [v9.7] 定義預設的元件資料 (Fallback)，確保即使 Sheet 未載入也能正常運作
            const ceilingDef = {
                name: '平釘天花板', group: '木作', unitPrice: 3400, addonsConfig: [
                    { name: '迴風口', unit: '處', price: 2000 },
                    { name: '維修孔(60X60內)', unit: '處', price: 1200 },
                    { name: '特殊加工(留縫)', unit: '公分', price: 20 }
                ]
            };
            const floorDef = {
                name: '超耐磨木地板', group: '地板工程', unitPrice: 3950, addonsConfig: [
                    { name: '升級12mm', unit: '坪', price: 1000 },
                    { name: '不足5坪加基本工資', unit: '式', price: 2500 },
                    { name: '傢俱位移', unit: '式', price: 2000 }
                ]
            };

            if (currentDrawingType === 'ceiling') {
                targetName = '平釘天花板';
                linkedComponent = ceilingDef;
            } else if (currentDrawingType === 'floor') {
                targetName = '超耐磨木地板'; // [v9.7 修正] 名稱對應 Sheet 資料
                linkedComponent = floorDef;
            }

            if (targetName) {
                for (const group in cabinetCategories) {
                    const found = cabinetCategories[group].find(c => c.name === targetName);
                    if (found) { linkedComponent = found; break; } // 若 Sheet 中有定義，則覆蓋預設值
                }
            }

            drawnAreas.push({
                id: `area-${Date.now()}`,
                type: currentDrawingType,
                points: [...currentDrawingPoints],
                areaInPing: areaInPing,
                note: '',
                customAddons: [], // [v9.3] 初始化自訂副屬性
                linkedComponent: linkedComponent || {}, // [v9.3] 連結元件資料
                addons: (linkedComponent && linkedComponent.addonsConfig) ? new Array(linkedComponent.addonsConfig.length).fill(0) : [] // [v9.4] 初始化預設副屬性數量
            });
            renderAllDrawnAreas();
            updateQuotation();
            saveState();
            cancelDrawing(true); // [v9.6] 確保傳入 true 以靜默取消，解決「地板連起來後會顯示繪圖已取消」的問題
        } catch (e) {
            console.error('finishDrawing error:', e);
            showGlobalNotification('繪圖錯誤: ' + e.message, 3000, 'error');
            cancelDrawing();
        }
    }
}

function cancelDrawing(silent = false) {
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

    // 恢復元件的透明度與點擊事件
    renderAllCabinets();
    if (!silent) showGlobalNotification('繪圖已取消', 2000, 'info');
}
// [錯誤修正] 新增遺漏的 startCabDrag, startResize, toggleBgMode, updateBgScale 函式
function startCabDrag(e, cab) {
    if (e.button !== 0 || isBgEditMode || isDrawing) return;
    e.stopPropagation();
    isDraggingCab = true;
    currentDragCab = cab;
    selectCabinet(cab.id);
    const rect = canvas.getBoundingClientRect();
    // 注意：拖曳開始時不儲存狀態，在 endDrag 時才儲存
    // [v8.8 修正] 紀錄拖曳起始點時，需將滑鼠目前位置轉換為「畫布內座標」
    // 公式: (clientX - rect.left) / viewScale
    // [v8.12 修正] 加入安全檢查，防止 viewScale 為 0 或 undefined 導致座標 NaN 造成元件消失
    const safeScale = viewScale || 1.0;
    const canvasX = (e.clientX - rect.left) / safeScale;
    const canvasY = (e.clientY - rect.top) / safeScale;

    if (isNaN(canvasX) || isNaN(canvasY)) {
        console.error('拖曳座標計算錯誤 (NaN)', { clientX: e.clientX, rect, safeScale });
        return; // 防止錯誤數據污染元件位置
    }

    dragOffset = { x: canvasX - cab.x, y: canvasY - cab.y };
    startPos = { x: cab.x, y: cab.y };
}

function startResize(id, e, direction = null) {
    if (e.button !== 0) return;
    e.stopPropagation();
    isResizing = true;
    resizeDirection = direction; // [v9.0] 記錄拉伸方向

    resizeTarget = placedCabinets.find(c => c.id === id);
    if (resizeTarget) {
        // [v9.0] 記錄起始滑鼠位置與原始幾何狀態
        resizeStart = {
            checkX: e.clientX, // 用 checkX 區別於 x/y (為了不混淆)
            checkY: e.clientY,
            x: resizeTarget.x,
            y: resizeTarget.y,
            w: resizeTarget.currentW,
            h: resizeTarget.currentH
        };
    }
}

// [新增] 開始拖曳標註
function startAnnotationDrag(e, anno, type) {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDraggingAnnotation = true;
    currentDragAnnotationId = anno.id;
    annotationDragType = type;
    selectAnnotation(anno.id);
    
    const rect = canvas.getBoundingClientRect();
    const safeScale = viewScale || 1.0;
    const mouseX = (e.clientX - rect.left) / safeScale;
    const mouseY = (e.clientY - rect.top) / safeScale;

    // 計算偏移量，防止跳動
    if (type === 'box') {
        annotationDragOffset = { x: mouseX - anno.x, y: mouseY - anno.y };
    } else {
        annotationDragOffset = { x: 0, y: 0 };
    }
}

function toggleBgMode(enabled) {
    isBgEditMode = enabled;
    const bgLayer = document.getElementById('bg-layer');
    const bgControls = document.getElementById('bg-controls');
    
    if (isBgEditMode) {
        bgLayer.style.cursor = 'grab';
        bgLayer.style.pointerEvents = 'auto';
        bgControls.classList.remove('opacity-50', 'pointer-events-none');
        showGlobalNotification('底圖調整模式：可拖曳底圖或使用滑桿縮放', 3000, 'info');
    } else {
        bgLayer.style.cursor = 'default';
        bgLayer.style.pointerEvents = 'none';
        bgControls.classList.add('opacity-50', 'pointer-events-none');
    }
}

function updateBgScale(scale) {
    bgScale = scale;
    document.getElementById('bg-scale').value = bgScale;
    document.getElementById('bg-scale-num').value = bgScale;
    updateBgTransform();
}



// [v8.8 新增] 更新畫布縮放 (Zoom In/Out) - 不影響資料結構，只改變顯示比例
function updateViewZoom(newScale) {
    if (newScale < 0.1 || newScale > 5.0) return; // 限制縮放範圍
    viewScale = newScale;

    // 顯示當前比例 (四捨五入到整數百分比)
    const percentage = Math.round(viewScale * 100);
    const displayEl = document.getElementById('zoom-level-display');
    if (displayEl) displayEl.innerText = `${percentage}%`;

    // 應用縮放到 canvas
    // 注意：依照使用者需求 [連同底圖及元件、比例不變]，我們直接對 canvas 應用 transform: scale
    // 為了保持畫布左上角固定，使用 transform-origin: top left
    canvas.style.transformOrigin = 'top left';
    canvas.style.transform = `scale(${viewScale})`;

    // [v8.12 修復] 解決 Zoom In 時無法捲動看到完整內容的問題
    // 當使用 CSS transform 放大時，元素佔據的 layout 空間不會改變，導致捲軸不會出現。
    // 我們透過動態設定 margin 來強制撐大 (或縮小) 父容器的 layout 空間。
    const originalSize = 2000; // 畫布原始大小

    // 計算視覺尺寸與原始尺寸的差值
    // scale > 1: 正值，增加右/下 margin，撐大捲動範圍
    // scale < 1: 負值，減少 layout 寬高，讓 margin: auto 能正確置中縮小後的畫布
    const extraSpace = originalSize * (viewScale - 1);

    canvas.style.marginRight = `${extraSpace}px`;
    canvas.style.marginBottom = `${extraSpace}px`;
}

// [v8.8 新增] 初始化縮放控制
function initZoomControls() {
    document.getElementById('zoom-in-btn').addEventListener('click', () => updateViewZoom(viewScale + 0.1));
    document.getElementById('zoom-out-btn').addEventListener('click', () => updateViewZoom(viewScale - 0.1));
    document.getElementById('zoom-reset-btn').addEventListener('click', () => updateViewZoom(1.0));

    document.addEventListener('wheel', (e) => {
        // [v9.8 新增] 底圖調整模式下，滾輪直接縮放底圖
        if (isBgEditMode) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            updateBgScale(Math.max(0.1, bgScale + delta));
            return;
        }

        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            updateViewZoom(viewScale + delta);
        }
    }, { passive: false });
}

// [v8.7 修復] 補回遺失的 updateBgTransform 函式，恢復底圖調整功能
function updateBgTransform() {
    const bgImg = document.getElementById('bg-img');
    if (bgImg) {
        // 設定 transform-origin 為左上角，讓位移和縮放更直觀
        bgImg.style.transformOrigin = '0 0';
        bgImg.style.transform = `translate(${bgPosition.x}px, ${bgPosition.y}px) scale(${bgScale})`;
        // 確保在調整模式下顯示
        bgImg.style.display = 'block';
    }
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
    
    // [v9.8 修正] 僅更新價格顯示，不重新選取 (避免輸入框失去焦點)
    updateQuotation();
    updateSelectedPriceDisplay(cab.id);
}

// [修改] 處理才數變更
function handleCaiQtyChange() {
    if (!selectedCabId) return;
    const cab = placedCabinets.find(c => c.id === selectedCabId);
    if (!cab || cab.data.pricingType !== 'cai') return;

    const newQty = parseFloat(document.getElementById('selected-cai-qty').value);
    if (isNaN(newQty) || newQty < 0) {
        showGlobalNotification('請輸入有效的才數。', 3000, 'error');
        document.getElementById('selected-cai-qty').value = cab.caiQty || 0; // Restore old value
        return;
    }

    cab.caiQty = newQty;
    saveState();
    updateQuotation();
    // [v9.8 修正] 僅更新價格顯示
    updateSelectedPriceDisplay(cab.id);
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
        placedAnnotations: JSON.parse(JSON.stringify(placedAnnotations)), // [新增]
        background: {
            position: bgPosition,
            scale: bgScale,
            src: document.getElementById('bg-img').src
        }
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
    placedAnnotations = state.placedAnnotations ? JSON.parse(JSON.stringify(state.placedAnnotations)) : []; // [新增]

    renderAllCabinets();
    renderAllDrawnAreas();
    renderAllAnnotations(); // [新增]
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

// [新增] 說明 Modal 控制
function openHelpModal() {
    document.getElementById('help-modal').style.display = 'flex';
}

function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

function bindEventListeners() {
    // 全域事件
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('keydown', handleKeyDown);
    document.body.addEventListener('click', handleGlobalClick);

    // [v8.8 新增] 初始化縮放控制
    initZoomControls();

    // 畫布事件
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        if (isBgEditMode) return showGlobalNotification("請先關閉底圖模式", 3000, 'error');
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const rect = canvas.getBoundingClientRect();
        // [v8.8 修正] 座標計算需除以 viewScale，以抵銷 CSS Transform 的影響
        addCabinet(data, (e.clientX - rect.left) / viewScale - data.width / 2, (e.clientY - rect.top) / viewScale - data.depth / 2);
    });

    // [v8.5 優化] 底圖拖曳邏輯重構：移至畫布層級監聽，解決點不到圖的問題
    // 原本綁定在 bg-layer，但 bg-layer 可能因圖片位移而跑掉或太小
    canvas.addEventListener('mousedown', (e) => {
        if (isBgEditMode) {
            // 在底圖模式下，點擊畫布任何地方都可以拖曳底圖 (更直覺)
            e.preventDefault();
            e.stopPropagation();
            isDraggingBg = true;
            bgDragStart = { x: e.clientX, y: e.clientY };
            bgStartPos = { x: bgPosition.x, y: bgPosition.y };
            document.getElementById('bg-layer').style.cursor = 'grabbing';
        }
    });

    // [v8.16 修復] 綁定繪圖點擊事件，讓使用者可以放置頂點
    // 原本的程式碼中似乎遺漏了這個綁定，導致點擊畫布無反應
    canvas.addEventListener('click', (e) => {
        if (isDrawing) {
            handleDrawingClick(e);
        }
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
    document.getElementById('draw-wall-btn').addEventListener('click', () => startDrawing('wall'));
    document.getElementById('show-ceilings-toggle').addEventListener('change', renderAllDrawnAreas);
    document.getElementById('show-floors-toggle').addEventListener('change', renderAllDrawnAreas);
    if (document.getElementById('show-walls-toggle')) document.getElementById('show-walls-toggle').addEventListener('change', renderAllDrawnAreas);
    
    // [新增] 標註與家具圖層切換
    document.getElementById('show-cabinets-toggle').addEventListener('change', renderAllCabinets);
    document.getElementById('show-annotations-toggle').addEventListener('change', renderAllAnnotations);
    document.getElementById('add-annotation-btn').addEventListener('click', addAnnotation);

    // [修正] 鎖定牆壁時，同時更新元件與繪圖區域
    if (document.getElementById('lock-walls-toggle')) document.getElementById('lock-walls-toggle').addEventListener('change', () => {
        renderAllCabinets();
        renderAllDrawnAreas();
    });
    // [修正] 鎖定繪圖區域時，使用 renderAllDrawnAreas 重繪以套用 pointer-events
    document.getElementById('lock-drawn-areas').addEventListener('change', (e) => {
        if (e.target.checked) deselectAllAreas();
        renderAllDrawnAreas();
    });
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
    document.getElementById('selected-group-input').addEventListener('change', updateSelectedGroup); // [新增]
    document.getElementById('selected-width').addEventListener('change', handleDimensionChange);
    document.getElementById('selected-height').addEventListener('change', handleDimensionChange);
    // [修改] 為才數輸入框綁定事件
    document.getElementById('selected-cai-qty').addEventListener('change', handleCaiQtyChange);

    // [您的要求] 為資訊視窗中的新按鈕綁定事件
    document.getElementById('selected-rotate-btn').addEventListener('click', () => rotateSelectedCab());
    // [新增] 綁定鏡像按鈕事件
    document.getElementById('selected-mirror-btn').addEventListener('click', () => mirrorSelectedCab());
    // [您的要求] 綁定新的複製按鈕事件
    document.getElementById('selected-duplicate-btn').addEventListener('click', () => duplicateSelectedCab());
    document.getElementById('selected-delete-btn').addEventListener('click', () => deleteCabById(selectedCabId));

    // [新增] 綁定圖層移動按鈕事件
    document.getElementById('selected-layer-up-btn').addEventListener('click', () => moveSelectedCabLayer('up'));
    document.getElementById('selected-layer-down-btn').addEventListener('click', () => moveSelectedCabLayer('down'));


    // 預算明細 Modal
    document.getElementById('budget-modal-close-btn').addEventListener('click', closeBudgetModal);
    document.getElementById('export-csv-btn').addEventListener('click', exportBudgetAsCSV);
    const printBtn = document.getElementById('print-budget-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

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

    // [新增] 說明 Modal 事件
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.addEventListener('click', openHelpModal);

    const helpCloseBtn = document.getElementById('help-modal-close-btn');
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);

    // 點擊背景關閉說明 Modal
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) closeHelpModal();
        });
    }



    // 預算與估價
    document.getElementById('show-budget-modal-btn').addEventListener('click', showBudgetModal);

    // 視窗拖曳
    initDraggable('info-window');
}

// [牆壁繪製模式修正] 新增輔助函式：計算兩線段的交點
function getLineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null; // 平行線

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
    };
}

// [牆壁繪製模式修正] 新增輔助函式：計算多邊形的外擴點位
function offsetPolygon(points, distance) {
    const offsetSegments = [];
    const numPoints = points.length;

    // 1. 計算每條邊向外平移後的線段
    for (let i = 0; i < numPoints; i++) {
        const p1 = points[i];
        // 處理閉合路徑的最後一條邊
        const p2 = points[(i + 1) % numPoints];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        // 計算垂直於邊的法向量 (Normal Vector)
        const nx = -dy / len;
        const ny = dx / len;

        // 將線段的兩個端點沿法向量方向平移
        offsetSegments.push({
            p1: { x: p1.x + nx * distance, y: p1.y + ny * distance },
            p2: { x: p2.x + nx * distance, y: p2.y + ny * distance }
        });
    }

    const newVertices = [];
    const numSegments = offsetSegments.length;

    // 2. 計算相鄰兩條平移線段的交點，形成新的頂點
    for (let i = 0; i < numSegments; i++) {
        // 當前線段與前一條線段
        const currentSeg = offsetSegments[i];
        const prevSeg = offsetSegments[(i + numSegments - 1) % numSegments];

        const intersection = getLineIntersection(prevSeg.p1, prevSeg.p2, currentSeg.p1, currentSeg.p2);

        if (intersection) {
            newVertices.push(intersection);
        } else {
            // 如果平行（例如畫了一個來回的直線），則直接使用當前線段的起點
            newVertices.push(currentSeg.p1);
        }
    }
    return newVertices;
}

// [牆壁繪製模式修正] 新增輔助函式：將點位陣列轉換為 SVG Path 的 'd' 屬性字串
function getPolygonPathData(points) {
    if (!points || points.length === 0) return "";
    const pathParts = points.map((p, i) => {
        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    });
    return `${pathParts.join(' ')} Z`;
}

// [牆壁繪製模式修正] 新增核心函式：計算牆壁的完整路徑 (自動判斷方向)
function calculateWallPath(points, thickness) {
    if (!points || points.length < 3) return "";

    // 1. 判斷繪製方向 (順時針或逆時針)
    // 使用多邊形面積公式 (Shoelace formula) 的正負號來判斷
    // getPolygonCentroid 已經有計算面積的邏輯，我們直接利用它
    const centroid = getPolygonCentroid(points);
    const signedArea = centroid.area;

    // 2. 決定外擴方向
    // 在 Canvas/SVG 座標系中 (Y軸向下)：
    // 順時針 (CW) -> 面積 > 0 -> 法向量指向外 -> distance 應為正
    // 逆時針 (CCW) -> 面積 < 0 -> 法向量指向內 -> distance 應為負 (反轉法向量指向外)
    const dist = signedArea < 0 ? -thickness : thickness;

    // 3. 計算外圈座標
    const outerPoints = offsetPolygon(points, dist);

    // 4. 組合路徑
    const outerPath = getPolygonPathData(outerPoints);
    // 內圈 (原始路徑)
    // 為了配合 fill-rule="evenodd" 或是 "nonzero"，通常建議內外圈方向相反
    // 但對於 evenodd 來說，只要是兩個分離的迴圈，方向其實不影響挖洞效果
    const innerPath = getPolygonPathData(points);

    return `${outerPath} ${innerPath}`;
}



// ========== [新增] 自動儲存與防崩潰機制 ==========

const AUTO_SAVE_KEY = 'layoutPlanner_autosave_v1';
const AUTO_SAVE_INTERVAL = 60000; // 60秒自動儲存一次

function initAutoSave() {
    // 1. 啟動定時器
    setInterval(autoSave, AUTO_SAVE_INTERVAL);

    // 2. 檢查是否有意外中斷的備份
    checkAndRestoreBackup();
}

function autoSave(silent = false) {
    try {
        // 收集當前狀態
        const layoutData = {
            version: '2.0',
            timestamp: new Date().getTime(), // 使用 timestamp 方便比較
            prettyTime: new Date().toLocaleString(), // 易讀的時間格式
            placedCabinets: placedCabinets,
            drawnAreas: drawnAreas,
            placedAnnotations: placedAnnotations, // [新增]
            background: {
                position: bgPosition,
                scale: bgScale,
                src: document.getElementById('bg-img').src
            }
        };

        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(layoutData));

        if (!silent) {
            // 使用非侵入式的方式提示 (只顯示 1 秒)
            showGlobalNotification('☁️ 進度已自動備份', 1000, 'info');
        }
    } catch (e) {
        console.error('自動備份失敗 (可能是 LocalStorage 已滿):', e);
    }
}

function checkAndRestoreBackup() {
    try {
        const json = localStorage.getItem(AUTO_SAVE_KEY);
        if (!json) return;

        const data = JSON.parse(json);
        // 檢查備份時間，如果距離現在超過 24 小時則忽略 (避免載入太舊的資料)
        const now = new Date().getTime();
        if (now - data.timestamp > 24 * 60 * 60 * 1000) {
            return;
        }

        // 詢問使用者是否還原
        if (confirm(`檢測到您有未儲存的進度 (${data.prettyTime})，是否還原？\n\n按「確定」還原，按「取消」將忽略此備份。`)) {
            loadLayoutFromData(data);
        } else {
            // 如果使用者選擇不還原，是否要清除備份？m
        }
    } catch (e) {
        console.error('檢查備份失敗:', e);
    }
}

// 抽取原本 loadLayout 的核心邏輯，以便重用
function loadLayoutFromData(layoutData) {
    placedCabinets = layoutData.placedCabinets || [];
    drawnAreas = layoutData.drawnAreas || [];
    placedAnnotations = layoutData.placedAnnotations || []; // [新增]

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

    if (layoutData.constructionArea !== undefined) {
        const constructionAreaEl = document.getElementById('construction-area');
        if (constructionAreaEl) constructionAreaEl.value = layoutData.constructionArea;
    }

    renderAllCabinets();
    renderAllDrawnAreas();
    renderAllAnnotations(); // [新增]
    updateBgTransform();
    saveState();
    updateQuotation();
    deselectAll();
    deselectAllAreas();

    showGlobalNotification('✅ 已成功還原備份進度', 3000, 'success');
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
        // [修正] 使用與 saveLayout 相同的資料結構，確保載入時格式正確
        const constructionAreaEl = document.getElementById('construction-area');
        const layoutData = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            placedCabinets: placedCabinets,
            drawnAreas: drawnAreas,
            placedAnnotations: placedAnnotations, // [新增]
            background: {
                position: bgPosition,
                scale: bgScale,
                src: document.getElementById('bg-img').src
            },
            constructionArea: constructionAreaEl ? constructionAreaEl.value : ''
        };
        zip.file(`佈局資料_${dateString}.json`, JSON.stringify(layoutData, null, 2));

        // 3. 加入預算 CSV 檔案
        const quotation = calculateFullQuotation();
        const headers = ['項次', '項目', '單位', '數量', '總價', '備註'];
        let csvContent = headers.join(',') + '\n';
        let itemIndex = 1;

        quotation.lineItems.forEach(item => {
            if (item.isHeader) {
                csvContent += `,"${item.name}",,,,\n`;
            } else {
                const row = [
                    itemIndex++,
                    `"${item.name.replace(/"/g, '""')}"`,
                    item.unit,
                    item.quantity,
                    item.totalPrice,
                    `"${(item.note || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(',') + '\n';
            }
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

    // [v7.0 新增] 啟動自動儲存機制
    initAutoSave();
};

// [v9.8 新增] 僅更新資訊面板的價格顯示 (不重繪 DOM，防止焦點跳離)
function updateSelectedPriceDisplay(id) {
    let target = placedCabinets.find(c => c.id === id);
    if (!target) target = placedAnnotations.find(a => a.id === id);
    if (!target) return; // 區域通常沒有單價顯示，或邏輯不同

    const priceEl = document.getElementById('selected-price');
    if (!priceEl) return;

    let priceText = '此項目不計價';
    const price = calculatePrice(target);

    if (target.data.pricingType !== 'none') {
        if (target.data.pricingType === 'width') {
            priceText = `單價: $${target.data.unitPrice.toLocaleString()} / 尺 | 總價: $${price.toLocaleString()}`;
        } else if (target.data.pricingType === 'cai' || target.data.pricingType === 'area') {
            priceText = `單價: $${target.data.unitPrice.toLocaleString()} / 才 | 總價: $${price.toLocaleString()}`;
        } else if (target.data.pricingType === 'cm') {
            priceText = `單價: $${target.data.unitPrice.toLocaleString()} / cm | 總價: $${price.toLocaleString()}`;
        } else {
            priceText = `總價: $${price.toLocaleString()}`;
        }
    }
    priceEl.innerText = priceText;
}

// [新增] 全域函式：更新元件副屬性 (供 HTML onchange 呼叫)
window.updateCabinetAddon = function(id, index, value) {
    const cab = placedCabinets.find(c => c.id === id);
    if (!cab || !cab.addons) return;
    
    cab.addons[index] = parseInt(value) || 0;
    
    saveState();
    updateQuotation();
    // [v9.8 修正] 僅更新價格，不重繪面板
    updateSelectedPriceDisplay(id);
};

// [v9.4 新增] 全域函式：更新區域預設副屬性
window.updateAreaAddon = function(id, index, value) {
    const area = drawnAreas.find(a => a.id === id);
    if (!area || !area.addons) return;
    
    area.addons[index] = parseInt(value) || 0;
    
    saveState();
    updateQuotation();
    // 區域沒有顯示單價在面板上，所以不需要 updateSelectedPriceDisplay
};

// [新增] 全域函式：新增自訂副屬性
window.addCustomAddon = function(id) {
    // [v9.3 修正] 同時支援 Cabinet 和 DrawnArea
    let target = placedCabinets.find(c => c.id === id);
    let isArea = false;
    let isAnnotation = false;
    if (!target) {
        target = drawnAreas.find(a => a.id === id);
        if (target) isArea = true;
    }
    // [修正] 支援標註
    if (!target) {
        target = placedAnnotations.find(a => a.id === id);
        if (target) isAnnotation = true;
    }
    if (!target) return;
    
    if (!target.customAddons) target.customAddons = [];
    
    // [修正] 若為標註且是第一筆，預設名稱為「基本費用」
    const isAnno = target.id.startsWith('anno-');
    const defaultName = (isAnno && target.customAddons.length === 0) ? '基本費用' : '';
    
    target.customAddons.push({ name: defaultName, unit: '', price: 0, qty: 1, category: '' });
    saveState();
    
    if (isArea) selectArea(id);
    else if (isAnnotation) selectAnnotation(id);
    else selectCabinet(id);
};

// [新增] 全域函式：更新自訂副屬性
window.updateCustomAddon = function(id, index, field, value) {
    // [v9.3 修正] 同時支援 Cabinet 和 DrawnArea
    let target = placedCabinets.find(c => c.id === id);
    let isArea = false;
    let isAnnotation = false;
    if (!target) {
        target = drawnAreas.find(a => a.id === id);
        if (target) isArea = true;
    }
    // [修正] 支援標註
    if (!target) {
        target = placedAnnotations.find(a => a.id === id);
        if (target) isAnnotation = true;
    }
    if (!target || !target.customAddons[index]) return;
    
    if (field === 'price' || field === 'qty') {
        target.customAddons[index][field] = parseFloat(value) || 0;
    } else {
        target.customAddons[index][field] = value;
    }
    saveState();
    updateQuotation();
    
    // [v9.8 修正] 僅更新價格，不重繪面板 (防止輸入時焦點跳離)
    if (!isArea) updateSelectedPriceDisplay(id);
};

// [新增] 全域函式：移除自訂副屬性
window.removeCustomAddon = function(id, index) {
    // [v9.3 修正] 同時支援 Cabinet 和 DrawnArea
    let target = placedCabinets.find(c => c.id === id);
    let isArea = false;
    let isAnnotation = false;
    if (!target) {
        target = drawnAreas.find(a => a.id === id);
        if (target) isArea = true;
    }
    // [修正] 支援標註
    if (!target) {
        target = placedAnnotations.find(a => a.id === id);
        if (target) isAnnotation = true;
    }
    if (!target || !target.customAddons) return;
    
    target.customAddons.splice(index, 1);
    saveState();
    updateQuotation();
    if (isArea) selectArea(id);
    else if (isAnnotation) selectAnnotation(id);
    else selectCabinet(id);
};