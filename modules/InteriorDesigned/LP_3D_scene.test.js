import { describe, it, expect } from 'vitest';
import {
    canvasToSceneXZ,
    buildLayout3DDescriptor,
    classifyPlacedCabinet3DKind,
    resolvePlacedCabinet3DKind,
    openingCutsWall,
    openingAssociatesWithWall,
    pointInWallBand,
    offsetPolygon,
    clampPointToWalkRings,
    pointInPolygonXZ,
    axisAlignedBoundsXZ,
    boundsXZMatch,
    boundsXZDelta,
    expandFloorRingToInnerFace,
    computeWalkRoomPreviewPose,
    assessLayout3DHeavyMode,
    LP_3D_HEAVY_THRESHOLDS,
} from './LP_3D_scene.js';

describe('canvasToSceneXZ', () => {
    it('工作區中心為原點', () => {
        const p = canvasToSceneXZ(1000, 1000, 2000);
        expect(p.x).toBe(0);
        expect(p.z).toBe(0);
    });
});

describe('classifyPlacedCabinet3DKind', () => {
    it('辨識門、窗、櫃體', () => {
        expect(classifyPlacedCabinet3DKind({ data: { name: '房門90', group: '門窗工程' } })).toBe('door');
        expect(classifyPlacedCabinet3DKind({ data: { name: '落地窗', group: '門窗工程' } })).toBe('window');
        expect(classifyPlacedCabinet3DKind({ data: { name: '矮櫃', group: '系統櫃' } })).toBe('cabinet');
        expect(classifyPlacedCabinet3DKind({ data: { isWall: true, name: '牆' } })).toBe('wallSegment');
    });

    it('系統櫃名稱含「門」字不誤判為門片（SWEEP-2 B4）', () => {
        expect(classifyPlacedCabinet3DKind({ data: { name: '開門高衣櫃', group: '系統櫃' } })).toBe('cabinet');
        expect(classifyPlacedCabinet3DKind({ data: { name: '雙開門矮櫃', group: '木作工程' } })).toBe('cabinet');
        expect(classifyPlacedCabinet3DKind({ data: { name: '開門高衣櫃', group: '門片' } })).toBe('cabinet');
        expect(classifyPlacedCabinet3DKind({ data: { name: '窗邊櫃', group: '門窗工程' } })).toBe('cabinet');
    });
});

describe('resolvePlacedCabinet3DKind', () => {
    it('手動覆寫優先於自動', () => {
        expect(resolvePlacedCabinet3DKind({
            model3dKind: 'window',
            data: { name: '房門', group: '門窗工程' },
        })).toBe('window');
        expect(resolvePlacedCabinet3DKind({
            model3dKind: 'ignore',
            data: { name: '房門', group: '門窗工程' },
        })).toBe(null);
    });
});

describe('openingCutsWall', () => {
    it('門貼牆才切削；遠離牆體內部不切削', () => {
        const wall = {
            outer: [
                { x: -50, z: -50 },
                { x: 50, z: -50 },
                { x: 50, z: 50 },
                { x: -50, z: 50 },
            ],
            inner: [
                { x: -40, z: -40 },
                { x: 40, z: -40 },
                { x: 40, z: 40 },
                { x: -40, z: 40 },
            ],
        };
        expect(pointInWallBand(0, -45, wall)).toBe(true);
        expect(pointInWallBand(0, 0, wall)).toBe(false);
        expect(openingCutsWall(wall, { kind: 'door', centerX: 0, centerZ: -45, widthCm: 90, depthCm: 15 })).toBe(true);
        expect(openingCutsWall(wall, {
            kind: 'door',
            centerX: 0,
            centerZ: 0,
            widthCm: 20,
            depthCm: 20,
            rotationDeg: 0,
        })).toBe(false);
        expect(openingCutsWall(wall, { kind: 'cabinet', centerX: 0, centerZ: -45 })).toBe(false);
    });

    it('旋轉門中心在室內、角點貼牆時仍應切削（與 openingAssociatesWithWall 一致）', () => {
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
        expect(openingAssociatesWithWall(wall, door)).toBe(true);
        expect(pointInWallBand(door.centerX, door.centerZ, wall)).toBe(false);
        expect(openingCutsWall(wall, door)).toBe(true);
    });
});

