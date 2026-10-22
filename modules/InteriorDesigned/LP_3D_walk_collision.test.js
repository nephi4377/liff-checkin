import { describe, it, expect } from 'vitest';
import { buildLayout3DDescriptor } from './LP_3D_scene.js';
import {
    WALK_BODY_RADIUS_CM,
    buildWalkCollision,
    buildWallInnerCollisionSegments,
    moveWithWalkCollision,
    openingSpanOnEdge,
    resolveWalkPosition,
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
});

describe('moveWithWalkCollision', () => {
    it('撞牆時無法穿過內牆線段', () => {
        const collision = {
            segments: [{
                ax: -100, az: 100, bx: 100, bz: 100, passable: false,
            }],
            circles: [],
        };
        const r = moveWithWalkCollision(0, 80, 0, 80, collision, WALK_BODY_RADIUS_CM);
        expect(r.z).toBeLessThan(100 - WALK_BODY_RADIUS_CM + 2);
    });

    it('沿牆滑動：斜向撞牆仍保留切線位移', () => {
        const collision = {
            segments: [{
                ax: -100, az: 100, bx: 100, bz: 100, passable: false,
            }],
            circles: [],
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

    it('櫃體圓形障礙阻擋前進', () => {
        const desc = buildLayout3DDescriptor(layoutRoomWithDoorAndWindow());
        const collision = buildWalkCollision(desc);
        const cab = desc.fixtures.find((f) => f.kind === 'cabinet');
        const r = resolveWalkPosition(
            cab.centerX - 60,
            cab.centerZ,
            cab.centerX - 5,
            cab.centerZ,
            collision,
            WALK_BODY_RADIUS_CM,
        );
        expect(r.x).toBeLessThan(cab.centerX - 25);
    });
});
