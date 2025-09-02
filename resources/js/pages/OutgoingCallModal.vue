<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch} from 'vue';
// import { defineProps, defineEmits } from 'vue';

interface Props {
    show: boolean;
    calleeName?: string
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'cancel'): void;
}>();
</script>

<template>
    <div v-if="props.show" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center space-y-4">
            <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">📞 Memanggil</h2>
            <p class="text-gray-600 dark:text-gray-300">Ke: {{ props.calleeName || "Unknown" }}</p>
            <div class="flex justify-center gap-4">
                <button
                    @click="emit('cancel')"
                    class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                        Batalkan
                </button>
            </div>
        </div>
    </div>
</template>