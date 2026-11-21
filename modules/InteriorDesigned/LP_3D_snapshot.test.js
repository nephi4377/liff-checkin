import { describe, it, expect, vi } from 'vitest';
import {
    ORBIT_CAMERA_PRESETS,
    computeOrbitPresetCamera,
    flipRgbaRowsToTopLeft,
    formatLayout3DPngFilename,
    scaleDimensionsToMaxSide,
    scaleDimensionsForPngExport,
    renderSceneToPngBlob,
    PNG_EXPORT_MAX_SIDE_PX,
    PNG_EXPORT_MAX_PIXELS,
    buildLayout3DViewPresetOptions,
    formatWalkRoomPresetId,
    parseWalkRoomPresetId,
    isOrbitCameraPresetId,
} from './LP_3D_snapshot.js';
import { buildLayout3DDescriptor, LP_3D_DEFAULTS, ringCentroidXZ } from './LP_3D_scene.js';

const demoLayout = {
    workspaceSize: 2000,
    drawnAreas: [
        {
            id: 'w1',
            type: 'wall',
            thickness: 15,
            points: [
                { x: 300, y: 300 },
                { x: 900, y: 300 },
                { x: 900, y: 800 },
                { x: 300, y: 800 },
            ],
        },
    ],
    placedCabinets: [],
};

describe('computeOrbitPresetCamera', () => {
    const desc = buildLayout3DDescriptor(demoLayout);

    it('角落斜角與預設鳥瞰重置使用相同 span 比例', () => {
        const ws = desc.workspaceSize;
        const span = ws * 0.55;
        const ring = desc.walkBounds?.rings?.[0];
        const c = ring?.length ? ringCentroidXZ(ring) : { x: 0, z: 0 };
        const corner = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.CORNER_ISO, desc, LP_3D_DEFAULTS);
        expect(corner.position.y).toBeCloseTo(span * 0.75, 5);
        expect(corner.position.x).toBeCloseTo(c.x + span, 1);
        expect(corner.position.z).toBeCloseTo(c.z + span, 1);
    });

    it('俯視：相機在房間中心上方、目標在地面中心', () => {
        const top = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.TOP, desc, LP_3D_DEFAULTS);
        expect(top.position.x).toBeCloseTo(top.target.x, 5);
        expect(top.position.z).toBeCloseTo(top.target.z, 5);
        expect(top.position.y).toBeGreaterThan(top.target.y + 500);
        expect(top.target.y).toBe(0);
    });

    it('正面斜角：相機在 -Z 側', () => {
        const front = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.FRONT_ISO, desc, LP_3D_DEFAULTS);
        expect(front.position.z).toBeLessThan(front.target.z);
        expect(front.position.y).toBeGreaterThan(front.target.y);
    });

    it('四向等角：相機在對應軸外側', () => {
        const south = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.ISO_SOUTH, desc, LP_3D_DEFAULTS);
        expect(south.position.z).toBeGreaterThan(south.target.z);
        const east = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.ISO_EAST, desc, LP_3D_DEFAULTS);
        expect(east.position.x).toBeGreaterThan(east.target.x);
        const west = computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.ISO_WEST, desc, LP_3D_DEFAULTS);
        expect(west.position.x).toBeLessThan(west.target.x);
    });
});

describe('buildLayout3DViewPresetOptions', () => {
    it('含四向等角與各地板房間視線', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [
                {
                    id: 'f1',
                    type: 'floor',
                    points: [
                        { x: 100, y: 100 },
                        { x: 400, y: 100 },
                        { x: 400, y: 400 },
                        { x: 100, y: 400 },
                    ],
                },
                {
                    id: 'f2',
                    type: 'floor',
                    points: [
                        { x: 500, y: 100 },
                        { x: 800, y: 100 },
                        { x: 800, y: 400 },
                        { x: 500, y: 400 },
                    ],
                },
            ],
            placedCabinets: [],
        });
        const { orbit, walkRooms } = buildLayout3DViewPresetOptions(desc);
        expect(orbit.map((o) => o.id)).toContain(ORBIT_CAMERA_PRESETS.ISO_WEST);
        expect(walkRooms).toHaveLength(2);
        expect(parseWalkRoomPresetId(walkRooms[0].id)).toBe(0);
        expect(isOrbitCameraPresetId(ORBIT_CAMERA_PRESETS.TOP)).toBe(true);
        expect(isOrbitCameraPresetId(formatWalkRoomPresetId(1))).toBe(false);
    });

    it('有地板時 walk 環僅來自 floors；外圈牆存在時房間視線仍與地板數一致', () => {
        const desc = buildLayout3DDescriptor({
            workspaceSize: 2000,
            drawnAreas: [
                {
                    id: 'wall-outer',
                    type: 'wall',
                    thickness: 15,
                    points: [
                        { x: 50, y: 50 },
                        { x: 950, y: 50 },
                        { x: 950, y: 950 },
                        { x: 50, y: 950 },
                    ],
                },
                {
                    id: 'floor-a',
                    type: 'floor',
                    points: [
                        { x: 100, y: 100 },
                        { x: 400, y: 100 },
                        { x: 400, y: 400 },
                        { x: 100, y: 400 },
                    ],
                },
                {
                    id: 'floor-b',
                    type: 'floor',
                    points: [
                        { x: 500, y: 100 },
                        { x: 800, y: 100 },
                        { x: 800, y: 400 },
                        { x: 500, y: 400 },
                    ],
                },
            ],
            placedCabinets: [],
        });
        expect(desc.walls).toHaveLength(1);
        expect(desc.floors).toHaveLength(2);
        expect(desc.walkBounds?.rings?.length).toBe(2);
        const { walkRooms } = buildLayout3DViewPresetOptions(desc);
        expect(walkRooms).toHaveLength(desc.floors.length);
        expect(walkRooms[0].label).toContain('floor-a');
        expect(parseWalkRoomPresetId(walkRooms[1].id)).toBe(1);
    });

    it('僅牆體無地板時不提供房間視線選項（即使 walkBounds 有牆環）', () => {
        const desc = buildLayout3DDescriptor(demoLayout);
        expect(desc.floors).toHaveLength(0);
        expect(desc.walkBounds?.rings?.length).toBe(1);
        const { walkRooms } = buildLayout3DViewPresetOptions(desc);
        expect(walkRooms).toHaveLength(0);
    });
});

