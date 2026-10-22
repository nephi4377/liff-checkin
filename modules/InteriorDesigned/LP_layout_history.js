/**
 * 將連續操作（拖曳、滑桿等）合併為單次 undo 步驟。
 * @param {() => void} commitFn
 */
export function createHistoryGestureCoalescer(commitFn) {
    let depth = 0;
    let pending = false;

    return {
        begin() {
            depth += 1;
        },
        end() {
            if (depth <= 0) return;
            depth -= 1;
            if (depth === 0 && pending) {
                pending = false;
                commitFn();
            }
        },
        requestSave() {
            if (depth > 0) {
                pending = true;
                return;
            }
            commitFn();
        },
        /** @returns {boolean} */
        isActive() {
            return depth > 0;
        },
        reset() {
            depth = 0;
            pending = false;
        },
    };
}

/**
 * 模擬一次拖曳手勢：多次 requestSave 僅在 end 後觸發一次 commit。
 * @param {{ commitCount: number }} sink
 * @param {number} moveCount
 */
export function simulateDragGestureCommits(sink, moveCount) {
    const coalescer = createHistoryGestureCoalescer(() => {
        sink.commitCount += 1;
    });
    coalescer.begin();
    for (let i = 0; i < moveCount; i += 1) {
        coalescer.requestSave();
    }
    coalescer.end();
}
