<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch} from 'vue';
import type { CallStatus, Participants } from '@/types/CallStatus';

// import { defineProps, defineEmits } from 'vue';

// export type Participants = {
//     id: number;
//     name: string;
//     status: "calling" | "rejected" | "missed" | "accepted";
// };

interface Props {
    show: boolean;
    calleeName?: string
}

const props = defineProps<{
    show: boolean;
    isGroup?: boolean;
    calleeName?: string // untuk personal call
    groupName?: string; // untuk group call
    participants?: Participants[];
}>();

const emit = defineEmits<{
    (e: 'cancel'): void;
    (e: "timeout"): void;
    (e: "rejected", id: number): void;
    (e: "accepted", id: number): void;
}>();

// State untuk countdown
const countdown = ref(30);
let countdownInterval: number | null = null;

// Fungsi untuk start countdown
const startCountdown = () => {
    countdown.value = 30;

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownInterval = window.setInterval(() => {
        countdown.value--;

        if (countdown.value <= 0) {
            clearInterval(countdownInterval!);
            emit("timeout");
        }
    }, 1000);
};

// Watch props show untuk start/stop countdown
watch(
    () => props.show,
    (newValue) => {
        if (newValue) {
            startCountdown();
        } else {
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
        }
    },
    { immediate: true }
);

// Cleanup on unmount
onMounted(() => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});

const cancel = () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    emit('cancel');
};

// state untuk anggota grup
const memberState = ref<Participants[]>([]);

// init status panggilan
onMounted(() => {
    if (props.isGroup && props.participants) {
        memberState.value = props.participants.map((p) => ({
            ...p,
            status: "calling"
        }));

        // timeout 30detik -> yang belum respon otomatis "missed"
        setTimeout(() => {
            memberState.value = memberState.value.map((m) =>
                m.status === "calling" ? { ...m, status: "missed" } : m
        );
        emit("timeout");
        });
    }
});

// helper update status
const updateStatus = (id: number, status: Participants["status"]) => {
    memberState.value = memberState.value.map((m) =>
        m.id === id ? { ...m, status } : m
    );   
}

</script>

<template>
    <div
        v-if="props.show"
        class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
        <div 
            class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center space-y-4 w-[90%] max-w-md"
        >
            <!-- Personal Call -->
            <template v-if="!props.isGroup">
                <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">🤙 Memanggil</h2>
                <p class="text-gray-600 dark:text-gray-300">Ke: {{ props.calleeName || 'Unknown' }}</p>
                <div>
                    <button
                        @click="emit('cancel')"
                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                        Batalkan Panggilan
                    </button>
                </div>
            </template>

            <!-- Group Call -->
            <template v-else>
                <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">
                    👥 Group Call: {{ props.groupName || "Tanpa Nama" }}
                </h2>
                <p class="text-sm text-gray-500">Minimal 1 orang bergabung sebelum lanjut</p>

                <!-- List Anggota -->
                <div class="space-y-2 text-left">
                    <div
                        v-for="member in memberState"
                        :key="member.id"
                        class="flex justify-between items-center p-2 rounded-md bg-gray-100 dark:bg-gray-700"
                    >
                        <span>{{ member.name }}</span>
                        <span
                            class="text-sm"
                            :class="{
                                'text-blue-500': member.status === 'calling',
                                'text-green-500': member.status === 'accepted',
                                'text-red-500': member.status === 'rejected',
                                'text-gray-400': member.status === 'missed'
                            }"
                        >
                            {{ member.status }}
                        </span>
                    </div>
                </div>

                <!-- cancel button -->
                <div class="flex justify-center mt-4">
                    <button
                        @click="emit('cancel')"
                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                        Batalkan Panggilan
                    </button>
                </div>
            </template>
        </div>
    </div>
</template>