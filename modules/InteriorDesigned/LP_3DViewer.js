import * as THREE from 'three';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from './vendor/three-bvh-csg/index.module.js';
import {
    buildLayout3DDescriptor,
    openingCutsWall,
    LP_3D_DEFAULTS,
    ringCentroidXZ,
} from './LP_3D_scene.js';
import {
    buildFixtureMeshGroup,
    createLabelSprite,
} from './LP_3D_furniture.js';
import { createWalkController } from './LP_3D_walk.js';
import { buildWalkCollision } from './LP_3D_walk_collision.js';

function makeShapeFromRing(outer, inner) {
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

function makeShapeFromSingleRing(ring) {
    const shape = new THREE.Shape();
    ring.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, p.z);
        else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    return shape;
}

function buildWallBrush(wall, wallMat, openings, defaults) {
    const shape = makeShapeFromRing(wall.outer, wall.inner);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: wall.heightCm,
        bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);

    let brush = new Brush(geo, wallMat);
    brush.updateMatrixWorld();

    const cutters = openings.filter((op) => openingCutsWall(wall, op));
    if (!cutters.length) return brush;

    const evaluator = new Evaluator();
    const mw = defaults.WALL_CUT_MARGIN_W_CM;
    const mh = defaults.WALL_CUT_MARGIN_H_CM;
    const md = defaults.WALL_CUT_DEPTH_CM;

    for (const op of cutters) {
        const cutGeo = new THREE.BoxGeometry(
            op.widthCm + mw,
            op.heightCm + mh,
            Math.max(op.depthCm + md, 30),
        );
        const cutBrush = new Brush(cutGeo);
        cutBrush.position.set(op.centerX, op.baseYCm + op.heightCm / 2, op.centerZ);
        cutBrush.rotation.y = (-op.rotationDeg * Math.PI) / 180;
        cutBrush.updateMatrixWorld();
        brush = evaluator.evaluate(brush, cutBrush, SUBTRACTION);
    }
    return brush;
}

