import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    isQuoteExportablePlacedCabinet,
    filterPlacedCabinetsForQuoteExport,
} from './LP_cabinet_quote_filter.js';
import { buildCabinetQuoteLineItemsFromLayout } from './LP_cabinet_quote_lines.js';
import { serializePlacedCabinetForLayoutSave } from './LP_quote_placement_meta.js';

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

    it('名稱含門／窗但為櫃體仍匯出', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'x1',
                data: { name: '推門衣櫃', group: '系統櫃', width: 120, depth: 60 },
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

    it('舊資料無旗標：model3dKind door、門窗工程、純沙發床排除', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'd1',
                data: { name: '房門', group: '系統櫃', model3dKind: 'door' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'w1',
                data: { name: '鋁窗', group: '門窗工程', width: 100, depth: 15 },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 's1',
                data: { name: '三人沙發', group: '系統櫃' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'b1',
                data: { name: '6尺床', group: '家具家電' },
            }),
        ).toBe(false);
    });

    it('放置後存檔不含推斷 quote 旗標', () => {
        const placed = {
            id: 'cab-1',
            data: { name: '冰箱櫃', group: '系統櫃', width: 60, depth: 60 },
        };
        expect(isQuoteExportablePlacedCabinet(placed)).toBe(true);
        const json = JSON.stringify(serializePlacedCabinetForLayoutSave(placed));
        expect(json).not.toMatch(/quoteSourceType/);
        expect(json).not.toMatch(/quoteExport/);
    });

    it('buildCabinetQuoteLineItemsFromLayout 略過門窗', () => {
        const lines = buildCabinetQuoteLineItemsFromLayout(demoFixture.placedCabinets);
        const names = lines.filter((r) => !r.isHeader).map((r) => r.name);
        expect(names).toContain('範例矮櫃');
        expect(names).not.toContain('房門');
        expect(filterPlacedCabinetsForQuoteExport(demoFixture.placedCabinets)).toHaveLength(1);
    });
});
