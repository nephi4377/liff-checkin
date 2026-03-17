/**
 * =============================================================================
 * 檔案名稱: social_ui.js
 * 模組名稱: SocialFeed 社群展示層
 * 說明: 負責渲染具有頭像、留言功能的「社群化日誌卡片」。
 * =============================================================================
 */

import { buildPhotoGridV2 } from '../js/ui.js';
import { state } from '../js/state.js';

/**
 * [V3 NEW] 建立社群化日誌卡片 (仿 FB)
 */
export function buildSocialLogCard(log) {
    const card = document.createElement('div');
    card.className = 'card social-log-card';
    card.id = `log-${log.LogID}`;

    // 1. 標頭區：頭像 + 姓名 + 時間
    const header = document.createElement('div');
    header.className = 'social-card-header';
    
    const avatar = document.createElement('div');
    avatar.className = 'social-avatar';
    if (log.userAvatar) {
        avatar.style.backgroundImage = `url(${log.userAvatar})`;
    } else {
        const initial = (log.UserName || '？').charAt(0);
        avatar.textContent = initial;
        avatar.classList.add('avatar-placeholder');
    }

    const info = document.createElement('div');
    info.className = 'social-author-info';
    info.innerHTML = `
        <div class="author-name">${log.UserName || '未知成員'}</div>
        <div class="post-time">${formatTimestamp(log.Timestamp)}</div>
    `;

    header.appendChild(avatar);
    header.appendChild(info);

    // 2. 內容區
    const body = document.createElement('div');
    body.className = 'social-card-body';
    body.innerHTML = `<div class="log-content">${log.Content || ''}</div>`;

    // 3. 媒體區 (仿 FB 5圖遮罩)
    if (log.PhotoLinks) {
        const photos = (log.PhotoLinks || '').split(',').map(p => p.trim()).filter(p => p !== '');
        if (photos && photos.length > 0) {
            const grid = document.createElement('div');
            grid.className = `social-photo-grid grid-${Math.min(photos.length, 5)}`;
            
            photos.slice(0, 5).forEach((url, index) => {
                const item = document.createElement('div');
                item.className = 'photo-item';
                item.style.backgroundImage = `url(${url})`;
                
                // 第五張且總數超過 5 時增加遮罩
                if (index === 4 && photos.length > 5) {
                    const overlay = document.createElement('div');
                    overlay.className = 'photo-overlay';
                    overlay.textContent = `+${photos.length - 5}`;
                    item.appendChild(overlay);
                }
                
                item.onclick = () => window.openLightbox(photos, index); 
                grid.appendChild(item);
            });
            body.appendChild(grid);
        }
    }

    // 4. 留言互動區
    const interaction = document.createElement('div');
    interaction.className = 'social-interaction-area';
    interaction.innerHTML = `
        <div class="comment-count-bar">
            <span class="view-more-comments" id="more-${log.LogID}" style="display:none; cursor:pointer; color:#1877f2;">查看較早的留言...</span>
            <span class="count-text">${log.commentCount || 0} 則回應</span>
        </div>
        <div class="comment-list" id="comments-${log.LogID}">
            <!-- 留言會動態注入在此 -->
        </div>
        <div class="comment-input-box">
            <input type="text" placeholder="寫下你的回應..." id="input-${log.LogID}">
            <button class="send-comment-btn" data-logid="${log.LogID}">發布</button>
        </div>
    `;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(interaction);

    return card;
}

/** 格式化時間 */
function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString('zh-TW', { hour12: false });
}

/** 注入 SocialFeed 專屬樣式 */
export function injectSocialStyles() {
    const styleId = 'social-feed-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .social-log-card { margin-bottom: 20px; border-radius: 12px; border: 1px solid #eee; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .social-card-header { padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
        .social-avatar { width: 44px; height: 44px; border-radius: 50%; background-size: cover; background-position: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background-color: #f0f2f5; font-weight: bold; color: #65676b; }
        .avatar-placeholder { background: #e4e6eb; font-size: 1.2rem; }
        .author-name { font-weight: 600; color: #050505; }
        .post-time { font-size: 0.85rem; color: #65676b; }
        .social-card-body { padding: 0 16px 12px; }
        .log-content { margin-bottom: 12px; white-space: pre-wrap; font-size: 1rem; line-height: 1.5; color: #050505; }
        
        /* 圖片網格系統 */
        .social-photo-grid { display: grid; gap: 4px; margin: 0 -16px; height: 300px; cursor: pointer; }
        .grid-1 { grid-template-columns: 1fr; }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .grid-3 .photo-item:first-child { grid-row: span 2; }
        .grid-4 { grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; }
        .grid-4 .photo-item:first-child { grid-column: span 3; }
        .grid-5 { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(6, 1fr); }
        .grid-5 .photo-item:nth-child(1) { grid-row: span 3; }
        .grid-5 .photo-item:nth-child(2) { grid-row: span 3; }
        .grid-5 .photo-item:nth-child(3) { grid-row: span 2; }
        .grid-5 .photo-item:nth-child(4) { grid-row: span 2; }
        .grid-5 .photo-item:nth-child(5) { grid-row: span 2; }

        .photo-item { background-size: cover; background-position: center; position: relative; transition: filter 0.2s; }
        .photo-item:hover { filter: brightness(0.9); }
        .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; }

        .social-interaction-area { border-top: 1px solid #eee; padding: 12px 16px; background: #fff; }
        .comment-count-bar { padding: 8px 0; font-size: 0.9rem; color: #65676b; display: flex; justify-content: space-between; border-bottom: 1px solid #f0f2f5; margin-bottom: 8px; }
        .comment-input-box { display: flex; gap: 12px; margin-top: 12px; align-items: center; }
        .comment-input-box input { flex: 1; border-radius: 20px; border: none; background: #f0f2f5; padding: 10px 16px; outline: none; transition: background 0.3s; font-size: 0.95rem; }
        .comment-input-box input:focus { background: #e4e6eb; }
        .send-comment-btn { background: none; border: none; color: #1877f2; font-weight: 600; cursor: pointer; transition: transform 0.1s; }
        .send-comment-btn:active { transform: scale(0.95); }
        .send-comment-btn:disabled { color: #bcc0c4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
}
