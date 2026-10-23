import { describe, it, expect } from 'vitest';
import { buildLayout3DDescriptor, openingAssociatesWithWall, openingCutsWall } from './LP_3D_scene.js';
import {
    WALK_BODY_RADIUS_CM,
    WALK_STANDARD_DOOR_MIN_WIDTH_CM,
    buildWalkCollision,
    buildWallInnerCollisionSegments,
    createWalkCollisionCache,
    fixtureToObb,
    moveWithWalkCollision,
    openingSpanOnEdge,
    partitionSegmentToObb,
    pushCircleOffObb,
    resolveWalkBodyRadiusCm,
    resolveWalkPosition,
    resolveWalkSpawnXZ,
    resolveOpeningCutterCenterOnWall,
    WALK_SPAWN_NUDGE_CABINET_MAX_EXTENT_CM,
} from './LP_3D_walk_collision.js';

const squareWall = {
    inner: [
        { x: -100, z: -100 },
        { x: 100, z: -100 },
        { x: 100, z: 100 },
        { x: -100, z: 100 },
    ],
};

function layoutRoomWithDoorAndWindow() {
    return {
        workspaceSize: 2000,
        drawnAreas: [{
            id: 'w1',
            type: 'wall',
            thickness: 15,
            points: [
                { x: 300, y: 300 },
                { x: 900, y: 300 },
                { x: 900, y: 800 },
                { x: 300, y: 800 },
            ],
        }],
        placedCabinets: [
            {
                id: 'door1',
                x: 500,
                y: 285,
                rotation: 0,
                currentW: 90,
                currentH: 15,
                data: { name: '房門', group: '門窗工程', width: 90, depth: 15 },
            },
            {
                id: 'win1',
                x: 700,
                y: 285,
                rotation: 0,
                currentW: 150,
                currentH: 15,
                data: { name: '落地窗', group: '門窗工程', width: 150, depth: 15 },
            },
            {
                id: 'cab1',
                x: 400,
                y: 600,
                rotation: 0,
                currentW: 120,
                currentH: 60,
                data: { name: '櫃', group: '系統櫃', width: 120, depth: 60 },
            },
        ],
    };
}

describe('resolveOpeningCutterCenterOnWall', () => {
    it('旋轉門中心在室內時，CSG 中心落在牆內圈邊（SWEEP-2 B6）', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [{
                id: 'w1',
                type: 'wall',
                thickness: 15,
                points: [
                    { x: 300, y: 300 },
                    { x: 900, y: 300 },
                    { x: 900, y: 800 },
                    { x: 300, y: 800 },
                ],
            }],
            placedCabinets: [{
                id: 'door-rot',
                x: 500,
                y: 312,
                rotation: 90,
                currentW: 90,
                currentH: 15,
                data: { name: '房門', group: '門窗工程', width: 90, depth: 15 },
            }],
        });
        const wall = desc.walls[0];
        const door = desc.fixtures.find((f) => f.kind === 'door');
        const cut = resolveOpeningCutterCenterOnWall(wall, door);
        expect(openingCutsWall(wall, door)).toBe(true);
        expect(Math.abs(cut.centerZ - wall.inner[0].z)).toBeLessThan(12);
        expect(Math.abs(cut.centerX - door.centerX)).toBeLessThan(50);
    });
});

describe('buildWallInnerCollisionSegments', () => {
    it('門洞區段不產生牆碰撞線，窗洞仍保留', () => {
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const wall = desc.walls[0];
        const segs = buildWallInnerCollisionSegments(wall, desc.fixtures);
        const northY = wall.inner[0].z;
        const door = desc.fixtures.find((f) => f.kind === 'door');
        const window = desc.fixtures.find((f) => f.kind === 'window');
        const doorHit = openingSpanOnEdge(
            door,
            wall.inner[0],
            wall.inner[1],
            Math.hypot(wall.inner[1].x - wall.inner[0].x, wall.inner[1].z - wall.inner[0].z),
            15,
        );
        expect(doorHit).not.toBeNull();

        const coversDoor = segs.some((s) => {
            if (Math.abs(s.az - northY) > 2 && Math.abs(s.bz - northY) > 2) return false;
            const minX = Math.min(s.ax, s.bx);
            const maxX = Math.max(s.ax, s.bx);
            const d0 = door.centerX - door.widthCm / 2;
            const d1 = door.centerX + door.widthCm / 2;
            return minX <= d0 + 2 && maxX >= d1 - 2;
        });
        expect(coversDoor).toBe(false);

        const coversWindow = segs.some((s) => {
            if (Math.abs(s.az - northY) > 2 && Math.abs(s.bz - northY) > 2) return false;
            const minX = Math.min(s.ax, s.bx);
            const maxX = Math.max(s.ax, s.bx);
            const w0 = window.centerX - window.widthCm / 2;
            const w1 = window.centerX + window.widthCm / 2;
            return minX <= w0 + 5 && maxX >= w1 - 5;
        });
        expect(coversWindow).toBe(true);
    });

    it('門只對所屬牆開洞，不誤開相鄰牆邊（openingAssociatesWithWall）', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [
                {
                    id: 'w-north',
                    type: 'wall',
                    thickness: 15,
                    points: [
                        { x: 200, y: 200 },
                        { x: 800, y: 200 },
                        { x: 800, y: 600 },
                        { x: 200, y: 600 },
                    ],
                },
                {
                    id: 'w-south',
                    type: 'wall',
                    thickness: 15,
                    points: [
                        { x: 900, y: 200 },
                        { x: 1400, y: 200 },
                        { x: 1400, y: 600 },
                        { x: 900, y: 600 },
                    ],
                },
            ],
            placedCabinets: [{
                id: 'door-n',
                x: 400,
                y: 185,
                rotation: 0,
                currentW: 90,
                currentH: 15,
                data: { name: '房門', group: '門窗工程', width: 90, depth: 15 },
            }],
        });
        const door = desc.fixtures.find((f) => f.kind === 'door');
        const north = desc.walls.find((w) => w.id === 'w-north');
        const south = desc.walls.find((w) => w.id === 'w-south');
        expect(openingAssociatesWithWall(north, door)).toBe(true);
        expect(openingAssociatesWithWall(south, door)).toBe(false);
        expect(openingCutsWall(south, door)).toBe(false);

        const southSegs = buildWallInnerCollisionSegments(south, desc.fixtures);
        const doorSpan = openingSpanOnEdge(
            door,
            south.inner[0],
            south.inner[1],
            Math.hypot(south.inner[1].x - south.inner[0].x, south.inner[1].z - south.inner[0].z),
            15,
        );
        expect(doorSpan).toBeNull();
        expect(southSegs.length).toBeGreaterThan(0);
    });
});

