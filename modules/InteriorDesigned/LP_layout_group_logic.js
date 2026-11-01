/**
 * 再群組前：僅將「被選取」成員移出既有 layout 群組；若原群組只剩 1 人則解散。
 * @param {Array<{ id: string, layoutGroupId?: string }>} placedCabinets
 * @param {Set<string>} selectedIds
 */
export function detachSelectedFromExistingLayoutGroups(placedCabinets, selectedIds) {
    const touchedGroupIds = new Set(
        placedCabinets
            .filter((c) => selectedIds.has(c.id) && c.layoutGroupId)
            .map((c) => c.layoutGroupId),
    );
    for (const gid of touchedGroupIds) {
        for (const cab of placedCabinets) {
            if (cab.layoutGroupId === gid && selectedIds.has(cab.id)) {
                delete cab.layoutGroupId;
            }
        }
        const remaining = placedCabinets.filter((c) => c.layoutGroupId === gid);
        if (remaining.length === 1) {
            delete remaining[0].layoutGroupId;
        }
    }
}
