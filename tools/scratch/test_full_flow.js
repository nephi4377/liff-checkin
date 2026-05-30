const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('【系統測試】開始進行快速報價系統的完整 UI/UX 流程探索與缺點評估...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 800 }); // slowMo 設為 800 讓操作極易看清
  const context = await browser.newContext();
  const page = await context.newPage();

  // 監聽 Console 訊息
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[瀏覽器 Error] ${msg.text()}`);
    }
  });

  const filePath = path.resolve(__dirname, '../QuickRenovationQuote_v2.html');
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl);
  await page.waitForTimeout(500);
  
  // 清理 localStorage 以確保新的 DEFAULTS.itemDefs 生效
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await page.waitForTimeout(1000);

  // 1. 測試防禦性輸入：輸入負數坪數
  console.log('👉 1. 測試防禦性輸入：填入負數坪數 -5...');
  await page.fill('#c_totalPing', '-5');
  await page.click('#c_calcBtn');
  await page.waitForTimeout(1000);
  const isErrVisible = await page.isVisible('#c_pingError');
  console.log(`-> 錯誤提示是否顯示: ${isErrVisible ? '是 (符合預期)' : '否 (UX缺陷)'}`);

  // 2. 正常輸入：選擇三房二廳 (3b2h)，25坪
  console.log('👉 2. 填入正常數值：三房二廳，25 坪...');
  await page.fill('#c_totalPing', '25');
  await page.selectOption('#c_template', '3b2h');
  await page.click('#c_calcBtn');
  await page.waitForTimeout(1000);

  // 3. 進入第二步：檢查推估分區表與方案切換
  console.log('👉 3. 進入第二步：檢查空間分區...');
  const allocText = await page.textContent('#c_allocTable');
  console.log('-> 空間分區表內容：\n', allocText.trim().replace(/\s+/g, ' '));

  console.log('-> 切換不同方案...');
  const radios = page.locator('input[name="scheme"]');
  const count = await radios.count();
  console.log(`-> 找到方案個數: ${count}`);
  if (count > 1) {
    await radios.nth(1).click(); // 切換到第二個方案
    console.log('-> 已切換至第二個方案');
    await page.waitForTimeout(1000);
  }

  await page.click('#c_toItemsBtn');
  await page.waitForTimeout(1500);

  // 4. 進入第三步：修改項目數量與即時連動
  console.log('👉 4. 進入第三步：修改明細項目...');
  // 尋找插座數量的輸入欄位 (在 #c_itemRows 中)
  const socketInput = page.locator('input.it-qty[data-id="mep_switches"]');
  if (await socketInput.count() > 0) {
    const origVal = await socketInput.inputValue();
    console.log(`-> 插座預設數量: ${origVal}`);
    
    // 將數量手動改為 15
    console.log('-> 手動將插座數量修改為 15...');
    await socketInput.fill('15');
    await page.waitForTimeout(1000);

    // 檢查小計或更新後的輸入值
    const updatedVal = await socketInput.inputValue();
    console.log(`-> 插座修改後的數量為: ${updatedVal}`);
  } else {
    console.log('-> 未找到插座數量的輸入欄位。');
  }

  // 5. 產生摘要並分析
  console.log('👉 5. 點選產生報價摘要...');
  await page.click('#c_quoteBtn');
  await page.waitForTimeout(1500);

  const quoteOutText = await page.textContent('#c_quoteOut');
  console.log('-> 報價摘要內容：\n', quoteOutText.trim());

  console.log('👉 測試完成，保留瀏覽器 5 秒供檢查...');
  await page.waitForTimeout(5000);
  await browser.close();
  console.log('【系統測試】測試結束。');
})();
