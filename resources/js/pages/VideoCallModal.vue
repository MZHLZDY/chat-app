<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, watch} from 'vue';
import { defineProps, defineEmits } from 'vue';
import { Mic, Camera, PhoneOff, Minimize2, Maximize2, MicOff, CameraOff} from 'lucide-vue-next';
import type { CallStatus, Participants } from '@/types/CallStatus';

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const remoteVideos = ref<{ [key: number]: HTMLVideoElement | null }>({});
const localStream = ref<MediaStream | null>(null);
const remoteStream = ref<MediaStream | null>(null);

// state untuk kontrol video / audio
const isVideoEnabled = ref(true);
const isAudioEnabled = ref(true);
const isFullscreen = ref(false);

// state untuk dragging
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const position = ref({ x: window.innerWidth - 340, y: window.innerHeight - 240 });

// state untuk minimize
const isMinimized = ref(false);

let peerConnection: RTCPeerConnection | null = null;

// State toggle mic & camera
const isMuted = ref(false);
const isCameraOn = ref(true);

const props = defineProps<{
    show: boolean;
    contactName?: string;
    status?: string;
    isGroup?: boolean;
    groupName?: string;
    participants?: any[];
}>();

const emit = defineEmits<{
    (e: "accept"): void;
    (e: "reject"): void;
    (e: "end"): void;
    (e: "minimize"): void;
}>();

// computed untuk grid layout berdasarkan jumlah peserta
const gridCols = computed(() => {
    if (!props.isGroup || !props.participants) return 'grid-cols-1';
    const count = props.participants.filter(p => p.status !== 'accepted').length + 1;
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
});

const acceptedParticipants = computed(() => {
    if (!props.isGroup || !props.participants) return [];
    return props.participants.filter(p => p.status === 'accepted');
});

// Get initials untuk avatar
const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// function untuk minimize / maximize
const toggleMinimize = () => {
    isMinimized.value = !isMinimized.value;
    console.log('⬇️ Video call diminimalkan:', isMinimized.value);

    // reset position ketika maximize
    if (!isMinimized.value) {
        position.value = { x: 0, y: 0 };
    } else {
        // set default position ketika minimize
        position.value = { x: window.innerWidth - 340, y: window.innerHeight - 240 };
    }
};

// fungsi dragging
const startDrag = (event: MouseEvent) => {
    if (!isMinimized.value) return;
    
    isDragging.value = true;
    dragOffset.value = {
        x: event.clientX - position.value.x,
        y: event.clientY - position.value.y
    };

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
};

const onDrag = (event: MouseEvent) => {
    if (!isDragging.value) return;

    const newX = event.clientX - dragOffset.value.x;
    const newY = event.clientY - dragOffset.value.y;

    // boundary constraints
    const maxX = window.innerWidth - 320; // lebar floating window
    const maxY = window.innerHeight - 220; // tinggi floating window

    position.value = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
    };
};

const stopDrag = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

const handleAccept = () => {emit("accept");};
const handleReject = () => {emit("reject");};
const handleEnd = () => {emit("end");};

onMounted(async () => {
    if (props.status === "connected" && localVideo.value) {
        try {
            console.log('📹 Meminta akses kamera dan mikrofon...');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });

            localStream.value = stream;

            if (localVideo.value) {
                localVideo.value.srcObject = stream;
                console.log('✅ Akses kamera dan mikrofon diberikan.');
            }

            return stream;
        } catch (err) {
            console.error("❌ Gagal mendapatkan akses media devices:", err);
            alert("Gagal mendapatkan akses kamera dan mikrofon. Silakan periksa pengaturan perangkat Anda.");
            throw err;
        }
    }
});

// fungsi untuk mendapatkan user media
const getUserMedia = async () => {
    try {
        console.log('📹 Meminta akses kamera dan mikrofon...');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });

        localStream.value = stream;
        if (localVideo.value) {
            localVideo.value.srcObject = stream;
            console.log('✅ Local media stream berhasil didapatkan');
        }

        return stream;
    } catch (error) {
        console.error('❌ Gagal mendapatkan media stream:', error);
        alert('Gagal mendapatkan akses kamera dan mikrofon. Silakan periksa pengaturan perangkat Anda.'); 
        throw error;
    }
};

// toggle video on/off
const toggleVideo = () => {
    if (localStream.value) {
        const videoTrack = localStream.value.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isCameraOn.value = videoTrack.enabled;
            isVideoEnabled.value = videoTrack.enabled;
            console.log('📹 Camera Toggled:', isCameraOn.value);
        }
    }
};

