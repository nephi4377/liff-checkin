const { ref, watch } = Vue;

export default {
    name: 'IframeView',
    props: ['src'],
    setup(props) {
        const isLoading = ref(true);
        const frameSrc = ref(props.src || 'about:blank');

        const onFrameLoad = () => {
            // about:blank 中轉時維持 loading，等真正目標頁 load
            if (!frameSrc.value || frameSrc.value === 'about:blank') return;
            isLoading.value = false;
        };

        // 主控台會計路由多半共用 modules/accounting/index.html，只改 route=；
        // 僅綁 :src 時部分瀏覽器可能不重載，導致「單據與存檔」停在舊子頁。
        watch(
            () => props.src,
            (next, prev) => {
                if (!next || next === prev) return;
                isLoading.value = true;
                frameSrc.value = 'about:blank';
                setTimeout(function () {
                    frameSrc.value = next;
                }, 0);
            }
        );

        return { isLoading, frameSrc, onFrameLoad };
    },
    template: `
        <div class="relative w-full h-full">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-50"><div class="spinner w-8 h-8 border-4 border-gray-200 rounded-full"></div></div>
            <iframe :src="frameSrc" @load="onFrameLoad" class="w-full h-full border-0" :class="{ 'hidden': isLoading }"></iframe>
        </div>
    `
};
