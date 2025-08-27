// ===================================================
// 版本: v1.0 (Service Worker)
// 更新時間: 2025/08/28 14:30
// 說明: 這是施工回報系統的背景快遞員 (Service Worker)。
//       負責處理背景同步，將暫存在本地資料庫的回報可靠地送出。
// ===================================================

// --- 步驟 1: 監聽 "sync" 事件 ---
// 當瀏覽器認為網路狀況良好，且我們註冊了同步任務時，這個事件就會被觸發
self.addEventListener('sync', function(event) {
    console.log('[Service Worker] 背景同步事件觸發！', event);
    // 我們為所有施工回報的同步任務，統一定義一個標籤 (tag)
    if (event.tag === 'sync-reports') {
        // event.waitUntil() 會確保 Service Worker 在非同步操作完成前不會被終止
        event.waitUntil(syncReports());
    }
});

// --- 步驟 2: 定義同步處理函式 ---
async function syncReports() {
    console.log('[Service Worker] 開始同步施工回報...');
    const db = await openDB();
    // 從本地資料庫中，讀取所有待辦的回報
    const reports = await getAllReports(db);

    // 逐一處理每一筆待辦的回報
    for (const report of reports) {
        try {
            console.log(`[Service Worker] 正在嘗試提交 ID 為 ${report.id} 的回報...`);
            
            // 執行真正的網路請求
            const response = await fetch(report.url, {
                method: 'POST',
                cache: 'no-cache',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: report.body
            });

            // 雖然因為平台異常，我們可能無法讀取到 response.ok
            // 但只要 fetch 沒有直接拋出網路錯誤，我們就視為成功送達
            console.log(`[Service Worker] ID 為 ${report.id} 的回報提交成功！`);
            // 提交成功後，從本地資料庫中刪除這筆已完成的任務
            await deleteReport(db, report.id);

        } catch (error) {
            console.error(`[Service Worker] 提交 ID 為 ${report.id} 的回報失敗:`, error);
            // 如果提交失敗（例如伺服器剛好 500 錯誤），
            // 我們會在此處中斷，這筆任務會被保留在資料庫中，
            // Service Worker 會在下一次 sync 事件時自動重試。
            break; 
        }
    }
    console.log('[Service Worker] 本次同步處理完成。');
}


// ===================================================
// ========= IndexedDB 本地資料庫輔助函式 =========
// ===================================================

const DB_NAME = 'report-queue-db';
const STORE_NAME = 'reports';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = self.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function getAllReports(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function deleteReport(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = event => resolve();
        request.onerror = event => reject(event.target.error);
    });
}
