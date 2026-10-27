// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

vi.mock('three', async (importOriginal) => {
    const THREE = await importOriginal();
    return {
        ...THREE,
        WebGLRenderer: class MockWebGLRenderer {
            constructor() {
                this.domElement = document.createElement('canvas');
            }

            setPixelRatio() {}

            setSize() {}

            render() {}

            dispose() {}

            getContext() {
                return {};
            }
        },
    };
});

import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import * as walkModule from './LP_3D_walk.js';
import { createLayoutPlanner3DViewer } from './LP_3DViewer.js';

const originalCreateWalk = walkModule.createWalkController;

function minimalLayoutData() {
    return {
        workspaceSize: 2400,
        placedCabinets: [],
        drawnAreas: [{
            id: 'room-1',
            type: 'room',
            points: [
                { x: 200, y: 200 },
                { x: 2200, y: 200 },
                { x: 2200, y: 2200 },
                { x: 200, y: 2200 },
            ],
        }],
    };
}

describe('createLayoutPlanner3DViewer walk lifecycle', () => {
    const viewers = [];
    let createWalkSpy;

    beforeAll(() => {
        global.ResizeObserver = class {
            observe() {}

            disconnect() {}
        };
    });

    afterEach(() => {
        while (viewers.length) viewers.pop().dispose();
        createWalkSpy?.mockRestore();
    });

    it('開關 20 次 walk 只建立一次，close 不 dispose；viewer.dispose 才釋放', () => {
        createWalkSpy = vi.spyOn(walkModule, 'createWalkController');
        const walkDisposeSpies = [];
        createWalkSpy.mockImplementation((...args) => {
            const ctrl = originalCreateWalk(...args);
            walkDisposeSpies.push(vi.spyOn(ctrl, 'dispose'));
            return ctrl;
        });

        const mountEl = document.createElement('div');
        Object.assign(mountEl.style, { width: '640px', height: '480px' });
        document.body.appendChild(mountEl);

        const viewer = createLayoutPlanner3DViewer({
            mountEl,
            getData: () => minimalLayoutData(),
        });
        viewers.push(viewer);

        for (let i = 0; i < 20; i += 1) {
            viewer.open();
            viewer.rebuild();
            viewer.close();
        }

        expect(createWalkSpy).toHaveBeenCalledTimes(1);
        expect(viewer.getDiagnostics().walkCreateCount).toBe(1);
        walkDisposeSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

        viewer.dispose();
        expect(walkDisposeSpies[0]).toHaveBeenCalledTimes(1);
        viewers.pop();
    });

    it('dispose 會呼叫 OrbitControls.dispose', () => {
        const disposeSpy = vi.spyOn(OrbitControls.prototype, 'dispose');
        const mountEl = document.createElement('div');
        Object.assign(mountEl.style, { width: '640px', height: '480px' });
        document.body.appendChild(mountEl);
        const viewer = createLayoutPlanner3DViewer({
            mountEl,
            getData: () => minimalLayoutData(),
        });
        viewers.push(viewer);
        viewer.open();
        viewer.dispose();
        expect(disposeSpy).toHaveBeenCalled();
        disposeSpy.mockRestore();
        viewers.pop();
    });
});
