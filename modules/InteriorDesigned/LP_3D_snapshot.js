import { computeWalkRoomPreviewPose, ringCentroidXZ } from './LP_3D_scene.js';

/** @typedef {'top' | 'front_iso' | 'corner_iso' | 'iso_north' | 'iso_south' | 'iso_east' | 'iso_west'} OrbitCameraPresetId */

export const ORBIT_CAMERA_PRESETS = {
    TOP: 'top',
    /** @deprecated 與 ISO_NORTH 相同，保留測試／舊按鈕 */
    FRONT_ISO: 'front_iso',
    ISO_NORTH: 'iso_north',
    ISO_SOUTH: 'iso_south',
    ISO_EAST: 'iso_east',
    ISO_WEST: 'iso_west',
    CORNER_ISO: 'corner_iso',
};

const ORBIT_ISO_Y_FACTOR = 0.72;
const ORBIT_ISO_HORIZ_FACTOR = 1.05;
const ORBIT_CORNER_Y_FACTOR = 0.75;

export const PNG_EXPORT_MAX_SIDE_PX = 3072;
export const PNG_EXPORT_MAX_PIXELS = 8_000_000;

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [maxSide]
 * @returns {{ width: number, height: number }}
 */
export function scaleDimensionsToMaxSide(width, height, maxSide = PNG_EXPORT_MAX_SIDE_PX) {
    const longest = Math.max(width, height);
    if (longest <= maxSide) {
        return { width, height };
    }
    const scale = maxSide / longest;
    return {
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale)),
    };
}

/**
 * PNG 匯出：最長邊 ≤ 3072，總像素 ≤ 8MP。
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
export function scaleDimensionsForPngExport(width, height) {
    let { width: w, height: h } = scaleDimensionsToMaxSide(width, height, PNG_EXPORT_MAX_SIDE_PX);
    let pixels = w * h;
    if (pixels > PNG_EXPORT_MAX_PIXELS) {
        const scale = Math.sqrt(PNG_EXPORT_MAX_PIXELS / pixels);
        w = Math.max(1, Math.floor(w * scale));
        h = Math.max(1, Math.floor(h * scale));
    }
    return { width: w, height: h };
}

/**
 * @param {OrbitCameraPresetId} preset
 * @param {{ workspaceSize?: number, walls?: { heightCm?: number }[], walkBounds?: { rings?: { x: number, z: number }[][] } }} desc
 * @param {{ WALL_HEIGHT_CM: number }} defaults
 * @returns {{ position: { x: number, y: number, z: number }, target: { x: number, y: number, z: number } }}
 */
export function computeOrbitPresetCamera(preset, desc, defaults) {
    const ws = desc.workspaceSize || 2000;
    const span = ws * 0.55;
    const wallH = desc.walls?.[0]?.heightCm ?? defaults.WALL_HEIGHT_CM;
    const ring = desc.walkBounds?.rings?.[0];
    const c = ring?.length ? ringCentroidXZ(ring) : { x: 0, z: 0 };
    const targetY = wallH * 0.45;
    const target = { x: c.x, y: targetY, z: c.z };

    if (preset === ORBIT_CAMERA_PRESETS.TOP) {
        return {
            position: {
                x: c.x,
                y: Math.max(span * 1.35, wallH * 2.2),
                z: c.z,
            },
            target: { x: c.x, y: 0, z: c.z },
        };
    }
    const isoY = span * ORBIT_ISO_Y_FACTOR;
    const isoH = span * ORBIT_ISO_HORIZ_FACTOR;
    if (preset === ORBIT_CAMERA_PRESETS.FRONT_ISO || preset === ORBIT_CAMERA_PRESETS.ISO_NORTH) {
        return {
            position: { x: c.x, y: isoY, z: c.z - isoH },
            target,
        };
    }
    if (preset === ORBIT_CAMERA_PRESETS.ISO_SOUTH) {
        return {
            position: { x: c.x, y: isoY, z: c.z + isoH },
            target,
        };
    }
    if (preset === ORBIT_CAMERA_PRESETS.ISO_EAST) {
        return {
            position: { x: c.x + isoH, y: isoY, z: c.z },
            target,
        };
    }
    if (preset === ORBIT_CAMERA_PRESETS.ISO_WEST) {
        return {
            position: { x: c.x - isoH, y: isoY, z: c.z },
            target,
        };
    }
    if (preset === ORBIT_CAMERA_PRESETS.CORNER_ISO) {
        return {
            position: { x: c.x + span, y: span * ORBIT_CORNER_Y_FACTOR, z: c.z + span },
            target,
        };
    }
    return computeOrbitPresetCamera(ORBIT_CAMERA_PRESETS.CORNER_ISO, desc, defaults);
}

