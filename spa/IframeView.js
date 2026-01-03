const { ref, onMounted } = Vue;

export default {
    name: 'IframeView',
    props: ['src'],
    setup(props) {
        const isLoading = ref(true);

        const onFrameLoad = () => {
            isLoading.value = false;
        };

        return { isLoading, onFrameLoad };
    },
    template: `
        <div class="relative w-full h-full">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-50"><div class="spinner w-8 h-8 border-4 border-gray-200 rounded-full"></div></div>
            <iframe :src="src" @load="onFrameLoad" class="w-full h-full border-0" :class="{ 'hidden': isLoading }"></iframe>
        </div>
    `
};