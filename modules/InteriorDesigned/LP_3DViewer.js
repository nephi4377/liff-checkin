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
    boundsXZDelta,
    computeWalkRoomPreviewPose,
    expandFloorRingToInnerFace,
} from './LP_3D_scene.js';
import {
    buildFixtureMeshGroup,
    attachDoorWindowPlanMarker,
    createLabelSprite,
    LP_3D_CATEGORY_COLORS,
} from './LP_3D_furniture.js';
import {
    LP_3D_PIXEL_SAMPLE_RGB,
    colorDistanceRgb,
    isBgLikeRgb,
    isWallLikeRgb,
} from './LP_3D_pixel_rgb.js';
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
    resolveOpeningCutterCenterOnWall,
    partitionSegmentToObb,
    partitionRotationY,
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
        const cutCenter = resolveOpeningCutterCenterOnWall(wall, op);
        const cutBrush = new Brush(cutGeo);
        cutBrush.position.set(cutCenter.centerX, op.baseYCm + op.heightCm / 2, cutCenter.centerZ);
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

function buildWallTopCapMesh(wall, material, capThicknessCm) {
    const shape = makeShapeFromRing(wall.outer, wall.inner);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: capThicknessCm, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = wall.heightCm - capThicknessCm;
    mesh.userData.lp3dWallTopCap = true;
    return mesh;
}

/** 俯視隔間牆（薄板，與外牆 plan ring 同層） */
function buildPartitionPlanMesh(obb, material) {
    const len = obb.halfW * 2;
    const thick = obb.halfD * 2;
    const geo = new THREE.BoxGeometry(len, 0.4, thick);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(obb.cx, 0.2, obb.cz);
    mesh.rotation.y = partitionRotationY(obb);
    mesh.userData.lp3dPartitionPlan = true;
    return mesh;
}

/** 俯視平面牆環（與地板同高，避免透視下牆頂 cap 與地板視差空隙） */
function buildWallPlanRingMesh(wall, material) {
    const shape = makeShapeFromRing(wall.outer, wall.inner);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = 0.13;
    mesh.renderOrder = 5;
    mesh.visible = false;
    mesh.userData.lp3dWallPlanRing = true;
    return mesh;
}

