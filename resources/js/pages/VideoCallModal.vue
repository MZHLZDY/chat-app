<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, watch} from 'vue';
import { defineProps, defineEmits } from 'vue';
import { Mic, Camera, PhoneOff, Minimize2, Maximize2} from 'lucide-vue-next';
import type { CallStatus, Participants } from '@/types/CallStatus';

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const localStream = ref<MediaStream | null>(null);
const remoteStream = ref<MediaStream | null>(null);

// state untuk kontrol video / audio
const isVideoEnabled = ref(true);
const isAudioEnabled = ref(true);
const isFullscreen = ref(false);

// state untuk minimize
const isMinimized = ref(false);

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
    (e: "minimize"): void;
}>();

// function untuk minimize / maximize
const toggleMinimize = () => {
    isMinimized.value = !isMinimized.value;
    console.log('⬇️ Video call diminimalkan:', isMinimized.value);
};

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

// fungsi untuk mendapatkan user media
const getUserMedia = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localStream.value = stream;
        if (localVideo.value) {
            localVideo.value.srcObject = stream;
        }

        console.log('✅ Local media stream berhasil didapatkan');
    } catch (error) {
        console.error('❌ Gagal mendapatkan media stream:', error);
    }
};

// toggle video on/off
const toggleVideo = () => {
    if (localStream.value) {
        const videoTrack = localStream.value.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoEnabled.value = videoTrack.enabled;
        }
    }
};

// toggle audio on/off
const toggleAudio = () => {
    if (localStream.value) {
        const audioTrack = localStream.value.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isAudioEnabled.value = audioTrack.enabled;
        }
    }
};

// toggle fullscreen
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
};

// simulate remote video (untuk testing, nanti diganti dengan RTC biar realtime)
const simulateRemoteVideo = () => {
    // Untuk demo, bisa pake video test / mirror local video
    if (remoteVideo.value && localStream.value) {
        // Sementara: mirror local stream ke remote (untuk demo / testing)
        remoteVideo.value.srcObject = localStream.value;
    }
};

onMounted(() => {
    getUserMedia().then(() => {
        // simulate remote video untuk demo / testing
        setTimeout(() => {
            simulateRemoteVideo();
        }, 1000);
    });
});

onUnmounted(() => {
    // cleanup media streams
    if (localStream.value) {
        localStream.value.getTracks().forEach(track => track.stop());
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
            track.enabled = !track.enabled; // toggle
        });
    }
    isCameraOn.value = !isCameraOn.value;
};

// TAMBAH STATE UNTUK RESPONSIVE
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

// COMPUTED UNTUK RESPONSIVE CLASSES
const containerClass = computed(() => {
    const isLargeScreen = windowWidth.value >= 1200;
    const isMediumScreen = windowWidth.value >= 768 && windowWidth.value < 1200;
    
    return {
        'max-w-7xl': isLargeScreen,
        'max-w-4xl': isMediumScreen,
        'max-w-2xl': windowWidth.value < 768,
        'h-[95vh]': isLargeScreen,
        'h-[90vh]': !isLargeScreen
    };
});

const localVideoClass = computed(() => {
    const isLargeScreen = windowWidth.value >= 1200;
    const isMediumScreen = windowWidth.value >= 768;
    
    if (isLargeScreen) {
        return 'w-64 h-48'; // Lebih besar untuk layar besar
    } else if (isMediumScreen) {
        return 'w-48 h-36'; // Medium size
    } else {
        return 'w-32 h-24'; // Kecil untuk mobile
    }
});

const controlsClass = computed(() => {
    const isLargeScreen = windowWidth.value >= 1200;
    
    return {
        'gap-6 px-8 py-6': isLargeScreen,
        'gap-4 px-6 py-4': !isLargeScreen
    };
});

// HANDLE WINDOW RESIZE
const handleResize = () => {
    windowWidth.value = window.innerWidth;
    windowHeight.value = window.innerHeight;
};

