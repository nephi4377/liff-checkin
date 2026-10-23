import { describe, expect, it } from 'vitest';
import {
    isBgLikeRgb,
    isWallLikeRgb,
    LP_3D_PIXEL_SAMPLE_RGB,
} from './LP_3D_pixel_rgb.js';

describe('LP_3D_pixel_rgb', () => {
    it('場景背景色不應被判為牆色', () => {
        const bg = LP_3D_PIXEL_SAMPLE_RGB.sceneBg;
        expect(isBgLikeRgb(bg)).toBe(true);
        expect(isWallLikeRgb(bg)).toBe(false);
    });

    it('牆頂／牆面樣本應被判為牆色', () => {
        expect(isWallLikeRgb(LP_3D_PIXEL_SAMPLE_RGB.wallCap)).toBe(true);
        expect(isWallLikeRgb(LP_3D_PIXEL_SAMPLE_RGB.wall)).toBe(true);
    });

    it('地板樣本不應被判為牆色', () => {
        expect(isWallLikeRgb(LP_3D_PIXEL_SAMPLE_RGB.floor)).toBe(false);
    });
});
