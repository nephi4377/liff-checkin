#!/usr/bin/env python3
"""Generate help flowchart SVGs for 使用教學 — matches help.css palette."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "help"
FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif'

STYLES = {
    "start": ("#f8fafc", "#cbd5e1", "#334155"),
    "default": ("#eff6ff", "#bfdbfe", "#1e40af"),
    "end": ("#dcfce7", "#86efac", "#166534"),
    "emp": ("#f0fdf4", "#bbf7d0", "#166534"),
    "mgr": ("#fef3c7", "#fde68a", "#92400e"),
    "fin": ("#e0f2fe", "#7dd3fc", "#075985"),
    "line": ("#f0fdf4", "#86efac", "#166534"),
    "web": ("#eff6ff", "#93c5fd", "#1d4ed8"),
    "optional": ("#fff", "#cbd5e1", "#64748b"),
}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def box(x, y, w, h, lines, style="default", sub=None):
    fill, stroke, color = STYLES[style]
    dash = ' stroke-dasharray="6 4"' if style == "optional" else ""
    out = [
        f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{dash}/>'
    ]
    cy = y + h / 2 - (len(lines) - 1) * 8
    if sub:
        cy -= 6
    for i, line in enumerate(lines):
        fs = 13 if i == 0 else 11
        fw = 700 if i == 0 else 500
        ty = cy + i * 22
        out.append(
            f'  <text x="{x + w/2}" y="{ty}" text-anchor="middle" font-family={FONT} font-size="{fs}" font-weight="{fw}" fill="{color}">{esc(line)}</text>'
        )
    if sub:
        out.append(
            f'  <text x="{x + w/2}" y="{y + h - 10}" text-anchor="middle" font-family={FONT} font-size="10" fill="#64748b">{esc(sub)}</text>'
        )
    return "\n".join(out)


def arrow(x, y1, y2):
    return f'  <line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)"/>'


def label(x, y, text):
    return f'  <text x="{x}" y="{y}" text-anchor="middle" font-family={FONT} font-size="11" font-weight="600" fill="#64748b">{esc(text)}</text>'


def header(title, w=900):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 600" width="{w}" height="600">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="{w/2}" y="36" text-anchor="middle" font-family={FONT} font-size="20" font-weight="700" fill="#0f172a">{esc(title)}</text>
  <text x="{w/2}" y="58" text-anchor="middle" font-family={FONT} font-size="12" fill="#64748b">添心設計 · 內部系統使用教學</text>
'''


def footer():
    return "</svg>\n"


def save(name, content):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print("wrote", path.relative_to(ROOT.parent.parent))


# 1. Accounting overview — 手機單排窄圖；寬螢幕上二下一直排
def gen_accounting_overview():
    w, h = 520, 560
    s = header("會計與款項 — 怎麼選？", w)
    s = s.replace(f'viewBox="0 0 {w} 600" width="{w}" height="600"', f'viewBox="0 0 {w} {h}" width="{w}" height="{h}"')
    cx = w // 2
    s += box(cx - 90, 72, 180, 44, ["這筆款…"], "start")
    s += arrow(cx, 116, 136)
    # 上排兩欄
    pairs = [
        (70, "已收／已付", ["會計系統", "→ 收支登錄"], "default", ["直接記帳"], "end"),
        (270, "還沒付款", ["待付款申請"], "default", ["申請 → 審核 → 匯款"], "default"),
    ]
    for x, lab, l1, st1, l2, st2 in pairs:
        s += label(x + 90, 152, lab)
        s += box(x, 162, 180, 50, l1, st1)
        s += arrow(x + 90, 212, 232)
        s += box(x, 236, 180, 44, l2, st2)
    # 下排置中
    x3 = 170
    s += label(x3 + 90, 308, "員工薪資")
    s += box(x3, 318, 180, 44, ["員工送審"], "emp")
    s += arrow(x3 + 90, 362, 382)
    s += box(x3, 386, 180, 44, ["審核 → 匯款"], "end")
    s += footer()
    save("00-accounting-overview.svg", s)


# 2. Accounting ingest
def gen_accounting_ingest():
    w = 900
    s = header("收支登錄 — 總流程", w)
    cx = w // 2
    s += box(cx - 130, 78, 260, 52, ["款項已收／已付？"], "start", "否 → 請改看「待付款申請」")
    s += arrow(cx, 130, 158)
    # LINE col
    s += label(225, 168, "LINE 模式")
    s += box(135, 178, 180, 52, ["進出群 A/B 格式", "或私訊傳圖"], "line")
    s += arrow(225, 230, 250)
    s += box(135, 254, 180, 40, ["系統解析／帶照片"], "default")
    s += arrow(225, 294, 314)
    s += box(135, 318, 180, 40, ["寫入試算表"], "end")
    # WEB col
    s += label(675, 168, "網頁模式")
    s += box(585, 178, 180, 52, ["會計系統", "→ 收支登錄"], "web")
    s += arrow(675, 230, 250)
    s += box(585, 254, 180, 40, ["填表單＋分攤＋照片"], "default")
    s += arrow(675, 294, 314)
    s += box(585, 318, 180, 40, ["送出記帳"], "end")
    s += f'  <text x="{cx}" y="390" text-anchor="middle" font-family={FONT} font-size="11" fill="#64748b">權限 ≥ 2（行政以上）</text>'
    s += footer()
    save("accounting-ingest/00-flow-diagram.svg", s)


# 3. Payment request main
def gen_payment_request_main():
    w = 900
    s = header("待付款申請 — 總流程", w)
    cx = w // 2
    s += box(cx - 70, 78, 140, 40, ["錢還沒付"], "start")
    s += arrow(cx, 118, 148)
    s += label(225, 158, "LINE（選用）")
    s += box(135, 168, 180, 52, ["#請款", "開啟待付款申請"], "line")
    s += label(675, 158, "網頁（主要）")
    s += box(585, 168, 180, 52, ["待付款申請", "上傳、辨識、送審"], "web")
    s += arrow(225, 220, 268)
    s += arrow(675, 212, 268)
    s += box(cx - 110, 272, 220, 44, ["請款審核（權限 ≥ 5）"], "mgr")
    s += arrow(cx, 316, 336)
    s += box(cx - 110, 340, 220, 44, ["廠商待匯款（權限 ≥ 4）"], "fin")
    s += arrow(cx, 384, 404)
    s += box(cx - 90, 408, 180, 40, ["匯款＋登錄收支"], "end")
    s += footer()
    save("payment-request/00-flow-diagram.svg", s)


def gen_payment_request_apply():
    w = 900
    s = header("待付款申請 — 申請階段", w)
    s += label(225, 88, "LINE（開啟入口）")
    s += box(135, 98, 180, 40, ["打 #請款"], "line")
    s += arrow(225, 138, 158)
    s += box(135, 162, 180, 44, ["回覆開啟", "待付款申請"], "default")
    s += arrow(225, 206, 226)
    s += box(135, 230, 180, 44, ["到網頁送審"], "end")
    s += label(675, 88, "網頁（主要）")
    s += box(585, 98, 180, 40, ["開啟表單"], "web")
    s += arrow(675, 138, 158)
    s += box(585, 162, 180, 36, ["①傳單據 ②辨識"], "default")
    s += arrow(675, 198, 214)
    s += box(585, 218, 180, 36, ["③確認收款人 ④送出"], "default")
    s += arrow(675, 254, 270)
    s += box(585, 274, 180, 40, ["進請款審核"], "end")
    s += footer()
    save("payment-request/01-apply-flow.svg", s)


def gen_payment_request_review():
    w = 700
    s = header("待付款申請 — 審核階段", w)
    cx = w // 2
    s += box(cx - 70, 78, 140, 40, ["待審列表"], "start")
    s += arrow(cx, 118, 138)
    s += box(cx - 100, 142, 200, 40, ["看請款單／附件"], "default")
    s += arrow(cx, 182, 202)
    s += label(175, 218, "快速核准")
    s += box(85, 228, 180, 40, ["進待匯款"], "end")
    s += label(525, 218, "詳審")
    s += box(435, 228, 180, 40, ["改案號／分攤"], "default")
    s += arrow(525, 268, 288)
    s += box(435, 292, 180, 40, ["核准或退回"], "end")
    s += f'  <text x="{cx}" y="360" text-anchor="middle" font-family={FONT} font-size="11" fill="#64748b">核准時不寫收支；等財務匯款後才登錄</text>'
    s += footer()
    save("payment-request/02-review-flow.svg", s)


def gen_payment_request_finance():
    w = 700
    s = header("待付款申請 — 匯款階段", w)
    cx = w // 2
    s += box(cx - 80, 78, 160, 40, ["待匯款清單"], "start")
    s += arrow(cx, 118, 138)
    s += box(cx - 80, 142, 160, 40, ["勾選本期項目"], "fin")
    s += arrow(cx, 182, 202)
    s += label(175, 218, "匯出 TXT")
    s += box(85, 228, 180, 40, ["中信轉帳檔"], "default")
    s += arrow(175, 268, 288)
    s += box(85, 292, 180, 44, ["寫收支＋已匯款"], "end")
    s += label(525, 218, "手動結案")
    s += box(435, 228, 180, 40, ["標記已匯款"], "default")
    s += arrow(525, 268, 288)
    s += box(435, 292, 180, 44, ["同樣寫收支"], "end")
    s += footer()
    save("payment-request/03-finance-flow.svg", s)


def gen_payroll_main():
    w = 700
    s = header("薪資 — 總流程", w)
    cx = w // 2
    s += box(cx - 100, 78, 200, 44, ["員工：核對並送審"], "emp")
    s += arrow(cx, 122, 142)
    s += box(cx - 110, 146, 220, 44, ["主管：薪資審核 ≥ 5"], "mgr")
    s += arrow(cx, 190, 210)
    s += label(175, 228, "核准")
    s += box(85, 238, 180, 44, ["財務：待匯款 ≥ 4"], "fin")
    s += arrow(175, 282, 302)
    s += box(85, 306, 180, 40, ["員工查看實領"], "end")
    s += label(525, 228, "退回")
    s += box(435, 238, 180, 40, ["填退回原因"], "mgr")
    s += arrow(525, 278, 298)
    s += box(435, 302, 180, 40, ["員工修改後重送"], "emp")
    s += f'  <text x="{cx}" y="380" text-anchor="middle" font-family={FONT} font-size="11" fill="#64748b">考勤儀表板不再審核薪資，請到會計模組處理</text>'
    s += footer()
    save("payroll/00-flow-diagram.svg", s)


def gen_payroll_employee():
    w = 520
    s = header("薪資 — 員工送審", w)
    cx = w // 2
    steps = [
        ("我的出勤與假勤", "start"),
        ("選發薪期別", "default"),
        ("檢查出勤、請假、試算", "default"),
        ("異常？提出說明申訴", "optional"),
        ("送出薪資核對", "end"),
    ]
    y = 78
    for i, (text, st) in enumerate(steps):
        s += box(cx - 110, y, 220, 40, [text], st)
        if i < len(steps) - 1:
            s += arrow(cx, y + 40, y + 52)
        y += 64
    s += f'  <text x="{cx}" y="400" text-anchor="middle" font-family={FONT} font-size="11" fill="#64748b">須等該期最後一天下班後才能送出</text>'
    s += footer()
    save("payroll/01-employee-flow.svg", s)


def gen_payroll_review():
    w = 700
    s = header("薪資 — 審核階段", w)
    cx = w // 2
    s += box(cx - 70, 78, 140, 40, ["待審列表"], "start")
    s += arrow(cx, 118, 138)
    s += box(cx - 150, 142, 300, 44, ["開啟送審單（員工自審／主管代開）"], "default")
    s += arrow(cx, 186, 206)
    s += box(cx - 170, 210, 340, 44, ["核對本薪、減項、獎金；專案報酬僅對照"], "default")
    s += arrow(cx, 254, 274)
    s += label(175, 290, "核准")
    s += box(85, 300, 180, 40, ["填獎金、扣款、備註"], "default")
    s += arrow(175, 340, 352)
    s += box(85, 356, 180, 40, ["進薪資待匯款"], "end")
    s += label(525, 290, "退回")
    s += box(435, 300, 180, 40, ["填退回原因"], "mgr")
    s += arrow(525, 340, 352)
    s += box(435, 356, 180, 40, ["員工修改後重送"], "emp")
    s += footer()
    save("payroll/02-review-flow.svg", s)


def gen_payroll_finance():
    w = 520
    s = header("薪資 — 匯款階段", w)
    cx = w // 2
    steps = [
        ("薪資待匯款列表", "start"),
        ("勾選本期項目", "fin"),
        ("匯出中信薪轉檔", "default"),
        ("銀行完成匯款", "default"),
        ("標記已匯＋通知員工", "end"),
    ]
    y = 78
    for i, (text, st) in enumerate(steps):
        s += box(cx - 110, y, 220, 40, [text], st)
        if i < len(steps) - 1:
            s += arrow(cx, y + 40, y + 52)
        y += 64
    s += footer()
    save("payroll/03-finance-flow.svg", s)


if __name__ == "__main__":
    gen_accounting_overview()
    gen_accounting_ingest()
    gen_payment_request_main()
    gen_payment_request_apply()
    gen_payment_request_review()
    gen_payment_request_finance()
    gen_payroll_main()
    gen_payroll_employee()
    gen_payroll_review()
    gen_payroll_finance()
    print("done")
