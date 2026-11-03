/** Enter 鍵在同步確認框的結果（可單測，不依賴 DOM） */
export function budgetWebSyncConfirmEnterProceeds(defaultProceed) {
    return defaultProceed === true;
}

/**
 * BudgetWeb 同步確認（避免原生 confirm：Enter 一律當「確定」）
 * @param {string} message
 * @param {{ defaultProceed?: boolean }} [opts] — false = 預設取消（Enter 等同取消）
 * @returns {Promise<boolean>} true = 使用者明確選擇繼續寫入
 */
export function confirmBudgetWebWriteProceed(message, opts = {}) {
    const defaultProceed = opts.defaultProceed === true;
    if (typeof document === 'undefined' || !document.body) {
        return Promise.resolve(defaultProceed);
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.setAttribute('data-lp-budgetweb-sync-confirm', '1');
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';

        const panel = document.createElement('div');
        panel.style.cssText =
            'max-width:520px;width:100%;background:#fff;border-radius:10px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.2);font:14px/1.5 system-ui,sans-serif;';

        const pre = document.createElement('pre');
        pre.textContent = String(message || '');
        pre.style.cssText = 'white-space:pre-wrap;margin:0 0 16px;max-height:50vh;overflow:auto;';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.textContent = '取消';
        btnCancel.style.cssText = 'padding:8px 16px;cursor:pointer;';

        const btnProceed = document.createElement('button');
        btnProceed.type = 'button';
        btnProceed.textContent = '確定寫入';
        btnProceed.style.cssText = 'padding:8px 16px;cursor:pointer;';

        let settled = false;
        const finish = (proceed) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve(Boolean(proceed));
        };

        btnCancel.addEventListener('click', () => finish(false));
        btnProceed.addEventListener('click', () => finish(true));

        const onKey = (ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                finish(false);
                return;
            }
            if (ev.key === 'Enter') {
                ev.preventDefault();
                finish(budgetWebSyncConfirmEnterProceeds(defaultProceed));
            }
        };

        document.addEventListener('keydown', onKey, true);
        row.append(btnCancel, btnProceed);
        panel.append(pre, row);
        overlay.append(panel);
        document.body.append(overlay);

        if (defaultProceed) {
            btnProceed.focus();
        } else {
            btnCancel.focus();
        }
    });
}
