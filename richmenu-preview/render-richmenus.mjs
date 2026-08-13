/**
 * LINE Rich Menu — 員工／客戶未綁四格／會員六格 2500×1686（全幅）、廠商 2500×843。
 * 版型：V2 內部版；客戶版對齊 2026-07-28 定稿。
 *
 * 執行：npm install && node render-richmenus.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 低飽和色票（莫蘭迪感、工地現場也耐看） */
const M = {
  bg0: "#f0f2f5",
  bg1: "#e4e8ee",
  in0: "#8f9eb0",
  in1: "#6f7d8f",
  rep0: "#8fa9a3",
  rep1: "#6e8580",
  hub0: "#4b5563",
  hub1: "#374151",
  /** 客戶版第三格：中性灰藍 */
  ct0: "#8d97a3",
  ct1: "#6f7782",
  ink: "#2b3036",
  sub: "rgba(255,255,255,0.82)",
};

function employeeSvg() {
  const w = 2500;
  const h = 1686;
  const r = 52;
  const p = 40;
  const topH = 843;
  const botY = 843;
  const cardW = 1250 - 2 * p;
  const cardH = topH - 2 * p;
  const botH = 843 - 2 * p;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.bg0}"/>
      <stop offset="100%" stop-color="${M.bg1}"/>
    </linearGradient>
    <linearGradient id="gIn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.in0}"/>
      <stop offset="100%" stop-color="${M.in1}"/>
    </linearGradient>
    <linearGradient id="gRep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.rep0}"/>
      <stop offset="100%" stop-color="${M.rep1}"/>
    </linearGradient>
    <linearGradient id="gHub" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${M.hub0}"/>
      <stop offset="100%" stop-color="${M.hub1}"/>
    </linearGradient>
    <filter id="sh" x="-6%" y="-6%" width="112%" height="116%">
      <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#1e293b" flood-opacity="0.11"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>

  <!-- Zone A -->
  <g filter="url(#sh)">
    <rect x="${p}" y="${p}" width="${cardW}" height="${cardH}" rx="${r}" fill="url(#gIn)"/>
  </g>
  <g transform="translate(625,360)" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="11" stroke-linecap="round">
    <circle r="118" cx="0" cy="0"/>
    <path d="M0-86v52M-86 0h172"/>
  </g>
  <text x="625" y="698" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="60" font-weight="700" fill="#ffffff">打卡</text>
  <text x="625" y="758" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="28" font-weight="500" fill="${M.sub}">Check-in</text>

  <!-- Zone B -->
  <g filter="url(#sh)">
    <rect x="${1250 + p}" y="${p}" width="${cardW}" height="${cardH}" rx="${r}" fill="url(#gRep)"/>
  </g>
  <g transform="translate(1875,378)" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="11" stroke-linejoin="round">
    <rect x="-148" y="-118" width="296" height="256" rx="24" fill="rgba(255,255,255,0.08)"/>
    <path d="M-108-12h216M-108 48h168M-108 108h196"/>
  </g>
  <text x="1875" y="698" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="60" font-weight="700" fill="#ffffff">施工回報</text>
  <text x="1875" y="758" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="28" font-weight="500" fill="${M.sub}">Site report</text>

  <!-- Zone C -->
  <g filter="url(#sh)">
    <rect x="${p}" y="${botY + p}" width="${2500 - 2 * p}" height="${botH}" rx="${r}" fill="url(#gHub)"/>
  </g>
  <g transform="translate(1250,1080)" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="11" stroke-linecap="round">
    <path d="M-280 0h560M-280 120h560M-280 240h560"/>
    <circle cx="-200" cy="0" r="28"/><circle cx="-200" cy="120" r="28"/><circle cx="-200" cy="240" r="28"/>
  </g>
  <text x="1250" y="1378" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="66" font-weight="700" fill="#ffffff">整合主控台</text>
  <text x="1250" y="1445" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="28" font-weight="500" fill="${M.sub}">Hub · 內部工具</text>
