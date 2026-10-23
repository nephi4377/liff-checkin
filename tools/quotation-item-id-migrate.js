/**
 * 僅對「同一 id 字串出現多次」的工項，從第 2 筆起補 _2、_3（第 1 筆 id 不變）。
 * 不剝除既有 id 的數字尾碼（避免 ITEM_1228_2 被誤改）。
 */

/**
 * @param {Array<{ id?: string, name?: string, [key: string]: unknown }>} items
 * @returns {{ items: Array<object>, changes: Array<{ index: number, from: string, to: string, name?: string }> }}
 */
export function migrateDuplicateItemIdsOnly(items) {
    const list = (items || []).map((it) => ({ ...it }));
    const positionsById = new Map();

    list.forEach((it, index) => {
        const id = it?.id != null && String(it.id).trim() !== '' ? String(it.id) : null;
        if (!id) return;
        if (!positionsById.has(id)) positionsById.set(id, []);
        positionsById.get(id).push(index);
    });

    const changes = [];
    for (const [id, indices] of positionsById) {
        if (indices.length <= 1) continue;
        for (let n = 1; n < indices.length; n++) {
            const index = indices[n];
            const newId = `${id}_${n + 1}`;
            const prev = list[index]?.id;
            if (prev !== newId) {
                changes.push({
                    index,
                    from: prev,
                    to: newId,
                    name: list[index]?.name,
                });
            }
            list[index] = { ...list[index], id: newId };
        }
    }

    return { items: list, changes };
}
