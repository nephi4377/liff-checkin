/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import {
    detectLayoutPlannerTouchUi,
    isPrimaryPointerButton,
    createRafThrottle,
    LP_MOBILE_TOUCH_MIN_HIT_PX,
} from './LP_layout_mobile.js';

describe('detectLayoutPlannerTouchUi', () => {
    it('lpDesktop=1 關閉觸控 UI', () => {
        expect(detectLayoutPlannerTouchUi('?lpDesktop=1')).toBe(false);
    });

    it('lpMobile=1 強制開啟', () => {
        expect(detectLayoutPlannerTouchUi('?lpMobile=1')).toBe(true);
    });
});

describe('isPrimaryPointerButton', () => {
    it('touch 左鍵視為主鍵', () => {
        expect(isPrimaryPointerButton({ pointerType: 'touch', button: 0 })).toBe(true);
        expect(isPrimaryPointerButton({ pointerType: 'mouse', button: 1 })).toBe(false);
    });
});

describe('createRafThrottle', () => {
    it('合併同一 frame 多次呼叫', async () => {
        let n = 0;
        const fn = createRafThrottle(() => { n += 1; });
        fn();
        fn();
        fn();
        await new Promise((r) => requestAnimationFrame(r));
        expect(n).toBe(1);
    });
});

describe('constants', () => {
    it('最小點擊區至少 44px', () => {
        expect(LP_MOBILE_TOUCH_MIN_HIT_PX).toBeGreaterThanOrEqual(44);
    });
});
