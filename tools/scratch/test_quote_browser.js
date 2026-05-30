const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('正在啟動 Playwright 實開瀏覽器測試...');
  // 實開瀏覽器 (headless: false)
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 載入本地報價網頁
  const filePath = path.resolve(__dirname, '../QuickRenovationQuote_v2.html');
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  console.log(`正在開啟網頁: ${fileUrl}`);
  await page.goto(fileUrl);

  // 等待網頁載入完成
  await page.waitForTimeout(1000);

  console.log('第一步：選擇 3b2h 房型並填寫 20 坪，點選「下一步：計算空間」');
  await page.selectOption('#c_template', '3b2h');
  await page.fill('#c_totalPing', '20');
  await page.click('#c_calcBtn');

  await page.waitForTimeout(1000);

  console.log('第二步：選擇報價方案，點選「下一步：帶出項目」');
  // 點選第一個方案
  const radios = page.locator('input[name="scheme"]');
  if (await radios.count() > 0) {
    await radios.first().click();
    console.log('已選取第一個方案。');
  }
  await page.click('#c_toItemsBtn');

  await page.waitForTimeout(1500);

  console.log('第三步：在明細中尋找插座項目並驗證數量與單價...');
  const rowData = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    let result = null;
    rows.forEach(row => {
      const text = row.innerText || '';
      if (text.includes('插座拉線') || text.includes('出線/開關插座')) {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        result = {
          name: cells[0],
          quantity: cells[1],
          unit: cells[2],
          price: cells[3],
          subtotal: cells[4]
        };
      }
    });
    return result;
  });

  if (rowData) {
    console.log('【測試結果】找到插座項目:', rowData);
    // 移除了逗號便於比較
    const priceVal = rowData.price.replace(/,/g, '');
    const qtyVal = rowData.quantity;
    if (priceVal === '1170' && qtyVal === '11') {
      console.log('✅ 驗證成功！單價為 1,170 元，數量為 11 座。');
    } else {
      console.error(`❌ 驗證失敗！實際單價 ${rowData.price}（預期 1,170）；實際數量 ${rowData.quantity}（預期 11）。`);
    }
  } else {
    console.error('❌ 找不到插座拉線工程相關表格列！');
    // 印出所有 tr 的 innerText 輔助除錯
    const allTrs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tr')).map(tr => tr.innerText.trim());
    });
    console.log('畫面上現有的 tr 內容如下：', allTrs);
  }

  // 前往第四步
  console.log('點選「產生報價摘要」...');
  await page.click('#c_quoteBtn');
  await page.waitForTimeout(1000);

  const totalText = await page.textContent('#c_quoteOut');
  console.log('【最終報價摘要】:\n', totalText);

  console.log('等待 5 秒鐘讓您確認實體瀏覽器畫面...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('測試結束，瀏覽器已關閉。');
})();

