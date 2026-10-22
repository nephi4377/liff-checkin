import { buildLayout3DDescriptor } from './LP_3D_scene.js';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

let threeModulePromise = null;

function loadThree() {
    if (!threeModulePromise) {
        threeModulePromise = Promise.all([
            import(/* @vite-ignore */ THREE_CDN),
            import(/* @vite-ignore */ ORBIT_CDN),
        ]).then(([THREE, { OrbitControls }]) => ({ THREE, OrbitControls }));
    }
    return threeModulePromise;
}

function makeShapeFromRing(outer, inner, THREE) {
    const shape = new THREE.Shape();
    outer.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, p.z);
        else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    if (inner && inner.length >= 3) {
        const hole = new THREE.Path();
        inner.forEach((p, i) => {
            if (i === 0) hole.moveTo(p.x, p.z);
            else hole.lineTo(p.x, p.z);
        });
        hole.closePath();
        shape.holes.push(hole);
    }
    return shape;
}

/**
 * @param {{ mountEl: HTMLElement, getData: () => { workspaceSize: number, placedCabinets: unknown[], drawnAreas: unknown[] } }} options
 */
export function createLayoutPlanner3DViewer(options) {
    const { mountEl, getData } = options;
    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let animationId = null;
    let resizeObserver = null;
    let isOpen = false;

    const contentGroup = { current: null };

    async function ensureScene() {
        const { THREE, OrbitControls } = await loadThree();
        if (renderer) return { THREE, OrbitControls };

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);

        const aspect = Math.max(mountEl.clientWidth, 1) / Math.max(mountEl.clientHeight, 1);
        camera = new THREE.PerspectiveCamera(50, aspect, 10, 50000);
        camera.position.set(800, 600, 800);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
        mountEl.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 120, 0);

        const hemi = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.85);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.65);
        dir.position.set(400, 800, 200);
        scene.add(dir);

        resizeObserver = new ResizeObserver(() => {
            if (!renderer || !camera) return;
            const w = Math.max(mountEl.clientWidth, 1);
            const h = Math.max(mountEl.clientHeight, 1);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
        resizeObserver.observe(mountEl);

        return { THREE, OrbitControls };
    }

    function disposeGroup(group) {
        if (!group) return;
        group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                else obj.material.dispose();
            }
        });
    }

    async function rebuild() {
        const { THREE } = await ensureScene();
        const raw = getData();
        const desc = buildLayout3DDescriptor({
            workspaceSize: raw.workspaceSize,
            placedCabinets: raw.placedCabinets,
            drawnAreas: raw.drawnAreas,
        });

        if (contentGroup.current) {
            scene.remove(contentGroup.current);
            disposeGroup(contentGroup.current);
        }

        const root = new THREE.Group();
        const ws = desc.workspaceSize;
        const grid = new THREE.GridHelper(ws, Math.round(ws / 100), 0xcbd5e1, 0xe2e8f0);
        grid.position.y = 0;
        root.add(grid);

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.85,
            metalness: 0.05,
        });
        for (const wall of desc.walls) {
            const shape = makeShapeFromRing(wall.outer, wall.inner, THREE);
            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: wall.heightCm,
                bevelEnabled: false,
            });
            geo.rotateX(-Math.PI / 2);
            const mesh = new THREE.Mesh(geo, wallMat);
            root.add(mesh);
        }

        for (const cab of desc.cabinets) {
            const geo = new THREE.BoxGeometry(cab.widthCm, cab.heightCm, cab.depthCm);
            const mat = new THREE.MeshStandardMaterial({
                color: cab.isWall ? 0x475569 : 0xd97706,
                roughness: 0.7,
                metalness: 0.1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cab.centerX, cab.heightCm / 2, cab.centerZ);
            mesh.rotation.y = (-cab.rotationDeg * Math.PI) / 180;
            root.add(mesh);
        }

        scene.add(root);
        contentGroup.current = root;

        const span = ws * 0.6;
        camera.position.set(span, span * 0.8, span);
        controls.target.set(0, desc.walls[0]?.heightCm ? desc.walls[0].heightCm / 2 : 100, 0);
        controls.update();
    }

    function tick() {
        if (!isOpen || !renderer) return;
        controls.update();
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(tick);
    }

    return {
        async open() {
            isOpen = true;
            mountEl.setAttribute('tabindex', '0');
            await ensureScene();
            if (!animationId) tick();
        },
        close() {
            isOpen = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        rebuild,
    };
}
