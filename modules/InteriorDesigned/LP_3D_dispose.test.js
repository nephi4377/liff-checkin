import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D } from './LP_3D_dispose.js';

describe('disposeObject3D', () => {
    it('共用 material 只 dispose 一次且不拋錯', () => {
        const shared = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const matSpy = vi.spyOn(shared, 'dispose');
        const g1 = new THREE.BoxGeometry(1, 1, 1);
        const g2 = new THREE.BoxGeometry(2, 2, 2);
        const root = new THREE.Group();
        root.add(new THREE.Mesh(g1, shared));
        root.add(new THREE.Mesh(g2, shared));

        disposeObject3D(root);

        expect(matSpy).toHaveBeenCalledTimes(1);
    });

    it('SpriteMaterial 的 map texture 會被釋放', () => {
        const tex = new THREE.Texture();
        const texSpy = vi.spyOn(tex, 'dispose');
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        const root = new THREE.Group();
        root.add(sprite);

        disposeObject3D(root);

        expect(texSpy).toHaveBeenCalledTimes(1);
    });
});
