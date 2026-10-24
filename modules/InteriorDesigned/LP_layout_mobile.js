/**
 * LayoutPlanner 手機／平板觸控與 UI 偵測（無 DOM 依賴部分可單測）
 */

export const LP_MOBILE_TOUCH_MIN_HIT_PX = 44;
export const LP_MOBILE_LONG_PRESS_MS = 550;

/** @param {string} [search] */
export function detectLayoutPlannerTouchUi(search = '') {
    if (typeof globalThis === 'undefined') return false;
    const params = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    if (params.get('lpDesktop') === '1') return false;
    if (params.get('lpMobile') === '1') return true;
    if (typeof matchMedia === 'function') {
        if (matchMedia('(pointer: coarse) and (hover: none)').matches) return true;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(
        (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '',
    );
}

/** @param {PointerEvent | MouseEvent} e */
export function isPrimaryPointerButton(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return e.button === 0;
    return e.button === 0;
}

/**
 * @param {HTMLElement} el
 * @param {(e: PointerEvent) => void} handler
 */
export function bindPrimaryPointerDown(el, handler) {
    if (!el || el.dataset.lpPtrBound === '1') return;
    el.dataset.lpPtrBound = '1';
    el.addEventListener('pointerdown', (e) => {
        if (!isPrimaryPointerButton(e)) return;
        if (e.pointerType === 'touch') e.preventDefault();
        handler(e);
    });
}

/**
 * @param {(...args: unknown[]) => void} fn
 */
export function createRafThrottle(fn) {
    let rafId = 0;
    /** @type {unknown[]} */
    let lastArgs = [];
    return (...args) => {
        lastArgs = args;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            fn(...lastArgs);
        });
    };
}

/**
 * 雙指縮放／平移（綁在 canvas-wrapper）
 * @param {HTMLElement} wrapper
 * @param {{ getScale: () => number, setScale: (n: number) => void, getScroll: () => { left: number, top: number }, setScroll: (left: number, top: number) => void }} view
 */
export function installCanvasPinchPan(wrapper, view, hooks = {}) {
    if (!wrapper || wrapper.dataset.lpPinchBound === '1') return;
    wrapper.dataset.lpPinchBound = '1';
    const pointers = new Map();
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

    const onDown = (e) => {
        if (e.pointerType === 'touch') {
            try { wrapper.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            hooks.onPinchStart?.();
            const pts = [...pointers.values()];
            pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            pinchStartScale = view.getScale();
            const scroll = view.getScroll();
            panStart = {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2,
                scrollLeft: scroll.left,
                scrollTop: scroll.top,
            };
        }
    };

    const onMove = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size !== 2) return;
        e.preventDefault();
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const scale = Math.min(5, Math.max(0.1, pinchStartScale * (dist / pinchStartDist)));
        view.setScale(scale);
        view.setScroll(
            panStart.scrollLeft - (midX - panStart.x),
            panStart.scrollTop - (midY - panStart.y),
        );
    };

    const onUp = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) {
            pinchStartDist = 0;
        }
    };

    wrapper.addEventListener('pointerdown', onDown, { passive: false });
    wrapper.addEventListener('pointermove', onMove, { passive: false });
    wrapper.addEventListener('pointerup', onUp);
    wrapper.addEventListener('pointercancel', onUp);
}
