/**
 * LayoutPlanner 2D → 3D 場景描述（無 Three.js 依賴，可單元測試）
 */

import {
    resolveFixtureDisplayCategory,
    resolveFixtureDisplayHeightCm,
} from './LP_3D_furniture.js';

export const LP_3D_DEFAULTS = {
    WALL_HEIGHT_CM: 280,
    CABINET_HEIGHT_CM: 90,
    WALL_SEGMENT_HEIGHT_CM: 280,
    DOOR_HEIGHT_CM: 210,
    WINDOW_SILL_HEIGHT_CM: 90,
    WINDOW_HEIGHT_CM: 120,
    WALL_CUT_MARGIN_W_CM: 6,
    WALL_CUT_MARGIN_H_CM: 4,
    WALL_CUT_DEPTH_CM: 36,
    FLOOR_THICKNESS_CM: 2,
    CEILING_THICKNESS_CM: 2,
    WALK_EYE_HEIGHT_CM: 160,
};

const DOOR_WINDOW_GROUPS = new Set(['門窗工程', '門片']);
const WINDOW_NAME_RE = /窗|落地窗|氣窗|百葉窗/;
const DOOR_NAME_RE = /門/;
const MANUAL_KINDS = new Set(['cabinet', 'door', 'window', 'wallSegment']);

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

/**
 * @param {{ model3dKind?: string, data?: { model3dKind?: string } }} cab
 * @returns {'wallSegment'|'door'|'window'|'cabinet'|null} null = 不顯示於 3D
 */
export function resolvePlacedCabinet3DKind(cab) {
    const manual = cab.model3dKind ?? cab.data?.model3dKind;
    if (manual === 'ignore') return null;
    if (manual && manual !== 'auto' && MANUAL_KINDS.has(manual)) return manual;
    return classifyPlacedCabinet3DKind(cab);
}

/** 畫布座標 → 以工作區中心為原點的 XZ（cm） */
/** 場景 XZ 環的軸對齊外框（cm） */
export function axisAlignedBoundsXZ(ring) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    if (!ring?.length) {
        return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    }
    for (const p of ring) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
    }
    return { minX, maxX, minZ, maxZ };
}

/** 兩個 XZ 外框是否在容差內一致 */
export function boundsXZMatch(a, b, toleranceCm = 2) {
    const t = toleranceCm;
    return Math.abs(a.minX - b.minX) <= t
        && Math.abs(a.maxX - b.maxX) <= t
        && Math.abs(a.minZ - b.minZ) <= t
        && Math.abs(a.maxZ - b.maxZ) <= t;
}

export function ringCentroidXZ(ring) {
    if (!ring?.length) return { x: 0, z: 0 };
    let x = 0;
    let z = 0;
    for (const p of ring) {
        x += p.x;
        z += p.z;
    }
    return { x: x / ring.length, z: z / ring.length };
}

function nearestPointOnSegmentXZ(x, z, a, b) {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2));
    const px = a.x + t * abx;
    const pz = a.z + t * abz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    return { x: px, z: pz, d2, t };
}

/**
 * 將 XZ 點限制在可行走區（支援多個地板多邊形；凹多邊形用射線法判定內外）
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number }[][]} rings
 */
export function clampPointToWalkRings(x, z, rings) {
    if (!rings?.length) return { x, z };
    for (const ring of rings) {
        if (ring?.length >= 3 && pointInPolygonXZ(x, z, ring)) return { x, z };
    }
    let bestPoint = { x, z };
    let bestD2 = Infinity;
    let bestRing = null;
    for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            const hit = nearestPointOnSegmentXZ(x, z, a, b);
            if (hit.d2 < bestD2) {
                bestD2 = hit.d2;
                bestPoint = { x: hit.x, z: hit.z };
                bestRing = ring;
            }
        }
    }
    if (!bestRing) return { x, z };
    const shrink = 8;
    const c = ringCentroidXZ(bestRing);
    const dx = c.x - bestPoint.x;
    const dz = c.z - bestPoint.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
        x: bestPoint.x + (dx / len) * shrink,
        z: bestPoint.z + (dz / len) * shrink,
    };
}

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