/** 俯視填滿牆內圈（ShapeGeometry 避免 Extrude 內縮） */
function buildFloorTopCoverMesh(ring, material) {
    const shape = makeShapeFromSingleRing(ring);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = 0.1;
    mesh.renderOrder = 12;
    mesh.userData.lp3dFloorTop = true;
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
    let topDownPresentationSeq = 0;
    let topDownPresentationAppliedSeq = 0;

    const contentGroup = { current: null };
    const ceilingGroup = { current: null };
    const labelGroup = { current: null };
    const wallMeshes = { current: [] };
    const wallCapMeshes = { current: [] };
    const wallPlanRingMeshes = { current: [] };
    let wallCapMatStandard = null;
    let wallCapMatTopDown = null;
    const floorMeshes = { current: [] };
    const fixtureGroups = { current: new Map() };
    const ORBIT_OBLIQUE_WALL_OPACITY = 0.35;
    const WALL_TOP_CAP_THICKNESS_CM = 4;
    const FLOOR_SAMPLE_RGB = LP_3D_PIXEL_SAMPLE_RGB.floor;
    const SCENE_BG_SAMPLE_RGB = LP_3D_PIXEL_SAMPLE_RGB.sceneBg;
    const WALL_SAMPLE_RGB = LP_3D_PIXEL_SAMPLE_RGB.wall;
    const WALL_CAP_SAMPLE_RGB = LP_3D_PIXEL_SAMPLE_RGB.wallCap;
    const CABINET_SAMPLE_RGB = { r: 180, g: 83, b: 9 };
    const LABEL_BG_SAMPLE_RGB = { r: 15, g: 23, b: 42 };

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

    let lastViewerHint = '';

    function setHint(text) {
        lastViewerHint = text;
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
            applyOrbitWallPresentation();
        } else {
            controls.enabled = false;
            walk?.setActive(true);
            camera.up.set(0, 1, 0);
            camera.rotation.z = 0;
            restoreSolidWallsForWalk();
            setHint('室內：WASD 移動 · 按住左鍵轉向 · 手機左半拖移動、右半轉向');
        }
        updateToolbarActive();
    }

    function restoreSolidWallsForWalk() {
        for (const mesh of wallMeshes.current) {
            mesh.visible = true;
            mesh.scale.y = 1;
            const mat = mesh.material;
            if (!mat) continue;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
        }
        for (const cap of wallCapMeshes.current) {
            cap.visible = false;
        }
        for (const ring of wallPlanRingMeshes.current) {
            ring.visible = false;
        }
        lastOrbitWallCut = null;
        applyDoorWindowPlanLayoutForView();
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
            walk.resetLevelOrientation();
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

        const lpPreview = typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('lpPreview') === '1';
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                preserveDrawingBuffer: lpPreview,
            });
        } catch (err) {
            setHint('此裝置無法建立 WebGL 3D 預覽，請更新瀏覽器或顯示驅動後再試');
            throw err;
        }
        const gl = typeof renderer.getContext === 'function' ? renderer.getContext() : null;
        if (!gl) {
            renderer.dispose();
            renderer = null;
            setHint('此裝置無法建立 WebGL 3D 預覽，請更新瀏覽器或顯示驅動後再試');
            throw new Error('WebGL context unavailable');
        }
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
        const floorTopMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e8 });
        const floorRings = desc.floors.length
            ? desc.floors.map((f) => f.ring)
            : (desc.walls[0] ? [desc.walls[0].inner] : []);
        floorMeshes.current = [];
        for (const ring of floorRings) {
            if (ring?.length >= 3) {
                const slab = buildSlabMesh(ring, 0, defaults.FLOOR_THICKNESS_CM, floorMat);
                slab.userData.lp3dFloor = true;
                const coverRing = expandFloorRingToInnerFace(ring, 1.2);
                const topCover = buildFloorTopCoverMesh(coverRing, floorTopMat);
                topCover.userData.lp3dFloorRing = ring;
                const floorGroup = new THREE.Group();
                floorGroup.userData.lp3dFloorAssembly = true;
                floorGroup.userData.lp3dFloorRing = ring;
                floorGroup.add(slab);
                floorGroup.add(topCover);
                floorMeshes.current.push(floorGroup);
                root.add(floorGroup);
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
        wallCapMeshes.current = [];
        wallPlanRingMeshes.current = [];
        topDownPresentationSeq += 1;
        wallCapMatStandard = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.92,
            metalness: 0.02,
        });
        wallCapMatTopDown = new THREE.MeshBasicMaterial({ color: 0x334155 });
        for (const wall of desc.walls) {
            const brush = buildWallBrush(wall, wallMat, openings, defaults);
            brush.userData.lp3dWall = true;
            wallMeshes.current.push(brush);
            root.add(brush);
            const cap = buildWallTopCapMesh(wall, wallCapMatStandard, WALL_TOP_CAP_THICKNESS_CM);
            cap.visible = false;
            cap.renderOrder = 1;
            wallCapMeshes.current.push(cap);
            root.add(cap);
            const planRing = buildWallPlanRingMesh(wall, wallCapMatTopDown);
            wallPlanRingMeshes.current.push(planRing);
            root.add(planRing);
        }

        const partitionHeight = defaults.WALL_HEIGHT_CM;
        for (const pw of desc.partitionWalls || []) {
            const obb = partitionSegmentToObb(pw.ax, pw.az, pw.bx, pw.bz, pw.thicknessCm);
            const segLen = obb.halfW * 2;
            const thick = obb.halfD * 2;
            const geo = new THREE.BoxGeometry(segLen, partitionHeight, thick);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(obb.cx, partitionHeight / 2, obb.cz);
            mesh.rotation.y = partitionRotationY(obb);
            mesh.userData.lp3dPartitionWall = true;
            wallMeshes.current.push(mesh);
            root.add(mesh);
            const planMat = wallCapMatTopDown || wallCapMatStandard || wallMat;
            const planMesh = buildPartitionPlanMesh(obb, planMat);
            wallPlanRingMeshes.current.push(planMesh);
            root.add(planMesh);
        }

        fixtureGroups.current = new Map();
        const cabinetCount = desc.fixtures.filter((f) => f.kind === 'cabinet').length;
        const showCabinetLabels = cabinetCount <= 12;
        for (const fix of desc.fixtures) {
            const group = buildFixtureMeshGroup(THREE, fix);
            const liftY = fix.kind === 'cabinet' ? 0.35 : 0;
            group.position.set(fix.centerX, liftY, fix.centerZ);
            group.rotation.y = (-fix.rotationDeg * Math.PI) / 180;
            if (fix.mirrored) group.scale.x = -1;
            group.userData.lp3dFixtureId = fix.id;
            group.userData.lp3dFixtureKind = fix.kind;
            fixtureGroups.current.set(fix.id, group);
            if (fix.kind === 'door' || fix.kind === 'window') {
                attachDoorWindowPlanMarker(THREE, group, fix);
            }
            root.add(group);

            if (showCabinetLabels && fix.label && fix.kind === 'cabinet') {
                const accent = LP_3D_CATEGORY_COLORS[fix.displayCategory]
                    ?? LP_3D_CATEGORY_COLORS.cabinet;
                const sprite = createLabelSprite(THREE, fix.label, accent);
                const topY = fix.baseYCm + fix.heightCm + 18 + liftY;
                sprite.userData.lp3dLabelAnchor = {
                    baseX: fix.centerX,
                    baseZ: fix.centerZ,
                    y: topY,
                    dx: fix.widthCm * 0.52,
                    dz: -fix.depthCm * 0.42,
                };
                sprite.position.set(fix.centerX, topY, fix.centerZ);
                labels.add(sprite);
            }
        }

        scene.add(root);
        scene.add(labels);
        contentGroup.current = root;
        labelGroup.current = labels;

        if (viewMode === 'orbit') {
            resetOrbitCamera(desc);
            applyOrbitWallPresentation();
        } else {
            resetWalkCamera(desc);
            restoreSolidWallsForWalk();
        }
        topDownPresentationAppliedSeq = topDownPresentationSeq;
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
        const topDown = isOrbitTopDownView();
        const modeKey = topDown ? 'top' : 'oblique';
        if (modeKey === lastOrbitWallCut) {
            topDownPresentationAppliedSeq = topDownPresentationSeq;
            return;
        }
        lastOrbitWallCut = modeKey;
        for (const mesh of wallMeshes.current) {
            mesh.visible = !topDown;
            mesh.scale.y = 1;
            const mat = mesh.material;
            if (!mat) continue;
            if (topDown) {
                mat.transparent = false;
                mat.opacity = 1;
                mat.depthWrite = true;
            } else {
                mat.transparent = true;
                mat.opacity = ORBIT_OBLIQUE_WALL_OPACITY;
                mat.depthWrite = false;
            }
            mat.needsUpdate = true;
        }
        for (const cap of wallCapMeshes.current) {
            cap.visible = false;
            if (wallCapMatStandard) {
                cap.material = wallCapMatStandard;
            }
        }
        for (const ring of wallPlanRingMeshes.current) {
            ring.visible = topDown;
            if (topDown && wallCapMatTopDown) {
                ring.material = wallCapMatTopDown;
            }
        }
        applyCabinetLabelLayoutForView();
        applyDoorWindowPlanLayoutForView();
        topDownPresentationAppliedSeq = topDownPresentationSeq;
    }

    function applyDoorWindowPlanLayoutForView() {
        const topDown = viewMode === 'orbit' && isOrbitTopDownView();
        for (const [, group] of fixtureGroups.current) {
            const kind = group.userData?.lp3dFixtureKind;
            if (kind !== 'door' && kind !== 'window') continue;
            group.traverse((obj) => {
                if (obj.userData?.lp3dPlanMarker) {
                    obj.visible = topDown;
                    return;
                }
                if (obj.isMesh || obj.isLineSegments) {
                    obj.visible = !topDown;
                }
            });
        }
    }

    function applyCabinetLabelLayoutForView() {
        if (!labelGroup.current?.children?.length) return;
        const topDown = viewMode === 'orbit' && isOrbitTopDownView();
        labelGroup.current.children.forEach((sprite) => {
            if (!sprite.userData?.lp3dCabinetLabel) return;
            const a = sprite.userData.lp3dLabelAnchor;
            if (!a) return;
            if (topDown) {
                sprite.visible = false;
            } else {
                sprite.visible = true;
                sprite.position.set(a.baseX, a.y, a.baseZ);
                if (sprite.material) sprite.material.depthTest = false;
            }
        });
    }

    function updateLabelScreenSizes() {
        if (!camera || !renderer || !labelGroup.current?.children?.length) return;
        applyCabinetLabelLayoutForView();
        const topDown = viewMode === 'orbit' && isOrbitTopDownView();
        const pxH = topDown ? 28 : 38;
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
        if (viewMode === 'walk') {
            walk.update(delta);
            camera.up.set(0, 1, 0);
            camera.rotation.z = 0;
        } else {
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
        if (renderer && scene && camera) renderer.render(scene, camera);
        floor.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(floor);
        const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        if (span > 50) {
            return {
                minX: box.min.x,
                maxX: box.max.x,
                minZ: box.min.z,
                maxZ: box.max.z,
            };
        }
        const ring = floor.userData?.lp3dFloorRing ?? lastDesc?.walls?.[0]?.inner;
        return ring?.length >= 3 ? axisAlignedBoundsXZ(ring) : null;
    }

    function wallCapInnerBoundsXZFromMesh(capMesh, wall) {
        const inner = wall?.inner;
        if (!capMesh || !inner?.length) return null;
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        capMesh.updateWorldMatrix(true, true);
        const pos = capMesh.geometry?.attributes?.position;
        if (!pos) return axisAlignedBoundsXZ(inner);
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            v.applyMatrix4(capMesh.matrixWorld);
            if (pointInPolygonXZ(v.x, v.z, inner)) {
                box.expandByPoint(v);
            }
        }
        if (box.isEmpty()) return axisAlignedBoundsXZ(inner);
        const spanX = box.max.x - box.min.x;
        const spanZ = box.max.z - box.min.z;
        if (spanX < 2 || spanZ < 2) return axisAlignedBoundsXZ(inner);
        return {
            minX: box.min.x,
            maxX: box.max.x,
            minZ: box.min.z,
            maxZ: box.max.z,
        };
    }

    function wallAssemblyInnerBoundsXZ() {
        const wall = lastDesc?.walls?.[0];
        if (!wall?.inner?.length) return null;
        return axisAlignedBoundsXZ(wall.inner);
    }

    function floorMeshBoxBoundsXZ() {
        const floor = floorMeshes.current[0];
        if (!floor) return null;
        let slab = null;
        floor.traverse((obj) => {
            if (obj.isMesh && obj.userData?.lp3dFloor && !obj.userData?.lp3dFloorTop) {
                slab = obj;
            }
        });
        const target = slab ?? floor;
        target.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(target);
        if (box.isEmpty()) return null;
        return {
            minX: box.min.x,
            maxX: box.max.x,
            minZ: box.min.z,
            maxZ: box.max.z,
        };
    }

    function wallAssemblyInnerBoundsXZForFloor() {
        const wall = lastDesc?.walls?.[0];
        if (!wall?.inner?.length) return null;
        const poly = axisAlignedBoundsXZ(wall.inner);
        const topDown = viewMode === 'orbit' && isOrbitTopDownView();
        if (topDown) {
            const planRing = wallPlanRingMeshes.current[0];
            const planInner = planRing
                ? (wallCapInnerBoundsXZFromMesh(planRing, wall) ?? poly)
                : poly;
            return { poly, capInner: planInner, meshInner: planInner };
        }
        const brush = wallMeshes.current[0];
        if (!brush) return { poly, capInner: poly, meshInner: poly };
        brush.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(brush);
        const meshInner = {
            minX: Math.max(box.min.x, poly.minX),
            maxX: Math.min(box.max.x, poly.maxX),
            minZ: Math.max(box.min.z, poly.minZ),
            maxZ: Math.min(box.max.z, poly.maxZ),
        };
        return { poly, capInner: poly, meshInner };
    }

    function floorToWallAssemblyDelta(meshBounds) {
        const wall = lastDesc?.walls?.[0];
        const ring = floorMeshes.current[0]?.userData?.lp3dFloorRing;
        const floorBounds = (ring?.length >= 3 ? axisAlignedBoundsXZ(ring) : null)
            ?? floorMeshBoxBoundsXZ()
            ?? meshBounds;
        const floorSlabBounds = floorMeshBoxBoundsXZ();
        if (!wall?.inner?.length || !floorBounds) return null;
        const asm = wallAssemblyInnerBoundsXZForFloor();
        if (!asm) return null;
        const dPoly = boundsXZDelta(asm.poly, floorBounds);
        const dCap = boundsXZDelta(asm.capInner, floorBounds);
        const dMesh = boundsXZDelta(asm.meshInner, floorBounds);
        return {
            ...dPoly,
            maxEdge: Math.max(dPoly.maxEdge, dCap.maxEdge, dMesh.maxEdge),
            capInnerBounds: asm.capInner,
            wallInnerBounds: asm.poly,
            wallMeshInnerBounds: asm.meshInner,
            floorMeshBounds: floorSlabBounds ?? floorBounds,
            floorRingBounds: floorBounds,
        };
    }

    function isFloorLikeRgb(rgb) {
        return colorDistanceRgb(rgb, FLOOR_SAMPLE_RGB) < 38;
    }

    function isCabinetLikeRgb(rgb) {
        return colorDistanceRgb(rgb, CABINET_SAMPLE_RGB) < 55
            && colorDistanceRgb(rgb, LABEL_BG_SAMPLE_RGB) > 35
            && colorDistanceRgb(rgb, FLOOR_SAMPLE_RGB) > 32;
    }

    function isDoorWindowPlanMarkerRgb(rgb) {
        const door = { r: 120, g: 53, b: 15 };
        const win = { r: 56, g: 189, b: 248 };
        return colorDistanceRgb(rgb, door) < 58 || colorDistanceRgb(rgb, win) < 58;
    }

    function scanTopDownFloorToWallTransition(screenX, screenY, dirX, dirY, maxSteps = 420) {
        let sawFloor = false;
        let lastFloorStep = 0;
        for (let step = 0; step < maxSteps; step++) {
            const sx = screenX + dirX * step;
            const sy = screenY + dirY * step;
            const rgb = sampleRendererPixel(sx, sy);
            if (!rgb || rgb.a === 0) continue;
            if (isFloorLikeRgb(rgb)) {
                sawFloor = true;
                lastFloorStep = step;
                continue;
            }
            if (!sawFloor) continue;
            if (isDoorWindowPlanMarkerRgb(rgb)) {
                continue;
            }
            if (step - lastFloorStep > 2) {
                return { ok: false, reason: 'gap_before_wall', step, rgb };
            }
            if (isBgLikeRgb(rgb)) {
                return { ok: false, reason: 'background_gap', step, rgb };
            }
            if (isWallLikeRgb(rgb)) {
                return { ok: true, step, rgb };
            }
            return { ok: false, reason: 'unknown_color', step, rgb };
        }
        return { ok: false, reason: 'no_wall_found' };
    }

    function projectWorldXZToScreen(x, z, yCm = 0.12) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const p = new THREE.Vector3(x, yCm, z).project(camera);
        return {
            sx: (p.x * 0.5 + 0.5) * w,
            sy: (-p.y * 0.5 + 0.5) * h,
        };
    }

    function screenUnitVectorForWorldDelta(worldDx, worldDz) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const a = new THREE.Vector3(0, 0.12, 0).project(camera);
        const b = new THREE.Vector3(worldDx, 0.12, worldDz).project(camera);
        const sx0 = (a.x * 0.5 + 0.5) * w;
        const sy0 = (-a.y * 0.5 + 0.5) * h;
        const sx1 = (b.x * 0.5 + 0.5) * w;
        const sy1 = (-b.y * 0.5 + 0.5) * h;
        const dx = sx1 - sx0;
        const dy = sy1 - sy0;
        const len = Math.hypot(dx, dy) || 1;
        return { dirX: dx / len, dirY: dy / len };
    }

    function scanFloorEdgeTowardWall(wx, wz, worldDirX, worldDirZ) {
        const start = projectWorldXZToScreen(wx, wz);
        const { dirX, dirY } = screenUnitVectorForWorldDelta(worldDirX, worldDirZ);
        return scanTopDownFloorToWallTransition(start.sx, start.sy, dirX, dirY);
    }

    function verifyTopDownFloorMeetsWallPixels() {
        if (!isOrbitTopDownView() || !floorMeshes.current[0] || !renderer) return null;
        const ring = floorMeshes.current[0].userData?.lp3dFloorRing
            ?? lastDesc?.walls?.[0]?.inner;
        const bounds = ring?.length >= 3
            ? axisAlignedBoundsXZ(ring)
            : floorMeshBoxBoundsXZ();
        if (!bounds) return null;
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cz = (bounds.minZ + bounds.maxZ) / 2;
        const spanX = bounds.maxX - bounds.minX;
        const spanZ = bounds.maxZ - bounds.minZ;
        const insetX = Math.min(40, spanX * 0.07);
        const insetZ = Math.min(40, spanZ * 0.07);
        // 北缘射线：西侧 8% 避开北门上的门窗平面标记
        const northX = bounds.minX + spanX * 0.08;
        // 南缘射线：东侧 82% 避开西侧矮柜 footprint（非笔误）
        const southX = bounds.minX + spanX * 0.82;
        renderer.render(scene, camera);
        const center = projectWorldXZToScreen(cx, cz);
        return {
            center,
            left: scanFloorEdgeTowardWall(bounds.minX + insetX, cz, -1, 0),
            right: scanFloorEdgeTowardWall(bounds.maxX - insetX, cz, 1, 0),
            up: scanFloorEdgeTowardWall(northX, bounds.minZ + insetZ, 0, -1),
            down: scanFloorEdgeTowardWall(southX, bounds.maxZ - insetZ, 0, 1),
        };
    }

    function sampleCabinetBodyTopDownPixel(cabGroup) {
        if (!cabGroup || !camera || !renderer) return null;
        let topMesh = null;
        let body = null;
        cabGroup.traverse((obj) => {
            if (!obj.isMesh) return;
            if (obj.userData?.lp3dCabinetTop) topMesh = obj;
            if (obj.userData?.lp3dCabinetBody) body = obj;
        });
        const target = topMesh ?? body ?? cabGroup;
        target.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(target);
        if (box.isEmpty()) return null;
        const center = new THREE.Vector3(
            (box.min.x + box.max.x) / 2,
            topMesh ? box.max.y - 0.5 : box.max.y - 1,
            (box.min.z + box.max.z) / 2,
        );
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(center.x, box.max.y + 80, center.z),
            new THREE.Vector3(0, -1, 0),
        );
        const hits = raycaster.intersectObject(cabGroup, true);
        const hitMesh = hits.find((h) => h.object?.userData?.lp3dCabinetTop
            || h.object?.userData?.lp3dCabinetBody);
        if (hitMesh) {
            center.copy(hitMesh.point);
            center.y += 0.2;
        }
        const p = center.clone().project(camera);
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const sx = (p.x * 0.5 + 0.5) * w;
        const sy = (-p.y * 0.5 + 0.5) * h;
        const rgb = sampleRendererPixel(sx, sy);
        if (!rgb) return null;
        return {
            screenX: sx,
            screenY: sy,
            rgb,
            isCabinetColor: isCabinetLikeRgb(rgb),
        };
    }

    function countDoorLeafMeshes() {
        let count = 0;
        for (const [, group] of fixtureGroups.current) {
            if (group.userData?.lp3dFixtureKind !== 'door') continue;
            group.traverse((obj) => {
                if (obj.isMesh && obj.userData?.lp3dDoorLeaf) count += 1;
            });
        }
        return count;
    }

    function openingWorldMaxY(op) {
        const group = fixtureGroups.current.get(op.id);
        if (!group) return null;
        const box = new THREE.Box3().setFromObject(group);
        return box.isEmpty() ? null : box.max.y;
    }

    function sampleRendererPixel(screenX, screenY, skipRender = false) {
        if (!renderer || !camera) return null;
        if (!skipRender) renderer.render(scene, camera);
        const canvas = renderer.domElement;
        const gl = renderer.getContext();
        const dpr = renderer.getPixelRatio();
        const x = Math.floor(screenX * dpr);
        const y = Math.floor((canvas.clientHeight - screenY) * dpr);
        const pixels = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    }

    function classifyTopDownScreenshotPixel(rgb) {
        if (!rgb || rgb.a === 0) return 'none';
        if (isBgLikeRgb(rgb)) return 'bg';
        if (isFloorLikeRgb(rgb)) return 'floor';
        if (isWallLikeRgb(rgb)) return 'wall';
        return 'other';
    }

    function readScreenshotLineLabels(axis, fixedCoord) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const labels = [];
        if (axis === 'row') {
            const sy = fixedCoord;
            for (let sx = 0; sx < w; sx++) {
                labels.push(classifyTopDownScreenshotPixel(sampleRendererPixel(sx, sy, true)));
            }
        } else {
            const sx = fixedCoord;
            for (let sy = 0; sy < h; sy++) {
                labels.push(classifyTopDownScreenshotPixel(sampleRendererPixel(sx, sy, true)));
            }
        }
        return labels;
    }

    function maxBgPixelsBetweenWallAndFloor(labels) {
        let worst = 0;
        const scan = (seq) => {
            for (let i = 0; i < seq.length - 2; i++) {
                if (seq[i] !== 'wall') continue;
                let j = i + 1;
                let bgRun = 0;
                while (j < seq.length && seq[j] === 'bg') {
                    bgRun += 1;
                    j += 1;
                }
                if (bgRun === 0) continue;
                let k = j;
                while (k < seq.length && seq[k] === 'other') k += 1;
                if (k < seq.length && seq[k] === 'floor') {
                    worst = Math.max(worst, bgRun);
                }
            }
        };
        scan(labels);
        scan([...labels].reverse());
        return worst;
    }

    function verifyTopDownScreenshotWallFloorNoGap(options = {}) {
        if (!isOrbitTopDownView() || !renderer) return null;
        renderer.render(scene, camera);
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const maxGapPx = options.maxGapPx ?? 2;
        const rows = new Set();
        const cols = new Set();
        if (options.scanY != null) rows.add(Math.round(options.scanY));
        const ring = floorMeshes.current[0]?.userData?.lp3dFloorRing
            ?? lastDesc?.walls?.[0]?.inner;
        if (ring?.length >= 3) {
            const b = axisAlignedBoundsXZ(ring);
            const cx = (b.minX + b.maxX) / 2;
            const cz = (b.minZ + b.maxZ) / 2;
            const center = projectWorldXZToScreen(cx, cz);
            const floorScreen = floorMeshes.current[0]
                ? projectWorldBoxToScreen(floorMeshes.current[0])
                : null;
            const midY = Math.round(center.sy);
            const midX = Math.round(center.sx);
            rows.add(midY);
            cols.add(midX);
            if (floorScreen?.pixelHeight) {
                rows.add(Math.round(midY - floorScreen.pixelHeight * 0.12));
                rows.add(Math.round(midY + floorScreen.pixelHeight * 0.12));
            }
            if (floorScreen?.pixelWidth) {
                cols.add(Math.round(midX - floorScreen.pixelWidth * 0.12));
                cols.add(Math.round(midX + floorScreen.pixelWidth * 0.12));
            }
        }
        if (!rows.size) rows.add(Math.round(h * 0.546));
        if (!cols.size) cols.add(Math.round(w * 0.5));
        const results = { rows: {}, cols: {}, ok: true, maxGapPx };
        for (const y of rows) {
            if (y < 0 || y >= h) continue;
            const labels = readScreenshotLineLabels('row', y);
            const gap = maxBgPixelsBetweenWallAndFloor(labels);
            results.rows[y] = { gap, ok: gap <= maxGapPx };
            if (gap > maxGapPx) results.ok = false;
        }
        for (const x of cols) {
            if (x < 0 || x >= w) continue;
            const labels = readScreenshotLineLabels('col', x);
            const gap = maxBgPixelsBetweenWallAndFloor(labels);
            results.cols[x] = { gap, ok: gap <= maxGapPx };
            if (gap > maxGapPx) results.ok = false;
        }
        return results;
    }

    function sampleCabinetFootprintPixel(cabGroup) {
        if (!cabGroup || !camera || !renderer) return null;
        const box = new THREE.Box3().setFromObject(cabGroup);
        if (box.isEmpty()) return null;
        const center = new THREE.Vector3(
            (box.min.x + box.max.x) / 2,
            box.max.y - 2,
            (box.min.z + box.max.z) / 2,
        );
        const p = center.clone().project(camera);
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const sx = (p.x * 0.5 + 0.5) * w;
        const sy = (-p.y * 0.5 + 0.5) * h;
        const rgb = sampleRendererPixel(sx, sy);
        if (!rgb) return null;
        const floorDist = colorDistanceRgb(rgb, FLOOR_SAMPLE_RGB);
        return {
            screenX: sx,
            screenY: sy,
            rgb,
            differsFromFloor: floorDist >= 28,
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
        const wallInnerBounds = wallAssemblyInnerBoundsXZ();
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
            wallCapsVisibleTopDown: Boolean(
                viewMode === 'orbit'
                && isOrbitTopDownView()
                && wallPlanRingMeshes.current.length > 0
                && wallPlanRingMeshes.current.every((m) => m.visible),
            ),
            wallsHiddenTopDown: Boolean(
                viewMode === 'orbit'
                && isOrbitTopDownView()
                && wallMeshes.current.every((m) => !m.visible),
            ),
            doorLeafMeshCount: countDoorLeafMeshes(),
            walkCameraRollRad: viewMode === 'walk' ? (walk?.getRollRadians?.() ?? null) : null,
            walkCameraUp: viewMode === 'walk' ? (walk?.getCameraUp?.() ?? null) : null,
            obliqueOpeningTops: (() => {
                const wallH = lastDesc.walls?.[0]?.heightCm ?? LP_3D_DEFAULTS.WALL_HEIGHT_CM;
                const oblique = viewMode === 'orbit' && !isOrbitTopDownView();
                if (!oblique) return null;
                return openings.map((op) => {
                    const maxY = openingWorldMaxY(op);
                    return {
                        id: op.id,
                        kind: op.kind,
                        maxY,
                        wallTop: wallH,
                        withinWallTop: maxY != null && maxY <= wallH + 1.5,
                    };
                });
            })(),
            cabinetTopDownPixel: (viewMode === 'orbit' && isOrbitTopDownView() && cabGroup)
                ? sampleCabinetFootprintPixel(cabGroup)
                : null,
            floorBoundsMatchInner: Boolean(
                meshBounds && (floorToWallAssemblyDelta(meshBounds)?.maxEdge ?? 99) <= 2,
            ),
            floorWallInnerDelta: floorToWallAssemblyDelta(meshBounds),
            floorInnerBoundsDelta: floorToWallAssemblyDelta(meshBounds),
            topDownFloorWallPixels: (viewMode === 'orbit' && isOrbitTopDownView())
                ? verifyTopDownFloorMeetsWallPixels()
                : null,
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
            wallInnerBounds,
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
                    textReadable: pixelWidth >= 68 && pixelHeight >= 18,
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
            getLabelSpriteScaleX: () => labelGroup.current?.children?.map((s) => s.scale?.x ?? 0) ?? [],
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
                    walk.resetLevelOrientation();
                }
                updateLabelScreenSizes();
            },
            sampleCabinetTopDownPixel: () => {
                const cabinets = lastDesc?.fixtures?.filter((f) => f.kind === 'cabinet') ?? [];
                const cabGroup = fixtureGroups.current.get('cab-demo-1')
                    ?? fixtureGroups.current.get(cabinets[0]?.id);
                return sampleCabinetBodyTopDownPixel(cabGroup);
            },
            verifyTopDownFloorMeetsWallPixels: () => verifyTopDownFloorMeetsWallPixels(),
            verifyTopDownScreenshotWallFloorNoGap: (options) => verifyTopDownScreenshotWallFloorNoGap(options),
            isTopDownPresentationReady: () => (
                topDownPresentationSeq === topDownPresentationAppliedSeq
                && (viewMode !== 'orbit' || !isOrbitTopDownView()
                    || (wallPlanRingMeshes.current.length > 0
                        && wallPlanRingMeshes.current.every((m) => m.visible)))
            ),
            getWallPlanRingMeshCount: () => wallPlanRingMeshes.current.length,
            getWallPlanRingMeshesVisible: () => wallPlanRingMeshes.current.some((m) => m.visible),
            sampleWalkDoorFloorNoPlanRingBand: () => {
                if (viewMode !== 'walk' || !renderer || !camera) return null;
                const door = lastDesc?.fixtures?.find((f) => f.kind === 'door');
                if (!door) return null;
                renderer.render(scene, camera);
                const p = new THREE.Vector3(door.centerX, 0.12, door.centerZ).project(camera);
                const w = renderer.domElement.clientWidth;
                const h = renderer.domElement.clientHeight;
                const sx = (p.x * 0.5 + 0.5) * w;
                const sy = (-p.y * 0.5 + 0.5) * h;
                const rgb = sampleRendererPixel(sx, sy, true);
                if (!rgb) return null;
                const isPlanWall = colorDistanceRgb(rgb, WALL_CAP_SAMPLE_RGB) < 32
                    && colorDistanceRgb(rgb, FLOOR_SAMPLE_RGB) > 36;
                return {
                    screenX: sx,
                    screenY: sy,
                    rgb,
                    planRingsVisible: wallPlanRingMeshes.current.some((m) => m.visible),
                    isPlanWallColor: isPlanWall,
                    ok: !wallPlanRingMeshes.current.some((m) => m.visible) && !isPlanWall,
                };
            },
            sampleScreenPixel: (screenX, screenY) => sampleRendererPixel(screenX, screenY),
            sampleWalkCenterWallPixels: () => {
                if (viewMode !== 'walk' || !renderer) return null;
                const w = renderer.domElement.clientWidth;
                const h = renderer.domElement.clientHeight;
                const left = sampleRendererPixel(w * 0.22, h * 0.48);
                const right = sampleRendererPixel(w * 0.78, h * 0.48);
                if (!left || !right) return null;
                const isWallish = (rgb) => (
                    colorDistanceRgb(rgb, WALL_SAMPLE_RGB)
                    < colorDistanceRgb(rgb, SCENE_BG_SAMPLE_RGB) - 12
                );
                return { left, right, leftIsWall: isWallish(left), rightIsWall: isWallish(right) };
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
            controls?.dispose();
            controls = null;
            if (contentGroup.current) {
                disposeObject3D(contentGroup.current);
                contentGroup.current = null;
            }
            if (labelGroup.current) {
                disposeObject3D(labelGroup.current);
                labelGroup.current = null;
            }
            wallCapMatStandard?.dispose();
            wallCapMatTopDown?.dispose();
            wallCapMatStandard = null;
            wallCapMatTopDown = null;
            if (renderer) {
                renderer.dispose();
                renderer.domElement?.remove();
                renderer = null;
            }
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
        getUserHint() {
            return lastViewerHint;
        },
        setViewMode(mode) {
            viewMode = mode === 'walk' ? 'walk' : 'orbit';
            applyViewMode();
        },
    };
    return viewer;
}
