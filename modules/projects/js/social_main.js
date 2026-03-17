/**
 * =============================================================================
 * 檔案名稱: social_main.js
 * 模組名稱: SocialFeed 獨立啟動器 (V3)
 * 說明: 負責 social_console.html 的核心啟動與資料渲染。
 * =============================================================================
 */

import { request as apiRequest } from './projectApi.js';
import { logToPage, showGlobalNotification } from '/shared/js/utils.js';
import { state } from './state.js';
import { displayProjectInfo, renderPostCreator, lazyLoadImages } from './ui.js';

// SocialFeed 模組引入
import { buildSocialLogCard, injectSocialStyles } from '../social_feed/social_ui.js';
import { injectCommentStyles, handleSendComment, renderSingleComment } from '../social_feed/social_actions.js';

/** 初始化啟動 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 SocialFeed 獨立主控台啟動中...');
    
    // 注入樣式
    injectSocialStyles();
    injectCommentStyles();

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    
    if (!projectId) {
        showGlobalNotification('未指定案號，無法加載社群牆。', 5000, 'error');
        return;
    }
    
    state.projectId = projectId; // 確保 state 同步

    // 抓取資料並渲染
    await loadSocialConsoleData(projectId);
});

/** 載入資料流 */
async function loadSocialConsoleData(projectId) {
    try {
        logToPage('🌀 正在同步社群數據...');
        
        const [projectInfo, socialLogs] = await Promise.all([
            apiRequest({ action: 'project', payload: { projectId: projectId } }), // 修正為 project 動作
            apiRequest({ action: 'get_social_logs', payload: { projectName: projectId } })
        ]);

        if (projectInfo.success) {
            state.overview = projectInfo.data;
            displayProjectInfo(); 
            renderPostCreator();   
        }

        if (socialLogs.success) {
            state.currentLogsData = socialLogs.data;
            renderSocialFeed();
        }
    } catch (e) {
        console.error('SocialFeed 加載失敗:', e);
        showGlobalNotification('與伺服器連線失敗', 5000, 'error');
    }
}

/** 渲染社群牆 */
function renderSocialFeed() {
    const container = document.getElementById('logs-container');
    if (!container) return;
    container.innerHTML = ''; 

    // [V3 修正] 增加防禦性檢查，避免空數據導致崩潰
    if (!state.currentLogsData || !Array.isArray(state.currentLogsData) || state.currentLogsData.length === 0) {
        container.innerHTML = '<div class="text-center p-10 text-gray-400">目前尚無社交動態 (專案 999)</div>';
        return;
    }

    state.currentLogsData.forEach(log => {
        const card = buildSocialLogCard(log);
        container.appendChild(card);
        
        // 綁定留言按鈕點擊事件
        const btn = card.querySelector('.send-comment-btn');
        if (btn) {
            btn.onclick = () => handleSendComment(log.LogID);
        }
        
        // 分別加載留言
        fetchAndRenderComments(log.LogID);
    });

    lazyLoadImages();
    logToPage('✅ 社群牆渲染完成');
}

/** 抓取留言 */
async function fetchAndRenderComments(logId) {
    try {
        const response = await apiRequest({ action: 'get_comments', payload: { logId: logId } });
        if (response && response.success) {
            const list = document.getElementById(`comments-${logId}`);
            if (list) {
                list.innerHTML = '';
                response.data.forEach(comment => {
                    list.appendChild(renderSingleComment(comment));
                });
            }
        }
    } catch (e) {
        console.warn(`[${logId}] 留言載入失敗`);
    }
}

// 註冊全域燈箱開啟函式供 ui.js 使用
window.openLightbox = (images, index) => {
    // 調用 main.js 注入的 initializeLightbox 相關邏輯 (如果有)
    console.log('開啟燈箱:', images[index]);
};
