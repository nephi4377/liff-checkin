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
          // 如果快取中有，直接回傳；否則從網路請求，並存入快取
          return cachedResponse || fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});