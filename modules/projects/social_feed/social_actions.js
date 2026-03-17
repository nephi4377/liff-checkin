/**
 * =============================================================================
 * 檔案名稱: social_actions.js
 * 模組名稱: SocialFeed 互動邏輯
 * 說明: 處理留言提交、API 同步與樂觀更新。
 * =============================================================================
 */

import { request as apiRequest } from '../js/projectApi.js';
import { state } from '../js/state.js';
import { showGlobalNotification } from '/shared/js/utils.js';

/**
 * [V3 NEW] 處理留言發布
 */
export async function handleSendComment(logId) {
    const input = document.getElementById(`input-${logId}`);
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // 1. 取得發言者資訊 (從 state)
    const userId = state.currentUserId || 'guest';
    const userName = state.currentUserName || '匿名成員';

    // 2. 樂觀更新 (UI 優先)
    const commentList = document.getElementById(`comments-${logId}`);
    const tempId = 'comment-temp-' + Date.now();
    const tempElement = renderSingleComment({
        CommentID: tempId,
        UserName: userName,
        CommentText: text,
        Timestamp: new Date().toISOString(),
        isPending: true
    });
    commentList.appendChild(tempElement);
    input.value = '';

    // 3. API 同步
    try {
        const response = await apiRequest({
            action: 'add_comment',
            payload: {
                logId: logId,
                userId: state.currentUserId,
                userName: state.currentUserName,
                commentText: text
            }
        });

        if (response && response.success) {
            // 移除樂觀更新的帶 Loading 樣式
            tempElement.classList.remove('comment-pending');
            showGlobalNotification('留言成功', 2000, 'success');
        } else {
            throw new Error(response.message || 'Server Error');
        }
    } catch (error) {
        console.error('留言失敗:', error);
        tempElement.classList.add('comment-fail');
        tempElement.innerHTML += `<span class="error-tag" onclick="this.parentElement.remove()">失敗 (點擊移除)</span>`;
        showGlobalNotification('留言發送失敗，請重試', 5000, 'error');
    }
}

/** 渲染單條留言 HTML */
export function renderSingleComment(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    if (comment.isPending) div.classList.add('comment-pending');
    
    const time = new Date(comment.Timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        <div class="comment-author">${comment.UserName}</div>
        <div class="comment-text">${comment.CommentText}</div>
        <div class="comment-meta">${time}</div>
    `;
    return div;
}

/** 注入留言樣式 */
export function injectCommentStyles() {
    const styleId = 'social-comment-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .comment-item { padding: 10px 14px; background: #f0f2f5; border-radius: 18px; margin-bottom: 8px; border: none; max-width: 90%; align-self: flex-start; }
        .comment-author { font-size: 0.8rem; font-weight: bold; color: #1c1e21; margin-bottom: 1px; }
        .comment-text { font-size: 0.9rem; color: #050505; word-break: break-all; line-height: 1.4; }
        .comment-meta { font-size: 0.7rem; color: #8a8d91; margin-top: 2px; }
        .comment-pending { opacity: 0.5; }
        .comment-fail { background: #fff0f0; border: 1px solid #ffc9c9; }
        .error-tag { color: #fa5252; font-size: 0.7rem; font-weight: bold; margin-left: 8px; cursor: pointer; text-decoration: underline; }
    `;
    document.head.appendChild(style);
}
