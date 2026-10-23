// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { createWalkController } from './LP_3D_walk.js';
import { LP_3D_DEFAULTS } from './LP_3D_scene.js';

describe('createWalkController', () => {
    const controllers = [];

    afterEach(() => {
        while (controllers.length) controllers.pop().dispose();
    });

    it('啟用後維持設定眼高並響應前進', () => {
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(10, 0, 10);
        const domElement = document.createElement('div');
        Object.defineProperty(domElement, 'clientWidth', { value: 800 });
        const walk = createWalkController({
            camera,
            domElement,
            eyeHeightCm: LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM,
            getWalkBounds: () => null,
        });
        controllers.push(walk);
        walk.setActive(true);
        walk.syncFromCamera();

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
        walk.update(0.5);

        expect(camera.position.y).toBe(LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM);
        expect(Math.hypot(camera.position.x - 10, camera.position.z - 10)).toBeGreaterThan(0);
    });

    it('停用後不再吃掉方向鍵', () => {
        const camera = new THREE.PerspectiveCamera();
        const domElement = document.createElement('div');
        Object.defineProperty(domElement, 'clientWidth', { value: 400 });
        const walk = createWalkController({
            camera,
            domElement,
            eyeHeightCm: 155,
            getWalkBounds: () => null,
        });
        controllers.push(walk);
        walk.setActive(false);
        const ev = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true });
        const prevented = !window.dispatchEvent(ev);
        expect(prevented).toBe(false);
    });
});
