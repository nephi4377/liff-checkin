/**
 * Sheet I 欄內嵌 SVG 注入 DOM 前移除危險內容（script、事件屬性、javascript: 連結等）。
 * 不取代業務上的信任模型；與 autoFixSvgGeometry 併用時請先 sanitize。
 */
export function sanitizeSvgString(svgStr) {
    if (!svgStr || typeof svgStr !== 'string') return '';
    let s = svgStr;
    s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<\/script>/gi, '');
    s = s.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
    s = s.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');
    s = s.replace(/(\s(?:href|xlink:href)\s*=\s*["'])\s*javascript:[^"']*["']/gi, '$1#sanitized"');
    s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
    return s;
}
