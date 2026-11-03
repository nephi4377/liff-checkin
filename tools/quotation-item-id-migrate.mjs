/**
 * 僅對「同一 id 字串出現多次」的工項，從第 2 筆起補 _2、_3…（跳過已存在的 id）。
 * usedIds 逐列佔用，與 budget-quote-parser-lib assignUniqueItemIdForSheet 順序一致。
 */

/**
 * @param {Set<string>} usedIds
 * @param {string} baseId
 * @param {Set<string>|undefined} reservedPlannedIds
 * @returns {string}
 */
export function claimUniqueItemIdForSheet(usedIds, baseId, reservedPlannedIds) {
    const id = String(baseId);
    if (!usedIds.has(id)) {
        usedIds.add(id);
        return id;
    }
    let n = 2;
    while (
        usedIds.has(`${id}_${n}`) ||
        (reservedPlannedIds && reservedPlannedIds.has(`${id}_${n}`))
    ) {
        n += 1;
    }
    const next = `${id}_${n}`;
    usedIds.add(next);
    return next;
}

/**
 * @param {Set<string>} usedIds
 * @param {string} baseId
 * @param {Set<string>|undefined} reservedPlannedIds
 * @returns {string}
 */
export function allocateDuplicateGroupSuffixId(usedIds, baseId, reservedPlannedIds) {
    let n = 2;
    while (
        usedIds.has(`${baseId}_${n}`) ||
        (reservedPlannedIds && reservedPlannedIds.has(`${baseId}_${n}`))
    ) {
        n += 1;
    }
    const next = `${baseId}_${n}`;
    usedIds.add(next);
    return next;
}

/**
 * @param {Array<object>|null|undefined} items
 * @returns {string[]} duplicate ids
 */
export function findDuplicateItemIds(items) {
    const seen = new Set();
    const dups = new Set();
    (items || []).forEach((it) => {
        if (!it?.id) return;
        const id = String(it.id);
        if (seen.has(id)) dups.add(id);
        else seen.add(id);
    });
    return [...dups];
}

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

    const usedIds = new Set();
    const reservedPlannedIds = new Set();
    list.forEach((it) => {
        const id = it?.id != null && String(it.id).trim() !== '' ? String(it.id) : null;
        if (id) reservedPlannedIds.add(id);
    });
    const changes = [];

    for (let index = 0; index < list.length; index++) {
        const id =
            list[index]?.id != null && String(list[index].id).trim() !== ''
                ? String(list[index].id)
                : null;
        if (!id) continue;

        const group = positionsById.get(id);
        if (!group || group.length <= 1) {
            const claimed = claimUniqueItemIdForSheet(usedIds, id, reservedPlannedIds);
            if (claimed !== id) {
                changes.push({
                    index,
                    from: id,
                    to: claimed,
                    name: list[index]?.name,
                });
                list[index] = { ...list[index], id: claimed };
            }
            continue;
        }

        const rank = group.indexOf(index);
        if (rank === 0) {
            claimUniqueItemIdForSheet(usedIds, id, reservedPlannedIds);
            continue;
        }

        const prev = String(list[index]?.id);
        const newId = allocateDuplicateGroupSuffixId(usedIds, id, reservedPlannedIds);
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

    return { items: list, changes };
}
