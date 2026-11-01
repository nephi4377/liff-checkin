const { ref, watch, onBeforeUnmount } = Vue;

export default {
    name: 'IframeView',
    props: ['src'],
    setup(props) {
        const isLoading = ref(true);
        const frameSrc = ref(props.src || 'about:blank');
        let remountGen = 0;
        let safetyTimer = null;

        const clearSafety = () => {
            if (safetyTimer) {
                clearTimeout(safetyTimer);
                safetyTimer = null;
            }
        };

        const armSafety = (gen) => {
            clearSafety();
            // LINE／部分 WebView 偶發不送 load → 勿永遠 hidden
            safetyTimer = setTimeout(function () {
                if (gen !== remountGen) return;
                if (!frameSrc.value || frameSrc.value === 'about:blank') return;
                isLoading.value = false;
            }, 8000);
        };

        const onFrameLoad = () => {
            // about:blank 中轉時維持 loading，等真正目標頁 load
            if (!frameSrc.value || frameSrc.value === 'about:blank') return;
            isLoading.value = false;
            clearSafety();
        };

        const remountTo = (next) => {
            const gen = ++remountGen;
            isLoading.value = true;
            frameSrc.value = 'about:blank';
            armSafety(gen);
            // 雙 rAF：等 blank 真正套用後再設目標，降低「load 遺失／卡空白」
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (gen !== remountGen) return;
                    frameSrc.value = next;
                    armSafety(gen);
                });
            });
        };

        // 主控台會計路由多半共用 modules/accounting/index.html，只改 route=；
        // 僅綁 :src 時部分瀏覽器可能不重載，導致「單據與存檔」停在舊子頁。
        watch(
            () => props.src,
            (next, prev) => {
                if (!next || next === prev) return;
                remountTo(next);
            }
        );

        onBeforeUnmount(function () {
            remountGen += 1;
            clearSafety();
        });

        if (props.src) armSafety(remountGen);

        return { isLoading, frameSrc, onFrameLoad };
    },
    template: `
        <div class="relative w-full h-full">
            <div v-if="isLoading" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-gray-50/95">
                <div class="spinner w-8 h-8 border-4 border-gray-200 rounded-full"></div>
                <p class="text-sm text-gray-500 m-0">載入中…</p>
            </div>
            <iframe :src="frameSrc" @load="onFrameLoad" class="w-full h-full border-0"></iframe>
        </div>
    `
};