describe('flipRgbaRowsToTopLeft', () => {
    it('上下翻轉 RGBA 行', () => {
        const width = 2;
        const height = 2;
        const src = new Uint8Array([
            1, 0, 0, 255, 2, 0, 0, 255,
            3, 0, 0, 255, 4, 0, 0, 255,
        ]);
        const out = flipRgbaRowsToTopLeft(width, height, src);
        expect(out[0]).toBe(3);
        expect(out[4]).toBe(4);
        expect(out[8]).toBe(1);
        expect(out[12]).toBe(2);
    });
});

describe('scaleDimensionsToMaxSide', () => {
    it('長邊超過上限時等比縮小', () => {
        const out = scaleDimensionsToMaxSide(8000, 4000, PNG_EXPORT_MAX_SIDE_PX);
        expect(Math.max(out.width, out.height)).toBe(PNG_EXPORT_MAX_SIDE_PX);
        expect(out.width).toBe(3072);
        expect(out.height).toBe(1536);
    });

    it('未超過上限時維持原尺寸', () => {
        expect(scaleDimensionsToMaxSide(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    });
});

describe('scaleDimensionsForPngExport', () => {
    it('長邊與總像素皆在限制內時維持等比縮長邊後尺寸', () => {
        const out = scaleDimensionsForPngExport(8000, 4000);
        expect(Math.max(out.width, out.height)).toBe(PNG_EXPORT_MAX_SIDE_PX);
        expect(out.width * out.height).toBeLessThanOrEqual(PNG_EXPORT_MAX_PIXELS);
    });

    it('正方形長邊 3072 時再縮到總像素 ≤ 8MP', () => {
        const out = scaleDimensionsForPngExport(3072, 3072);
        expect(out.width * out.height).toBeLessThanOrEqual(PNG_EXPORT_MAX_PIXELS);
        expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(PNG_EXPORT_MAX_SIDE_PX);
    });
});

describe('renderSceneToPngBlob', () => {
    it('readRenderTargetPixels 丟錯時仍還原 aspect、render target 並 dispose', async () => {
        const dispose = vi.fn();
        const renderTarget = { dispose };
        const THREE = {
            WebGLRenderTarget: vi.fn(() => renderTarget),
            LinearFilter: 1,
            NearestFilter: 2,
            RGBAFormat: 3,
            UnsignedByteType: 4,
        };
        const prevTarget = { id: 'prev' };
        const renderer = {
            domElement: { width: 1920, height: 1080 },
            getRenderTarget: () => prevTarget,
            setRenderTarget: vi.fn(),
            render: vi.fn(),
            readRenderTargetPixels: vi.fn(() => {
                throw new Error('read fail');
            }),
        };
        const camera = {
            aspect: 1.5,
            updateProjectionMatrix: vi.fn(),
        };

        await expect(renderSceneToPngBlob(THREE, renderer, {}, camera)).rejects.toThrow('read fail');
        expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(prevTarget);
        expect(camera.aspect).toBe(1.5);
        expect(camera.updateProjectionMatrix).toHaveBeenCalled();
        expect(dispose).toHaveBeenCalled();
    });
});

describe('formatLayout3DPngFilename', () => {
    it('產生固定格式檔名', () => {
        expect(formatLayout3DPngFilename(new Date('2026-10-22T14:05:00'))).toBe('layout-3d-20261022-1405.png');
    });
});
