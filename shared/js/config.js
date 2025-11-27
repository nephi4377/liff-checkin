/*
 * =============================================================================
 * 檔案名稱: config.js
 * 專案名稱: 專案日誌管理主控台
 * 版本: v1.0
 * 說明: 集中管理所有環境變數與設定值。
 * =============================================================================
 */

export const CONFIG = {
    // LIFF ID 設定
    LIFF_ID: '2007974938-jVxn6y37', // 員工打卡用
    PROJECT_CONSOLE_LIFF_ID: '2007974938-7yKM9EqL', // 專案主控台用
    HUB_LIFF_ID: '2007974938-2nPKg3J0', // 整合主控台 (SPA) 用
    REPORT_FORM_LIFF_ID: '2007974938-gOrjlzna', // 施工回報用

    // Google Apps Script Web App URL 設定
    GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec', // 主 API
    ATTENDANCE_GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbz5-DUPNNciVdvE5wrOogNgxYt8EpDZppAe9f2cUh8pW9y3i29fB6n0RA5r-A5KuAiz/exec', // 出勤 API
};
