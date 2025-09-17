<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch} from 'vue';
import { defineProps, defineEmits } from 'vue';
import { Mic, Camera, PhoneOff } from 'lucide-vue-next';
import type { CallStatus, Participants } from '@/types/CallStatus';
// import type { Participants } from './OutgoingCallModal.vue';

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

let peerConnection: RTCPeerConnection | null = null;

// State toggle mic & camera
const isMuted = ref(false);
const isCameraOn = ref(true);

const props = defineProps<{
    show: boolean;
    contactName?: string;
    status?: Exclude<CallStatus, 'calling'>; // tambahan
    isGroup?: boolean;
    groupName?: string;
    participants?: Participants[];
}>();

const emit = defineEmits<{
    (e: "accept"): void;
    (e: "reject"): void;
    (e: "end"): void;
}>();

const handleAccept = () => {emit("accept");};
const handleReject = () => {emit("reject");};
const handleEnd = () => {emit("end");};

onMounted(async () => {
    if (props.status === "connected" && localVideo.value) {
        try {
            peerConnection = new RTCPeerConnection();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localVideo.value.srcObject = stream;

            stream.getTracks().forEach(track => {
                peerConnection?.addTrack(track, stream);
            });

            peerConnection.ontrack = (event) => {
                if (remoteVideo.value) {
                    remoteVideo.value.srcObject = event.streams[0];
                }
            };
        }   catch (err) {
            console.error("Error accessing media devices.", err);
        }
    }
});

// Toggle mic
const toggleMute = () => {
    if (localVideo.value?.srcObject) {
        const stream = localVideo.value.srcObject as MediaStream;
        stream.getAudioTracks().forEach((track) => {
            track.enabled = isMuted.value; // toggle
        });
    }
    isMuted.value = !isMuted.value;
};

// Toggle camera
const toggleCamera = () => {
    if (localVideo.value?.srcObject) {
        const stream = localVideo.value.srcObject as MediaStream;
        stream.getVideoTracks().forEach((track) => {
            track.enabled = !isCameraOn.value; // toggle
        });
    }
    isCameraOn.value = !isCameraOn.value;
};

// Cleanup stream ketika modal ditutup
watch(
    () => props.show,
    (val) => {
        if (!val && localVideo.value?.srcObject) {
            const stream = localVideo.value.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            peerConnection?.close();
            isMuted.value = false;
            isCameraOn.value = true;
        }
    }
);
</script>

<template>
    <!-- Overlay Video Call -->
    <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
        >
        <div
            class="bg-gray-900 text-white w-[80%] h-[80%] rounded-xl relative flex flex-col overflow-hidden"
        >
            <!-- Header -->
            <div
                class="flex justify-between items-center p-4 border-b border-gray-700"
            >
                <span class="font-bold">
                    <template v-if="!isGroup">
                        Video Call dengan {{ contactName || "Unknown" }}
                    </template>
                    <template v-else>
                        Grup Call: {{ groupName || "Tanpa Nama" }}
                        <span class="text-sm text-gray-400">
                            ({{ participants?.length || 0 }} anggota)
                        </span>
                    </template>
                </span>
            </div>

            <!-- Status Calling -->
            <!-- <div
                v-if="status === 'calling'"
                class="flex-1 flex intems-center justify-center"
            >
                <p class="text-gray-300">
                    🤙Memanggil {{ contactName || "Unknown" }}
                </p>
                <button
                    @click="handleEnd"
                    class="ml-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
                >
                    Batalkan
                </button>
            </div> -->

             <!-- Status Incoming -->
            <div
                v-if="status === 'incoming'"
                class="flex-1 flex flex-col items-center justify-center space-y-4"
            >
                <p class="text-lg font-bold">
                    📲 Panggilan dari {{ contactName || "Unknown" }}
                </p>
                <div class="flex gap-4">
                    <button
                        @click="handleAccept"
                        class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                    >
                        Terima
                    </button>
                    <button
                        @click="handleReject"
                        class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
                    >
                        Tolak
                    </button>
                </div>
            </div>

            <!-- Status Connected (Video area) -->
            <div v-else-if="status === 'connected'" class="flex-1 relative bg-black">
                <!-- Remote Video (full screen) -->
                <video
                    ref="remoteVideo"
                    autoplay
                    playsinline
                    class="w-full h-full object-cover"
                />

                <!-- Local Video (small overlay at bottom-right) -->
                <video
                    ref="localVideo"
                    autoplay
                    muted
                    playsinline
                    class="absolute bottom-4 right-4 w-40 h-28 rounded-lg border-2 border-white object-cover shadow-lg pointer-events-none"
                />
            </div>

            <!-- Status Ended -->
            <div
                v-else-if="status === 'ended'"
                class="flex-1 flex intems-center justify-center"
            >
                <p>☎️ Panggilan Berakhir</p>
            </div>

            <!-- Controls (hanya muncul waktu connected) -->
             <div
                v-if="status === 'connected'"
                class="p-4 flex justify-center gap-4 border-t border-gray-700 relative z-50"
             >
                <!-- Mic -->
                <button
                    @click="toggleMute"
                    :class="[
                        'p-3 rounded-full text-white transition',
                        isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                    ]"
                    >
                        <Mic class="w-6 h-6"/>
                </button>

                <!-- Camera -->
                <button
                    @click="toggleCamera"
                    :class="[
                        'p-3 rounded-full text-white transition',
                        isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                    ]"
                    >
                        <Camera class="w-6 h-6"/>
                </button>

                <!-- End Call -->
                <button
                    @click="handleEnd"
                    class="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition"
                >
                    <PhoneOff class="w-6 h-6"/>
                </button>
             </div>
        </div>
    </div>
</template>