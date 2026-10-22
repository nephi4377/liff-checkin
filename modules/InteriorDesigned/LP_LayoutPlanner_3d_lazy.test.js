import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const plannerSrc = readFileSync(join(dir, 'LP_LayoutPlanner.js'), 'utf8');

describe('LP_LayoutPlanner 3D lazy load', () => {
    it('不在模組頂層靜態 import LP_3DViewer', () => {
        expect(plannerSrc).not.toMatch(/import\s+\{[^}]*createLayoutPlanner3DViewer[^}]*\}\s+from\s+['"]\.\/LP_3DViewer\.js['"]/);
    });

    it('以動態 import 載入 LP_3DViewer', () => {
        expect(plannerSrc).toMatch(/import\s*\(\s*['"]\.\/LP_3DViewer\.js['"]\s*\)/);
        expect(plannerSrc).toMatch(/resetLp3dViewerAfterLoadFailure/);
    });
});