describe('fixture OBB 與隔間牆', () => {
    it('櫃體 OBB 依寬深與旋轉阻擋（非固定 20cm 圓）', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [],
            placedCabinets: [{
                id: 'cab-rot',
                x: 900,
                y: 900,
                rotation: 90,
                currentW: 100,
                currentH: 40,
                data: { name: '櫃', group: '系統櫃', width: 100, depth: 40 },
            }],
        });
        const cab = desc.fixtures[0];
        const obb = fixtureToObb(cab);
        expect(obb.halfW).toBe(50);
        expect(obb.halfD).toBe(20);
        expect(obb.halfW).toBe(50);
        expect(obb.halfD).toBe(20);
        expect(Math.abs(obb.cos)).toBeLessThan(0.01);
        expect(Math.abs(obb.sin)).toBeGreaterThan(0.99);
        const collision = buildWalkCollision(desc);
        expect(collision.obbs).toHaveLength(1);
    });

    it('兩點直線隔間牆含厚度可碰撞', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [{
                id: 'part-1',
                type: 'wall',
                thickness: 20,
                points: [{ x: 500, y: 500 }, { x: 900, y: 500 }],
            }],
            placedCabinets: [],
        });
        expect(desc.partitionWalls).toHaveLength(1);
        const collision = buildWalkCollision(desc);
        expect(collision.obbs).toHaveLength(1);
        const before = { x: -300, z: -530 };
        const after = moveWithWalkCollision(
            before.x,
            before.z,
            0,
            60,
            collision,
            WALK_BODY_RADIUS_CM,
        );
        expect(after.z).toBeLessThan(before.z + 45);
        expect(after.z).toBeLessThan(-500);
    });

    it('牆片元件（wallSegment）產生 OBB', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [],
            placedCabinets: [{
                id: 'ws1',
                x: 400,
                y: 400,
                rotation: 0,
                currentW: 200,
                currentH: 15,
                data: { isWall: true, name: '隔間', width: 200, depth: 15 },
            }],
        });
        const collision = buildWalkCollision(desc);
        expect(collision.obbs).toHaveLength(1);
    });
});

describe('resolveWalkBodyRadiusCm', () => {
    it('標準門寬維持 20cm 身體半徑', () => {
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        expect(resolveWalkBodyRadiusCm(desc)).toBe(WALK_BODY_RADIUS_CM);
    });

    it('極窄門縮小身體半徑；60cm 門仍可通過', () => {
        const narrow = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: layoutRoomWithDoorAndWindow().drawnAreas,
            placedCabinets: [{
                id: 'd-narrow',
                x: 500,
                y: 285,
                rotation: 0,
                currentW: 28,
                currentH: 15,
                data: { name: '房門', group: '門窗工程', width: 28, depth: 15 },
            }],
        });
        const rNarrow = resolveWalkBodyRadiusCm(narrow);
        expect(rNarrow).toBeLessThan(WALK_BODY_RADIUS_CM);
        expect(rNarrow).toBeLessThanOrEqual(28 / 2 - 2);

        const normal = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: layoutRoomWithDoorAndWindow().drawnAreas,
            placedCabinets: [{
                id: 'd-ok',
                x: 500,
                y: 285,
                rotation: 0,
                currentW: WALK_STANDARD_DOOR_MIN_WIDTH_CM,
                currentH: 15,
                data: { name: '房門', group: '門窗工程', width: WALK_STANDARD_DOOR_MIN_WIDTH_CM, depth: 15 },
            }],
        });
        expect(resolveWalkBodyRadiusCm(normal)).toBe(WALK_BODY_RADIUS_CM);
        const collision = buildWalkCollision(normal);
        const door = normal.fixtures[0];
        const r = moveWithWalkCollision(
            door.centerX,
            door.centerZ + 80,
            0,
            -100,
            collision,
            WALK_BODY_RADIUS_CM,
        );
        expect(r.z).toBeLessThan(door.centerZ - 20);
    });
});

