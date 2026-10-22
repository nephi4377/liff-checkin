import { ringCentroidXZ } from './LP_3D_scene.js';

/** @typedef {'top' | 'front_iso' | 'corner_iso'} OrbitCameraPresetId */

export const ORBIT_CAMERA_PRESETS = {
    TOP: 'top',
    FRONT_ISO: 'front_iso',
    CORNER_ISO: 'corner_iso',
};

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
    if (preset === ORBIT_CAMERA_PRESETS.FRONT_ISO) {
        return {
            position: { x: c.x, y: span * 0.72, z: c.z - span * 1.05 },
            target,
        };
    }
    return {
        position: { x: c.x + span, y: span * 0.75, z: c.z + span },
        target,
    };
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
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
        const srcStart = (height - 1 - y) * rowBytes;
        out.set(rgbaBottomLeft.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
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
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    if (w < 1 || h < 1) {
        throw new Error('viewport size invalid');
    }

    const renderTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);

    const pixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixels);
    renderTarget.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    const imageData = ctx.createImageData(w, h);
    imageData.data.set(flipRgbaRowsToTopLeft(w, h, pixels));
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('PNG encode failed'));
        }, 'image/png');
    });
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
    URL.revokeObjectURL(url);
}

/** @param {Date} [date] */
export function formatLayout3DPngFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `layout-3d-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}
