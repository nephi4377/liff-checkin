import * as THREE from 'three';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from './vendor/three-bvh-csg/index.module.js';
import {
    buildLayout3DDescriptor,
    openingCutsWall,
    openingAssociatesWithWall,
    LP_3D_DEFAULTS,
    ringCentroidXZ,
    fixtureFootprintSamplePointsXZ,
    pointInPolygonXZ,
    pointInWallBand,
    axisAlignedBoundsXZ,
    boundsXZMatch,
    computeWalkRoomPreviewPose,
} from './LP_3D_scene.js';
import {
    buildFixtureMeshGroup,
    createLabelSprite,
    LP_3D_CATEGORY_COLORS,
} from './LP_3D_furniture.js';
import { createWalkController } from './LP_3D_walk.js';
import { disposeObject3D, disposeBrushGeometry } from './LP_3D_dispose.js';
import {
    ORBIT_CAMERA_PRESETS,
    computeOrbitPresetCamera,
    renderSceneToPngBlob,
    downloadBlobAsFile,
    formatLayout3DPngFilename,
} from './LP_3D_snapshot.js';
import {
    createWalkCollisionCache,
    resolveWalkBodyRadiusCm,
    resolveWalkSpawnXZ,
} from './LP_3D_walk_collision.js';

/** ExtrudeGeometry 旋轉後 shape.y 對應 world -Z，與 fixture 的 centerZ 一致 */
function shapePointXZ(p) {
    return { x: p.x, y: -p.z };
}

function shapeSignedArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = shapePointXZ(ring[i]);
        const b = shapePointXZ(ring[(i + 1) % ring.length]);
        sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
}

/** Three.js Shape 外圈需 CCW（shape 平面） */
function ringForShapeOuter(ring) {
    if (!ring?.length) return ring;
    return shapeSignedArea(ring) < 0 ? [...ring].reverse() : ring;
}

function ringForShapeHole(ring) {
    return [...ringForShapeOuter(ring)].reverse();
}

function makeShapeFromRing(outer, inner) {
    const shape = new THREE.Shape();
    const outerRing = ringForShapeOuter(outer);
    outerRing.forEach((p, i) => {
        const s = shapePointXZ(p);
        if (i === 0) shape.moveTo(s.x, s.y);
        else shape.lineTo(s.x, s.y);
    });
    shape.closePath();
    if (inner && inner.length >= 3) {
        const hole = new THREE.Path();
        const innerRing = ringForShapeHole(inner);
        innerRing.forEach((p, i) => {
            const s = shapePointXZ(p);
            if (i === 0) hole.moveTo(s.x, s.y);
            else hole.lineTo(s.x, s.y);
        });
        hole.closePath();
        shape.holes.push(hole);
    }
    return shape;
}

