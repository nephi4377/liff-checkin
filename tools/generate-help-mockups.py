#!/usr/bin/env python3
"""Generate SVG wireframe illustrations for 使用教學 help pages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "help"
FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif'
MONO = '"Consolas", "Courier New", monospace'


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def save(rel: str, body: str, w: int, h: int, title: str = ""):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    cap = f'  <text x="{w/2}" y="{h - 14}" text-anchor="middle" font-family={FONT} font-size="10" fill="#94a3b8">示意圖 · 實際畫面以系統為準</text>\n' if title else ""
    t = ""
    if title:
        t = f'  <text x="{w/2}" y="28" text-anchor="middle" font-family={FONT} font-size="15" font-weight="700" fill="#0f172a">{esc(title)}</text>\n'
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
{t}{body}{cap}</svg>
'''
    path.write_text(svg, encoding="utf-8")
    print("wrote", rel)


def line_chat(title: str, rel: str, messages: list[tuple[str, str]], w: int = 420):
    """messages: (role, text) role=user|bot|system"""
    h = 80 + len(messages) * 58 + 40
    body = [f'  <rect x="20" y="44" width="{w-40}" height="{h-90}" rx="16" fill="#fff" stroke="#e2e8f0" stroke-width="1.5"/>']
    body.append(f'  <text x="{w/2}" y="62" text-anchor="middle" font-family={FONT} font-size="11" font-weight="600" fill="#64748b">LINE</text>')
    y = 78
    for role, text in messages:
        if role == "system":
            body.append(f'  <text x="{w/2}" y="{y}" text-anchor="middle" font-family={FONT} font-size="10" fill="#94a3b8">{esc(text)}</text>')
            y += 24
            continue
        if role == "user":
            bx, fill, stroke = w - 220, "#dcfce7", "#86efac"
        else:
            bx, fill, stroke = 40, "#fff", "#e2e8f0"
        lines = text.split("\n")
        bh = 20 + len(lines) * 16
        body.append(f'  <rect x="{bx}" y="{y}" width="180" height="{bh}" rx="10" fill="{fill}" stroke="{stroke}"/>')
        for i, ln in enumerate(lines):
            body.append(f'  <text x="{bx+12}" y="{y+18+i*16}" font-family={FONT} font-size="11" fill="#334155">{esc(ln)}</text>')
        y += bh + 12
    save(rel, "\n".join(body) + "\n", w, h, title)


def web_panel(title: str, rel: str, fields: list[str], buttons: list[str] | None = None, badge: str = "", w: int = 520):
    buttons = buttons or []
    h = 100 + len(fields) * 34 + (44 if buttons else 0) + 36
    body = [
        f'  <rect x="16" y="44" width="{w-32}" height="{h-80}" rx="10" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>',
        f'  <rect x="16" y="44" width="{w-32}" height="28" rx="10" fill="#f1f5f9"/>',
        f'  <rect x="28" y="52" width="10" height="10" rx="2" fill="#f87171"/>',
        f'  <rect x="44" y="52" width="10" height="10" rx="2" fill="#fbbf24"/>',
        f'  <rect x="60" y="52" width="10" height="10" rx="2" fill="#4ade80"/>',
    ]
    if badge:
        body.append(f'  <rect x="{w-120}" y="78" width="88" height="22" rx="6" fill="#eff6ff" stroke="#93c5fd"/>')
        body.append(f'  <text x="{w-76}" y="93" text-anchor="middle" font-family={FONT} font-size="10" font-weight="600" fill="#1d4ed8">{esc(badge)}</text>')
    y = 108
    for f in fields:
        body.append(f'  <text x="36" y="{y}" font-family={FONT} font-size="10" font-weight="600" fill="#64748b">{esc(f)}</text>')
        body.append(f'  <rect x="36" y="{y+6}" width="{w-72}" height="22" rx="5" fill="#f8fafc" stroke="#e2e8f0"/>')
        y += 34
    if buttons:
        bx = 36
        for b in buttons:
            bw = max(72, len(b) * 12 + 24)
            body.append(f'  <rect x="{bx}" y="{y+8}" width="{bw}" height="28" rx="6" fill="#2563eb"/>')
            body.append(f'  <text x="{bx+bw/2}" y="{y+27}" text-anchor="middle" font-family={FONT} font-size="11" font-weight="600" fill="#fff">{esc(b)}</text>')
            bx += bw + 10
    save(rel, "\n".join(body) + "\n", w, h, title)


def hub_cards(title: str, rel: str, cards: list[tuple[str, str]], w: int = 480):
    h = 120 + ((len(cards) + 1) // 2) * 88
    body = [f'  <rect x="20" y="50" width="{w-40}" height="{h-90}" rx="12" fill="#fff" stroke="#e2e8f0"/>']
    body.append(f'  <text x="36" y="74" font-family={FONT} font-size="12" font-weight="700" fill="#334155">主控台</text>')
    for i, (name, sub) in enumerate(cards):
        col, row = i % 2, i // 2
        x = 36 + col * ((w - 72) // 2 + 8)
        y = 88 + row * 80
        cw = (w - 88) // 2
        hl = name in ("會計系統", "收支登錄", "待付款申請")
        stroke = "#2563eb" if hl else "#e2e8f0"
        fill = "#eff6ff" if hl else "#f8fafc"
        body.append(f'  <rect x="{x}" y="{y}" width="{cw}" height="68" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="{"2" if hl else "1"}"/>')
        body.append(f'  <text x="{x+12}" y="{y+28}" font-family={FONT} font-size="12" font-weight="700" fill="#0f172a">{esc(name)}</text>')
        body.append(f'  <text x="{x+12}" y="{y+48}" font-family={FONT} font-size="10" fill="#64748b">{esc(sub)}</text>')
    save(rel, "\n".join(body) + "\n", w, h, title)


def table_view(title: str, rel: str, cols: list[str], rows: list[list[str]], actions: list[str] | None = None, w: int = 560):
    actions = actions or []
    rh = 28
    h = 110 + rh * (len(rows) + 1) + (36 if actions else 0)
    body = [f'  <rect x="16" y="44" width="{w-32}" height="{h-80}" rx="10" fill="#fff" stroke="#cbd5e1"/>']
    cw = (w - 48) // len(cols)
    y = 72
    for i, c in enumerate(cols):
        body.append(f'  <text x="{28+i*cw}" y="{y}" font-family={FONT} font-size="10" font-weight="700" fill="#475569">{esc(c)}</text>')
    body.append(f'  <line x1="24" y1="{y+6}" x2="{w-24}" y2="{y+6}" stroke="#e2e8f0"/>')
    y += rh
    for row in rows:
        for i, cell in enumerate(row):
            body.append(f'  <text x="{28+i*cw}" y="{y}" font-family={FONT} font-size="10" fill="#334155">{esc(cell)}</text>')
        y += rh
    if actions:
        ax = 28
        for a in actions:
            bw = len(a) * 11 + 20
            body.append(f'  <rect x="{ax}" y="{y+4}" width="{bw}" height="24" rx="5" fill="#eff6ff" stroke="#93c5fd"/>')
            body.append(f'  <text x="{ax+bw/2}" y="{y+20}" text-anchor="middle" font-family={FONT} font-size="10" fill="#1d4ed8">{esc(a)}</text>')
            ax += bw + 8
    save(rel, "\n".join(body) + "\n", w, h, title)


def split_form(title: str, rel: str, left_label: str, left_fields: list[str], right_label: str, right_fields: list[str], w: int = 560):
    h = 140 + max(len(left_fields), len(right_fields)) * 30
    body = [f'  <rect x="16" y="44" width="{w-32}" height="{h-80}" rx="10" fill="#fff" stroke="#cbd5e1"/>']
    half = (w - 48) // 2
    for side, label, fields, ox in [(0, left_label, left_fields, 28), (1, right_label, right_fields, 28 + half + 8)]:
        body.append(f'  <rect x="{ox}" y="64" width="{half}" height="{h-110}" rx="8" fill="#{"f0fdf4" if side==0 else "eff6ff"}" stroke="#{"86efac" if side==0 else "93c5fd"}"/>')
        body.append(f'  <text x="{ox+half/2}" y="84" text-anchor="middle" font-family={FONT} font-size="11" font-weight="700" fill="#334155">{esc(label)}</text>')
        y = 100
        for f in fields:
            body.append(f'  <text x="{ox+10}" y="{y}" font-family={FONT} font-size="10" fill="#475569">{esc(f)}</text>')
            body.append(f'  <rect x="{ox+10}" y="{y+4}" width="{half-20}" height="18" rx="4" fill="#fff" stroke="#e2e8f0"/>')
            y += 30
    save(rel, "\n".join(body) + "\n", w, h, title)


def alloc_table(title: str, rel: str, w: int = 480):
    body = [
        '  <rect x="20" y="50" width="440" height="200" rx="10" fill="#fff" stroke="#cbd5e1"/>',
        '  <text x="36" y="78" font-family=' + FONT + ' font-size="11" font-weight="700" fill="#334155">分攤明細</text>',
        '  <text x="380" y="78" text-anchor="end" font-family=' + FONT + ' font-size="10" fill="#1d4ed8">合計 $3,500</text>',
        '  <text x="36" y="100" font-family=' + FONT + ' font-size="10" font-weight="600" fill="#64748b">案號 · 品項 · 金額</text>',
        '  <rect x="36" y="108" width="408" height="24" rx="4" fill="#f8fafc" stroke="#e2e8f0"/>',
        '  <text x="48" y="124" font-family=' + MONO + ' font-size="10" fill="#334155">TX2401 · 木工代工 · $2,000</text>',
        '  <rect x="36" y="138" width="408" height="24" rx="4" fill="#f8fafc" stroke="#e2e8f0"/>',
        '  <text x="48" y="154" font-family=' + MONO + ' font-size="10" fill="#334155">TX2401 · 運費 · $1,500</text>',
        '  <rect x="36" y="178" width="100" height="26" rx="6" fill="#eff6ff" stroke="#93c5fd"/>',
        '  <text x="86" y="196" text-anchor="middle" font-family=' + FONT + ' font-size="10" fill="#1d4ed8">＋ 新增一列</text>',
        '  <text x="36" y="230" font-family=' + FONT + ' font-size="10" fill="#166534">✓ 分攤加總＝支付金額</text>',
    ]
    save(rel, "\n".join(body) + "\n", w, 270, title)


def success_bar(title: str, rel: str, msg: str, w: int = 480):
    body = [
        '  <rect x="20" y="60" width="440" height="120" rx="10" fill="#fff" stroke="#cbd5e1"/>',
        '  <rect x="36" y="78" width="408" height="36" rx="8" fill="#dcfce7" stroke="#86efac"/>',
        f'  <text x="240" y="101" text-anchor="middle" font-family={FONT} font-size="12" font-weight="600" fill="#166534">{esc(msg)}</text>',
        '  <rect x="36" y="128" width="120" height="28" rx="6" fill="#2563eb"/>',
        '  <text x="96" y="147" text-anchor="middle" font-family=' + FONT + ' font-size="11" font-weight="600" fill="#fff">清空，再記一筆</text>',
        '  <rect x="168" y="128" width="88" height="28" rx="6" fill="#f1f5f9" stroke="#cbd5e1"/>',
        '  <text x="212" y="147" text-anchor="middle" font-family=' + FONT + ' font-size="11" fill="#475569">完成離開</text>',
        '  <text x="36" y="168" font-family=' + FONT + ' font-size="10" fill="#64748b">本輪已記 2 筆</text>',
    ]
    save(rel, "\n".join(body) + "\n", w, 210, title)


def flow_overview(title: str, rel: str, nodes: list[str], w: int = 400):
    h = 80 + len(nodes) * 52
    body = []
    y = 50
    for i, n in enumerate(nodes):
        st = "#f8fafc" if i == 0 else ("#dcfce7" if i == len(nodes) - 1 else "#eff6ff")
        body.append(f'  <rect x="100" y="{y}" width="200" height="36" rx="8" fill="{st}" stroke="#cbd5e1"/>')
        body.append(f'  <text x="200" y="{y+22}" text-anchor="middle" font-family={FONT} font-size="11" font-weight="600" fill="#334155">{esc(n)}</text>')
        if i < len(nodes) - 1:
            body.append(f'  <line x1="200" y1="{y+36}" x2="200" y2="{y+48}" stroke="#94a3b8" stroke-width="2"/>')
        y += 52
    save(rel, "\n".join(body) + "\n", w, h, title)


# ── accounting-ingest ──────────────────────────────────────────
def gen_accounting_ingest():
    line_chat(
        "LINE · 進出群文字記帳（收入 A）",
        "accounting-ingest/10-line-group-text.svg",
        [
            ("user", "收款日期：115/07/10\n客戶名：王小姐\n訂編：TX2401\n款項：尾款\n金額：50000\n付款方式：匯款"),
            ("bot", "✓ 已記好收入\n試算表第 128 列"),
        ],
    )
    line_chat(
        "LINE · 私訊傳圖開表單",
        "accounting-ingest/11-line-photo-form.svg",
        [
            ("user", "📷 收據照片"),
            ("bot", "已收到照片\n請點連結填寫收支登錄\n（請選「支出」）"),
        ],
    )
    line_chat(
        "LINE · #格式 範本",
        "accounting-ingest/12-line-format-help.svg",
        [
            ("user", "#格式"),
            ("bot", "格式 A（收入）\n格式 B（支出）\n點選複製範本"),
        ],
    )
    web_panel(
        "收支登錄 — 主畫面",
        "accounting-ingest/01-form-overview.svg",
        ["類型：收入 / 支出", "店別", "快選案場", "收款日期 · 客戶名 · 訂編", "款項類別 · 金額 · 付款方式"],
        ["送出這一筆"],
        badge="收支登錄",
    )
    hub_cards(
        "主控台 → 會計系統",
        "accounting-ingest/02-hub-card.svg",
        [("會計系統", "收支、請款、薪資"), ("我的出勤", "打卡與假勤"), ("案場工作區", "施工回報"), ("使用教學", "操作說明")],
    )
    split_form(
        "收入 vs 支出欄位",
        "accounting-ingest/05-income-vs-expense.svg",
        "收入 A", ["收款日期", "客戶名", "訂編", "款項類別", "金額", "入零用金"],
        "支出 B", ["支出日期", "廠商名稱", "支付金額", "分攤明細", "款項月份", "申請人"],
    )
    alloc_table("支出 — 案號分攤", "accounting-ingest/03-allocation.svg")
    success_bar("送出成功", "accounting-ingest/04-success-line-sync.svg", "✓ 已寫入試算表")


# ── payment-request ────────────────────────────────────────────
def gen_payment_request():
    hub_cards(
        "會計系統 → 待付款申請",
        "payment-request/01-menu-entry.svg",
        [("收支登錄", "已收已付"), ("待付款申請", "上傳單據送審"), ("請款審核", "主管 ≥5"), ("廠商待匯款", "財務 ≥4")],
    )
    web_panel(
        "上傳單據與 AI 辨識",
        "payment-request/02-upload-ocr.svg",
        ["① 工項分類", "② 選擇廠商", "拖曳上傳單據照片", "辨識結果：金額、日期、品項"],
        ["重新辨識"],
        badge="待付款申請",
    )
    web_panel(
        "確認廠商與帳號",
        "payment-request/03-vendor-bank.svg",
        ["廠商名稱：○○木作", "銀行代碼 · 帳號", "分攤案號 · 金額", "付款方式"],
        ["送出審核"],
    )
    web_panel(
        "送出審核",
        "payment-request/04-submit.svg",
        ["申請人（自動）", "備註", "附件預覽"],
        ["送出審核", "暫存"],
    )
    table_view(
        "請款審核列表",
        "payment-request/05-ledger-review.svg",
        ["廠商", "金額", "狀態", "申請日"],
        [["○○木作", "$12,000", "待審", "07/10"], ["△△五金", "$3,500", "待審", "07/11"]],
        ["快速核准", "審核"],
    )
    web_panel(
        "審核詳情",
        "payment-request/05b-review-detail.svg",
        ["請款單附件", "分攤明細", "廠商帳號"],
        ["核准", "退回"],
        badge="請款審核",
    )
    table_view(
        "廠商待匯款",
        "payment-request/06-finance-list.svg",
        ["☑", "廠商", "金額", "帳號"],
        [["☑", "○○木作", "$12,000", "完整"], ["☐", "△△五金", "$3,500", "缺帳號"]],
        ["匯出中信轉帳檔", "標記已匯款"],
    )
    web_panel(
        "匯出轉帳檔",
        "payment-request/06b-export-txt.svg",
        ["已勾選 2 筆", "匯出格式：中信 TAB", "下載檔案：transfer.txt"],
        ["下載轉帳檔"],
        badge="廠商待匯款",
    )
    web_panel(
        "款項進度查詢",
        "payment-request/07-vendor-status.svg",
        ["請款單編號", "狀態：已匯款", "收支已登錄"],
    )
    line_chat(
        "LINE · 審核通知",
        "payment-request/12-line-review-notify.svg",
        [
            ("bot", "【請款審核】\n○○木作 $12,000\n狀態：已核准\n→ 進入待匯款"),
        ],
    )


# ── payroll ────────────────────────────────────────────────────
def gen_payroll():
    web_panel(
        "個人頁 — 薪資核對",
        "payroll/02-personal-payroll-panel.svg",
        ["發薪期別：115/07 上期", "出勤天數 · 請假時數", "試算本薪 · 加班 · 津貼", "預估實領"],
        badge="我的出勤與假勤",
    )
    web_panel(
        "送出薪資核對",
        "payroll/03-submit-button.svg",
        ["確認無誤後送出", "送出後鎖定，須等退回才能改"],
        ["送出薪資核對"],
    )
    table_view(
        "薪資審核列表",
        "payroll/04-payroll-review.svg",
        ["員工", "期別", "狀態"],
        [["王小明", "115/07上期", "待審"], ["李小華", "115/07上期", "待審"]],
        ["審核"],
    )
    web_panel(
        "審核詳情",
        "payroll/04b-review-detail.svg",
        ["本薪 · 減項 · 加班", "一般獎金 · 扣款", "銀行帳戶"],
        ["核准", "退回"],
        badge="薪資審核",
    )
    web_panel(
        "退回原因",
        "payroll/04c-reject-reason.svg",
        ["退回原因（必填）", "例：病假時數有誤"],
        ["確認退回"],
    )
    table_view(
        "薪資待匯款",
        "payroll/05-payroll-finance.svg",
        ["☑", "員工", "實領", "帳號"],
        [["☑", "王小明", "$42,000", "完整"], ["☑", "李小華", "$38,500", "完整"]],
        ["匯出中信薪轉檔"],
    )
    web_panel(
        "匯出薪轉檔",
        "payroll/05b-export-txt.svg",
        ["已勾選 5 筆", "中信薪轉 TXT", "下載後至網銀上傳"],
        ["下載薪轉檔"],
        badge="薪資待匯款",
    )
    line_chat(
        "LINE · 薪資通知",
        "payroll/06-line-payslip-notify.svg",
        [("bot", "【薪資通知】\n115/07 上期已匯款\n實領 $42,000\n請至個人頁查看明細")],
    )
    web_panel(
        "實領歷史",
        "payroll/07-payslip-history.svg",
        ["期別", "實領金額", "匯款日", "明細下載"],
    )


# ── attendance / projects / design / budget ────────────────────
def gen_other():
    flow_overview(
        "出勤與假勤 — 怎麼選",
        "attendance/00-overview.svg",
        ["查自己 → 我的出勤", "要請假 → 假勤申請", "審假單 → 假勤審核", "排班 → 排班系統"],
    )
    web_panel("我的出勤與假勤", "attendance/01-my-personal.svg", ["月份切換", "打卡紀錄", "請假列表", "薪資核對區塊"], badge="個人頁")
    web_panel("線上假勤申請", "attendance/02-leave-request.svg", ["假別", "起迄日期", "時段 · 原因"], ["送出申請"])
    table_view("假勤審核", "attendance/03-approval.svg", ["員工", "假別", "日期"], [["王小明", "特休", "07/15"]], ["核准", "退回"])
    web_panel("員工排班系統", "attendance/04-schedule.svg", ["週次 · 店別", "班表格子", "儲存排班"], ["儲存"])

    flow_overview(
        "案場施工流程",
        "projects/00-flow.svg",
        ["建立案場", "專案工作區", "每日施工回報", "工作總覽"],
    )
    web_panel("新增案場", "projects/01-new-site.svg", ["客戶名", "訂編 · 地址", "開工日"], ["建立"])
    web_panel("專案工作區", "projects/02-console.svg", ["案場資訊", "文件 · 照片", "成員"], badge="工作區")
    web_panel("施工回報", "projects/03-report.svg", ["今日進度", "照片上傳", "備註"], ["送出回報"])
    web_panel("工作總覽", "projects/04-daily-report.svg", ["團隊今日回報", "燈號狀態"])

    hub_cards(
        "設計工具",
        "design/00-overview.svg",
        [("配置規劃", "LayoutPlanner"), ("平面圖校正", "Straightener"), ("使用教學", "操作說明")],
    )
    web_panel("配置規劃工具", "design/01-layout-planner.svg", ["案場平面圖", "家具配置", "輸出配置圖"], badge="LayoutPlanner")
    web_panel("平面圖校正", "design/02-floorplan-straightener.svg", ["上傳掃描圖", "拉直邊線", "匯出校正圖"])

    web_panel("報價單解析", "budget/01-budget-web.svg", ["上傳報價 PDF", "AI 解析工項", "編輯確認"], ["匯入預算"])
    web_panel("案場驗收表", "budget/02-budget-audit.svg", ["驗收項目", "實際數量", "照片"], ["送出驗收"])


if __name__ == "__main__":
    gen_accounting_ingest()
    gen_payment_request()
    gen_payroll()
    gen_other()
    print("done — all help mockups generated as SVG")
