import { describe, it, expect } from 'vitest';
import {
    canvasToSceneXZ,
    buildLayout3DDescriptor,
    classifyPlacedCabinet3DKind,
    offsetPolygon,
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
                    id: 'win1',
                    x: 200,
                    y: 0,
                    rotation: 0,
                    currentW: 120,
                    currentH: 15,
                    data: { name: '落地窗', group: '門窗工程', width: 120, depth: 15 },
                },
            ],
        });
        expect(desc.walls).toHaveLength(1);
        expect(desc.fixtures).toHaveLength(3);
        const door = desc.fixtures.find((f) => f.id === 'd1');
        const win = desc.fixtures.find((f) => f.id === 'win1');
        const cab = desc.fixtures.find((f) => f.id === 'c1');
        expect(door?.kind).toBe('door');
        expect(door?.heightCm).toBe(210);
        expect(door?.baseYCm).toBe(0);
        expect(win?.kind).toBe('window');
        expect(win?.baseYCm).toBe(90);
        expect(win?.heightCm).toBe(120);
        expect(cab?.kind).toBe('cabinet');
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