function makeShapeFromSingleRing(ring) {
    const shape = new THREE.Shape();
    const oriented = ringForShapeOuter(ring);
    oriented.forEach((p, i) => {
        const s = shapePointXZ(p);
        if (i === 0) shape.moveTo(s.x, s.y);
        else shape.lineTo(s.x, s.y);
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
        const prev = brush;
        brush = evaluator.evaluate(prev, cutBrush, SUBTRACTION);
        if (prev !== brush) disposeBrushGeometry(prev);
        disposeBrushGeometry(cutBrush);
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
    let showCeiling = false;
    let lastDesc = null;
    const walkCollisionCache = createWalkCollisionCache();
    let lastTick = performance.now();
    let orbitBookmark = null;
    let rebuildCount = 0;
    let walkCreateCount = 0;

    const contentGroup = { current: null };
    const ceilingGroup = { current: null };
    const labelGroup = { current: null };
    const wallMeshes = { current: [] };
    const floorMeshes = { current: [] };
    const fixtureGroups = { current: new Map() };
    const ORBIT_WALL_CUT_HEIGHT_CM = 100;

    const hintEl = overlayEl?.querySelector('#lp-3d-hint');
    const btnOrbit = overlayEl?.querySelector('#lp-3d-btn-orbit');
    const btnWalk = overlayEl?.querySelector('#lp-3d-btn-walk');
    const btnReset = overlayEl?.querySelector('#lp-3d-btn-reset');
    const btnExit = overlayEl?.querySelector('#lp-3d-btn-exit-2d');
    const ceilingToggle = overlayEl?.querySelector('#lp-3d-ceiling-toggle');
    const btnPresetTop = overlayEl?.querySelector('#lp-3d-btn-preset-top');
    const btnPresetFront = overlayEl?.querySelector('#lp-3d-btn-preset-front');
    const btnPresetCorner = overlayEl?.querySelector('#lp-3d-btn-preset-corner');
    const presetSelect = overlayEl?.querySelector('#lp-3d-preset-select');
    const btnSavePng = overlayEl?.querySelector('#lp-3d-btn-save-png');

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
            walk?.setActive(false);
            controls.enabled = true;
            setHint('鳥瞰：左鍵旋轉 · 右鍵平移 · 滾輪縮放');
        } else {
            controls.enabled = false;
            walk?.setActive(true);
            camera.rotation.order = 'YXZ';
            walk.syncFromCamera();
            setHint('室內：WASD 移動 · 按住左鍵轉向 · 手機左半拖移動、右半轉向');
        }
        updateToolbarActive();
    }

    function resetOrbitCamera(desc) {
        applyOrbitPresetInternal(ORBIT_CAMERA_PRESETS.TOP, desc, { hideCeiling: true });
    }

    function applyOrbitPresetInternal(presetId, desc, opts = {}) {
        if (!camera || !controls) return;
        const { position, target } = computeOrbitPresetCamera(presetId, desc, LP_3D_DEFAULTS);
        camera.position.set(position.x, position.y, position.z);
        controls.target.set(target.x, target.y, target.z);
        controls.update();
        orbitBookmark = {
            pos: camera.position.clone(),
            target: controls.target.clone(),
        };
        if (opts.hideCeiling) {
            showCeiling = false;
            if (ceilingToggle) ceilingToggle.checked = false;
            if (ceilingGroup.current) ceilingGroup.current.visible = false;
        }
        applyOrbitWallPresentation();
    }

    function resetWalkCamera(desc) {
        const ring = desc.walkBounds?.rings?.[0];
        const pose = ring ? computeWalkRoomPreviewPose(ring) : null;
        if (pose) {
            walk.setPosition(pose.x, pose.z);
            walk.lookAt(pose.lookX, pose.lookZ);
            if (pose.pitch != null) walk.setPitch(pose.pitch);
            return;
        }
        const c = ring?.length ? ringCentroidXZ(ring) : { x: 0, z: 0 };
        const bodyR = resolveWalkBodyRadiusCm(desc);
        const collision = walkCollisionCache.get(desc);
        const spawn = resolveWalkSpawnXZ(c.x, c.z, collision, bodyR);
        walk.setPosition(spawn.x, spawn.z);
        walk.lookAt(spawn.x, spawn.z - 80);
    }

    function ensureWalk() {
        if (walk) return;
        walkCreateCount += 1;
        walk = createWalkController({
            camera,
            domElement: renderer.domElement,
            eyeHeightCm: LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM,
            getWalkBounds: () => lastDesc?.walkBounds ?? null,
            getWalkCollision: () => walkCollisionCache.get(lastDesc),
            getWalkBodyRadiusCm: () => (lastDesc ? resolveWalkBodyRadiusCm(lastDesc) : 20),
        });
    }

    function resetView() {
        if (!lastDesc) return;
        if (viewMode === 'orbit') resetOrbitCamera(lastDesc);
        else resetWalkCamera(lastDesc);
    }

    function applyOrbitPreset(presetId) {
        if (!lastDesc || !camera || !controls) return;
        viewMode = 'orbit';
        applyViewMode();
        applyOrbitPresetInternal(presetId, lastDesc);
    }

    async function saveCurrentViewPng() {
        if (!renderer || !scene || !camera) return;
        renderer.render(scene, camera);
        const blob = await renderSceneToPngBlob(THREE, renderer, scene, camera);
        downloadBlobAsFile(blob, formatLayout3DPngFilename());
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
        controls.addEventListener('end', () => applyOrbitWallPresentation());

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
        btnPresetTop?.addEventListener('click', () => applyOrbitPreset(ORBIT_CAMERA_PRESETS.TOP));
        btnPresetFront?.addEventListener('click', () => applyOrbitPreset(ORBIT_CAMERA_PRESETS.FRONT_ISO));
        btnPresetCorner?.addEventListener('click', () => applyOrbitPreset(ORBIT_CAMERA_PRESETS.CORNER_ISO));
        presetSelect?.addEventListener('change', () => {
            const value = presetSelect.value;
            if (!value) return;
            if (value === ORBIT_CAMERA_PRESETS.TOP
                || value === ORBIT_CAMERA_PRESETS.FRONT_ISO
                || value === ORBIT_CAMERA_PRESETS.CORNER_ISO) {
                applyOrbitPreset(value);
            }
            presetSelect.value = '';
        });
        btnSavePng?.addEventListener('click', () => {
            saveCurrentViewPng().catch((err) => console.error('[LP 3D save PNG]', err));
        });

        updateToolbarActive();
        setHint('鳥瞰：左鍵旋轉 · 右鍵平移 · 滾輪縮放');
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
        lastOrbitWallCut = null;
        walkCollisionCache.invalidate();
        const defaults = LP_3D_DEFAULTS;
        const openings = desc.fixtures.filter((f) => f.kind === 'door' || f.kind === 'window');

        if (contentGroup.current) {
            scene.remove(contentGroup.current);
            disposeObject3D(contentGroup.current);
        }
        if (labelGroup.current) {
            scene.remove(labelGroup.current);
            disposeObject3D(labelGroup.current);
        }
        rebuildCount += 1;

        const root = new THREE.Group();
        const labels = new THREE.Group();
        const ceilings = new THREE.Group();
        ceilingGroup.current = ceilings;

        const ws = desc.workspaceSize;
        const grid = new THREE.GridHelper(ws, Math.round(ws / 100), 0xb8c4d4, 0xdbe4ef);
        grid.position.y = -0.5;
        root.add(grid);

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xf5f0e8,
            roughness: 0.92,
            metalness: 0.02,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        });
        const floorRings = desc.floors.length
            ? desc.floors.map((f) => f.ring)
            : (desc.walls[0] ? [desc.walls[0].inner] : []);
        floorMeshes.current = [];
        for (const ring of floorRings) {
            if (ring?.length >= 3) {
                const slab = buildSlabMesh(ring, 0, defaults.FLOOR_THICKNESS_CM, floorMat);
                slab.userData.lp3dFloor = true;
                floorMeshes.current.push(slab);
                root.add(slab);
            }
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
        wallMeshes.current = [];
        for (const wall of desc.walls) {
            const brush = buildWallBrush(wall, wallMat, openings, defaults);
            brush.userData.lp3dWall = true;
            wallMeshes.current.push(brush);
            root.add(brush);
        }

        fixtureGroups.current = new Map();
        const cabinetCount = desc.fixtures.filter((f) => f.kind === 'cabinet').length;
        const showCabinetLabels = cabinetCount <= 12;
        for (const fix of desc.fixtures) {
            const group = buildFixtureMeshGroup(THREE, fix);
            const liftY = fix.kind === 'cabinet' ? 0.35 : 0;
            group.position.set(fix.centerX, liftY, fix.centerZ);
            group.rotation.y = (-fix.rotationDeg * Math.PI) / 180;
            group.userData.lp3dFixtureId = fix.id;
            group.userData.lp3dFixtureKind = fix.kind;
            fixtureGroups.current.set(fix.id, group);
            root.add(group);

            if (showCabinetLabels && fix.label && fix.kind === 'cabinet') {
                const accent = LP_3D_CATEGORY_COLORS[fix.displayCategory]
                    ?? LP_3D_CATEGORY_COLORS.cabinet;
                const sprite = createLabelSprite(THREE, fix.label, accent);
                const topY = fix.baseYCm + fix.heightCm + 18 + liftY;
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
        applyOrbitWallPresentation();
    }

    function isOrbitTopDownView() {
        if (!camera || !controls || !lastDesc) return false;
        const wallH = lastDesc.walls?.[0]?.heightCm ?? LP_3D_DEFAULTS.WALL_HEIGHT_CM;
        const dx = camera.position.x - controls.target.x;
        const dz = camera.position.z - controls.target.z;
        const dy = camera.position.y - controls.target.y;
        const horiz = Math.hypot(dx, dz);
        return dy > wallH * 0.65 && horiz < dy * 0.42;
    }

    let lastOrbitWallCut = null;

    function applyOrbitWallPresentation() {
        if (!camera || viewMode !== 'orbit' || !wallMeshes.current.length) return;
        const wallH = lastDesc?.walls?.[0]?.heightCm ?? LP_3D_DEFAULTS.WALL_HEIGHT_CM;
        const topDown = isOrbitTopDownView();
        const cut = !topDown;
        const modeKey = topDown ? 'top' : (cut ? 'cut' : 'full');
        if (modeKey === lastOrbitWallCut && modeKey !== 'top') return;
        if (modeKey === lastOrbitWallCut && topDown) {
            for (const mesh of wallMeshes.current) {
                if (mesh.visible) {
                    mesh.visible = false;
                }
            }
            return;
        }
        lastOrbitWallCut = modeKey;
        for (const mesh of wallMeshes.current) {
            if (topDown) {
                mesh.visible = false;
                continue;
            }
            mesh.visible = true;
            mesh.scale.y = cut ? ORBIT_WALL_CUT_HEIGHT_CM / wallH : 1;
            const mat = mesh.material;
            if (!mat) continue;
            mat.transparent = cut;
            mat.opacity = cut ? 0.38 : 1;
            mat.depthWrite = !cut;
            mat.needsUpdate = true;
        }
    }

    function updateLabelScreenSizes() {
        if (!camera || !renderer || !labelGroup.current?.children?.length) return;
        const pxH = 38;
        const viewH = Math.max(renderer.domElement.clientHeight, 1);
        const vFov = (camera.fov * Math.PI) / 180;
        labelGroup.current.children.forEach((sprite) => {
            const d = Math.max(camera.position.distanceTo(sprite.position), 40);
            const worldH = 2 * Math.tan(vFov / 2) * d * (pxH / viewH);
            const img = sprite.material?.map?.image;
            const aspect = img?.width && img?.height ? img.width / img.height : 2.6;
            sprite.scale.set(worldH * aspect, worldH, 1);
        });
    }

    function tick(now) {
        if (!isOpen || !renderer) return;
        const delta = Math.min((now - lastTick) / 1000, 0.05);
        lastTick = now;
        if (viewMode === 'walk') walk.update(delta);
        else {
            controls.update();
            applyOrbitWallPresentation();
        }
        updateLabelScreenSizes();
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(tick);
    }

    function meshWorldCentersXZ(object) {
        const out = [];
        const v = new THREE.Vector3();
        object.traverse((obj) => {
            if (obj.isMesh) {
                obj.getWorldPosition(v);
                out.push({ x: v.x, z: v.z });
            }
        });
        return out;
    }

    function projectWorldBoxToScreen(object3d) {
        if (!camera || !renderer || !object3d) return null;
        const box = new THREE.Box3().setFromObject(object3d);
        if (box.isEmpty()) return null;
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const corners = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];
        let minSx = Infinity;
        let maxSx = -Infinity;
        let minSy = Infinity;
        let maxSy = -Infinity;
        let anyInFront = false;
        for (const v of corners) {
            const p = v.clone().project(camera);
            if (p.z < 1) anyInFront = true;
            const sx = (p.x * 0.5 + 0.5) * w;
            const sy = (-p.y * 0.5 + 0.5) * h;
            minSx = Math.min(minSx, sx);
            maxSx = Math.max(maxSx, sx);
            minSy = Math.min(minSy, sy);
            maxSy = Math.max(maxSy, sy);
        }
        const pixelWidth = Math.max(0, maxSx - minSx);
        const pixelHeight = Math.max(0, maxSy - minSy);
        const pixelArea = pixelWidth * pixelHeight;
        const maxSpan = Math.max(pixelWidth, pixelHeight);
        return {
            pixelWidth,
            pixelHeight,
            pixelArea,
            inFrustum: anyInFront && (pixelArea >= 120 || maxSpan >= 14),
        };
    }

    function fixtureMeshVisibleOnScreen(group) {
        if (!group) return false;
        let meshCount = 0;
        group.traverse((obj) => {
            if (obj.isMesh && obj.visible) meshCount += 1;
        });
        const screen = projectWorldBoxToScreen(group);
        return meshCount > 0 && Boolean(screen?.inFrustum);
    }

    function floorMeshBoundsXZ() {
        const floor = floorMeshes.current[0];
        if (!floor) return null;
        const box = new THREE.Box3().setFromObject(floor);
        return {
            minX: box.min.x,
            maxX: box.max.x,
            minZ: box.min.z,
            maxZ: box.max.z,
        };
    }

    function openingSubMeshInWallBand(wall, op, group) {
        const centers = meshWorldCentersXZ(group);
        return centers.every((p) => {
            if (pointInWallBand(p.x, p.z, wall)) return true;
            return openingAssociatesWithWall(wall, { ...op, centerX: p.x, centerZ: p.z });
        });
    }

    function computeRoomAcceptanceSnapshot() {
        if (!lastDesc) return null;
        const floorRing = lastDesc.walkBounds?.rings?.[0];
        const innerBounds = floorRing ? axisAlignedBoundsXZ(floorRing) : null;
        const meshBounds = floorMeshBoundsXZ();
        const openings = lastDesc.fixtures.filter((f) => f.kind === 'door' || f.kind === 'window');
        const cabinets = lastDesc.fixtures.filter((f) => f.kind === 'cabinet');
        const sprite = labelGroup.current?.children?.find((c) => c.userData?.lp3dCabinetLabel);
        const cabGroup = fixtureGroups.current.get('cab-demo-1')
            ?? fixtureGroups.current.get(cabinets[0]?.id);
        const floorMesh = floorMeshes.current[0];
        const walkRing = floorRing;
        const walkPose = walkRing ? computeWalkRoomPreviewPose(walkRing) : null;
        const camX = camera?.position.x;
        const camZ = camera?.position.z;
        const camY = camera?.position.y;
        let walkStandoffSouth = null;
        if (walkRing && camX != null && camZ != null) {
            const b = axisAlignedBoundsXZ(walkRing);
            walkStandoffSouth = b.maxZ - camZ;
        }
        return {
            ceilingVisible: Boolean(ceilingGroup.current?.visible),
            wallsHiddenTopDown: Boolean(
                viewMode === 'orbit'
                && isOrbitTopDownView()
                && wallMeshes.current.every((m) => !m.visible),
            ),
            floorBoundsMatchInner: Boolean(
                innerBounds && meshBounds && boundsXZMatch(innerBounds, meshBounds, 2),
            ),
            cabinetMeshVisible: fixtureMeshVisibleOnScreen(cabGroup),
            cabinetMeshScreen: cabGroup ? projectWorldBoxToScreen(cabGroup) : null,
            floorMeshScreen: floorMesh ? projectWorldBoxToScreen(floorMesh) : null,
            walkCamera: camX != null ? {
                x: camX,
                y: camY,
                z: camZ,
                standoffSouthCm: walkStandoffSouth,
                eyeHeightCm: LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM,
            } : null,
            walkPoseTarget: walkPose,
            innerBounds,
            floorMeshBounds: meshBounds,
            openingWallHits: openings.map((op) => {
                const associated = lastDesc.walls.find((w) => openingAssociatesWithWall(w, op));
                const cuts = lastDesc.walls.some((w) => openingCutsWall(w, op));
                const group = fixtureGroups.current.get(op.id);
                const subMeshesInWall = Boolean(
                    associated && group && openingSubMeshInWallBand(associated, op, group),
                );
                return {
                    id: op.id,
                    kind: op.kind,
                    intersectsWall: Boolean(associated),
                    csgCut: cuts,
                    subMeshesInWall,
                };
            }),
            cabinetsInsideFloor: cabinets.map((cab) => {
                const pts = fixtureFootprintSamplePointsXZ(cab);
                const inside = Boolean(
                    floorRing?.length >= 3
                    && pts.every((p) => pointInPolygonXZ(p.x, p.z, floorRing)),
                );
                return { id: cab.id, inside };
            }),
            labelCount: labelGroup.current?.children?.length ?? 0,
            labelScreen: (() => {
                if (!sprite || !camera || !renderer) {
                    return { visible: false, textReadable: false };
                }
                const d = Math.max(camera.position.distanceTo(sprite.position), 40);
                const viewH = Math.max(renderer.domElement.clientHeight, 1);
                const vFov = (camera.fov * Math.PI) / 180;
                const worldH = sprite.scale.y;
                const pixelHeight = (worldH * viewH) / (2 * Math.tan(vFov / 2) * d);
                const img = sprite.material?.map?.image;
                const aspect = img?.width && img?.height ? img.width / img.height : 2.6;
                const pixelWidth = pixelHeight * aspect;
                return {
                    visible: true,
                    pixelWidth,
                    pixelHeight,
                    textReadable: pixelWidth >= 72 && pixelHeight >= 20,
                };
            })(),
        };
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
            getRoomAcceptanceSnapshot: () => computeRoomAcceptanceSnapshot(),
            resetWalkRoomPreview: () => {
                if (!walk || !lastDesc) return;
                viewMode = 'walk';
                applyViewMode();
                const ring = lastDesc.walkBounds?.rings?.[0];
                const pose = ring ? computeWalkRoomPreviewPose(ring) : null;
                if (pose) {
                    walk.setPosition(pose.x, pose.z);
                    walk.lookAt(pose.lookX, pose.lookZ);
                    if (pose.pitch != null) walk.setPitch(pose.pitch);
                }
                updateLabelScreenSizes();
            },
        };
        mountEl.__lp3dGetDiagnostics = () => viewer.getDiagnostics();
        mountEl.__lp3dRebuild = () => viewer.rebuild();
    }

    const viewer = {
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
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        dispose() {
            viewer.close();
            resizeObserver?.disconnect();
            resizeObserver = null;
            walk?.dispose();
            walk = null;
            if (renderer) {
                renderer.dispose();
                renderer.domElement?.remove();
                renderer = null;
            }
            controls = null;
            scene = null;
            camera = null;
        },
        getDiagnostics() {
            return {
                isOpen,
                animationFrameScheduled: animationId !== null,
                rebuildCount,
                walkCreateCount,
                rendererChildCount: mountEl.childElementCount,
                sceneChildCount: scene?.children?.length ?? 0,
            };
        },
        rebuild,
        setViewMode(mode) {
            viewMode = mode === 'walk' ? 'walk' : 'orbit';
            applyViewMode();
        },
    };
    return viewer;
}
