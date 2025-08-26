<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch} from 'vue';
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
    show: boolean;
    callerName?: string;
}>();

const emit = defineEmits<{
    (e: 'accept'): void;
    (e: 'reject'): void;
}>();

const countdown = ref(30);
let interval: number | null = null;

// reset countdown tiap kali modal muncul
watch(
    () => props.show,
    (val) => {
        if (val) {
            countdown.value = 30;
            if (interval) clearInterval(interval);
            interval = window.setInterval(() => {
                if (countdown.value > 0) {
                    countdown.value--;
                }
            }, 1000);
        }   else {
            if (interval) clearInterval(interval);
        }
    }
)

const accept = () => emit('accept');
const reject = () => emit('reject');
</script>

<template>
    <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
        <div class="bg-white p-6 rounded-xl shadow-lg text-center space-y-4">
            <h2 class="text-lg font-bold text-gray-800">🤙 Panggilan Masuk</h2>
            <p class="text-gray-600">Dari: {{ callerName || "Unknown" }}</p>
            <p class="text-sm text-gray-500">Otomatis ditutup dalam {{ countdown }} detik...</p>
            <div class="flex justify-center gap-4">
                <button
                    @click="accept"
                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                        Terima Panggilan
                </button>
                <button
                    @click="reject"
                    class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                        Tolak Panggilan
                </button>
            </div>
        </div>
    </div>
</template>