describe('createWalkCollisionCache', () => {
    it('同一 desc 參考不重算；換物件才重建', () => {
        const cache = createWalkCollisionCache();
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const a = cache.get(desc);
        const b = cache.get(desc);
        expect(a).toBe(b);
        const desc2 = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const c = cache.get(desc2);
        expect(c).not.toBe(a);
    });
});

describe('pushCircleOffObb', () => {
    it('身體半徑大於櫃半深、圓心在櫃內時仍沿最短軸推出', () => {
        const obb = {
            cx: 500,
            cz: 500,
            halfW: 10,
            halfD: 10,
            cos: 1,
            sin: 0,
        };
        const bodyR = WALK_BODY_RADIUS_CM;
        const push = pushCircleOffObb(500, 500, bodyR, obb);
        expect(push).not.toBeNull();
        const outX = 500 + push.x;
        const outZ = 500 + push.z;
        const lx = outX - obb.cx;
        const lz = outZ - obb.cz;
        expect(Math.abs(lx)).toBeGreaterThanOrEqual(obb.halfW + bodyR - 0.1);
        expect(Math.abs(lz)).toBeLessThanOrEqual(obb.halfD + 0.1);
    });
});

describe('resolveWalkSpawnXZ', () => {
    it('出生點在小型櫃內時推出櫃外', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [{
                id: 'w1',
                type: 'wall',
                thickness: 15,
                points: [
                    { x: 300, y: 300 },
                    { x: 900, y: 300 },
                    { x: 900, y: 800 },
                    { x: 300, y: 800 },
                ],
            }],
            placedCabinets: [{
                id: 'small-cab',
                x: 575,
                y: 525,
                rotation: 0,
                currentW: 20,
                currentH: 20,
                data: { name: '小茶几', group: '系統櫃', width: 20, depth: 20 },
            }],
        });
        const collision = buildWalkCollision(desc);
        const cab = desc.fixtures[0];
        expect(cab.widthCm).toBeLessThanOrEqual(WALK_SPAWN_NUDGE_CABINET_MAX_EXTENT_CM);
        const bodyR = WALK_BODY_RADIUS_CM;
        const spawn = resolveWalkSpawnXZ(cab.centerX, cab.centerZ, collision, bodyR);
        const push = pushCircleOffObb(spawn.x, spawn.z, bodyR, collision.obbs[0]);
        expect(push).toBeNull();
        expect(Math.hypot(spawn.x - cab.centerX, spawn.z - cab.centerZ)).toBeGreaterThan(5);
    });
});

describe('moveWithWalkCollision', () => {
    it('撞牆時無法穿過內牆線段', () => {
        const collision = {
            segments: [{
                ax: -100, az: 100, bx: 100, bz: 100, passable: false,
            }],
            obbs: [],
        };
        const r = moveWithWalkCollision(0, 80, 0, 80, collision, WALK_BODY_RADIUS_CM);
        expect(r.z).toBeLessThan(100 - WALK_BODY_RADIUS_CM + 2);
    });

    it('沿牆滑動：斜向撞牆仍保留切線位移', () => {
        const collision = {
            segments: [{
                ax: -100, az: 100, bx: 100, bz: 100, passable: false,
            }],
            obbs: [],
        };
        const r = moveWithWalkCollision(0, 70, 50, 50, collision, WALK_BODY_RADIUS_CM);
        expect(r.x).toBeGreaterThan(35);
        expect(r.z).toBeLessThan(100 - WALK_BODY_RADIUS_CM + 2);
    });

    it('門洞方向可通過（無該段碰撞）', () => {
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const collision = buildWalkCollision(desc);
        const door = desc.fixtures.find((f) => f.kind === 'door');
        const startZ = door.centerZ + 80;
        const endZ = door.centerZ - 40;
        const r = moveWithWalkCollision(door.centerX, startZ, 0, endZ - startZ, collision, WALK_BODY_RADIUS_CM);
        expect(r.z).toBeLessThan(door.centerZ - 20);
    });

    it('櫃體 OBB 阻擋前進', () => {
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const collision = buildWalkCollision(desc);
        const cab = desc.fixtures.find((f) => f.kind === 'cabinet');
        const r = moveWithWalkCollision(
            cab.centerX - 100,
            cab.centerZ,
            80,
            0,
            collision,
            WALK_BODY_RADIUS_CM,
        );
        expect(r.x).toBeLessThan(cab.centerX - 55);
    });
});
