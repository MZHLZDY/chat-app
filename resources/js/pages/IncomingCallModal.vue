<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch, onUnmounted} from 'vue';
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
    show: boolean;
    callerName?: string;
    isGroup?: boolean;
}>();

const emit = defineEmits<{
    (e: 'accept'): void;
    (e: 'reject'): void;
}>();

const countdown = ref(30);
let interval: number | null = null;

// computed untuk warna countdown
const countdownTextClass = computed(() => {
    if (countdown.value > 10) {
        // 30 - 11 detik = hijau
        return 'text-green-600 font-semibold transition-all duration-500 ease-in-out';
    } else if (countdown.value > 5) {
        // 10 - 6 detik = oren dengan pulse
        return 'text-orange-600 font-bold animate-pulse transition-all duration-500 ease-in-out';
    } else {
        // 5 - 0 detik = merah dengan bounce
        return 'text-red-600 font-bold animate-bounce transition-all duration-500 ease-in-out';
    }
});

// reset countdown tiap kali modal muncul
watch(
    () => props.show,
    (val) => {
        console.log('📱 Modal show berubah:', val);

        if (val) {
            console.log('⏳ Memulai countdown dari 30 detik...');
            countdown.value = 30;

            // clear interval yang ada
            if (interval) {
                console.log('🧹 Membersihkan interval sebelumnya...');
                clearInterval(interval)
            };

            // buat interval baru
            console.log('⏰Membuat interval baru')
            interval = window.setInterval(() => {
                countdown.value--;
                console.log(`⏰ Interval berjalan: ${countdown.value} ke ${countdown.value - 1}`);

                // auto reject ketika countdown habis
                if (countdown.value <= 0) {
                    console.log('⏳ Countdown habis, menolak panggilan secara otomatis.');
                    clearInterval(interval!);
                    interval = null;
                    emit('reject'); // tolak panggilan
                }
            }, 1000);

            console.log('✅ Interval terbuat dengan ID:', interval);
        } else {
            console.log('❌ Modal ditutup, membersihkan interval jika ada...');
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }
    }
);

// debug watcher untuk props.show
watch(() => props.show, (newVal, oldVal) => {
    console.log(`🔄 props.show berubah dari: ${oldVal} ke ${newVal}`);

    // kalau props.show berubah terus, ini yang bikin countdown reset
    if (newVal === true && oldVal === true) {
        console.log('⚠️ WARNING: props.show dari true ke true lagi! Ini yang bikin countdown reset');
    }
});

// debug watcher untuk countdown
watch(countdown, (newVal, oldVal) => {
    console.log(`🔁 countdown berubah dari: ${oldVal} ke ${newVal}`);

    // kalau countdown tiba tiba reset ke 30, ada yang salah
    if (oldVal !== undefined && oldVal < 30 && newVal === 30) {
        console.log('⚠️ WARNING: countdown tiba-tiba reset ke 30! Ada yang override countdown!');
        console.trace();
    }
});

const accept = () => {
    console.log('✅ Panggilan diterima');
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    emit('accept')
};
const reject = () => {
    console.log('❌ Panggilan ditolak');
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    emit('reject');
};

// cleanup on unmount
onUnmounted(() => {
    console.log('🔒 Membersihkan sumber daya...');
    if (interval) {
        clearInterval(interval);
    }
});
</script>

<template>
    <div
    v-if="props.show"
    class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center space-y-4 max-w-sm w-full mx-4">
            <!-- Tambahkan avatar untuk visual -->
            <div class="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto animate-pulse">
                {{ (props.callerName || 'U').charAt(0).toUpperCase() }}
            </div>

            <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">🤙 Panggilan Masuk</h2>
            <p class="text-gray-600 dark:text-gray-300">Dari: {{ props.callerName || "Unknown" }}</p>

            <!-- Tambahkan lebih banyak debug info -->
            <!-- <div class="text-xs text-gray-500 space-y-1">
                <div>Props.show: {{ props.show }}</div>
                <div>Countdown: {{ countdown }}</div>
                <div>Interval ID: {{ interval }}</div>
                <div>Current Time: {{ new Date().toLocaleTimeString() }}</div>
            </div> -->

            <!-- Countdown dinamis -->
            <p class="text-sm font-semibold" :class="countdownTextClass">Otomatis ditutup dalam {{ countdown }} detik...</p>
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