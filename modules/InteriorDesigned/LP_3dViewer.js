/**
 * LayoutPlanner 唯讀 3D 預覽（three.js ESM CDN）
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function polygonToShape(polygonXZ) {
    const shape = new THREE.Shape();
    if (!polygonXZ.length) return shape;
    shape.moveTo(polygonXZ[0].x, polygonXZ[0].z);
    for (let i = 1; i < polygonXZ.length; i++) {
        shape.lineTo(polygonXZ[i].x, polygonXZ[i].z);
    }
    shape.closePath();
    return shape;
}

function ringToExtrudeGeometry(outerXZ, innerXZ, heightCm) {
    const shape = polygonToShape(outerXZ);
    if (innerXZ && innerXZ.length >= 3) {
        const hole = new THREE.Path();
        hole.moveTo(innerXZ[0].x, innerXZ[0].z);
        for (let i = 1; i < innerXZ.length; i++) {
            hole.lineTo(innerXZ[i].x, innerXZ[i].z);
        }
        hole.closePath();
        shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: heightCm,
        bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
}

function slabGeometry(polygonXZ, thicknessCm) {
    const shape = polygonToShape(polygonXZ);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thicknessCm,
        bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
}

export class Layout3DPreview {
    /**
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.container = container;
        this._meshes = [];
        this._running = false;
        this._boundResize = () => this.resize();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe8eaed);

        const w = container.clientWidth || 640;
        const h = container.clientHeight || 480;
        this.camera = new THREE.PerspectiveCamera(50, w / h, 1, 20000);
        this.camera.position.set(400, 350, 400);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;

        const amb = new THREE.AmbientLight(0xffffff, 0.65);
        const dir = new THREE.DirectionalLight(0xffffff, 0.85);
        dir.position.set(300, 500, 200);
        this.scene.add(amb);
        this.scene.add(dir);

        const grid = new THREE.GridHelper(2000, 40, 0x9ca3af, 0xd1d5db);
        grid.position.y = 0;
        this.scene.add(grid);
    }

    resize() {
        const w = this.container.clientWidth || 640;
        const h = this.container.clientHeight || 480;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _clearMeshes() {
        for (const m of this._meshes) {
            this.scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) {
                if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
                else m.material.dispose();
            }
        }
        this._meshes = [];
    }

    /**
     * @param {ReturnType<import('./LP_layout3d.js').layoutTo3DModel>} model
     */
    render(model) {
        this._clearMeshes();
        const defs = model.defaults || {};

        const floorMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 });
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85 });
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.7, metalness: 0.05 });

        for (const slab of model.floorSlabs || []) {
            const geo = slabGeometry(slab.polygonXZ, defs.slabThicknessCm || 2);
            const mesh = new THREE.Mesh(geo, floorMat);
            mesh.position.y = 0;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        }

        const wallH = defs.wallHeightCm || 280;
        const slabT = defs.slabThicknessCm || 2;
        for (const slab of model.ceilingSlabs || []) {
            const geo = slabGeometry(slab.polygonXZ, slabT);
            const mesh = new THREE.Mesh(geo, ceilMat);
            mesh.position.y = wallH - slabT;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        }

        for (const wall of model.wallRings || []) {
            const geo = ringToExtrudeGeometry(wall.outerXZ, wall.innerXZ, wall.heightCm);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.y = 0;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        }

        for (const box of model.boxes || []) {
            const geo = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
            const mesh = new THREE.Mesh(geo, boxMat.clone());
            mesh.position.set(box.center.x, box.center.y, box.center.z);
            mesh.rotation.y = (box.rotationYDeg * Math.PI) / 180;
            if (box.mirrored) mesh.scale.x = -1;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        }

        this._frameCamera();
        this.start();
        window.addEventListener('resize', this._boundResize);
    }

    _frameCamera() {
        const box = new THREE.Box3();
        for (const m of this._meshes) {
            box.expandByObject(m);
        }
        if (box.isEmpty()) {
            this.controls.target.set(0, 100, 0);
            this.camera.position.set(400, 350, 400);
            this.controls.update();
            return;
        }
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z, 200);
        const dist = maxDim * 1.4;
        this.controls.target.copy(center);
        this.camera.position.set(center.x + dist, center.y + dist * 0.7, center.z + dist);
        this.camera.near = Math.max(1, dist / 200);
        this.camera.far = dist * 20;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    start() {
        if (this._running) return;
        this._running = true;
        const animate = () => {
            if (!this._running) return;
            this._raf = requestAnimationFrame(animate);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    pause() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        window.removeEventListener('resize', this._boundResize);
    }

    dispose() {
        this.pause();
        this._clearMeshes();
        this.renderer.dispose();
    }
}