function buildSlabMesh(ring, yCm, thicknessCm, material) {
    const shape = makeShapeFromSingleRing(ring);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessCm, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = yCm - thicknessCm;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * @param {{ mountEl: HTMLElement, getData: () => { workspaceSize: number, placedCabinets: unknown[], drawnAreas: unknown[] }, onRequestClose?: () => void }} options
 */
export function createLayoutPlanner3DViewer(options) {
    const { mountEl, getData, onRequestClose } = options;
    const overlayEl = mountEl.closest('#lp-3d-overlay') || mountEl.parentElement;

    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let walk = null;
    let animationId = null;
    let resizeObserver = null;
    let isOpen = false;
    let viewMode = 'orbit';
    let showCeiling = true;
    let lastDesc = null;
    let lastTick = performance.now();
    let orbitBookmark = null;

    const contentGroup = { current: null };
    const ceilingGroup = { current: null };
    const labelGroup = { current: null };

    const hintEl = overlayEl?.querySelector('#lp-3d-hint');
    const btnOrbit = overlayEl?.querySelector('#lp-3d-btn-orbit');
    const btnWalk = overlayEl?.querySelector('#lp-3d-btn-walk');
    const btnReset = overlayEl?.querySelector('#lp-3d-btn-reset');
    const btnExit = overlayEl?.querySelector('#lp-3d-btn-exit-2d');
    const ceilingToggle = overlayEl?.querySelector('#lp-3d-ceiling-toggle');

    function setHint(text) {
        if (hintEl) hintEl.textContent = text;
    }

    function updateToolbarActive() {
        btnOrbit?.classList.toggle('lp-3d-active', viewMode === 'orbit');
        btnWalk?.classList.toggle('lp-3d-active', viewMode === 'walk');
    }

    function applyViewMode() {
        if (!controls || !walk || !camera) return;
        if (viewMode === 'orbit') {
            walk.setActive(false);
            controls.enabled = true;
            setHint('鳥瞰：左鍵旋轉 · 右鍵平移 · 滾輪縮放');
        } else {
            controls.enabled = false;
            walk.setActive(true);
            camera.rotation.order = 'YXZ';
            walk.syncFromCamera();
            setHint('室內：WASD 移動 · 按住左鍵轉向 · 手機左半拖移動、右半轉向');
        }
        updateToolbarActive();
    }

    function resetOrbitCamera(desc) {
        const ws = desc.workspaceSize;
        const span = ws * 0.55;
        const wallH = desc.walls[0]?.heightCm || LP_3D_DEFAULTS.WALL_HEIGHT_CM;
        camera.position.set(span, span * 0.75, span);
        controls.target.set(0, wallH * 0.45, 0);
        controls.update();
        orbitBookmark = {
            pos: camera.position.clone(),
            target: controls.target.clone(),
        };
    }

    function resetWalkCamera(desc) {
        const ring = desc.walkBounds?.rings?.[0];
        const c = ring?.length ? ringCentroidXZ(ring) : { x: 0, z: 0 };
        walk.setPosition(c.x, c.z);
        walk.lookAt(c.x, c.z - 80);
    }

    function ensureWalk() {
        if (walk) return;
        walk = createWalkController({
            camera,
            domElement: renderer.domElement,
            eyeHeightCm: LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM,
            getWalkBounds: () => lastDesc?.walkBounds ?? null,
            getWalkCollision: () => (lastDesc ? buildWalkCollision(lastDesc) : null),
        });
    }

    function resetView() {
        if (!lastDesc) return;
        if (viewMode === 'orbit') resetOrbitCamera(lastDesc);
        else resetWalkCamera(lastDesc);
    }

    function ensureScene() {
        if (renderer) {
            ensureWalk();
            return;
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xe2e8f0);

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

        const hemi = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.9);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.55);
        dir.position.set(400, 900, 300);
        scene.add(dir);
        const fill = new THREE.DirectionalLight(0xffffff, 0.25);
        fill.position.set(-300, 200, -400);
        scene.add(fill);

        resizeObserver = new ResizeObserver(() => {
            if (!renderer || !camera) return;
            const w = Math.max(mountEl.clientWidth, 1);
            const h = Math.max(mountEl.clientHeight, 1);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
        resizeObserver.observe(mountEl);
        ensureWalk();

        btnOrbit?.addEventListener('click', () => {
            viewMode = 'orbit';
            applyViewMode();
            if (lastDesc) resetOrbitCamera(lastDesc);
        });
        btnWalk?.addEventListener('click', () => {
            viewMode = 'walk';
            applyViewMode();
            if (lastDesc) resetWalkCamera(lastDesc);
        });
        btnReset?.addEventListener('click', () => resetView());
        btnExit?.addEventListener('click', () => onRequestClose?.());
        ceilingToggle?.addEventListener('change', () => {
            showCeiling = ceilingToggle.checked;
            if (ceilingGroup.current) ceilingGroup.current.visible = showCeiling;
        });

        updateToolbarActive();
        setHint('鳥瞰：左鍵旋轉 · 右鍵平移 · 滾輪縮放');
    }

    function disposeGroup(group) {
        if (!group) return;
        group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                else obj.material.dispose();
            }
            if (obj.material?.map) obj.material.map.dispose();
        });
    }

    function rebuild() {
        ensureScene();
        ensureWalk();
        const raw = getData();
        const desc = buildLayout3DDescriptor({
            workspaceSize: raw.workspaceSize,
            placedCabinets: raw.placedCabinets,
            drawnAreas: raw.drawnAreas,
        });
        lastDesc = desc;
        const defaults = LP_3D_DEFAULTS;
        const openings = desc.fixtures.filter((f) => f.kind === 'door' || f.kind === 'window');

        if (contentGroup.current) {
            scene.remove(contentGroup.current);
            disposeGroup(contentGroup.current);
        }
        if (labelGroup.current) {
            scene.remove(labelGroup.current);
            disposeGroup(labelGroup.current);
        }

        const root = new THREE.Group();
        const labels = new THREE.Group();
        const ceilings = new THREE.Group();
        ceilingGroup.current = ceilings;

        const ws = desc.workspaceSize;
        const grid = new THREE.GridHelper(ws, Math.round(ws / 100), 0xb8c4d4, 0xdbe4ef);
        grid.position.y = 0.05;
        root.add(grid);

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xf5f0e8,
            roughness: 0.92,
            metalness: 0.02,
        });
        const floorRings = desc.floors.length
            ? desc.floors.map((f) => f.ring)
            : (desc.walls[0] ? [desc.walls[0].inner] : []);
        for (const ring of floorRings) {
            if (ring?.length >= 3) root.add(buildSlabMesh(ring, 0, defaults.FLOOR_THICKNESS_CM, floorMat));
        }

        const ceilingMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.95,
            metalness: 0,
            side: THREE.DoubleSide,
        });
        const ceilingItems = desc.ceilings.length
            ? desc.ceilings
            : floorRings.map((ring, i) => ({
                id: `auto-ceiling-${i}`,
                ring,
                baseYCm: defaults.WALL_HEIGHT_CM,
                thicknessCm: defaults.CEILING_THICKNESS_CM,
            }));
        for (const ceil of ceilingItems) {
            if (ceil.ring?.length >= 3) {
                const slab = buildSlabMesh(ceil.ring, ceil.baseYCm, ceil.thicknessCm, ceilingMat);
                ceilings.add(slab);
            }
        }
        ceilings.visible = showCeiling;
        root.add(ceilings);

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.88,
            metalness: 0.04,
        });
        for (const wall of desc.walls) {
            const brush = buildWallBrush(wall, wallMat, openings, defaults);
            root.add(brush);
        }

        for (const fix of desc.fixtures) {
            const group = buildFixtureMeshGroup(THREE, fix);
            group.position.set(fix.centerX, 0, fix.centerZ);
            group.rotation.y = (-fix.rotationDeg * Math.PI) / 180;
            root.add(group);

            if (fix.label && fix.kind === 'cabinet') {
                const sprite = createLabelSprite(THREE, fix.label);
                const topY = fix.baseYCm + fix.heightCm + 12;
                sprite.position.set(fix.centerX, topY, fix.centerZ);
                labels.add(sprite);
            }
        }

        scene.add(root);
        scene.add(labels);
        contentGroup.current = root;
        labelGroup.current = labels;

        if (viewMode === 'orbit') resetOrbitCamera(desc);
        else resetWalkCamera(desc);
    }

    function tick(now) {
        if (!isOpen || !renderer) return;
        const delta = Math.min((now - lastTick) / 1000, 0.05);
        lastTick = now;
        if (viewMode === 'walk') walk.update(delta);
        else controls.update();
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(tick);
    }

    function publishTestHooks() {
        if (typeof window === 'undefined') return;
        if (new URLSearchParams(window.location.search).get('lpPreview') !== '1') return;
        window.__LP3D_TEST_HOOKS__ = {
            getViewMode: () => viewMode,
            getEyeHeightCm: () => LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM,
            getCameraY: () => camera?.position.y ?? null,
            getCameraXZ: () => (camera ? { x: camera.position.x, z: camera.position.z } : null),
            setWalkPosition: (x, z) => walk?.setPosition(x, z),
            lookWalkAt: (x, z) => walk?.lookAt(x, z),
        };
    }

    return {
        open() {
            isOpen = true;
            mountEl.setAttribute('tabindex', '0');
            overlayEl?.setAttribute('data-lp-3d-open', 'true');
            ensureScene();
            applyViewMode();
            lastTick = performance.now();
            if (!animationId) animationId = requestAnimationFrame(tick);
            publishTestHooks();
        },
        close() {
            isOpen = false;
            overlayEl?.removeAttribute('data-lp-3d-open');
            walk?.setActive(false);
            walk?.dispose();
            walk = null;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        rebuild,
        setViewMode(mode) {
            viewMode = mode === 'walk' ? 'walk' : 'orbit';
            applyViewMode();
        },
    };
}
