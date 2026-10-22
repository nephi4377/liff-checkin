/**
 * LayoutPlanner 2D → 3D 場景描述（無 Three.js 依賴，可單元測試）
 */

export const LP_3D_DEFAULTS = {
    WALL_HEIGHT_CM: 280,
    CABINET_HEIGHT_CM: 90,
    WALL_SEGMENT_HEIGHT_CM: 280,
    DOOR_HEIGHT_CM: 210,
    WINDOW_SILL_HEIGHT_CM: 90,
    WINDOW_HEIGHT_CM: 120,
};

const DOOR_WINDOW_GROUPS = new Set(['門窗工程', '門片']);
const WINDOW_NAME_RE = /窗|落地窗|氣窗|百葉窗/;
const DOOR_NAME_RE = /門/;

/**
 * @param {{ data?: { name?: string, group?: string, isWall?: boolean } }} cab
 * @returns {'wallSegment'|'door'|'window'|'cabinet'}
 */
export function classifyPlacedCabinet3DKind(cab) {
    if (!cab?.data) return 'cabinet';
    if (cab.data.isWall) return 'wallSegment';
    const group = String(cab.data.group || '');
    const name = String(cab.data.name || '');
    const inDoorWindowGroup = DOOR_WINDOW_GROUPS.has(group);

    if (WINDOW_NAME_RE.test(name)) return 'window';
    if (DOOR_NAME_RE.test(name) && !WINDOW_NAME_RE.test(name)) return 'door';
    if (inDoorWindowGroup) {
        if (WINDOW_NAME_RE.test(name)) return 'window';
        if (DOOR_NAME_RE.test(name)) return 'door';
        return 'door';
    }
    return 'cabinet';
}

/** 畫布座標 → 以工作區中心為原點的 XZ（cm） */
export function canvasToSceneXZ(x, y, workspaceSize) {
    const half = workspaceSize / 2;
    return { x: x - half, z: y - half };
}

export function signedPolygonArea(points) {
    if (!points || points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        sum += p1.x * p2.y - p2.x * p1.y;
    }
    return sum / 2;
}

function lineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
    };
}

/** 與 LP_LayoutPlanner offsetPolygon 相同邏輯（外擴牆厚） */
export function offsetPolygon(points, distance) {
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
        const intersection = lineIntersection(prevSeg.p1, prevSeg.p2, currentSeg.p1, currentSeg.p2);
        newVertices.push(intersection || currentSeg.p1);
    }
    return newVertices;
}

function mapRingToScene(points, workspaceSize) {
    return points.map((p) => canvasToSceneXZ(p.x, p.y, workspaceSize));
}

function fixtureVerticalExtents(kind, defaults, cab) {
    if (kind === 'wallSegment') {
        return { baseYCm: 0, heightCm: defaults.WALL_SEGMENT_HEIGHT_CM };
    }
    if (kind === 'door') {
        return { baseYCm: 0, heightCm: defaults.DOOR_HEIGHT_CM };
    }
    if (kind === 'window') {
        return {
            baseYCm: defaults.WINDOW_SILL_HEIGHT_CM,
            heightCm: defaults.WINDOW_HEIGHT_CM,
        };
    }
    const customH = cab.data?.height > 0 ? cab.data.height : defaults.CABINET_HEIGHT_CM;
    return { baseYCm: 0, heightCm: customH };
}

/**
 * @returns {{ workspaceSize: number, walls: object[], fixtures: object[] }}
 */
export function buildLayout3DDescriptor(layout, options = {}) {
    const defaults = { ...LP_3D_DEFAULTS, ...options };
    const workspaceSize = layout.workspaceSize || 2000;
    const walls = [];
    const fixtures = [];

    for (const area of layout.drawnAreas || []) {
        if (area.type !== 'wall' || !area.points || area.points.length < 3) continue;
        const thickness = area.thickness || 15;
        const signed = signedPolygonArea(area.points);
        const dist = signed < 0 ? -thickness : thickness;
        const outer = offsetPolygon(area.points, dist);
        walls.push({
            id: area.id,
            heightCm: defaults.WALL_HEIGHT_CM,
            outer: mapRingToScene(outer, workspaceSize),
            inner: mapRingToScene(area.points, workspaceSize),
        });
    }

    for (const cab of layout.placedCabinets || []) {
        const w = cab.currentW ?? cab.data?.width ?? 0;
        const d = cab.currentH ?? cab.data?.depth ?? 0;
        if (w <= 0 || d <= 0) continue;
        const kind = classifyPlacedCabinet3DKind(cab);
        const { baseYCm, heightCm } = fixtureVerticalExtents(kind, defaults, cab);
        const cx = cab.x + w / 2;
        const cy = cab.y + d / 2;
        const center = canvasToSceneXZ(cx, cy, workspaceSize);
        fixtures.push({
            id: cab.id,
            kind,
            widthCm: w,
            depthCm: d,
            heightCm,
            baseYCm,
            centerX: center.x,
            centerZ: center.z,
            rotationDeg: cab.rotation || 0,
            label: cab.data?.name || '',
        });
    }

    return { workspaceSize, walls, fixtures };
}
