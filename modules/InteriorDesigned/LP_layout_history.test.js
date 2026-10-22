import { describe, it, expect } from 'vitest';
import { createHistoryGestureCoalescer, simulateDragGestureCommits } from './LP_layout_history.js';

describe('createHistoryGestureCoalescer', () => {
    it('手勢外每次 requestSave 立即 commit', () => {
        let n = 0;
        const g = createHistoryGestureCoalescer(() => { n += 1; });
        g.requestSave();
        g.requestSave();
        expect(n).toBe(2);
    });

    it('手勢內多次 requestSave 僅在 end 時 commit 一次', () => {
        let n = 0;
        const g = createHistoryGestureCoalescer(() => { n += 1; });
        g.begin();
        g.requestSave();
        g.requestSave();
        g.requestSave();
        expect(n).toBe(0);
        g.end();
        expect(n).toBe(1);
    });

    it('simulateDragGesture：10 次 mousemove 級 save 只 1 次 commit', () => {
        const sink = { commitCount: 0 };
        simulateDragGestureCommits(sink, 10);
        expect(sink.commitCount).toBe(1);
    });

    it('嵌套手勢僅在最外層 end 時 commit', () => {
        let n = 0;
        const g = createHistoryGestureCoalescer(() => { n += 1; });
        g.begin();
        g.requestSave();
        g.begin();
        g.requestSave();
        g.end();
        expect(n).toBe(0);
        g.end();
        expect(n).toBe(1);
    });
});
