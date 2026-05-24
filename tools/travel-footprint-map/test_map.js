const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/a9999/.gemini/antigravity/brain/0ba281b5-fda9-4b01-83bb-1de00bcf116c';

async function run() {
  console.log('【測試步驟 1】啟動 Chromium 測試瀏覽器，設定 1280x800 視窗大小…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`  [網頁主機 Console] ${msg.type() === 'error' ? '❌' : 'ℹ️'} : ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`  [網頁執行期錯誤 ❌] : ${err.stack || err.message}`);
  });

  console.log('【測試步驟 2】載入旅遊足跡地圖本機首頁 (http://127.0.0.1:5188)…');
  await page.goto('http://127.0.0.1:5188');

  // 因為初始地圖預設為空白，我們需要模擬上傳測試資料 data/test-saved-places.json
  console.log('  - 初始為空白地圖，正在模擬上傳測試資料 data/test-saved-places.json…');
  await page.setInputFiles('input#fileInput', 'data/test-saved-places.json');

  // 等待地圖標記出現
  console.log('  - 等待世界地圖標記加載完成…');
  await page.waitForSelector('g.marker circle.marker-core', { timeout: 10000 });
  
  const status = await page.evaluate(() => document.getElementById('statusLine')?.innerText);
  console.log(`  - 目前狀態列顯示："${status}"`);
  
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_initial_state.png') });
  console.log('  - 初始畫面已截圖為 01_initial_state.png');

  console.log('【測試步驟 3】模擬點擊地圖上的標記，確認手帳卡片 Popup 彈出…');
  const markers = page.locator('g.marker');
  const count = await markers.count();
  console.log(`  - 向量地圖上共有 ${count} 個足跡點標記`);
  
  if (count > 0) {
    // 點擊其中一個標記 (例如第二個標記)
    await markers.nth(1).locator('circle.marker-core').click({ force: true });
    await page.waitForTimeout(1000);
    
    const popupVisible = await page.evaluate(() => {
      const popup = document.getElementById('mapPopup');
      return popup && !popup.classList.contains('hidden');
    });
    console.log(`  - 手記彈窗 Popup 是否顯示：${popupVisible}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_popup_view.png') });
    console.log('  - 手記檢視彈窗已截圖為 02_popup_view.png');

    // 點擊檢視框中的更換標記為「旗子 (flag)」
    await page.click('#popupViewMode .popup-btn[data-type="flag"]', { force: true });

    // 點擊編輯日記，填寫資訊與評分
    console.log('【測試步驟 4】進入編輯模式，測試旅行手寫日記、推薦星級、貼上照片 URL 與儲存功能…');
    await page.click('#btnEditJournal', { force: true });
    await page.waitForTimeout(500);
    const editModeVisible = await page.evaluate(() => {
      const mode = document.getElementById('popupEditMode');
      const view = document.getElementById('popupViewMode');
      return {
        editHidden: mode.classList.contains('hidden'),
        viewHidden: view.classList.contains('hidden'),
        editDisplay: window.getComputedStyle(mode).display,
        viewDisplay: window.getComputedStyle(view).display
      };
    });
    console.log('  - [診斷] 編輯面板狀態：', editModeVisible);

    await page.fill('#journalNameInput', '夢幻櫻花祭·東京');
    await page.fill('#journalDateInput', '2026-04-15');
    await page.click('.star-btn[data-star="5"]', { force: true }); // 點 5 星
    await page.fill('#journalPhotoUrlInput', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600');
    await page.fill('#journalNoteInput', '在東京賞櫻、吃拉麵，景色非常美麗！');
    
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_popup_editing.png') });
    console.log('  - 手記編輯中畫面已截圖為 03_popup_editing.png');

    // 保存手記
    await page.click('#btnSaveJournal', { force: true });
    await page.waitForTimeout(1000);
    
    const savedLabel = await page.evaluate(() => {
      return {
        displayTitle: document.getElementById('popupContent')?.querySelector('strong')?.innerText,
        journalText: document.getElementById('popupJournalDisplay')?.innerText,
        photoSrc: document.querySelector('#popupPhotoContainer img')?.src
      };
    });
    console.log(`  - 保存後 Popup 顯示名稱變更為："${savedLabel.displayTitle}"`);
    console.log(`  - 保存後手記照片網址為："${savedLabel.photoSrc}"`);
    console.log(`  - 保存後手記內容為：\n"${savedLabel.journalText}"`);
    
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_popup_saved.png') });
    console.log('  - 手記保存後檢視畫面已截圖為 04_popup_saved.png');
  }

  console.log('【測試步驟 5】測試雙擊 D3 地圖空白處手動新增足跡點…');
  const svg = page.locator('#mapSvg');
  const box = await svg.boundingBox();
  if (box) {
    // 雙擊 svg 空白處 (避開 marker 的座標)
    await page.mouse.dblclick(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.waitForTimeout(1000);
    
    const formVisible = await page.evaluate(() => {
      const form = document.getElementById('manualAddForm');
      return form && !form.classList.contains('hidden');
    });
    console.log(`  - 手動新增表單是否展開：${formVisible}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_manual_form.png') });
    console.log('  - 手動新增表單畫面已截圖為 05_manual_form.png');

    // 填寫手動點
    await page.fill('#manualLocName', '夢幻水上度假村');
    await page.fill('#manualLocPhotoUrl', 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600');
    await page.click('#btnSubmitManualAdd');
    await page.waitForTimeout(1000);
    
    const totalCount = await page.evaluate(() => document.querySelectorAll('g.marker').length);
    console.log(`  - 手動新增後地圖標記總數為：${totalCount}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_manual_added.png') });
    console.log('  - 成功新增足跡標記畫面已截圖為 06_manual_added.png');
  }

  console.log('【測試步驟 6】測試側邊欄旅行手記日記點擊跳轉定位與平滑過渡…');
  // 點擊剛剛在側邊欄產生的日記項目
  const journalItems = page.locator('li.journal-item');
  const journalCount = await journalItems.count();
  console.log(`  - 側邊欄旅行日記項目總數：${journalCount}`);
  if (journalCount > 0) {
    // 點擊第一個日記項目
    await journalItems.first().click();
    console.log('  - 點擊日記項目，地圖平滑平移定位中…');
    await page.waitForTimeout(2000); // 等待平移與 Popup 打開
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_journal_jump.png') });
    console.log('  - 平移跳轉後畫面已截圖為 07_journal_jump.png');
  }

  console.log('【測試步驟 7】測試切換底圖為 Voyager 彩色街道圖磚（Leaflet 模式）…');
  // 切換至地圖風格分頁以顯露一鍵風格按鈕
  await page.click('button[data-tab="tab-style"]');
  await page.waitForTimeout(500);
  await page.click('button[data-preset="street-voyager"]');
  console.log('  - 等待 Leaflet 街道圖磚與 divIcon 標記載入…');
  await page.waitForSelector('.custom-div-icon', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_leaflet_load.png') });
  console.log('  - Leaflet 圖磚載入畫面已截圖為 08_leaflet_load.png');

  // 點擊 Leaflet 的自訂圖示標記
  const leafletMarkers = page.locator('.custom-div-icon');
  const leafletCount = await leafletMarkers.count();
  console.log(`  - Leaflet 模式下共有 ${leafletCount} 個 divIcon 標記`);
  if (leafletCount > 0) {
    console.log('  - 點擊 Leaflet 標記…');
    await leafletMarkers.first().click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_leaflet_popup.png') });
    console.log('  - Leaflet 下彈出手帳日記卡片已截圖為 09_leaflet_popup.png');
  }

  console.log('【測試步驟 8】測試質感配色之「自訂專屬配色」與 Color Pickers 面板觸發…');
  // 切換主題為自訂配色
  await page.selectOption('select#themeSelect', 'custom');
  await page.waitForTimeout(500);

  const customPanelVisible = await page.evaluate(() => {
    const panel = document.getElementById('customThemePanel');
    return panel && !panel.classList.contains('hidden');
  });
  console.log(`  - 自訂配色調整面板是否滑出：${customPanelVisible}`);

  // 模擬調色：將海洋背景調整為墨藍色 (#0a1624)
  console.log('  - 模擬變更海洋背景為 #0a1624…');
  await page.evaluate(() => {
    const cp = document.getElementById('cpMapBg');
    if (cp) {
      cp.value = '#0a1624';
      cp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_custom_theme.png') });
  console.log('  - 自訂色彩動態渲染後已截圖為 10_custom_theme.png');

  console.log('【測試步驟 9】測試結束，關閉瀏覽器…');
  await browser.close();
  console.log('所有階段測試截圖已完美儲存於 artifacts 目錄！');
}

run().catch(err => {
  console.error('測試中斷失敗：', err);
});
