import * as THREE from 'three';
import { clampPointToWalkRings } from './LP_3D_scene.js';
import {
    moveWithWalkCollision,
    resolveWalkBodyRadiusCm,
    WALK_BODY_RADIUS_CM,
} from './LP_3D_walk_collision.js';

const MOVE_SPEED_CM_S = 220;
const LOOK_SENS = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.08;
const WALK_KEY_CODES = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

/**
 * @param {{ camera: import('three').PerspectiveCamera, domElement: HTMLElement, eyeHeightCm: number, getWalkBounds: () => { rings?: {x:number,z:number}[][] }|null, getWalkCollision?: () => { segments?: object[], obbs?: object[] }|null, getWalkBodyRadiusCm?: () => number }} opts
 */
export function createWalkController(opts) {
    const { camera, domElement, eyeHeightCm, getWalkBounds, getWalkCollision, getWalkBodyRadiusCm } = opts;
    let active = false;
    let yaw = 0;
    let pitch = 0;
    const keys = new Set();
    let pointerDown = false;
    let lastX = 0;
    let lastY = 0;
    let touchMoveId = null;
    let touchLookId = null;
    const touchMove = { x: 0, y: 0 };

    function clampInsideBounds(x, z) {
        const bounds = getWalkBounds();
        return clampPointToWalkRings(x, z, bounds?.rings);
    }

    function applyPositionDelta(dx, dz) {
        const x0 = camera.position.x;
        const z0 = camera.position.z;
        const collision = getWalkCollision?.() ?? null;
        const bodyR = getWalkBodyRadiusCm?.() ?? WALK_BODY_RADIUS_CM;
        const moved = moveWithWalkCollision(x0, z0, dx, dz, collision, bodyR);
        const clamped = clampInsideBounds(moved.x, moved.z);
        camera.position.x = clamped.x;
        camera.position.z = clamped.z;
    }

    function applyCameraRotation() {
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    }

    function swallowWalkKey(e) {
        if (!WALK_KEY_CODES.has(e.code)) return;
        keys.add(e.code);
        e.preventDefault();
        e.stopPropagation();
    }

    function onKeyDown(e) {
        if (!active) return;
        swallowWalkKey(e);
    }

    function onKeyUp(e) {
        if (!active) return;
        if (WALK_KEY_CODES.has(e.code)) {
            keys.delete(e.code);
            e.stopPropagation();
        }
    }

    function onMouseDown(e) {
        if (!active || e.button !== 0) return;
        pointerDown = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.stopPropagation();
    }

    function onMouseUp() {
        pointerDown = false;
    }

    function onMouseMove(e) {
        if (!active || !pointerDown) return;
        yaw -= (e.clientX - lastX) * LOOK_SENS;
        pitch -= (e.clientY - lastY) * LOOK_SENS;
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
        lastX = e.clientX;
        lastY = e.clientY;
        applyCameraRotation();
        e.stopPropagation();
    }

    function onTouchStart(e) {
        if (!active) return;
        for (const t of e.changedTouches) {
            if (t.clientX < domElement.clientWidth * 0.45 && touchMoveId === null) {
                touchMoveId = t.identifier;
                touchMove.x = t.clientX;
                touchMove.y = t.clientY;
            } else if (touchLookId === null) {
                touchLookId = t.identifier;
                lastX = t.clientX;
                lastY = t.clientY;
            }
        }
        e.stopPropagation();
    }

    function onTouchMove(e) {
        if (!active) return;
        for (const t of e.changedTouches) {
            if (t.identifier === touchMoveId) {
                const dx = t.clientX - touchMove.x;
                const dy = t.clientY - touchMove.y;
                touchMove.x = t.clientX;
                touchMove.y = t.clientY;
                const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
                const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
                forward.y = 0;
                right.y = 0;
                forward.normalize();
                right.normalize();
                const step = 0.35;
                applyPositionDelta(
                    forward.x * (-dy * step) + right.x * (dx * step),
                    forward.z * (-dy * step) + right.z * (dx * step),
                );
            } else if (t.identifier === touchLookId) {
                yaw -= (t.clientX - lastX) * LOOK_SENS * 1.4;
                pitch -= (t.clientY - lastY) * LOOK_SENS * 1.4;
                pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
                lastX = t.clientX;
                lastY = t.clientY;
                applyCameraRotation();
            }
        }
        e.preventDefault();
        e.stopPropagation();
    }

    function onTouchEnd(e) {
        for (const t of e.changedTouches) {
            if (t.identifier === touchMoveId) touchMoveId = null;
            if (t.identifier === touchLookId) touchLookId = null;
        }
        e.stopPropagation();
    }

    function update(deltaSec) {
        if (!active) return;
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();
        let moveX = 0;
        let moveZ = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
        if (moveX !== 0 || moveZ !== 0) {
            const len = Math.hypot(moveX, moveZ) || 1;
            moveX /= len;
            moveZ /= len;
            const dist = MOVE_SPEED_CM_S * deltaSec;
            applyPositionDelta(
                forward.x * moveZ * dist + right.x * moveX * dist,
                forward.z * moveZ * dist + right.z * moveX * dist,
            );
        }
        camera.position.y = eyeHeightCm;
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd);
    domElement.addEventListener('touchcancel', onTouchEnd);

    return {
        setActive(on) {
            active = on;
            if (!on) keys.clear();
        },
        isActive: () => active,
        syncFromCamera() {
            const e = new THREE.Euler(0, 0, 0, 'YXZ');
            e.setFromQuaternion(camera.quaternion);
            yaw = e.y;
            pitch = e.x;
        },
        setPosition(x, z) {
            const c = clampInsideBounds(x, z);
            camera.position.set(c.x, eyeHeightCm, c.z);
        },
        lookAt(x, z) {
            const dx = x - camera.position.x;
            const dz = z - camera.position.z;
            yaw = Math.atan2(-dx, -dz);
            pitch = 0;
            applyCameraRotation();
        },
        setPitch(rad) {
            pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, rad));
            applyCameraRotation();
        },
        update,
        dispose() {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
            domElement.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
            domElement.removeEventListener('touchstart', onTouchStart);
            domElement.removeEventListener('touchmove', onTouchMove);
            domElement.removeEventListener('touchend', onTouchEnd);
            domElement.removeEventListener('touchcancel', onTouchEnd);
        },
    };
}