/** 場景 XZ 平面：點是否在多邊形內 */
export function pointInPolygonXZ(x, z, ring) {
    if (!ring || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].x;
        const zi = ring[i].z;
        const xj = ring[j].x;
        const zj = ring[j].z;
        const denom = zj - zi;
        const intersect = ((zi > z) !== (zj > z))
            && (x < (xj - xi) * (z - zi) / (Math.abs(denom) < 1e-9 ? 1e-9 : denom) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/** 是否在牆環帶內（外圈內、內圈外） */
export function pointInWallBand(x, z, wall) {
    return pointInPolygonXZ(x, z, wall.outer) && !pointInPolygonXZ(x, z, wall.inner);
}

export function fixtureFootprintSamplePointsXZ(fixture) {
    const w = fixture.widthCm || 80;
    const d = fixture.depthCm || 15;
    const rad = ((fixture.rotationDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pts = [{ x: fixture.centerX, z: fixture.centerZ }];
    for (const [lx, lz] of [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
    ]) {
        pts.push({
            x: fixture.centerX + lx * cos - lz * sin,
            z: fixture.centerZ + lx * sin + lz * cos,
        });
    }
    return pts;
}

function estimateWallThicknessFromRings(wall) {
    if (!wall?.inner?.length || !wall?.outer?.length) return 15;
    const a = wall.inner[0];
    const o = wall.outer[0];
    return Math.max(8, Math.hypot(o.x - a.x, o.z - a.z));
}

const OPENING_WALL_EDGE_MARGIN_CM = 8;

/** 門／窗是否屬於此牆（牆帶內或貼齊此牆 inner 邊，非任意遠距牆邊） */
export function openingAssociatesWithWall(wall, fixture) {
    if (!fixture || (fixture.kind !== 'door' && fixture.kind !== 'window')) return false;
    for (const p of fixtureFootprintSamplePointsXZ(fixture)) {
        if (pointInWallBand(p.x, p.z, wall)) return true;
    }
    const thickness = estimateWallThicknessFromRings(wall);
    const maxPerp = Math.max(thickness, fixture.depthCm || 15) + OPENING_WALL_EDGE_MARGIN_CM;
    const maxPerp2 = maxPerp * maxPerp;
    const inner = wall.inner;
    if (!inner || inner.length < 3) return false;
    for (const p of fixtureFootprintSamplePointsXZ(fixture)) {
        for (let i = 0; i < inner.length; i++) {
            const a = inner[i];
            const b = inner[(i + 1) % inner.length];
            const hit = nearestPointOnSegmentXZ(p.x, p.z, a, b);
            if (hit.d2 <= maxPerp2) return true;
        }
    }
    return false;
}

export function openingCutsWall(wall, fixture) {
    if (!fixture || (fixture.kind !== 'door' && fixture.kind !== 'window')) return false;
    return pointInWallBand(fixture.centerX, fixture.centerZ, wall);
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

function mapAreaRingToScene(area, workspaceSize) {
    return mapRingToScene(area.points, workspaceSize);
}

/**
 * @returns {{ workspaceSize: number, walls: object[], fixtures: object[], floors: object[], ceilings: object[], walkBounds: object|null }}
 */
export function buildLayout3DDescriptor(layout, options = {}) {
    const defaults = { ...LP_3D_DEFAULTS, ...options };
    const workspaceSize = layout.workspaceSize || 2000;
    const walls = [];
    const fixtures = [];
    const floors = [];
    const ceilings = [];
    const wallHeight = defaults.WALL_HEIGHT_CM;

    for (const area of layout.drawnAreas || []) {
        if (!area.points || area.points.length < 3) continue;
        if (area.type === 'floor') {
            floors.push({
                id: area.id,
                ring: mapAreaRingToScene(area, workspaceSize),
                thicknessCm: defaults.FLOOR_THICKNESS_CM,
            });
            continue;
        }
        if (area.type === 'ceiling') {
            ceilings.push({
                id: area.id,
                ring: mapAreaRingToScene(area, workspaceSize),
                baseYCm: wallHeight,
                thicknessCm: defaults.CEILING_THICKNESS_CM,
            });
            continue;
        }
        if (area.type !== 'wall') continue;
        const thickness = area.thickness || 15;
        const signed = signedPolygonArea(area.points);
        const dist = signed < 0 ? -thickness : thickness;
        // 2D SVG evenodd 與 calculateWallPath 用 dist 畫「內圈外偏」；Three.js Shape 需真正向外擴一圈。
        const outer = offsetPolygon(area.points, -dist);
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
        const kind = resolvePlacedCabinet3DKind(cab);
        if (!kind) continue;
        const displayCategory = resolveFixtureDisplayCategory(cab, kind);
        let { baseYCm, heightCm } = fixtureVerticalExtents(kind, defaults, cab);
        if (kind === 'cabinet') {
            heightCm = resolveFixtureDisplayHeightCm(displayCategory, cab, defaults.CABINET_HEIGHT_CM);
        }
        const cx = cab.x + w / 2;
        const cy = cab.y + d / 2;
        const center = canvasToSceneXZ(cx, cy, workspaceSize);
        fixtures.push({
            id: cab.id,
            kind,
            displayCategory,
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

    const walkRings = [];
    for (const f of floors) {
        if (f.ring?.length >= 3) walkRings.push(f.ring);
    }
    if (!walkRings.length) {
        for (const w of walls) {
            if (w.inner?.length >= 3) walkRings.push(w.inner);
        }
    }
    const walkBounds = walkRings.length ? { rings: walkRings } : null;

    /** 兩點直線隔間牆（中心線＋厚度），供漫遊碰撞 */
    const partitionWalls = [];
    for (const area of layout.drawnAreas || []) {
        if (area.type !== 'wall' || !area.points || area.points.length !== 2) continue;
        const thickness = area.thickness || 15;
        const p0 = canvasToSceneXZ(area.points[0].x, area.points[0].y, workspaceSize);
        const p1 = canvasToSceneXZ(area.points[1].x, area.points[1].y, workspaceSize);
        partitionWalls.push({
            id: area.id,
            ax: p0.x,
            az: p0.z,
            bx: p1.x,
            bz: p1.z,
            thicknessCm: thickness,
        });
    }

    return {
        workspaceSize,
        walls,
        fixtures,
        floors,
        ceilings,
        walkBounds,
        partitionWalls,
    };
}