</svg>`;
}

function vendorSvg() {
  const w = 2500;
  const h = 843;
  const r = 44;
  const p = 28;
  const split = 1251;
  const leftCardW = split - 2 * p;
  const rightX = split + 16;
  const rightW = w - rightX - p;
  const midRight = rightX + rightW / 2;
  const midLeft = p + leftCardW / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="vl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.bg0}"/>
      <stop offset="100%" stop-color="#f7f8fa"/>
    </linearGradient>
    <linearGradient id="vr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.rep0}"/>
      <stop offset="100%" stop-color="${M.rep1}"/>
    </linearGradient>
    <filter id="vs" x="-5%" y="-12%" width="110%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#1e293b" flood-opacity="0.09"/>
    </filter>
  </defs>
  <rect width="${split}" height="${h}" fill="url(#vl)"/>
  <rect x="${split}" width="${w - split}" height="${h}" fill="${M.bg1}"/>

  <g filter="url(#vs)">
    <rect x="${p}" y="${p}" width="${leftCardW}" height="${h - 2 * p}" rx="${r}" fill="#fafbfc" stroke="#dde1e6" stroke-width="2"/>
  </g>
  <g transform="translate(${midLeft}, 300)" fill="none" stroke="#7a8490" stroke-width="11" stroke-linejoin="round">
    <path d="M-150-70 L90-70 L130 10 L130 200 L-190 200 L-190 10 Z"/>
    <path d="M-100 50 C-30-30 30-30 100 50 C30 130-100 130-100 50"/>
  </g>
  <text x="${midLeft}" y="618" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="48" font-weight="700" fill="${M.ink}">協力夥伴</text>
  <text x="${midLeft}" y="676" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="26" font-weight="500" fill="#6b7280">添心工程 · 感謝配合</text>

  <g filter="url(#vs)">
    <rect x="${rightX}" y="${p}" width="${rightW}" height="${h - 2 * p}" rx="${r}" fill="url(#vr)"/>
  </g>
  <g transform="translate(${midRight}, 318)" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="11" stroke-linejoin="round">
    <rect x="-168" y="-142" width="336" height="284" rx="26" fill="rgba(255,255,255,0.08)"/>
    <path d="M-118-28h236M-118 32h188M-118 92h208"/>
    <path d="M72-100 L124-48 L216-118" stroke-linecap="round" stroke-width="13"/>
  </g>
  <text x="${midRight}" y="592" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="66" font-weight="800" fill="#ffffff">施工回報</text>
  <text x="${midRight}" y="656" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="28" font-weight="500" fill="${M.sub}">點此上傳進度與照片</text>
</svg>`;
}

/** 客戶色票：對齊落地頁米白／木質／植栽綠（與內部冷灰分開） */
const C = {
  canvas: "#f7f3ea",
  ink: "#2a3c35",
  muted: "#5c6b62",
  accent: "#3d5a4c",
};

