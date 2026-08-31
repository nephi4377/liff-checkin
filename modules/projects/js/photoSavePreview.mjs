/**
 * 施工日誌「管理照片」存檔前的預覽網址。
 * 後端要的是 { data, type, name }；畫面上的照片牆只吃字串網址。
 * 若把物件直接丟進照片牆，.trim() 會炸掉，畫面先關、其實沒送出。
 */

export function photoUploadToPreviewUrl(upload) {
    if (upload == null) return '';
    if (typeof upload === 'string') return upload.trim();
    if (typeof upload !== 'object') return String(upload).trim();
    const type = String(upload.type || 'image/jpeg').trim() || 'image/jpeg';
    const data = String(upload.data || '').trim();
    if (!data) return '';
    if (data.startsWith('data:')) return data;
    return `data:${type};base64,${data}`;
}

export function buildOptimisticPhotoLinks(keepLinks, newUploads) {
    const kept = (Array.isArray(keepLinks) ? keepLinks : [])
        .map((s) => String(s || '').trim())
        .filter(Boolean);
    const added = (Array.isArray(newUploads) ? newUploads : [])
        .map(photoUploadToPreviewUrl)
        .filter(Boolean);
    return kept.concat(added);
}
