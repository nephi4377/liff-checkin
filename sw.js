// ===================================================
// 版本: v1.1 (狀態回報)
// 更新時間: 2025/08/28 16:25
// 說明: 這是施工回報系統的背景快遞員 (Service Worker)。
//       - 【新增】在同步的不同階段，透過 postMessage 將狀態回報給主頁面。
// ===================================================

// --- 監聽 "sync" 事件 ---
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-reports') {
        event.waitUntil(syncReports());
    }
});

async function syncReports() {
    // 【新增】向主頁面回報：同步已開始
    await postStatusToClients('背景同步處理中...');
    
    const db = await openDB();
    const reports = await getAllReports(db);

    if (reports.length === 0) {
        await postStatusToClients('佇列為空，無需同步。');
        return;
    }

    for (const report of reports) {
        try {
            await postStatusToClients(`正在提交佇列中的回報 ID: ${report.id}...`);
            const response = await fetch(report.url, {
                method: 'POST',
                cache: 'no-cache',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: report.body
            });

            // 我們依然假設，只要 fetch 沒有拋出網路層級的錯誤，就代表成功
            await deleteReport(db, report.id);
            await postStatusToClients(`回報 ID: ${report.id} 同步成功！`);

        } catch (error) {
            console.error(`[Service Worker] 提交 ID 為 ${report.id} 的回報失敗:`, error);
            // 【新增】向主頁面回報：同步失敗，並附上錯誤訊息
            await postStatusToClients(`回報 ID: ${report.id} 同步失敗: ${error.message}`);
            // 中斷迴圈，等待下一次網路恢復時重試
            break; 
        }
    }
}

/**
 * 【新增函式】向所有可見的頁面客戶端廣播狀態訊息
 * @param {string} message - 要發送的訊息
 */
async function postStatusToClients(message) {
    const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
    });
    clients.forEach((client) => {
        client.postMessage({ type: 'syncStatus', message: message });
    });
}


// ===================================================
// ========= IndexedDB 本地資料庫輔助函式 (不變) =========
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
