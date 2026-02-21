const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

class AdminDashboard {
    constructor(configManager, checkinService) {
        this.config = configManager;
        this.checkinService = checkinService;
        this.window = null;
    }

    show(skipLogin = false) {
        if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
            if (skipLogin) {
                this.window.webContents.send('auto-login-success');
            }
            return;
        }

        this._createWindow(skipLogin);
    }

    _createWindow(skipLogin = false) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        this.window = new BrowserWindow({
            width: 1200,
            height: 800,
            x: Math.floor((width - 1200) / 2),
            y: Math.floor((height - 800) / 2),
            title: '管理員監控面板',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            autoHideMenuBar: true
        });

        this._loadUI();

        if (skipLogin) {
            this.window.webContents.on('did-finish-load', () => {
                this.window.webContents.send('auto-login-success');
            });
        }
    }

    _loadUI() {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>管理員監控面板</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary-color: #1890ff;
            --success-color: #52c41a;
            --warning-color: #faad14;
            --error-color: #ff4d4f;
            --bg-color: #f0f2f5;
            --card-bg: #ffffff;
            --text-main: #333333;
            --text-secondary: #666666;
            --border-color: #f0f0f0;
        }
        body { font-family: 'Segoe UI', 'Microsoft JhengHei', sans-serif; margin: 0; padding: 0; background-color: var(--bg-color); color: var(--text-main); }
        .container { padding: 24px; max-width: 1400px; margin: 0 auto; transition: opacity 0.3s; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .title { font-size: 28px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
        
        .tabs { display: flex; margin-bottom: 24px; background: #e4e7ed; padding: 4px; border-radius: 8px; width: fit-content; }
        .tab-btn { padding: 8px 24px; cursor: pointer; border: none; background: none; font-size: 15px; border-radius: 6px; transition: all 0.2s; color: var(--text-secondary); }
        .tab-btn.active { background: white; color: var(--primary-color); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .controls { background: var(--card-bg); padding: 20px; border-radius: 12px; margin-bottom: 24px; display: flex; gap: 16px; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); flex-wrap: wrap; }
        .filter-group { display: flex; align-items: center; gap: 8px; }
        input[type="date"], input[type="text"] { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 6px; outline: none; }
        
        .btn { padding: 8px 20px; background-color: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .btn-outline { background-color: transparent; border: 1px solid var(--primary-color); color: var(--primary-color); }

        .table-container { background: var(--card-bg); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #fafafa; padding: 16px; text-align: left; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border-color); }
        td { padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
        tr:hover { background-color: #fafafa; }
        tr.anomaly-row { background-color: #fff1f0; }
        
        .status-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 8px; }
        .badge-work { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
        .badge-work .status-dot { background: #52c41a; }
        .badge-idle { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
        .badge-idle .status-dot { background: #faad14; }
        .badge-offline { background: #f5f5f5; color: #8c8c8c; border: 1px solid #d9d9d9; }
        .badge-offline .status-dot { background: #8c8c8c; }

        .chart-row { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 24px; }
        .chart-box { background: var(--card-bg); padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 320px; }
        
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-bottom: 24px; }
        .card { background: var(--card-bg); padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; }
        .card h4 { margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; }
        .card .value { font-size: 28px; font-weight: 700; }
        
        .tag { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 4px; color: white; }
        .tag-danger { background: #ff4d4f; }
        .tag-warning { background: #faad14; }
        
        #login-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .login-box { background: white; padding: 40px; border-radius: 16px; width: 340px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; }
        .login-box input { width: 100%; padding: 12px; margin: 16px 0; border: 1px solid #d9d9d9; border-radius: 8px; text-align: center; }
        .login-box button { width: 100%; padding: 12px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }

        .text-danger { color: var(--error-color); font-weight: 600; }
        .text-success { color: var(--success-color); font-weight: 600; }
        .scrollbar::-webkit-scrollbar { width: 6px; }
        .scrollbar::-webkit-scrollbar-thumb { background: #d9d9d9; border-radius: 3px; }
    </style>
</head>
<body>
    <div id="login-overlay">
        <div class="login-box">
            <div style="font-size: 40px; mb: 12px;">🛡️</div>
            <h3>管理員登入</h3>
            <input type="password" id="password-input" placeholder="••••••••" onkeyup="if(event.key==='Enter') verifyPassword()">
            <button onclick="verifyPassword()">安全登入</button>
            <div id="login-msg" style="color: var(--error-color); margin-top: 16px;"></div>
        </div>
    </div>

    <div class="container" style="display: none; opacity: 0;" id="main-content">
        <div class="header">
            <div class="title">管理員監控面板 🚀</div>
            <div id="last-update" style="font-size: 13px; color: var(--text-secondary);">準備中...</div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('live')">📡 即時監控</button>
            <button class="tab-btn" onclick="switchTab('history')">🕰️ 歷史報表</button>
        </div>

        <div id="tab-live" class="tab-content active">
            <div class="controls" style="justify-content: space-between;">
                <input type="text" id="live-filter" placeholder="搜尋員工姓名..." oninput="filterLiveTable()" style="width: 250px;">
                <button class="btn btn-outline" onclick="refreshLive()">🔄 重新整理</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>員工姓名</th><th>狀態</th><th>應用程式</th><th>標題/裝置</th><th>最後心跳</th></tr>
                    </thead>
                    <tbody id="status-body"></tbody>
                </table>
            </div>
        </div>

        <div id="tab-history" class="tab-content">
            <div class="controls">
                <input type="date" id="start-date">
                <span>-</span>
                <input type="date" id="end-date">
                <input type="text" id="history-filter" placeholder="過濾姓名..." oninput="filterHistoryTable()">
                <button class="btn" onclick="loadHistory()">🔍 查詢</button>
            </div>
            <div class="summary-cards">
                <div class="card"><h4>總工時 (min)</h4><div class="value" id="val-work">0</div></div>
                <div class="card"><h4>總閒置 (min)</h4><div class="value" id="val-idle">0</div></div>
                <div class="card"><h4>平均生產力</h4><div class="value" id="val-prod">0%</div></div>
                <div class="card"><h4>人天紀錄</h4><div class="value" id="val-count">0</div></div>
            </div>
            <div class="chart-row">
                <div class="chart-box"><canvas id="chart-pie"></canvas></div>
                <div class="chart-box"><canvas id="chart-bar"></canvas></div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>日期</th><th>員工</th><th>工時</th><th>休閒</th><th>生產力</th><th>內容摘要</th><th>標籤</th></tr>
                    </thead>
                    <tbody id="history-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const { ipcRenderer } = require('electron');
        let charts = {};

        function verifyPassword() {
            ipcRenderer.send('admin-login-verify', document.getElementById('password-input').value);
        }
        ipcRenderer.on('admin-login-result', (e, success) => {
            success ? handleLoginSuccess() : (document.getElementById('login-msg').innerText = '密碼錯誤');
        });
        ipcRenderer.on('auto-login-success', handleLoginSuccess);

        function handleLoginSuccess() {
            document.getElementById('login-overlay').style.display = 'none';
            const content = document.getElementById('main-content');
            content.style.display = 'block';
            setTimeout(() => content.style.opacity = '1', 50);
            initDefaults(); refreshLive(); startAutoRefresh();
        }

        function initDefaults() {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('end-date').value = today;
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            document.getElementById('start-date').value = weekAgo.toISOString().split('T')[0];
        }

        function switchTab(tab) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.includes(tab === 'live' ? '📡' : '🕰️')));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
        }

        function refreshLive() {
            document.getElementById('last-update').innerText = '更新中...';
            ipcRenderer.send('fetch-team-status');
        }
        function startAutoRefresh() { setInterval(refreshLive, 30000); }

        ipcRenderer.on('team-status-data', (e, res) => {
            const tbody = document.getElementById('status-body');
            if (!res.success) { tbody.innerHTML = '<tr><td colspan="5">' + res.message + '</td></tr>'; return; }
            document.getElementById('last-update').innerText = '最後更新: ' + new Date().toLocaleTimeString();
            tbody.innerHTML = res.data.map(u => {
                let cls = 'badge-offline', txt = '離線';
                if (u.status === 'work') { cls = 'badge-work'; txt = '工作中'; }
                else if (u.status === 'idle') { cls = 'badge-idle'; txt = '閒置'; }
                return \`
                    <tr class="user-row" data-name="\${u.userName}">
                        <td>\${u.userName}</td>
                        <td><div class="status-badge \${cls}"><span class="status-dot"></span>\${txt}</div></td>
                        <td>\${u.currentApp || '-'}</td>
                        <td title="\${u.siteName}">\${u.siteName || '-'}</td>
                        <td>\${u.lastHeartbeat ? new Date(u.lastHeartbeat).toLocaleTimeString() : '-'}</td>
                    </tr>
                \`;
            }).join('');
            filterLiveTable();
        });

        function filterLiveTable() {
            const q = document.getElementById('live-filter').value.toLowerCase();
            document.querySelectorAll('#status-body tr').forEach(r => r.style.display = r.getAttribute('data-name').toLowerCase().includes(q) ? '' : 'none');
        }

        function loadHistory() {
            ipcRenderer.send('fetch-history-data', { 
                startDate: document.getElementById('start-date').value, 
                endDate: document.getElementById('end-date').value 
            });
        }
        ipcRenderer.on('history-data-result', (e, res) => {
            if (!res.success) return alert(res.message);
            const d = res.data;
            document.getElementById('val-work').innerText = Math.round(d.summary.totalWork);
            document.getElementById('val-idle').innerText = Math.round(d.summary.totalIdle);
            document.getElementById('val-prod').innerText = d.summary.avgProductivity + '%';
            document.getElementById('val-count').innerText = d.summary.records;
            renderCharts(d); renderHistoryTable(d.daily);
        });

        function filterHistoryTable() {
            const q = document.getElementById('history-filter').value.toLowerCase();
            document.querySelectorAll('#history-body tr').forEach(r => r.style.display = r.getAttribute('data-name').toLowerCase().includes(q) ? '' : 'none');
        }

        function renderHistoryTable(data) {
            const tbody = document.getElementById('history-body');
            tbody.innerHTML = data.map(r => {
                let tags = '';
                if (r.anomalies?.includes('low_score')) tags += '<span class="tag tag-danger">低生產力</span>';
                if (r.anomalies?.includes('high_leisure')) tags += '<span class="tag tag-warning">高休閒</span>';
                const det = (r.detailText || '').replace(/\\n/g, '<br>').replace(/\\r/g, '');
                return \`
                    <tr data-name="\${r.userName}" class="\${r.anomalies?.length ? 'anomaly-row' : ''}">
                        <td>\${r.date}</td>
                        <td style="font-weight:600">\${r.userName}</td>
                        <td>\${r.work}</td>
                        <td>\${r.leisure}</td>
                        <td class="\${r.productivity < 60 ? 'text-danger' : 'text-success'}">\${r.productivity}%</td>
                        <td><div class="scrollbar" style="max-height:60px; overflow-y:auto; font-size:12px; cursor:zoom-in" onclick="alert(this.innerText)">\${det}</div></td>
                        <td>\${tags || '-'}</td>
                    </tr>
                \`;
            }).join('');
        }

        function renderCharts(d) {
            if (charts.pie) charts.pie.destroy(); if (charts.bar) charts.bar.destroy();
            charts.pie = new Chart(document.getElementById('chart-pie'), {
                type: 'doughnut',
                data: {
                    labels: ['工作', '閒置', '休閒', '其他'],
                    datasets: [{ data: [d.categoryStats.work, d.categoryStats.idle, d.categoryStats.leisure, d.categoryStats.other], backgroundColor: ['#52c41a', '#faad14', '#ff4d4f', '#8c8c8c'] }]
                },
                options: { maintainAspectRatio: false }
            });
            charts.bar = new Chart(document.getElementById('chart-bar'), {
                type: 'bar',
                data: {
                    labels: d.daily.map(x => x.date.split('-').slice(1).join('/')),
                    datasets: [{ label: '工作', data: d.daily.map(x => x.work), backgroundColor: '#52c41a' }, { label: '閒置', data: d.daily.map(x => x.idle), backgroundColor: '#faad14' }]
                },
                options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
            });
        }
    </script>
</body>
</html>
        `;

        this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    }

    _stopAutoUpdate() { }
}

module.exports = { AdminDashboard };
