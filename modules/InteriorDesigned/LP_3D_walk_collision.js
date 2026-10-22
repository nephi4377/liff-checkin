/**
 * 室內漫遊 XZ 碰撞（無 Three.js，可單元測試）
 */

export const WALK_BODY_RADIUS_CM = 20;
export const WALK_CABINET_BLOCK_RADIUS_CM = 20;
const OPENING_EDGE_MAX_DIST_CM = 40;

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
 * @param {{ centerX: number, centerZ: number, widthCm: number, depthCm: number }} op
 * @param {{ x: number, z: number }} a
 * @param {{ x: number, z: number }} b
 * @param {number} edgeLen
 */
export function openingSpanOnEdge(op, a, b, edgeLen) {
    const hit = nearestPointOnSegmentXZ(op.centerX, op.centerZ, a, b);
    const maxDist = Math.max(op.depthCm || 15, 12) + OPENING_EDGE_MAX_DIST_CM;
    if (hit.d2 > maxDist * maxDist) return null;
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
            const span = openingSpanOnEdge(op, a, b, edgeLen);
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

/**
 * @param {{ walls?: object[], fixtures?: object[] }} descriptor
 */
export function buildWalkCollision(descriptor) {
    if (!descriptor) return { segments: [], circles: [] };
    const segments = [];
    for (const wall of descriptor.walls || []) {
        segments.push(...buildWallInnerCollisionSegments(wall, descriptor.fixtures));
    }
    const circles = [];
    for (const f of descriptor.fixtures || []) {
        if (f.kind !== 'cabinet') continue;
        circles.push({
            x: f.centerX,
            z: f.centerZ,
            r: WALK_CABINET_BLOCK_RADIUS_CM,
        });
    }
    return { segments, circles };
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

export function pushCircleOffCircle(x, z, bodyR, cx, cz, obstacleR) {
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz);
    const minD = bodyR + obstacleR;
    if (d >= minD - 0.05) return null;
    const penetration = minD - d;
    if (d < 1e-6) return { x: penetration, z: 0 };
    return { x: (dx / d) * penetration, z: (dz / d) * penetration };
}

/**
 * @param {number} x0
 * @param {number} z0
 * @param {number} x1
 * @param {number} z1
 * @param {{ segments?: object[], circles?: object[] } | null} collision
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
        for (const c of collision.circles || []) {
            const push = pushCircleOffCircle(x, z, bodyRadius, c.x, c.z, c.r);
            if (push) {
                x += push.x;
                z += push.z;
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
    if (!collision?.segments?.length && !collision?.circles?.length) {
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
