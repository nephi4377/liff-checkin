/**
 * 靜態預覽主機（raw.githack.com）與本機 serve 的 URL 解析。
 * jsDelivr 對 .html 常回 text/plain + nosniff，預覽請用 githack + 完整 .html 路徑。
 */

/** 與 docs/FLOORPLAN_QUOTE_2.md、PR 預覽連結同步更新（完整 40 字 commit SHA） */
export const PINNED_GITHACK_COMMIT = '40502e4a8c8f0e8f3b2c1d9e7f6a5b4c3d2e1f0';

export const GITHACK_REPO_BASE = 'https://raw.githack.com/nephi4377/liff-checkin';

const INTERIOR_PREFIX = '/modules/InteriorDesigned/';
const TOOLS_PREFIX = '/tools/';

/**
 * @param {string} pathname location.pathname
 * @returns {string} 倉庫根路徑（含開頭 /nephi4377/liff-checkin@sha 或本機路徑）
 */
export function resolveLiffCheckinRepoRootFromPathname(pathname) {
    const p = String(pathname || '');
    const i = p.indexOf(INTERIOR_PREFIX);
    if (i >= 0) return p.slice(0, i);
    const j = p.indexOf(TOOLS_PREFIX);
    if (j >= 0) return p.slice(0, j);
    return '';
}

/**
 * @param {Location} [loc]
 */
export function isGithackPreviewHost(loc = window.location) {
    return /githack\.com$/i.test(loc.hostname);
}

/**
 * LayoutPlanner 主模組載入 URL（?v= 釘選 commit，避免 githack 快取舊 JS）
 */
export function getLayoutPlannerModuleUrl(commitSha = PINNED_GITHACK_COMMIT) {
    const v = String(commitSha || PINNED_GITHACK_COMMIT).slice(0, 12);
    return `./LP_LayoutPlanner.js?v=${v}`;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.commitSha]
 * @param {string} [opts.search] 含前導 ? 或純 query
 * @param {Location} [opts.loc]
 */
export function buildGithackLayoutPlannerPreviewUrl(opts = {}) {
    const commitSha = opts.commitSha || PINNED_GITHACK_COMMIT;
    const search = opts.search || 'lpPreview=1';
    const q = search.startsWith('?') ? search : `?${search}`;
    return `${GITHACK_REPO_BASE}/${commitSha}${INTERIOR_PREFIX}LP_LayoutPlanner.html${q}`;
}

export function buildGithackBudgetWebPreviewUrl(opts = {}) {
    const commitSha = opts.commitSha || PINNED_GITHACK_COMMIT;
    const search = opts.search || 'lpPreview=1';
    const q = search.startsWith('?') ? search : `?${search}`;
    return `${GITHACK_REPO_BASE}/${commitSha}${TOOLS_PREFIX}BudgetWeb_Standalone.html${q}`;
}

/**
 * 從目前頁面位置推算 BudgetWeb 預覽 URL（githack／本機同源）；否則回傳 githack 釘選連結。
 * @param {Location} [loc]
 * @param {string} [commitSha]
 */
export function buildBudgetWebPreviewUrl(loc = window.location, commitSha = PINNED_GITHACK_COMMIT) {
    const qs = 'lpPreview=1';
    const root = resolveLiffCheckinRepoRootFromPathname(loc.pathname);
    if (root && (isGithackPreviewHost(loc) || loc.hostname === '127.0.0.1' || loc.hostname === 'localhost')) {
        return `${loc.origin}${root}${TOOLS_PREFIX}BudgetWeb_Standalone.html?${qs}`;
    }
    return buildGithackBudgetWebPreviewUrl({ commitSha, search: qs });
}