/** 客戶未綁｜四格 2×2（熱區與 createCustomerRichMenus.js 一致：1250×422 + 1250×421） */
function customerGuestSvg() {
  const w = 2500;
  const h = 843;
  const p = 22;
  const r = 40;
  const colWidths = [1250, 1250];
  const rowHeights = [422, 421];
  const labels = [
    { title: "申請綁定專案", sub: "把案子跟您連在一起", fill: "cgSand", row: 0, col: 0 },
    { title: "了解添心", sub: "看看我們怎麼做家", fill: "cgSage", row: 0, col: 1 },
    { title: "常見問題", sub: "先幫您解惑", fill: "cgLinen", row: 1, col: 0 },
    { title: "Facebook", sub: "看作品日常", fill: "cgStone", row: 1, col: 1 },
  ];
  const cards = labels.map((lb) => {
    const cellX = colWidths.slice(0, lb.col).reduce((a, b) => a + b, 0);
    const cellY = rowHeights.slice(0, lb.row).reduce((a, b) => a + b, 0);
    const cw = colWidths[lb.col];
    const ch = rowHeights[lb.row];
    const cx = cellX + cw / 2;
    const cy = cellY + ch / 2;
    return `
  <g filter="url(#csh)">
    <rect x="${cellX + p}" y="${cellY + p}" width="${cw - 2 * p}" height="${ch - 2 * p}" rx="${r}" fill="url(#${lb.fill})"/>
  </g>
  <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="46" font-weight="700" fill="${C.ink}">${lb.title}</text>
  <text x="${cx}" y="${cy + 46}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="26" font-weight="500" fill="${C.muted}">${lb.sub}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#faf7f0"/>
      <stop offset="100%" stop-color="${C.canvas}"/>
    </linearGradient>
    <linearGradient id="cgSand" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f3e6d4"/><stop offset="100%" stop-color="#ead9c4"/></linearGradient>
    <linearGradient id="cgSage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e4eee6"/><stop offset="100%" stop-color="#d5e0d4"/></linearGradient>
    <linearGradient id="cgLinen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#faf6ee"/><stop offset="100%" stop-color="#f3eadc"/></linearGradient>
    <linearGradient id="cgStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eee8de"/><stop offset="100%" stop-color="#e4ddd0"/></linearGradient>
    <filter id="csh" x="-5%" y="-10%" width="110%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#2a3c35" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#cbg)"/>
${cards}
</svg>`;
}

/** 客戶會員｜六格 3×2（熱區與 createCustomerRichMenus.js 一致：834+833+833 × 422+421） */
function customerMemberSvg() {
  const w = 2500;
  const h = 843;
  const p = 16;
  const r = 32;
  const colWidths = [834, 833, 833];
  const rowHeights = [422, 421];
  const fills = ["cgSand", "cgSage", "cgLinen", "cgSage", "cgLinen", "cgStone"];
  const labels = [
    { title: "收款確認", sub: "核對這一期款項", fill: fills[0], row: 0, col: 0 },
    { title: "我的案場", sub: "選材與案子紀錄", fill: fills[1], row: 0, col: 1 },
    { title: "綁定新專案", sub: "再加一個案子", fill: fills[2], row: 0, col: 2 },
    { title: "了解添心", sub: "看看我們怎麼做家", fill: fills[3], row: 1, col: 0 },
    { title: "常見問題", sub: "先幫您解惑", fill: fills[4], row: 1, col: 1 },
    { title: "Facebook", sub: "看作品日常", fill: fills[5], row: 1, col: 2 },
  ];
  const cards = labels.map((lb) => {
    const cellX = colWidths.slice(0, lb.col).reduce((a, b) => a + b, 0);
    const cellY = rowHeights.slice(0, lb.row).reduce((a, b) => a + b, 0);
    const cw = colWidths[lb.col];
    const ch = rowHeights[lb.row];
    const cx = cellX + cw / 2;
    const cy = cellY + ch / 2;
    const fs = lb.title.length > 5 ? 34 : 38;
    return `
  <g filter="url(#msh)">
    <rect x="${cellX + p}" y="${cellY + p}" width="${cw - 2 * p}" height="${ch - 2 * p}" rx="${r}" fill="url(#${lb.fill})"/>
  </g>
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="${fs}" font-weight="700" fill="${C.ink}">${lb.title}</text>
  <text x="${cx}" y="${cy + 42}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="20" font-weight="500" fill="${C.muted}">${lb.sub}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="mbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#faf7f0"/>
      <stop offset="100%" stop-color="${C.canvas}"/>
    </linearGradient>
    <linearGradient id="cgSand" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f3e6d4"/><stop offset="100%" stop-color="#ead9c4"/></linearGradient>
    <linearGradient id="cgSage" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e4eee6"/><stop offset="100%" stop-color="#d5e0d4"/></linearGradient>
    <linearGradient id="cgLinen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#faf6ee"/><stop offset="100%" stop-color="#f3eadc"/></linearGradient>
    <linearGradient id="cgStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eee8de"/><stop offset="100%" stop-color="#e4ddd0"/></linearGradient>
    <filter id="msh" x="-4%" y="-10%" width="108%" height="125%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#2a3c35" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#mbg)"/>
${cards}
</svg>`;
}

/** @deprecated 舊三格客戶版；保留供對照，不再輸出 */
function customerSvgLegacy() {
  const w = 2500;
  const h = 843;
  const p = 28;
  const r = 40;
  const w0 = 834;
  const w1 = 833;
  const w2 = 833;
  const cx0 = w0 / 2;
  const cx1 = w0 + w1 / 2;
  const cx2 = w0 + w1 + w2 / 2;
  const ch = h - 2 * p;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.bg0}"/>
      <stop offset="100%" stop-color="${M.bg1}"/>
    </linearGradient>
    <linearGradient id="cg0" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.in0}"/>
      <stop offset="100%" stop-color="${M.in1}"/>
    </linearGradient>
    <linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.rep0}"/>
      <stop offset="100%" stop-color="${M.rep1}"/>
    </linearGradient>
    <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.ct0}"/>
      <stop offset="100%" stop-color="${M.ct1}"/>
    </linearGradient>
    <filter id="csh" x="-5%" y="-10%" width="110%" height="125%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#1e293b" flood-opacity="0.1"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#cbg)"/>

  <!-- 欄 0：0–834 -->
  <g filter="url(#csh)">
    <rect x="${p}" y="${p}" width="${w0 - 2 * p}" height="${ch}" rx="${r}" fill="url(#cg0)"/>
  </g>
  <g transform="translate(${cx0}, 300)" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="10" stroke-linejoin="round">
    <rect x="-120" y="-100" width="240" height="200" rx="20" fill="rgba(255,255,255,0.08)"/>
    <path d="M-80-20h160M-80 20h120M-80 60h140"/>
    <circle cx="88" cy="-52" r="14" fill="rgba(255,255,255,0.35)" stroke="none"/>
  </g>
  <text x="${cx0}" y="600" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="52" font-weight="700" fill="#ffffff">施工進度</text>
  <text x="${cx0}" y="658" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="24" font-weight="500" fill="${M.sub}">唯讀日誌與驗收摘要</text>

  <!-- 欄 1：834–1667 -->
  <g filter="url(#csh)">
    <rect x="${w0 + p}" y="${p}" width="${w1 - 2 * p}" height="${ch}" rx="${r}" fill="url(#cg1)"/>
  </g>
  <g transform="translate(${cx1}, 308)" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="10" stroke-linejoin="round">
    <rect x="-110" y="-88" width="220" height="176" rx="18" fill="rgba(255,255,255,0.08)"/>
    <path d="M-88-40h176M-88 0h176M-88 40h132"/>
    <path d="M-40-88 L-40-120 L40-120 L40-88" stroke-linecap="round"/>
  </g>
  <text x="${cx1}" y="600" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="52" font-weight="700" fill="#ffffff">服務資訊</text>
  <text x="${cx1}" y="658" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="24" font-weight="500" fill="${M.sub}">添心官網與作品</text>

  <!-- 欄 2：1667–2500 -->
  <g filter="url(#csh)">
    <rect x="${w0 + w1 + p}" y="${p}" width="${w2 - 2 * p}" height="${ch}" rx="${r}" fill="url(#cg2)"/>
  </g>
  <g transform="translate(${cx2}, 300)">
    <circle r="78" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.9)" stroke-width="10"/>
    <text x="0" y="22" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="rgba(255,255,255,0.95)">?</text>
  </g>
  <text x="${cx2}" y="600" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="52" font-weight="700" fill="#ffffff">常見問答</text>
  <text x="${cx2}" y="658" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="24" font-weight="500" fill="${M.sub}">流程、費用、時程一次查</text>
