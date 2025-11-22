const CACHE_NAME = 'daily-report-image-cache-v1';
const IMAGE_HOST = 'drive.google.com';

self.addEventListener('install', (event) => {
  // 安裝時不需要預先快取任何東西
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 啟用時，清除舊版本的快取
  console.log('Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只快取來自 Google Drive 的圖片請求
  if (request.url.includes(IMAGE_HOST) && request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // [v584.0 核心優化] 增加對快取內容的有效性檢查
          // 如果快取存在且是成功的 (status 2xx)，才回傳快取。
          if (cachedResponse && cachedResponse.ok) {
            return cachedResponse;
          }

          // 如果沒有快取，或者快取的回應是失敗的 (如 429)，則重新從網路請求。
          return fetch(request).then((networkResponse) => {
              // [v582.0 核心修正] 只快取成功的請求 (狀態碼 200-299)
              if (networkResponse && networkResponse.ok) {
                // 複製一份回應存入快取，因為回應只能被讀取一次
                cache.put(request, networkResponse.clone());
              }
              return networkResponse; // 無論成功失敗，都將原始回應傳回給頁面
          });          
        });
      })
    );
  }
});