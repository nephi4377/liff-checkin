const fs = require('fs');

try {
    const jsonStr = fs.readFileSync('c:\\Users\\a9999\\Dropbox\\CodeBackups\\CODING\\assets\\budget_context_1774483600337.json', 'utf8');
    const data = JSON.parse(jsonStr);

    console.log('JSON 讀取成功, total items:', data.items.length);
    const appData = data;

    // 模擬 renderList
    const items = appData.items || [];
    
    // Group by zone
    const zones = {};
    items.forEach(it => {
        const z = it.zone || '未分類區域';
        if(!zones[z]) zones[z] = [];
        zones[z].push(it);
    });

    Object.keys(zones).forEach(zName => {
        zones[zName].forEach(item => {
            const isVerified = item.verification && item.verification.is_ok;
            const statusClass = item.completion_percent === 100 ? 'badge-done' : (item.completion_percent > 0 ? 'badge-process' : 'badge-pending');
            const statusText = item.completion_percent === 100 ? '已完工' : (item.completion_percent > 0 ? '施工中' : '等候中');

            const html = `
                <div class="item-main">
                    <div class="name">${item.name}</div>
                    <div class="spec">${item.spec || ''}</div>
                    <div class="tags">
                        <span class="tag">${item.category_tag || '未分類'}</span>
                        <span class="tag">${item.unit || ''}</span>
                    </div>
                </div>
                <div class="progress-box">
                    <div class="progress-label">${item.completion_percent || 0}%</div>
                    <input type="range" min="0" max="100" value="${item.completion_percent || 0}" 
                        oninput="updateProgress('${item.id}', this.value)">
                </div>
                <div>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <div class="verify-toggle">
                    <button class="verify-btn ${isVerified ? 'active' : ''}" onclick="toggleVerify('${item.id}')">
                        <i data-lucide="${isVerified ? 'check-circle' : 'circle'}"></i> 
                        ${isVerified ? '已核對' : '標註核對'}
                    </button>
                    <div class="verify-info">${isVerified ? `${item.verification.verified_by || '系統'}<br>${item.verification.verified_at || ''}` : ''}</div>
                </div>
            `;
            // 如果跑到這且沒有例外，就說明這是可以執行的。
        });
    });

    console.log('✅ 所有 HTML 組裝測試通過！沒有發生 Exception。');

} catch (e) {
    console.error('❌ Exception 發生:', e.message);
}
