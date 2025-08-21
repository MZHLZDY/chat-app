<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, } from 'vue';
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
    show: boolean;
    contactName?: string;
}>();

const emit = defineEmits<{
    (e: "end"): void;
}>();

const handleEnd = () => {
    emit("end");
};
</script>

<template>
    <!-- Overlay Video Call -->
    <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
        >
        <div
            class="bg-gray-900 text-white w-[80%] h-[80%] rounded-xl relative flex flex-col"
        >
            <!-- Header -->
            <div
                class="flex justify-between items-center p-4 border-b border-gray-700"
            >
                <span class="font-bold">
                    Video Call dengan {{ contactName || "Unknown" }}
                </span>
                <button
                @click="handleEnd"
                class="bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition"
                >
                    End
                </button>
            </div>

            <!-- Video Streams -->
            <div class="flex-1 grid grid-cols-2 gap-2 p-4">

                <!-- Local Stream -->
                <div
                    id="local-stream"
                    class="bg-black rounded-lg flex items-center justify-center text-gray-400"
                    >
                        <span>Local Stream</span>
                </div>

                <!-- Remote Stream -->
                <div
                id="remote-stream"
                class="bg-black rounded-lg flex items-center justify-center text-gray-400"
                >
                    <span>Remote Stream</span>
                </div>
            </div>
        </div>
    </div>
</template>