/** @param {string} presetId */
export function isOrbitCameraPresetId(presetId) {
    return presetId === ORBIT_CAMERA_PRESETS.TOP
        || presetId === ORBIT_CAMERA_PRESETS.FRONT_ISO
        || presetId === ORBIT_CAMERA_PRESETS.ISO_NORTH
        || presetId === ORBIT_CAMERA_PRESETS.ISO_SOUTH
        || presetId === ORBIT_CAMERA_PRESETS.ISO_EAST
        || presetId === ORBIT_CAMERA_PRESETS.ISO_WEST
        || presetId === ORBIT_CAMERA_PRESETS.CORNER_ISO;
}

const WALK_ROOM_PRESET_PREFIX = 'walk_room:';

/** @param {number} ringIndex */
export function formatWalkRoomPresetId(ringIndex) {
    return `${WALK_ROOM_PRESET_PREFIX}${ringIndex}`;
}

/** @param {string} value */
export function parseWalkRoomPresetId(value) {
    if (!value?.startsWith(WALK_ROOM_PRESET_PREFIX)) return null;
    const idx = Number.parseInt(value.slice(WALK_ROOM_PRESET_PREFIX.length), 10);
    return Number.isFinite(idx) && idx >= 0 ? idx : null;
}

/**
 * 工具列「視角」下拉：鳥瞰四向等角 ＋ 各地板房間室內視線（無房間則僅 orbit）。
 * @param {{ walkBounds?: { rings?: { x: number, z: number }[][] }, floors?: { id?: string }[] }} desc
 */
export function buildLayout3DViewPresetOptions(desc) {
    const orbit = [
        { id: ORBIT_CAMERA_PRESETS.TOP, label: '俯視' },
        { id: ORBIT_CAMERA_PRESETS.ISO_NORTH, label: '北向斜角' },
        { id: ORBIT_CAMERA_PRESETS.ISO_SOUTH, label: '南向斜角' },
        { id: ORBIT_CAMERA_PRESETS.ISO_EAST, label: '東向斜角' },
        { id: ORBIT_CAMERA_PRESETS.ISO_WEST, label: '西向斜角' },
        { id: ORBIT_CAMERA_PRESETS.CORNER_ISO, label: '角落斜角' },
    ];
    const rings = desc?.walkBounds?.rings ?? [];
    const walkRooms = rings.map((ring, i) => {
        if (!ring?.length) return null;
        const floorId = desc.floors?.[i]?.id;
        const label = floorId ? `房間視線（${floorId}）` : `房間 ${i + 1} 視線`;
        return { id: formatWalkRoomPresetId(i), label, ringIndex: i };
    }).filter(Boolean);
    return { orbit, walkRooms };
}

/**
 * @param {{ x: number, z: number }[]} ring
 * @param {number} [standoffCm]
 */
export function computeWalkRoomEyePresetPose(ring, standoffCm = 150) {
    return computeWalkRoomPreviewPose(ring, standoffCm);
}

/**
 * WebGL readRenderTargetPixels 為左下角原點；翻轉成左上角原點並寫入 dest。
 * @param {Uint8ClampedArray} dest
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgbaBottomLeft
 */
export function flipRgbaRowsInto(dest, width, height, rgbaBottomLeft) {
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
        const srcStart = (height - 1 - y) * rowBytes;
        dest.set(rgbaBottomLeft.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
}

/**
 * WebGL readRenderTargetPixels 為左下角原點；轉成 Canvas ImageData（左上角原點）。
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgbaBottomLeft
 * @returns {Uint8ClampedArray}
 */
export function flipRgbaRowsToTopLeft(width, height, rgbaBottomLeft) {
    const out = new Uint8ClampedArray(width * height * 4);
    flipRgbaRowsInto(out, width, height, rgbaBottomLeft);
    return out;
}

/**
 * 單次離屏渲染並匯出 PNG（不啟用 preserveDrawingBuffer，不影響常態 frame rate）。
 * @param {typeof import('three')} THREE
 * @param {import('three').WebGLRenderer} renderer
 * @param {import('three').Scene} scene
 * @param {import('three').Camera} camera
 * @returns {Promise<Blob>}
 */
export async function renderSceneToPngBlob(THREE, renderer, scene, camera) {
    const srcW = renderer.domElement.width;
    const srcH = renderer.domElement.height;
    if (srcW < 1 || srcH < 1) {
        throw new Error('viewport size invalid');
    }

    const { width: w, height: h } = scaleDimensionsForPngExport(srcW, srcH);

    const renderTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });

    const prevTarget = renderer.getRenderTarget();
    const prevAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    try {
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);

        const pixels = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixels);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2d context unavailable');

        const imageData = ctx.createImageData(w, h);
        flipRgbaRowsInto(imageData.data, w, h, pixels);
        ctx.putImageData(imageData, 0, 0);

        return await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('PNG encode failed'));
            }, 'image/png');
        });
    } finally {
        renderer.setRenderTarget(prevTarget);
        camera.aspect = prevAspect;
        camera.updateProjectionMatrix();
        renderTarget.dispose();
    }
}

/** @param {Blob} blob @param {string} filename */
export function downloadBlobAsFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** @param {Date} [date] */
export function formatLayout3DPngFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `layout-3d-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}
