/**
 * 室內漫遊 XZ 碰撞（無 Three.js，可單元測試）
 */

import { openingAssociatesWithWall } from './LP_3D_scene.js';

export const WALK_BODY_RADIUS_CM = 20;
/** 標準門寬（≥60cm）時使用的身體半徑；更窄的門會縮小（見 resolveWalkBodyRadiusCm） */
export const WALK_BODY_RADIUS_NARROW_DOOR_CM = 14;
export const WALK_NARROW_DOOR_WIDTH_CM = 32;
export const WALK_STANDARD_DOOR_MIN_WIDTH_CM = 60;

const OPENING_EDGE_PERP_MARGIN_CM = 8;

/**
 * @param {{ x: number, z: number }} a
 * @param {{ x: number, z: number }} b
 */
export function nearestPointOnSegmentXZ(x, z, a, b) {
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
 * @param {{ t0: number, t1: number }[]} ranges normalized [0,1]
 */
function subtractTRange(ranges, cut0, cut1) {
    const out = [];
    for (const r of ranges) {
        if (cut1 <= r.t0 || cut0 >= r.t1) {
            out.push(r);
            continue;
        }
        if (cut0 > r.t0) out.push({ t0: r.t0, t1: cut0 });
        if (cut1 < r.t1) out.push({ t0: cut1, t1: r.t1 });
    }
    return out;
}

/**
 * 門／窗在牆邊上的投影區段；僅當中心垂距落在牆厚帶內（與 openingCutsWall 一致）才回傳。
 * @param {{ centerX: number, centerZ: number, widthCm: number, depthCm: number }} op
 * @param {{ x: number, z: number }} a
 * @param {{ x: number, z: number }} b
 * @param {number} edgeLen
 * @param {number} [wallThicknessCm]
 */
export function openingSpanOnEdge(op, a, b, edgeLen, wallThicknessCm = 15) {
    const maxPerp = Math.max(wallThicknessCm, op.depthCm || 15) + OPENING_EDGE_PERP_MARGIN_CM;
    const maxPerp2 = maxPerp * maxPerp;
    let hit = nearestPointOnSegmentXZ(op.centerX, op.centerZ, a, b);
    if (hit.d2 > maxPerp2) {
        const w = op.widthCm || 80;
        const d = op.depthCm || 15;
        const rad = ((op.rotationDeg || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        let found = false;
        for (const [lx, lz] of [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, d / 2],
            [-w / 2, d / 2],
        ]) {
            const px = op.centerX + lx * cos - lz * sin;
            const pz = op.centerZ + lx * sin + lz * cos;
            const h = nearestPointOnSegmentXZ(px, pz, a, b);
            if (h.d2 <= maxPerp2) {
                hit = h;
                found = true;
                break;
            }
        }
        if (!found) return null;
    }
    const half = (op.widthCm || 80) / 2 + 4;
    const tCenter = hit.t * edgeLen;
    const t0 = Math.max(0, (tCenter - half) / edgeLen);
    const t1 = Math.min(1, (tCenter + half) / edgeLen);
    if (t1 - t0 < 1e-5) return null;
    return { t0, t1 };
}

/**
 * @param {object} wall
 * @param {object[]} fixtures
 * @returns {{ ax: number, az: number, bx: number, bz: number, passable: boolean }[]}
 */
export function buildWallInnerCollisionSegments(wall, fixtures) {
    const inner = wall.inner;
    if (!inner || inner.length < 3) return [];
    const segments = [];
    const wallThicknessCm = estimateWallThicknessCm(wall);

    for (let i = 0; i < inner.length; i++) {
        const a = inner[i];
        const b = inner[(i + 1) % inner.length];
        const edx = b.x - a.x;
        const edz = b.z - a.z;
        const edgeLen = Math.hypot(edx, edz);
        if (edgeLen < 1e-6) continue;

        let blocked = [{ t0: 0, t1: 1 }];
        for (const op of fixtures || []) {
            if (op.kind !== 'door' && op.kind !== 'window') continue;
            if (!openingAssociatesWithWall(wall, op)) continue;
            const span = openingSpanOnEdge(op, a, b, edgeLen, wallThicknessCm);
            if (!span) continue;
            if (op.kind === 'door') {
                blocked = subtractTRange(blocked, span.t0, span.t1);
            }
        }

        for (const range of blocked) {
            if (range.t1 - range.t0 < 1e-5) continue;
            segments.push({
                ax: a.x + edx * range.t0,
                az: a.z + edz * range.t0,
                bx: a.x + edx * range.t1,
                bz: a.z + edz * range.t1,
                passable: false,
            });
        }
    }
    return segments;
}

function estimateWallThicknessCm(wall) {
    if (!wall?.inner?.length || !wall?.outer?.length) return 15;
    const a = wall.inner[0];
    const o = wall.outer[0];
    return Math.max(8, Math.hypot(o.x - a.x, o.z - a.z));
}

/**
 * @param {{ widthCm?: number, depthCm?: number, centerX: number, centerZ: number, rotationDeg?: number }} f
 */
export function fixtureToObb(f) {
    const w = f.widthCm || 0;
    const d = f.depthCm || 0;
    const rad = ((f.rotationDeg || 0) * Math.PI) / 180;
    return {
        cx: f.centerX,
        cz: f.centerZ,
        halfW: w / 2,
        halfD: d / 2,
        cos: Math.cos(rad),
        sin: Math.sin(rad),
    };
}

/**
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 * @param {number} thicknessCm
 */
export function partitionSegmentToObb(ax, az, bx, bz, thicknessCm) {
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    return {
        cx: mx,
        cz: mz,
        halfW: len / 2,
        halfD: Math.max(thicknessCm, 8) / 2,
        cos: Math.cos(ang),
        sin: Math.sin(ang),
    };
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} bodyR
 * @param {{ cx: number, cz: number, halfW: number, halfD: number, cos: number, sin: number }} obb
 */
export function pushCircleOffObb(x, z, bodyR, obb) {
    const lx = (x - obb.cx) * obb.cos + (z - obb.cz) * obb.sin;
    const lz = -(x - obb.cx) * obb.sin + (z - obb.cz) * obb.cos;
    const clx = Math.max(-obb.halfW, Math.min(obb.halfW, lx));
    const clz = Math.max(-obb.halfD, Math.min(obb.halfD, lz));
    const dx = lx - clx;
    const dz = lz - clz;
    const dist = Math.hypot(dx, dz);
    let plx = 0;
    let plz = 0;
    if (dist < 1e-6) {
        const toLeft = lx + obb.halfW + bodyR;
        const toRight = obb.halfW - lx + bodyR;
        const toNegZ = lz + obb.halfD + bodyR;
        const toPosZ = obb.halfD - lz + bodyR;
        const min = Math.min(toLeft, toRight, toNegZ, toPosZ);
        if (min > obb.halfW + obb.halfD) return null;
        if (min === toLeft) plx = -toLeft;
        else if (min === toRight) plx = toRight;
        else if (min === toNegZ) plz = -toNegZ;
        else plz = toPosZ;
    } else if (dist >= bodyR - 0.05) {
        return null;
    } else {
        const pen = bodyR - dist;
        plx = (dx / dist) * pen;
        plz = (dz / dist) * pen;
    }
    return {
        x: plx * obb.cos - plz * obb.sin,
        z: plx * obb.sin + plz * obb.cos,
    };
}

/**
 * @param {{ walls?: object[], fixtures?: object[], partitionWalls?: object[] }} descriptor
 */
export function buildWalkCollision(descriptor) {
    if (!descriptor) return { segments: [], obbs: [] };
    const segments = [];
    for (const wall of descriptor.walls || []) {
        segments.push(...buildWallInnerCollisionSegments(wall, descriptor.fixtures));
    }
    const obbs = [];
    for (const f of descriptor.fixtures || []) {
        if (f.kind === 'cabinet' || f.kind === 'wallSegment') {
            obbs.push(fixtureToObb(f));
        }
    }
    for (const pw of descriptor.partitionWalls || []) {
        obbs.push(partitionSegmentToObb(pw.ax, pw.az, pw.bx, pw.bz, pw.thicknessCm));
    }
    return { segments, obbs };
}

/**
 * @param {{ fixtures?: { kind?: string, widthCm?: number }[] }} descriptor
 */
export function resolveWalkBodyRadiusCm(descriptor) {
    const doors = (descriptor?.fixtures || []).filter((f) => f.kind === 'door');
    if (!doors.length) return WALK_BODY_RADIUS_CM;
    const minWidth = Math.min(...doors.map((d) => d.widthCm || 80));
    if (minWidth >= WALK_STANDARD_DOOR_MIN_WIDTH_CM) return WALK_BODY_RADIUS_CM;
    if (minWidth < WALK_NARROW_DOOR_WIDTH_CM) {
        return Math.min(WALK_BODY_RADIUS_CM, Math.max(8, minWidth / 2 - 2));
    }
    const t = (minWidth - WALK_NARROW_DOOR_WIDTH_CM)
        / (WALK_STANDARD_DOOR_MIN_WIDTH_CM - WALK_NARROW_DOOR_WIDTH_CM);
    const r = WALK_BODY_RADIUS_NARROW_DOOR_CM
        + t * (WALK_BODY_RADIUS_CM - WALK_BODY_RADIUS_NARROW_DOOR_CM);
    return Math.min(WALK_BODY_RADIUS_CM, r);
}

/**
 * 依 lastDesc 參考快取碰撞資料（desc 物件換掉時重建）
 */
export function createWalkCollisionCache() {
    let ref = null;
    let collision = null;
    return {
        get(desc) {
            if (!desc) return null;
            if (ref !== desc) {
                ref = desc;
                collision = buildWalkCollision(desc);
            }
            return collision;
        },
        invalidate() {
            ref = null;
            collision = null;
        },
    };
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} r
 * @param {{ ax: number, az: number, bx: number, bz: number }} seg
 * @returns {{ x: number, z: number } | null}
 */
export function pushCircleOffSegment(x, z, r, seg) {
    const hit = nearestPointOnSegmentXZ(x, z, { x: seg.ax, z: seg.az }, { x: seg.bx, z: seg.bz });
    const d = Math.sqrt(hit.d2);
    if (d >= r - 0.05) return null;
    const penetration = r - d;
    if (d < 1e-6) {
        const nx = -(seg.bz - seg.az);
        const nz = seg.bx - seg.ax;
        const len = Math.hypot(nx, nz) || 1;
        return { x: (nx / len) * penetration, z: (nz / len) * penetration };
    }
    return {
        x: ((x - hit.x) / d) * penetration,
        z: ((z - hit.z) / d) * penetration,
    };
}

/**
 * @param {number} x0
 * @param {number} z0
 * @param {number} x1
 * @param {number} z1
 * @param {{ segments?: object[], obbs?: object[] } | null} collision
 * @param {number} bodyRadius
 */
export function resolveWalkPosition(x0, z0, x1, z1, collision, bodyRadius) {
    if (!collision) return { x: x1, z: z1 };
    let x = x1;
    let z = z1;
    const maxIter = 12;
    for (let iter = 0; iter < maxIter; iter++) {
        let moved = false;
        for (const seg of collision.segments || []) {
            if (seg.passable) continue;
            const push = pushCircleOffSegment(x, z, bodyRadius, seg);
            if (push) {
                x += push.x;
                z += push.z;
                moved = true;
            }
        }
        for (const obb of collision.obbs || []) {
            const push = pushCircleOffObb(x, z, bodyRadius, obb);
            if (push) {
                x += push.x;
                z += push.z;
                moved = true;
            }
        }
        for (const c of collision.circles || []) {
            const dx = x - c.x;
            const dz = z - c.z;
            const d = Math.hypot(dx, dz);
            const minD = bodyRadius + c.r;
            if (d < minD - 0.05) {
                const penetration = minD - d;
                if (d < 1e-6) {
                    x += penetration;
                } else {
                    x += (dx / d) * penetration;
                    z += (dz / d) * penetration;
                }
                moved = true;
            }
        }
        if (!moved) break;
    }
    return { x, z };
}

/**
 * 分軸移動 + 解碰撞，便於沿牆滑動
 */
export function moveWithWalkCollision(x0, z0, dx, dz, collision, bodyRadius) {
    if (!dx && !dz) return { x: x0, z: z0 };
    const hasSeg = collision?.segments?.length;
    const hasObb = collision?.obbs?.length;
    const hasCirc = collision?.circles?.length;
    if (!hasSeg && !hasObb && !hasCirc) {
        return { x: x0 + dx, z: z0 + dz };
    }
    const len = Math.hypot(dx, dz);
    const step = Math.max(bodyRadius * 0.45, 6);
    const steps = Math.max(1, Math.ceil(len / step));
    const sdx = dx / steps;
    const sdz = dz / steps;
    let x = x0;
    let z = z0;
    for (let i = 0; i < steps; i++) {
        const targetX = x + sdx;
        const targetZ = z + sdz;
        const resolved = resolveWalkPosition(x, z, targetX, targetZ, collision, bodyRadius);
        x = resolved.x;
        z = resolved.z;
    }
    return { x, z };
}
