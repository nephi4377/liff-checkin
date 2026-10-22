import { describe, it, expect } from 'vitest';
import {
    resolveFixtureDisplayCategory,
    resolveFixtureDisplayHeightCm,
} from './LP_3D_furniture.js';

describe('resolveFixtureDisplayCategory', () => {
    it('依名稱與群組分辨家具類別', () => {
        expect(resolveFixtureDisplayCategory({ data: { name: '開門高衣櫃' } }, 'cabinet')).toBe('wardrobe');
        expect(resolveFixtureDisplayCategory({ data: { name: '電視櫃' } }, 'cabinet')).toBe('tvCabinet');
        expect(resolveFixtureDisplayCategory({ data: { name: 'L型沙發' } }, 'cabinet')).toBe('sofa');
        expect(resolveFixtureDisplayCategory({ data: { name: '6尺床' } }, 'cabinet')).toBe('bed');
        expect(resolveFixtureDisplayCategory({ data: { name: '流理臺' } }, 'cabinet')).toBe('kitchen');
        expect(resolveFixtureDisplayCategory({ data: { name: '房門' } }, 'door')).toBe('door');
    });
});

describe('resolveFixtureDisplayHeightCm', () => {
    it('衣櫃與床使用類別預設高度', () => {
        expect(resolveFixtureDisplayHeightCm('wardrobe', {}, 90)).toBe(240);
        expect(resolveFixtureDisplayHeightCm('bed', {}, 90)).toBe(45);
        expect(resolveFixtureDisplayHeightCm('cabinet', { data: { height: 120 } }, 90)).toBe(120);
    });
});
