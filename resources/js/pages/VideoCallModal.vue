<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, watch} from 'vue';
import { defineProps, defineEmits } from 'vue';
import { Mic, Camera, PhoneOff } from 'lucide-vue-next';

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

let peerConnection: RTCPeerConnection | null = null;

// State toggle mic & camera
const isMuted = ref(false);
const isCameraOn = ref(true);

const props = defineProps<{
    show: boolean;
    contactName?: string;
    status?: CallStatus; // tambahan
    isGroup?: boolean;
    groupName?: string;
    participants?: { id: number; name: string }[];
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

            <!-- Video area -->
            <div class="flex-1 relative bg-black">
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

            <!-- Controls -->
             <div class="p-4 flex justify-center gap-4 border-t border-gray-700 relative z-50">
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