</svg>`;
}

const WASH = {
  /** 2026-08-13 總監定案：奶油金＋現況排列 */
  sand: { top: "#C9A258", topOp: "0.22", bot: "#3A2814", botOp: "0.68" },
  sage: { top: "#BAA88C", topOp: "0.22", bot: "#2E2418", botOp: "0.70" },
  linen: { top: "#FAF0DC", topOp: "0.18", bot: "#4A3A24", botOp: "0.64" },
  stone: { top: "#B08E62", topOp: "0.22", bot: "#2A2016", botOp: "0.72" },
};

function bgFile(name) {
  return path.join(__dirname, "bg", name);
}

async function roundedPhotoCell({ src, w, h, wash, radius, zoom = 1.42 }) {
  const zw = Math.max(w, Math.round(w * zoom));
  const zh = Math.max(h, Math.round(h * zoom));
  const grown = await sharp(src)
    .resize(zw, zh, { fit: "cover", position: "attention" })
    .toBuffer();
  const photo = await sharp(grown)
    .extract({
      left: Math.floor((zw - w) / 2),
      top: Math.floor((zh - h) / 2),
      width: w,
      height: h,
    })
    .toBuffer();
  const washSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${wash.top}" stop-opacity="${wash.topOp}"/>
        <stop offset="100%" stop-color="${wash.bot}" stop-opacity="${wash.botOp}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`);
  const tinted = await sharp(photo)
    .composite([{ input: washSvg, blend: "over" }])
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" fill="#fff"/></svg>`
  );
  return sharp(tinted)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function customerTextSvg(w, h, cells) {
  const texts = cells.map((c) => {
    const fs = c.fs || (c.title.length > 5 ? 118 : 132);
    const subFs = c.subFs || 48;
    return `
  <text x="${c.cx}" y="${c.cy - 12}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="${fs}" font-weight="700" fill="#faf7f0">${c.title}</text>
  <text x="${c.cx}" y="${c.cy + 56}" text-anchor="middle" font-family="Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif" font-size="${subFs}" font-weight="600" fill="rgba(250,247,240,0.96)">${c.sub}</text>`;
  }).join("");
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="ts"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#2a2018" flood-opacity="0.75"/></filter>
  </defs>
  <g filter="url(#ts)">${texts}</g>
</svg>`);
}

async function renderCustomerPhotoMenu({ colWidths, rowHeights, pad, radius, cells, pngPath, jpgPath }) {
  const w = 2500;
  const h = 1686;
  const composites = [];
  const textCells = [];
  for (const cell of cells) {
    const cellX = colWidths.slice(0, cell.col).reduce((a, b) => a + b, 0);
    const cellY = rowHeights.slice(0, cell.row).reduce((a, b) => a + b, 0);
    const cw = colWidths[cell.col];
    const ch = rowHeights[cell.row];
    const innerW = cw - 2 * pad;
    const innerH = ch - 2 * pad;
    const buf = await roundedPhotoCell({
      src: cell.src,
      w: innerW,
      h: innerH,
      wash: cell.wash,
      radius,
    });
    composites.push({ input: buf, left: cellX + pad, top: cellY + pad });
    textCells.push({
      title: cell.title,
      sub: cell.sub,
      cx: cellX + cw / 2,
      cy: cellY + ch - 140,
      fs: cell.fs,
      subFs: cell.subFs,
    });
  }
  const canvas = sharp({
    create: { width: w, height: h, channels: 3, background: { r: 247, g: 243, b: 234 } },
  });
  const withPhotos = await canvas.composite(composites).png().toBuffer();
  const withText = await sharp(withPhotos)
    .composite([{ input: await sharp(customerTextSvg(w, h, textCells)).png().toBuffer() }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(withText).toFile(pngPath);
  await sharp(withText).jpeg({ quality: 86, mozjpeg: true }).toFile(jpgPath);
}

async function main() {
  const outDir = __dirname;
  const empSvgBuf = Buffer.from(employeeSvg(), "utf8");
  const venSvgBuf = Buffer.from(vendorSvg(), "utf8");

  const empPng = path.join(outDir, "employee_richmenu_v2.png");
  const venPng = path.join(outDir, "vendor_richmenu_v2.png");
  const guestPng = path.join(outDir, "customer_guest_richmenu_v1.png");
  const memberPng = path.join(outDir, "customer_member_richmenu_v1.png");
  const empJpg = path.join(outDir, "employee_richmenu_v2.jpg");
  const venJpg = path.join(outDir, "vendor_richmenu_v2.jpg");
  const guestJpg = path.join(outDir, "customer_guest_richmenu_v1.jpg");
  const memberJpg = path.join(outDir, "customer_member_richmenu_v1.jpg");

  await sharp(empSvgBuf).png({ compressionLevel: 9 }).toFile(empPng);
  await sharp(venSvgBuf).png({ compressionLevel: 9 }).toFile(venPng);
  await sharp(empSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(empJpg);
  await sharp(venSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(venJpg);

  await renderCustomerPhotoMenu({
    colWidths: [1250, 1250],
    rowHeights: [843, 843],
    pad: 8,
    radius: 18,
    pngPath: guestPng,
    jpgPath: guestJpg,
    cells: [
      { row: 0, col: 0, src: bgFile("sand-closet.jpg"), wash: WASH.sand, title: "申請綁定專案", sub: "把案子跟您連在一起" },
      { row: 0, col: 1, src: bgFile("sage-green-sofa.jpg"), wash: WASH.sage, title: "了解添心", sub: "看看我們怎麼做家" },
      { row: 1, col: 0, src: bgFile("linen-american.jpg"), wash: WASH.linen, title: "常見問題", sub: "先幫您解惑" },
      { row: 1, col: 1, src: bgFile("stone-glass.jpg"), wash: WASH.stone, title: "Facebook", sub: "看作品日常" },
    ],
  });

  await renderCustomerPhotoMenu({
    colWidths: [834, 833, 833],
    rowHeights: [843, 843],
    pad: 6,
    radius: 14,
    pngPath: memberPng,
    jpgPath: memberJpg,
    cells: [
      { row: 0, col: 0, src: bgFile("sand-workspace.jpg"), wash: WASH.sand, title: "收款確認", sub: "核對這一期款項", fs: 96, subFs: 40 },
      { row: 0, col: 1, src: bgFile("sage-living.jpg"), wash: WASH.sage, title: "我的案場", sub: "選材與案子紀錄", fs: 96, subFs: 40 },
      { row: 0, col: 2, src: bgFile("linen-kids.jpg"), wash: WASH.linen, title: "綁定新專案", sub: "再加一個案子", fs: 88, subFs: 40 },
      { row: 1, col: 0, src: bgFile("sage-green-sofa.jpg"), wash: WASH.sage, title: "了解添心", sub: "看看我們怎麼做家", fs: 96, subFs: 40 },
      { row: 1, col: 1, src: bgFile("linen-american.jpg"), wash: WASH.linen, title: "常見問題", sub: "先幫您解惑", fs: 96, subFs: 40 },
      { row: 1, col: 2, src: bgFile("stone-glass.jpg"), wash: WASH.stone, title: "Facebook", sub: "看作品日常", fs: 96, subFs: 40 },
    ],
  });

  const em = await sharp(empPng).metadata();
  const ve = await sharp(venPng).metadata();
  const gu = await sharp(guestPng).metadata();
  const me = await sharp(memberPng).metadata();
  console.log("OK", empPng, em.width, "x", em.height, "(employee)");
  console.log("OK", venPng, ve.width, "x", ve.height, "(vendor)");
  console.log("OK", guestPng, gu.width, "x", gu.height, "(customer guest 2x2)");
  console.log("OK", memberPng, me.width, "x", me.height, "(customer member 3x2)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
