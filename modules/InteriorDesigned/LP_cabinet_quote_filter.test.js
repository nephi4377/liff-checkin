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

    it('房門、落地窗不匯出', () => {
        const door = demoFixture.placedCabinets.find((c) => c.id === 'door-demo-1');
        const win = demoFixture.placedCabinets.find((c) => c.id === 'win-demo-1');
        expect(isQuoteExportablePlacedCabinet(door)).toBe(false);
        expect(isQuoteExportablePlacedCabinet(win)).toBe(false);
    });

    it('buildCabinetQuoteLineItemsFromLayout 略過門窗', () => {
        const lines = buildCabinetQuoteLineItemsFromLayout(demoFixture.placedCabinets);
        const names = lines.filter((r) => !r.isHeader).map((r) => r.name);
        expect(names).toContain('範例矮櫃');
        expect(names).not.toContain('房門');
        expect(names).not.toContain('落地窗');
        expect(filterPlacedCabinetsForQuoteExport(demoFixture.placedCabinets)).toHaveLength(1);
    });
});
