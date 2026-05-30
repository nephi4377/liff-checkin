const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('正在為總監啟動 Playwright 實開瀏覽器...');
  // 實開瀏覽器且不關閉
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized'] // 讓視窗最大化
  });
  
  // 建立 context 與頁面，並設定視窗大小
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // 載入本地報價網頁
  const filePath = path.resolve(__dirname, '../QuickRenovationQuote_v2.html');
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  console.log(`正在載入網頁: ${fileUrl}`);
  await page.goto(fileUrl);

  console.log('✅ 瀏覽器已成功開啟！此視窗將保持開啟，您可以直接在瀏覽器中操作。');
  console.log('若操作完畢，請直接關閉瀏覽器視窗，或在終端機按下 Ctrl+C 結束進程。');

  // 保持進程存活，不調用 browser.close()
  // 監聽瀏覽器關閉事件，當所有頁面都被關閉時才結束
  page.on('close', () => {
    console.log('頁面已關閉，準備結束進程。');
    process.exit(0);
  });
})();
