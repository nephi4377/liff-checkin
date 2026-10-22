/**
 * LayoutPlanner：2D 平面資料 → 3D 預覽用中性模型（無 three.js 依賴，可單測）。
 */

export const LP_3D_DEFAULTS = {
    wallHeightCm: 280,
    cabinetHeightCm: 85,
    tallCabinetHeightCm: 240,
    tableHeightCm: 75,
    slabThicknessCm: 2,
    defaultWallThicknessCm: 15,
};

function getLineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
    };
}

/** 與 LP_LayoutPlanner offsetPolygon 相同邏輯 */
export function offsetPolygon(points, distance) {
    if (!points || points.length < 2) return [];
    const offsetSegments = [];
    const numPoints = points.length;

    for (let i = 0; i < numPoints; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % numPoints];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const nx = -dy / len;
        const ny = dx / len;
        offsetSegments.push({
            p1: { x: p1.x + nx * distance, y: p1.y + ny * distance },
            p2: { x: p2.x + nx * distance, y: p2.y + ny * distance },
        });
    }

    const newVertices = [];
    const numSegments = offsetSegments.length;
    for (let i = 0; i < numSegments; i++) {
        const currentSeg = offsetSegments[i];
        const prevSeg = offsetSegments[(i + numSegments - 1) % numSegments];
        const intersection = getLineIntersection(prevSeg.p1, prevSeg.p2, currentSeg.p1, currentSeg.p2);
        newVertices.push(intersection || currentSeg.p1);
    }
    return newVertices;
}

export function getPolygonSignedArea(points) {
    if (!points || points.length < 3) return 0;
    let area = 0;
    let j = points.length - 1;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[j];
        area += p1.x * p2.y - p2.x * p1.y;
        j = i;
    }
    return area / 2;
}

/** 牆體內圈與外圈（cm，平面座標） */
export function getWallRingPolygons(points, thickness) {
    if (!points || points.length < 3) {
        return { inner: [], outer: [] };
    }
    const signedArea = getPolygonSignedArea(points);
    const dist = signedArea < 0 ? -thickness : thickness;
    const outer = offsetPolygon(points, dist);
    return { inner: points, outer };
}

/**
 * 2D 畫布 cm → 3D 地面 XZ（原點在畫布中心）
 */
export function cmPointToWorldXZ(xCm, yCm, workspaceSizeCm) {
    const origin = workspaceSizeCm / 2;
    return { x: xCm - origin, z: yCm - origin };
}

/**
 * @param {{ x: number, y: number }} p
 */
export function mapPlanPointToXZ(p, workspaceSizeCm) {
    return cmPointToWorldXZ(p.x, p.y, workspaceSizeCm);
}

/**
 * @param {object} cab placedCabinets 項目
 * @param {object} defaults LP_3D_DEFAULTS
 */
export function resolveCabinetHeightCm(cab, defaults = LP_3D_DEFAULTS) {
    const name = (cab.data && cab.data.name) || '';
    if (cab.data && cab.data.isWall) {
        return defaults.wallHeightCm;
    }
    if (/衣櫃|高櫃|高衣櫃/.test(name)) {
        return defaults.tallCabinetHeightCm;
    }
    if (/桌|茶几|中島/.test(name)) {
        return defaults.tableHeightCm;
    }
    return defaults.cabinetHeightCm;
}

/**
 * @param {object} cab
 * @param {number} workspaceSizeCm
 */
export function cabinetToBoxPrimitive(cab, workspaceSizeCm, defaults = LP_3D_DEFAULTS) {
    const w = cab.currentW ?? cab.data?.width ?? 0;
    const d = cab.currentH ?? cab.data?.depth ?? 0;
    const heightCm = resolveCabinetHeightCm(cab, defaults);
    const cx = cab.x + w / 2;
    const cy = cab.y + d / 2;
    const center = cmPointToWorldXZ(cx, cy, workspaceSizeCm);
    return {
        kind: 'box',
        id: cab.id,
        name: cab.data?.name || 'cabinet',
        center: { x: center.x, y: heightCm / 2, z: center.z },
        size: { x: w, y: heightCm, z: d },
        rotationYDeg: cab.rotation || 0,
        mirrored: !!cab.mirrored,
    };
}

/**
 * @param {object} input
 * @param {object[]} input.placedCabinets
 * @param {object[]} input.drawnAreas
 * @param {number} input.workspaceSizeCm
 */
export function layoutTo3DModel(input, options = {}) {
    const defaults = { ...LP_3D_DEFAULTS, ...options.defaults };
    const workspaceSizeCm = input.workspaceSizeCm || 2000;
    const placedCabinets = input.placedCabinets || [];
    const drawnAreas = input.drawnAreas || [];

    const floorSlabs = [];
    const ceilingSlabs = [];
    const wallRings = [];
    const boxes = [];

    for (const area of drawnAreas) {
        if (!area.points || area.points.length < 3) continue;
        const ring = area.points.map((p) => mapPlanPointToXZ(p, workspaceSizeCm));
        if (area.type === 'floor') {
            floorSlabs.push({ id: area.id, polygonXZ: ring });
        } else if (area.type === 'ceiling') {
            ceilingSlabs.push({ id: area.id, polygonXZ: ring });
        } else if (area.type === 'wall') {
            const thickness = area.thickness ?? defaults.defaultWallThicknessCm;
            const { inner, outer } = getWallRingPolygons(area.points, thickness);
            if (inner.length >= 3 && outer.length >= 3) {
                wallRings.push({
                    id: area.id,
                    heightCm: defaults.wallHeightCm,
                    innerXZ: inner.map((p) => mapPlanPointToXZ(p, workspaceSizeCm)),
                    outerXZ: outer.map((p) => mapPlanPointToXZ(p, workspaceSizeCm)),
                });
            }
        }
    }

    for (const cab of placedCabinets) {
        if (!cab || cab.currentW <= 0 || cab.currentH <= 0) continue;
        boxes.push(cabinetToBoxPrimitive(cab, workspaceSizeCm, defaults));
    }

    return {
        workspaceSizeCm,
        defaults,
        floorSlabs,
        ceilingSlabs,
        wallRings,
        boxes,
    };
}