describe('buildLayout3DDescriptor', () => {
    it('產生牆環、門窗與櫃體', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [
                {
                    id: 'w1',
                    type: 'wall',
                    thickness: 10,
                    points: [
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                        { x: 100, y: 100 },
                        { x: 0, y: 100 },
                    ],
                },
            ],
            placedCabinets: [
                {
                    id: 'c1',
                    x: 10,
                    y: 10,
                    rotation: 0,
                    currentW: 50,
                    currentH: 40,
                    data: { name: '範例矮櫃', width: 50, depth: 40, group: '系統櫃' },
                },
                {
                    id: 'd1',
                    x: 50,
                    y: 0,
                    rotation: 0,
                    currentW: 90,
                    currentH: 15,
                    data: { name: '房門', group: '門窗工程', width: 90, depth: 15 },
                },
                {
                    id: 'x1',
                    model3dKind: 'ignore',
                    x: 0,
                    y: 0,
                    rotation: 0,
                    currentW: 20,
                    currentH: 20,
                    data: { name: '隱藏', group: '其他' },
                },
            ],
        });
        expect(desc.walls).toHaveLength(1);
        expect(desc.fixtures).toHaveLength(2);
        expect(desc.fixtures.find((f) => f.id === 'x1')).toBeUndefined();
        expect(desc.floors).toEqual([]);
        expect(desc.ceilings).toEqual([]);
    });

    it('傳遞 2D 鏡像旗標至 fixture（SWEEP-2 B5）', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [],
            placedCabinets: [{
                id: 'm1',
                x: 100,
                y: 100,
                rotation: 0,
                mirrored: true,
                currentW: 80,
                currentH: 40,
                data: { name: '矮櫃', group: '系統櫃', width: 80, depth: 40 },
            }],
        });
        expect(desc.fixtures[0].mirrored).toBe(true);
    });

    it('包含地板與天花區域', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [
                {
                    id: 'f1',
                    type: 'floor',
                    points: [
                        { x: 100, y: 100 },
                        { x: 200, y: 100 },
                        { x: 200, y: 200 },
                        { x: 100, y: 200 },
                    ],
                },
                {
                    id: 'c1',
                    type: 'ceiling',
                    points: [
                        { x: 100, y: 100 },
                        { x: 200, y: 100 },
                        { x: 200, y: 200 },
                        { x: 100, y: 200 },
                    ],
                },
            ],
            placedCabinets: [],
        });
        expect(desc.floors).toHaveLength(1);
        expect(desc.ceilings).toHaveLength(1);
        expect(desc.walkBounds?.rings).toHaveLength(1);
    });
});

describe('clampPointToWalkRings', () => {
    it('凹形與多區域地板：內部不位移、外部投影回邊界', () => {
        const lShape = [
            { x: 0, z: 0 },
            { x: 100, z: 0 },
            { x: 100, z: 40 },
            { x: 40, z: 40 },
            { x: 40, z: 100 },
            { x: 0, z: 100 },
        ];
        const inside = clampPointToWalkRings(20, 20, [lShape]);
        expect(inside.x).toBe(20);
        expect(inside.z).toBe(20);
        expect(pointInPolygonXZ(20, 20, lShape)).toBe(true);

        const roomA = [
            { x: -50, z: -50 },
            { x: 50, z: -50 },
            { x: 50, z: 50 },
            { x: -50, z: 50 },
        ];
        const roomB = [
            { x: 80, z: -30 },
            { x: 160, z: -30 },
            { x: 160, z: 30 },
            { x: 80, z: 30 },
        ];
        expect(pointInPolygonXZ(0, 0, roomA)).toBe(true);
        expect(pointInPolygonXZ(120, 0, roomB)).toBe(true);
        const outside = clampPointToWalkRings(200, 200, [roomA, roomB]);
        expect(
            pointInPolygonXZ(outside.x, outside.z, roomA)
            || pointInPolygonXZ(outside.x, outside.z, roomB),
        ).toBe(true);
    });
});