onMounted(() => {
    getUserMedia().then(() => {
        // simulate remote video untuk demo / testing
        setTimeout(() => {
            simulateRemoteVideo();
        }, 1000);
    });

    // Add resize listener
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    // cleanup media streams
    if (localStream.value) {
        localStream.value.getTracks().forEach(track => track.stop());
    }

    // Remove resize listener
    window.removeEventListener('resize', handleResize);
});

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
        v-if="props.show"
        class="fixed z-50 transition-all duration-300 ease-in-out"
        :class="[
            isMinimized
                ? 'bottom-4 right-4 w-80 h-56 rounded-xl shadow-2xl border border-gray-600'
                : 'inset-0 bg-black bg-opacity-90 flex items-center justify-center',
        ]"
    >
        <div
            class="bg-gray-900 overflow-hidden w-full h-full flex flex-col transition-all duration-300"
            :class="[
                isMinimized
                    ? 'w-full h-full rounded-xl'
                    : 'w-full h-full'
            ]"
        >
            <!-- Header - RESPONSIVE -->
            <div 
                class="bg-gray-800 flex items-center justify-between flex-shrink-0"
                :class="isMinimized ? 'px-3 py-2' : 'px-4 sm:px-6 py-3 sm:py-4'"
            >
                <div class="flex items-center gap-2">
                    <div class="bg-gray-600 rounded-full flex items-center justify-center text-white font-bold"
                        :class="isMinimized ? 'w-6 h-6 text-xs' : 'w-8 h-8 sm:w-10 sm:h-10 text-sm sm:text-kg'"    
                    >
                        {{ props.isGroup ? 'G' : (props.contactName || 'U').charAt(0).toUpperCase() }}
                    </div>

                    <!-- tampilkan info berbeda saat minimized -->
                    <div v-if="!isMinimized">
                        <h3 class="text-white font-semibold text-sm sm:text-base">
                            {{ props.isGroup ? props.groupName : `Video Call dengan ${props.contactName}` }}
                        </h3>
                        <p class="text-gray-400 text-xs sm:text-sm">
                            {{ status === 'connected' ? 'Terhubung' : 'Menghubungkan...' }}
                        </p>
                    </div>
                    <p v-else class="text-white text-xs font-medium truncate">
                        {{ props.contactName }}
                    </p>
                </div>

                <!-- ganti jadi minimize button -->
                <button 
                    @click="toggleMinimize"
                    class="text-white hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                    :class="isMinimized ? 'p-1' : 'p-1 sm:p-2'"
                    :title="isMinimized ? 'Maximize' :'Minimize'"
                >
                    <Maximize2 v-if="isMinimized" class="w-4 h-4"/>
                    <Minimize2 v-else class="w-4 h-4 sm:w-5 sm:h-5"/>
                </button>
            </div>

            <!-- Status Incoming -->
            <div
                v-if="status === 'incoming'"
                class="flex-1 flex flex-col items-center justify-center space-y-4 p-4"
            >
                <p class="text-lg font-bold text-white text-center">
                    📲 Panggilan dari {{ contactName || "Unknown" }}
                </p>
                <div class="flex gap-4">
                    <button
                        @click="handleAccept"
                        class="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-white font-medium"
                    >
                        Terima
                    </button>
                    <button
                        @click="handleReject"
                        class="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg text-white font-medium"
                    >
                        Tolak
                    </button>
                </div>
            </div>

            <!-- Status Connected (Video area) - RESPONSIVE -->
            <div v-else-if="status === 'connected'" class="flex-1 relative bg-black min-h-0">
                
                <!-- Remote Video Container - MAINTAIN ASPECT RATIO -->
                <div v-if="!isMinimized" class="relative w-full h-full">
                    <!-- Remote Video (Main) -->
                    <video
                        ref="remoteVideo"
                        autoplay
                        playsinline
                        class="w-full h-full object-contain bg-black"
                    />

                    <!-- Local Video (Picture in Picture) - RESPONSIVE POSITIONING -->
                    <div 
                        class="absolute z-10 bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg"
                        :class="[
                            localVideoClass,
                            // RESPONSIVE POSITIONING
                            windowWidth >= 1200 ? 'bottom-6 right-6' : 
                            windowWidth >= 768 ? 'bottom-4 right-4' : 'bottom-2 right-2'
                        ]"
                    >
                        <video
                            ref="localVideo"
                            autoplay
                            muted
                            playsinline
                            class="w-full h-full object-cover transform scale-x-[-1]"
                        />
                        
                        <!-- Local video overlay jika camera disabled -->
                        <div v-if="!isCameraOn" 
                             class="absolute inset-0 bg-gray-800 flex items-center justify-center">
                            <div class="w-8 h-8 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                                You
                            </div>
                        </div>
                    </div>
                </div>

                <!-- minimized layout (split view) -->
                 <div v-else class="flex w-full h-full">
                    <!-- Remote Video (sebelah kiri) -->
                    <div class="flex-1 relative border-1 border-gray-600">
                        <Video
                            ref="localVideo"    
                            autoplay
                            muted
                            playsinLine
                            class="w-full h-full object-cover transform"
                        />

                        <!-- remote lable -->
                        <div class="absolute bottom-1 left-1 bg-black bg-opacity-50 px-1 py-0.5 rounded text-xs text-white">
                            {{ props.contactName }}
                        </div>
                    </div>

                    <!-- local video (sebelah kanan) -->
                    <div class="flex-1 relative border-1 border-gray-600">
                        <Video
                            ref="localVideo"
                            autoplay
                            muted
                            playsinLine
                            class="w-full h-full object-cover transform scale-x-[-1]"
                        />

                        <!-- local video overlay jika camera disabled -->
                        <div v-if="!isCameraOn"
                                class="absolute inset-0 bg-gray-800 flex items-center justify-center">
                            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                You
                            </div>
                        </div>

                        <!-- local label -->
                        <div class="absolute bottom-1 right-1 bg-black bg-opacity-50 px-1 py-0.5 rounded text-xs text-white">
                            You
                        </div>
                    </div>
                 </div>
            </div>

            <!-- Status Ended -->
            <div
                v-else-if="status === 'ended'"
                class="flex-1 flex items-center justify-center p-4"
            >
                <p class="text-white text-lg">☎️ Panggilan Berakhir</p>
            </div>

            <!-- Controls - Sembunyi ketika dikecilkan -->
            <div
                v-if="status === 'connected' && !isMinimized"
                class="border-t border-gray-700 flex-shrink-0 flex justify-center items-center bg-gray-800"
                :class="controlsClass"
            >
                <!-- Mic -->
                <button
                    @click="toggleMute"
                    :class="[
                        'rounded-full text-white transition-all duration-200 transform hover:scale-110',
                        'p-2 sm:p-3',
                        isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                    ]"
                >
                    <Mic class="w-5 h-5 sm:w-6 sm:h-6"/>
                </button>

                <!-- Camera -->
                <button
                    @click="toggleCamera"
                    :class="[
                        'rounded-full text-white transition-all duration-200 transform hover:scale-110',
                        'p-2 sm:p-3',
                        !isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                    ]"
                >
                    <Camera class="w-5 h-5 sm:w-6 sm:h-6"/>
                </button>

                <!-- End Call -->
                <button
                    @click="() => { console.log('☎️ Tombol panggilan diakhiri ditekan'); $emit('end'); }"
                    class="p-2 sm:p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 transform hover:scale-110"
                >
                    <PhoneOff class="w-5 h-5 sm:w-6 sm:h-6"/>
                </button>
            </div>
        </div>
    </div>
</template>