// toggle audio on/off
const toggleAudio = () => {
    if (localStream.value) {
        const audioTrack = localStream.value.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMuted.value = !audioTrack.enabled;
            isAudioEnabled.value = audioTrack.enabled;
            console.log('🎤 Mic toggled:', !isMuted.value);
        }
    }
};

// toggle fullscreen
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
};

// simulate remote video (untuk testing, nanti diganti dengan RTC biar realtime)
const simulateRemoteVideo = async () => {
    try {
        console.log('📹 Mensimulasikan remote video...');

        if (remoteVideo.value && localStream.value) {
            remoteVideo.value.srcObject = localStream.value;
            remoteStream.value = localStream.value;
            console.log('✅ Remote video berhasil disimulasikan.');
        }
    } catch (error) {
        console.error('❌ Gagal mensimulasikan remote video:', error);
    }
};

onMounted(async () => {
    try {
        console.log('🚀 VideoCallModal mounted, status:', props.status);

        // dapatkan user media saat modal dibuka
        await getUserMedia();
        
        // inisialisai webRTC jika status connected
        if (props.status === 'connected') {
            console.log('✅ Status connected, simulating remote...');

            // inisialisasi webRTC (buat nanti waktu pake agora)
            peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            if (localStream.value) {
                localStream.value.getTracks().forEach(track => {
                    peerConnection?.addTrack(track, localStream.value!);
                });
            }

            peerConnection.ontrack = (event) => {
                if (remoteVideo.value) {
                    remoteVideo.value.srcObject = event.streams[0];
                    remoteStream.value = event.streams[0];
                }
            };
        }

        // simulate remote video untuk demo / testing
        setTimeout(() => {
            simulateRemoteVideo();
        }, 1000);

        // tambahkan listener resize
        window.addEventListener('resize', handleResize);

    } catch (error) {
        console.error('❌ Error dalam onMounted:', error);
    }
});

onUnmounted(() => {
    console.log('🔴 VideoCallModal unmounted');

    // cleanup media streams
    if (localStream.value) {
        localStream.value.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Local media track stopped:', track.kind);
        });
    }
    if (remoteStream.value) {
        remoteStream.value.getTracks().forEach(track => track.stop());
    }

    // cleanup webRTC
    if (peerConnection) {
        peerConnection.close();
    }

    // cleanup drag listeners
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);

    // remove rezise listener
    window.removeEventListener('resize', handleResize);
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
const localVideoClass = computed(() => {
    const isLargeScreen = windowWidth.value >= 1200;
    const isMediumScreen = windowWidth.value >= 768;

    if (isLargeScreen) {
        return 'w-64 h-48'; // lebih besar untuk layar besar
    } else if (isMediumScreen) {
        return 'w-48 h-36'; // ukuran sedang
    } else {
        return 'w-32 h-24'; // ukuran kecil untuk mobile
    }
});

const controlsClass = computed(() => {
    const isLargeScreen = windowWidth.value >= 1200;
    
    return {
        'gap-6 px-8 py-6': isLargeScreen,
        'gap-4 px-6 py-4': !isLargeScreen
    };
});

// computed style untuk floating position
const floatingStyle = computed(() => {
    if (!isMinimized.value) return {};

    return {
        transform: `translate(${position.value.x}px, ${position.value.y}px)`,
        cursor: isDragging.value ? 'grabbing' : 'grab'
    };
})

// HANDLE WINDOW RESIZE
const handleResize = () => {
    windowWidth.value = window.innerWidth;
    windowHeight.value = window.innerHeight;

    // atur posisi jika keluar batas setelah resize
    if (isMinimized.value) {
        const maxX = window.innerWidth - 320;
        const maxY = window.innerHeight - 220;

        position.value = {
            x: Math.max(0, Math.min(position.value.x, maxX)),
            y: Math.max(0, Math.min(position.value.y, maxY))
        }
    }
};

// Cleanup stream ketika modal ditutup
watch(
    () => props.show,
    (val) => {
        if (!val) {
            console.log('🔴 Video call modal ditutup, membersihkan resources...');

            // Stop semua track
            if (localStream.value) {
                localStream.value.getTracks().forEach((track) => track.stop());
            }
            if (remoteStream.value) {
                remoteStream.value.getTracks().forEach((track) => track.stop());
            }

            // tutup koneksi RTC
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }

            // reset states
            isMuted.value = false;
            isCameraOn.value = true;
            isMinimized.value = false;

            // reset position
            position.value = { x: window.innerWidth - 340, y: window.innerHeight - 240 };
        }
    }
);

