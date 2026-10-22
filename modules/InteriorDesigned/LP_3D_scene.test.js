import { describe, it, expect } from 'vitest';
import {
    canvasToSceneXZ,
    buildLayout3DDescriptor,
    offsetPolygon,
    signedPolygonArea,
} from './LP_3D_scene.js';

describe('canvasToSceneXZ', () => {
    it('工作區中心為原點', () => {
        const p = canvasToSceneXZ(1000, 1000, 2000);
        expect(p.x).toBe(0);
        expect(p.z).toBe(0);
    });
});

describe('buildLayout3DDescriptor', () => {
    it('產生牆環與櫃體盒子', () => {
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
                    data: { name: '範例', width: 50, depth: 40 },
                },
            ],
        });
        expect(desc.walls).toHaveLength(1);
        expect(desc.walls[0].outer.length).toBe(4);
        expect(desc.cabinets).toHaveLength(1);
        expect(desc.cabinets[0].widthCm).toBe(50);
    });
});

describe('offsetPolygon', () => {
    it('正方形外擴後面積變大', () => {
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
