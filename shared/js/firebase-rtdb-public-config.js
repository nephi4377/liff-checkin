/**
 * Firebase Web 用戶端設定（與 reportV3 同一專案；apiKey 為公開 Web 設定，非伺服器密鑰）。
 */
(function attachPublicFirebaseRtdbConfig(root) {
  root.FIREBASE_RTDB_WEB_PUBLIC = {
    apiKey: 'AIzaSyApr3pKxW9Ukot6_QRJ2WunlQD8R4DImoQ',
    authDomain: 'brave-calling-391208.firebaseapp.com',
    databaseURL:
      'https://brave-calling-391208-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'brave-calling-391208',
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
