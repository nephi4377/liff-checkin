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

    it('3D 不顯示（ignore）僅影響 3D：家具／門窗仍不匯出，櫃體名稱仍匯出', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'sofa-hide',
                model3dKind: 'ignore',
                data: { name: 'L型沙發', group: '家具家電' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'door-hide',
                model3dKind: 'ignore',
                data: { name: '房門', group: '門窗工程' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'bed-hide',
                model3dKind: 'ignore',
                data: { name: '雙人床', group: '家具家電' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'tv-cab',
                model3dKind: 'ignore',
                data: { name: '電視櫃', group: '系統櫃' },
            }),
        ).toBe(true);
    });

    it('isWall 優先於名稱像櫃體（收納牆不匯出）', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'wall-storage',
                data: { isWall: true, name: '收納牆', group: '系統櫃' },
            }),
        ).toBe(false);
    });

    it('isWall 與仅靠名稱／群組的門窗（model3dKind auto）不匯出', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'wall-1',
                data: { isWall: true, name: '牆段', group: '系統櫃' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'd-auto',
                data: { name: '房門', group: '系統櫃', model3dKind: 'auto' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'w-auto',
                data: { name: '落地窗', group: '系統櫃', model3dKind: 'auto' },
            }),
        ).toBe(false);
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'd-leaf',
                data: { name: '浴室門', group: '門片', model3dKind: 'auto' },
            }),
        ).toBe(false);
    });

    it('手動 model3dKind cabinet 仍匯出（覆寫門窗名稱）', () => {
        expect(
            isQuoteExportablePlacedCabinet({
                id: 'd-cab',
                model3dKind: 'cabinet',
                data: { name: '房門', group: '門片' },
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

    describe.each([
        ['(無)', false, '矮櫃', '系統櫃', true],
        ['auto', false, '房門', '系統櫃', false],
        ['cabinet', false, '房門', '門片', true],
        ['ignore', false, 'L型沙發', '家具家電', false],
        ['ignore', false, '房門', '門窗工程', false],
        ['ignore', false, '電視櫃', '系統櫃', true],
        ['ignore', false, '雙人床', '家具家電', false],
        ['(無)', true, '收納牆', '系統櫃', false],
        ['door', false, '標籤', '系統櫃', false],
        ['window', false, '標籤', '系統櫃', false],
        ['(無)', false, '推門衣櫃', '系統櫃', true],
    ])(
        '矩陣 model3dKind=%s isWall=%s name=%s group=%s → export=%s',
        (model3dKind, isWall, name, group, expectExport) => {
            it(`→ ${expectExport}`, () => {
                const cab = {
                    id: 'matrix',
                    data: { name, group },
                };
                if (isWall) cab.data.isWall = true;
                if (model3dKind !== '(無)') {
                    cab.model3dKind = model3dKind;
                    cab.data.model3dKind = model3dKind;
                }
                expect(isQuoteExportablePlacedCabinet(cab)).toBe(expectExport);
            });
        },
    );

    it('buildCabinetQuoteLineItemsFromLayout 略過門窗', () => {
        const lines = buildCabinetQuoteLineItemsFromLayout(demoFixture.placedCabinets);
        const names = lines.filter((r) => !r.isHeader).map((r) => r.name);
        expect(names).toContain('範例矮櫃');
        expect(names).not.toContain('房門');
        expect(filterPlacedCabinetsForQuoteExport(demoFixture.placedCabinets)).toHaveLength(1);
    });
});
