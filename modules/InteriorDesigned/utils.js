/**
 * 顯示全域通知
 * @param {string} message - 通知訊息
 * @param {number} duration - 持續時間 (毫秒)
 * @param {string} type - 類型: 'info', 'success', 'error', 'warning'
 */
export function showGlobalNotification(message, duration = 3000, type = 'info') {
    // 檢查是否已存在通知容器
    let container = document.getElementById('global-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'global-notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // 建立通知元素
    const notification = document.createElement('div');

    // 根據類型設定顏色
    let bgClass = 'bg-gray-800';
    let icon = 'ℹ️';

    if (type === 'success') {
        bgClass = 'bg-green-600';
        icon = '✅';
    } else if (type === 'error') {
        bgClass = 'bg-red-600';
        icon = '❌';
    } else if (type === 'warning') {
        bgClass = 'bg-yellow-600';
        icon = '⚠️';
    }

    // 使用 Tailwind CSS 樣式 (如果有的話)，否則使用內聯樣式作為後備
    notification.className = `${bgClass} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform translate-y-[-20px] opacity-0`;
    notification.innerHTML = `
        <span class="text-xl">${icon}</span>
        <span class="font-medium">${message}</span>
    `;

    // 如果沒有 Tailwind，加入基本樣式
    if (!window.tailwind) {
        notification.style.backgroundColor = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#1f2937';
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.gap = '12px';
    }

    container.appendChild(notification);

    // 動畫進場
    requestAnimationFrame(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    });

    // 自動移除
    setTimeout(() => {
        notification.style.transform = 'translateY(-20px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}
