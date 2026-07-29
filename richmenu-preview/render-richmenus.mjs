/**
 * LINE Rich Menu — 員工 2500×1686、廠商 2500×843、客戶未綁四格／會員六格 2500×843。
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

/** 客戶未綁｜四格 2×2（熱區與 createCustomerRichMenus.js 一致：1250×422 + 1250×421） */
function customerGuestSvg() {
  const w = 2500;
  const h = 843;
  const p = 20;
  const r = 32;
  const colWidths = [1250, 1250];
  const rowHeights = [422, 421];
  const labels = [
    { title: "申請綁定專案", sub: "綁定裝修案", grad: "cg0", row: 0, col: 0 },
    { title: "了解添心", sub: "公司介紹", grad: "cg1", row: 0, col: 1 },
    { title: "常見問題", sub: "FAQ", grad: "cg2", row: 1, col: 0 },
    { title: "Facebook", sub: "外開社群", grad: "cg3", row: 1, col: 1 },
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
    <rect x="${cellX + p}" y="${cellY + p}" width="${cw - 2 * p}" height="${ch - 2 * p}" rx="${r}" fill="url(#${lb.grad})"/>
  </g>
  <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${lb.title}</text>
  <text x="${cx}" y="${cy + 58}" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="24" font-weight="500" fill="${M.sub}">${lb.sub}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.bg0}"/>
      <stop offset="100%" stop-color="${M.bg1}"/>
    </linearGradient>
    <linearGradient id="cg0" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.in0}"/><stop offset="100%" stop-color="${M.in1}"/></linearGradient>
    <linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.rep0}"/><stop offset="100%" stop-color="${M.rep1}"/></linearGradient>
    <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.ct0}"/><stop offset="100%" stop-color="${M.ct1}"/></linearGradient>
    <linearGradient id="cg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7a8a9a"/><stop offset="100%" stop-color="#5c6773"/></linearGradient>
    <filter id="csh" x="-5%" y="-10%" width="110%" height="125%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#1e293b" flood-opacity="0.1"/>
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
  const r = 28;
  const colWidths = [834, 833, 833];
  const rowHeights = [422, 421];
  const labels = [
    { title: "收款確認", sub: "LIFF", grad: "cm0", row: 0, col: 0 },
    { title: "我的案場", sub: "選材", grad: "cm1", row: 0, col: 1 },
    { title: "綁定新專案", sub: "申請", grad: "cm2", row: 0, col: 2 },
    { title: "了解添心", sub: "落地頁", grad: "cm3", row: 1, col: 0 },
    { title: "常見問題", sub: "FAQ", grad: "cm4", row: 1, col: 1 },
    { title: "Facebook", sub: "外開", grad: "cm5", row: 1, col: 2 },
  ];
  const cards = labels.map((lb) => {
    const cellX = colWidths.slice(0, lb.col).reduce((a, b) => a + b, 0);
    const cellY = rowHeights.slice(0, lb.row).reduce((a, b) => a + b, 0);
    const cw = colWidths[lb.col];
    const ch = rowHeights[lb.row];
    const cx = cellX + cw / 2;
    const cy = cellY + ch / 2;
    const fs = lb.title.length > 5 ? 32 : 36;
    return `
  <g filter="url(#msh)">
    <rect x="${cellX + p}" y="${cellY + p}" width="${cw - 2 * p}" height="${ch - 2 * p}" rx="${r}" fill="url(#${lb.grad})"/>
  </g>
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="${fs}" font-weight="700" fill="#ffffff">${lb.title}</text>
  <text x="${cx}" y="${cy + 52}" text-anchor="middle" font-family="Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif" font-size="20" font-weight="500" fill="${M.sub}">${lb.sub}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${M.bg0}"/>
      <stop offset="100%" stop-color="${M.bg1}"/>
    </linearGradient>
    <linearGradient id="cm0" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.in0}"/><stop offset="100%" stop-color="${M.in1}"/></linearGradient>
    <linearGradient id="cm1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.rep0}"/><stop offset="100%" stop-color="${M.rep1}"/></linearGradient>
    <linearGradient id="cm2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9aa8b8"/><stop offset="100%" stop-color="#7a8796"/></linearGradient>
    <linearGradient id="cm3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${M.ct0}"/><stop offset="100%" stop-color="${M.ct1}"/></linearGradient>
    <linearGradient id="cm4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8fa9a3"/><stop offset="100%" stop-color="#6e8580"/></linearGradient>
    <linearGradient id="cm5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7a8a9a"/><stop offset="100%" stop-color="#5c6773"/></linearGradient>
    <filter id="msh" x="-4%" y="-10%" width="108%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#1e293b" flood-opacity="0.1"/>
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

async function main() {
  const outDir = __dirname;
  const empSvgBuf = Buffer.from(employeeSvg(), "utf8");
  const venSvgBuf = Buffer.from(vendorSvg(), "utf8");
  const guestSvgBuf = Buffer.from(customerGuestSvg(), "utf8");
  const memberSvgBuf = Buffer.from(customerMemberSvg(), "utf8");

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
  await sharp(guestSvgBuf).png({ compressionLevel: 9 }).toFile(guestPng);
  await sharp(memberSvgBuf).png({ compressionLevel: 9 }).toFile(memberPng);
  await sharp(empSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(empJpg);
  await sharp(venSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(venJpg);
  await sharp(guestSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(guestJpg);
  await sharp(memberSvgBuf).jpeg({ quality: 93, mozjpeg: true }).toFile(memberJpg);

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