// watch status untuk auto stimulate remote saat connected
watch(
    () => props.status,
    async (newStatus) => {
        console.log('📡 Status changed to:', newStatus);
        
        if (newStatus === 'connected' && !remoteStream.value) {
            setTimeout(() => {
                simulateRemoteVideo();
            }, 500);
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
                ? 'w-80 h-56 rounded-xl shadow-2xl border border-gray-600'
                : 'inset-0 bg-black bg-opacity-90 flex items-center justify-center',
        ]"
        :style="floatingStyle"
        @mousedown="startDrag"
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
                        :class="isMinimized ? 'w-6 h-6 text-xs' : 'w-8 h-8 sm:w-10 sm:h-10 text-sm sm:text-lg'"    
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

                <div class="flex gap-1">
                    <!-- kontrol waktu minimize -->
                    <div v-if="isMinimized" class="flex gap-1">
                        <!-- kontrol mic untuk floating -->
                        <button
                            @click.stop="toggleAudio"
                            :class="[
                                'rounded p-1 text-white transition-colors',
                                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                            ]"
                        >
                            <MicOff v-if="isMuted" class="w-3 h-3"/>
                            <Mic v-else class="w-3 h-3"/>
                        </button>

                        <!-- kontrol kamera untuk floating -->
                        <button
                            @click.stop="toggleVideo"
                            :class="[
                                'rounded p-1 text-white transition-colors',
                                !isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                            ]"
                        >
                            <CameraOff v-if="!isCameraOn" class="w-3 h-3"/>
                            <Camera v-else class="w-3 h-3"/>
                        </button>

                        <!-- end call waktu floating -->
                        <button
                            @click.stop="() => { console.log('☎️ Tombol panggilan diakhiri ditekan'); $emit('end'); }"
                            class="rounded p-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                            <PhoneOff class="w-3 h-3"/>
                        </button>
                    </div>
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
            <div v-else-if="status === 'connected' && !props.isGroup" class="flex-1 relative bg-black min-h-0">
                
                <!-- layout full screen -->
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
                                {{ (props.contactName || 'You').charAt(0).toUpperCase() }}
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
                            playsinline
                            class="w-full h-full object-cover"
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

            <!-- Status Connected - GROUP VIDEO CALL -->
            <div v-else-if="status === 'connected' && props.isGroup" class="flex-1 relative bg-black min-h-0 p-4">
                <div :class="['grid gap-2 h-full', gridCols]">
                    <!-- Local Video (diri sendiri) -->
                    <div class="relative bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                        <video
                            ref="localVideo"
                            autoplay
                            muted
                            playsinline
                            class="w-full h-full object-cover"
                        ></video>

                        <div class="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-10">
                            You
                        </div>

                        <div v-if="isMuted" class="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full z-10">
                            <MicOff class="w-4 h-4"/>
                        </div>
                    </div>

                    <!-- Remote Participants -->
                    <div
                        v-for="participant in acceptedParticipants"
                        :key="participant.id"
                        class="relative bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center"
                    >
                        <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                            <div class="w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white text-2xl font-bold mb-2">
                                {{ getInitials(participant.name) }}
                            </div>
                            <p class="text-white font-semibold text-sm">{{ participant.name }}</p>
                        </div>

                        <div class="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-10">
                            {{ participant.name }}
                        </div>

                        <div class="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse z-10"></div>
                    </div>

                    <!-- Menunggu partisipan -->
                    <div
                        v-for="participant in participants?.filter(p => p.status === 'calling')"
                        :key="'waiting-' + participant.id"
                        class="relative bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center opacity-50"
                    >
                        <div class="flex flex-col items-center justify-center text-gray-400">
                            <div class="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-white text-lg font-bold mb-2">
                                {{ getInitials(participant.name) }}
                            </div>
                            <p class="text-sm">{{ participant.name }}</p>
                            <p class="text-xs mt-1">Memanggil...</p>
                        </div>
                    </div>
                </div>
                <!-- Demo badge for group video call -->
                <div class="absolute top-8 right-8 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-20">
                    Demo Mode
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
                    @click="toggleAudio"
                    :class="[
                        'rounded-full text-white transition-all duration-200 transform hover:scale-110',
                        'p-2 sm:p-3',
                        isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                    ]"
                >
                    <MicOff v-if="isMuted" class="w-5 h-5 sm:w-6 sm:h-6"/>
                    <Mic v-else class="w-5 h-5 sm:w-6 sm:h-6"/>
                </button>

                <!-- Camera -->
                <button
                    @click="toggleVideo"
                    :class="[
                        'rounded-full text-white transition-all duration-200 transform hover:scale-110',
                        'p-2 sm:p-3',
                        !isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                    ]"
                >
                    <cameraOff v-if="!isCameraOn" class="w-5 h-5 sm:w-6 sm:h-6"/>
                    <Camera v-else class="w-5 h-5 sm:w-6 sm:h-6"/>
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