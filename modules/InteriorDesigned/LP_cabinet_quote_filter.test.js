import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    isQuoteExportablePlacedCabinet,
    filterPlacedCabinetsForQuoteExport,
} from './LP_cabinet_quote_filter.js';
import { buildCabinetQuoteLineItemsFromLayout } from './LP_cabinet_quote_lines.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoFixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'e2e/fixtures/lp-3d-spec-demo.json'), 'utf8'),
);

describe('isQuoteExportablePlacedCabinet', () => {
    it('範例矮櫃可匯出', () => {
        const cab = demoFixture.placedCabinets.find((c) => c.id === 'cab-demo-1');
        expect(isQuoteExportablePlacedCabinet(cab)).toBe(true);
    });

    it('quoteExport:false 的房門、落地窗不匯出', () => {
        const door = demoFixture.placedCabinets.find((c) => c.id === 'door-demo-1');
        const win = demoFixture.placedCabinets.find((c) => c.id === 'win-demo-1');
        expect(isQuoteExportablePlacedCabinet(door)).toBe(false);
        expect(isQuoteExportablePlacedCabinet(win)).toBe(false);
    });

    it('名稱含門／窗但為櫃體仍匯出（不依 3D 名稱猜測）', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'x1',
                data: { name: '推門衣櫃', group: '系統櫃', width: 120, depth: 60 },
            }),
        ).toBe(true);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'x2',
                data: { name: '拉門鞋櫃', group: '系統櫃' },
            }),
        ).toBe(true);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'x3',
                data: { name: '窗邊臥榻', group: '木作' },
            }),
        ).toBe(true);
    });

    it('3D 不顯示（model3dKind ignore）仍計入報價', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'hidden-cab',
                model3dKind: 'ignore',
                data: { name: '隱形矮櫃', group: '系統櫃' },
            }),
        ).toBe(true);
    });

    it('quoteCategory / quoteSourceType 排除家具與開口', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'sofa',
                data: { name: '三人沙發', quoteCategory: 'furniture' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'bed',
                data: { name: '6尺床', quoteSourceType: 'furniture' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'open',
                data: { name: '房門', quoteSourceType: 'opening' },
            }),
        ).toBe(false);
    });

    it('無 data 物件不匯出', () => {
        expect(isQuoteExportablePlacedCabinet({ id: 'bare' })).toBe(false);
    });

    it('buildCabinetQuoteLineItemsFromLayout 略過 quoteExport:false 門窗', () => {
        const lines = buildCabinetQuoteLineItemsFromLayout(demoFixture.placedCabinets);
        const names = lines.filter((r) => !r.isHeader).map((r) => r.name);
        expect(names).toContain('範例矮櫃');
        expect(names).not.toContain('房門');
        expect(names).not.toContain('落地窗');
        expect(filterPlacedCabinetsForQuoteExport(demoFixture.placedCabinets)).toHaveLength(1);
    });
});