describe('lp-3d-spec-demo fixture', () => {
    it('門窗中心可對牆開洞、櫃體在內圈內', () => {
        const layout = {
            workspaceSize: 2000,
            drawnAreas: [{
                id: 'area-demo-wall',
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
                    id: 'cab-demo-1',
                    x: 400,
                    y: 600,
                    rotation: 0,
                    currentW: 120,
                    currentH: 60,
                    data: { name: '範例矮櫃', group: '系統櫃', width: 120, depth: 60 },
                },
                {
                    id: 'door-demo-1',
                    x: 500,
                    y: 285,
                    rotation: 0,
                    currentW: 90,
                    currentH: 15,
                    data: { name: '房門', group: '門窗工程', width: 90, depth: 15 },
                },
                {
                    id: 'win-demo-1',
                    x: 700,
                    y: 285,
                    rotation: 0,
                    currentW: 150,
                    currentH: 15,
                    data: { name: '落地窗', group: '門窗工程', width: 150, depth: 15 },
                },
            ],
        };
        const desc = buildLayout3DDescriptor(layout);
        const wall = desc.walls[0];
        const door = desc.fixtures.find((f) => f.kind === 'door');
        const window = desc.fixtures.find((f) => f.kind === 'window');
        const cab = desc.fixtures.find((f) => f.kind === 'cabinet');
        expect(openingCutsWall(wall, door)).toBe(true);
        expect(openingCutsWall(wall, window)).toBe(true);
        const ring = wall.inner;
        expect(pointInPolygonXZ(cab.centerX, cab.centerZ, ring)).toBe(true);
    });
});

describe('computeWalkRoomPreviewPose', () => {
    it('距南牆 standoff 並朝北看', () => {
        const ring = [
            { x: -300, z: -250 },
            { x: 300, z: -250 },
            { x: 300, z: 250 },
            { x: -300, z: 250 },
        ];
        const pose = computeWalkRoomPreviewPose(ring, 150);
        expect(pose.x).toBe(0);
        expect(pose.z).toBe(100);
        expect(pose.lookX).toBe(-72);
        expect(pose.lookZ).toBe(-90);
        expect(pose.pitch).toBeLessThan(0);
    });
});

describe('expandFloorRingToInnerFace', () => {
    it('略外擴仍落在 2cm 容差內', () => {
        const ring = [
            { x: -100, z: -100 },
            { x: 100, z: -100 },
            { x: 100, z: 100 },
            { x: -100, z: 100 },
        ];
        const expanded = expandFloorRingToInnerFace(ring, 1.2);
        const a = axisAlignedBoundsXZ(ring);
        const b = axisAlignedBoundsXZ(expanded);
        expect(boundsXZDelta(a, b).maxEdge).toBeLessThanOrEqual(2);
    });
});

describe('boundsXZMatch', () => {
    it('容差內判定外框一致', () => {
        const a = axisAlignedBoundsXZ([
            { x: -10, z: -20 },
            { x: 10, z: 20 },
        ]);
        const b = { minX: -10.5, maxX: 10.5, minZ: -19.5, maxZ: 20.5 };
        expect(boundsXZMatch(a, b, 1)).toBe(true);
        expect(boundsXZMatch(a, b, 0.2)).toBe(false);
    });
});

describe('offsetPolygon', () => {
    it('正方形外擴後頂點位移', () => {
        const sq = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ];
        const outer = offsetPolygon(sq, 10);
        expect(outer.length).toBe(4);
        expect(outer[0].x).not.toBe(sq[0].x);
    });
});

describe('assessLayout3DHeavyMode', () => {
    it('達櫃體與牆段雙門檻才啟用 heavy', () => {
        const cabinets = Array.from({ length: LP_3D_HEAVY_THRESHOLDS.CABINETS }, (_, i) => ({
            id: `c${i}`,
            x: 10,
            y: 10,
            rotation: 0,
            currentW: 50,
            currentH: 40,
            data: { name: '櫃', group: '系統櫃', width: 50, depth: 40 },
        }));
        const walls = Array.from({ length: LP_3D_HEAVY_THRESHOLDS.WALL_SEGMENTS }, (_, i) => ({
            id: `w${i}`,
            type: 'wall',
            thickness: 12,
            points: [
                { x: 100 + i * 200, y: 100 },
                { x: 200 + i * 200, y: 100 },
                { x: 200 + i * 200, y: 200 },
                { x: 100 + i * 200, y: 200 },
            ],
        }));
        const desc = buildLayout3DDescriptor({
            workspaceSize: 4000,
            placedCabinets: cabinets,
            drawnAreas: walls,
        });
        const heavy = assessLayout3DHeavyMode(desc);
        expect(heavy.heavy).toBe(true);
        expect(heavy.cabinetCount).toBeGreaterThanOrEqual(LP_3D_HEAVY_THRESHOLDS.CABINETS);
        expect(heavy.wallSegments).toBeGreaterThanOrEqual(LP_3D_HEAVY_THRESHOLDS.WALL_SEGMENTS);
    });
});
