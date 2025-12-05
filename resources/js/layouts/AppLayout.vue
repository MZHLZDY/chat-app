<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { onMounted, computed, ref, watch } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import { useContacts } from '@/composables/useContacts';
import AppSidebarLayout from '@/layouts/app/AppSidebarLayout.vue';
import { PhoneCall, PhoneOff, PhoneMissed } from 'lucide-vue-next';
import IncomingCallModal from '@/pages/IncomingCallModal.vue';
import VoiceCallPersonal from '@/pages/VoiceCallPersonal.vue';
import VoiceCallGroup from '@/pages/VoiceCallGroup.vue';
import MinimizeCallWidget from '@/pages/MinimizeCallWidget.vue';
import { usePersonalCall } from '@/composables/usePersonalCall';
import { useGroupCall } from '@/composables/useGroupCall';
import { useCallNotification } from '@/composables/useCallNotification';
// import type { User, } from '@/types';
import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
import type { BreadcrumbItem, AppPageProps, User } from '@/types';

interface Props {
    breadcrumbs?: BreadcrumbItem[];
}

interface UserPresence {
    id: number;
    name: string;
    profile_photo_url: string;
}

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});

const page = usePage<AppPageProps>();
const currentUserId = computed(() => page.props.auth?.user?.id ?? null);
const currentUserName = computed(() => page.props.auth.user.name);
const isCallMinimized = ref(false);
const callDuration = ref(0);
let callTimer: ReturnType<typeof setTimeout> | null = null;

// --- STATE UNTUK NOTIFIKASI VOICE CALL ---
const { requestPermission, setupListeners } = useCallNotification();

// --- STATE UNTUK PANGGILAN VIDEO PERSONAL ---
const incomingCall = ref<{ from: User } | null>(null);
const callStatus = ref<'idle' | 'ringing' | 'connected' | 'rejected'>('idle');

const receiveIncomingCall = (from: User) => {
    incomingCall.value = { from };
    callStatus.value = 'ringing';
};

const acceptIncomingCall = () => {
    callStatus.value = 'connected';
    incomingCall.value = null;
};

const rejectIncomingCall = () => {
    callStatus.value = 'rejected';
    incomingCall.value = null;
    setTimeout(() => (callStatus.value = 'idle'), 2000);
};

const handleSwitchToVideo = () => {
  if (!activeCallData.value) return;

  console.log('🔄 Memulai proses beralih ke panggilan video...');

  // 1. Dapatkan informasi kontak dari panggilan suara yang sedang aktif
  const contactToCall = activeCallData.value.isCaller
    ? activeCallData.value.callee
    : activeCallData.value.caller;

  // 2. Akhiri panggilan suara saat ini
  endVoiceCallWithReason('Beralih ke panggilan video');

  // 3. Kirim event global yang bisa didengar oleh Chat.vue
  if (contactToCall) {
    window.dispatchEvent(new CustomEvent('start-video-call-request', {
      detail: { contact: contactToCall }
    }));
  }
};

// --- COMPOSABLES ---
const {
    groupVoiceCallData,
    isGroupVoiceCallActive,
    isGroupCaller,
    groupCallTimeoutCountdown,
    startGroupVoiceCall,
    acceptGroupCall,
    rejectGroupCall,
    endGroupCall,
    cancelGroupCall,
    handleLeaveGroupCall,
    handleRecallParticipant,
    initializeGlobalListeners
} = useGroupCall();

const {
    isInVoiceCall,
    localAudioTrack,
    remoteAudioTrack,
    incomingCallVoice,
    outgoingCallVoice,
    activeCallData,
    callTimeoutCountdown,
    isMuted,
    toggleMute, 
    answerVoiceCall,
    endVoiceCallWithReason,
    initializePersonalCallListeners,
} = usePersonalCall();

const { loadContacts, updateUserInContacts } = useContacts();

// ✅ COMPUTED PROPERTIES YANG BENAR
const isAnyCallActive = computed(() => 
    isGroupVoiceCallActive.value || isInVoiceCall.value || 
    !!incomingCallVoice.value || !!outgoingCallVoice.value
);

const formattedCallDuration = computed(() => {
  const minutes = Math.floor(callDuration.value / 60);
  const seconds = callDuration.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

const isCallConnected = computed(() => {
    return groupVoiceCallData.value?.status === 'accepted' || 
           activeCallData.value?.status === 'connected';
});

const minimizedWidgetData = computed(() => {
    // Panggilan Grup
    if (isGroupVoiceCallActive.value) {
        // Untuk panggilan grup, gunakan foto grup atau fallback ke inisial/avatar default
        // Jika Anda memiliki foto grup (group.profile_photo_url), gunakan itu.
        const groupPhotoUrl = groupVoiceCallData.value?.group?.profile_photo_url;
        
        return {
            name: groupVoiceCallData.value?.group?.name || 'Panggilan Grup',
            duration: formattedCallDuration.value,
            // ✅ FIX GRUP: Gunakan foto grup jika ada
            profilePhotoUrl: groupPhotoUrl || null 
        };
    }
    
    // Panggilan Personal
    if (isInVoiceCall.value && activeCallData.value) {
        const contactData = activeCallData.value.isCaller
            // Jika Anda Caller, tampilkan foto Callee
            ? activeCallData.value.callee 
            // Jika Anda Callee, tampilkan foto Caller
            : activeCallData.value.caller;

        const contactName = contactData?.name;
        
        return {
            name: contactName || 'Panggilan Personal',
            duration: formattedCallDuration.value,
            // ✅ FIX PERSONAL: Ambil profile_photo_url dari contactData
            profilePhotoUrl: contactData?.profile_photo_url || null
        };
    }
    
    // Default / Tidak ada panggilan
    return { name: 'Panggilan', duration: '', profilePhotoUrl: null };
});

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 👇 TAMBAHKAN FUNGSI UTAMA UNTUK SUBSCRIBE
const requestPermissionAndSubscribe = async () => {
    // 1. Minta izin notifikasi
    const permissionGranted = await requestPermission();
    if (!permissionGranted) {
        console.warn('⚠️ Izin notifikasi tidak diberikan oleh pengguna.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        // 2. Jika belum ada subscription, buat baru
        if (!subscription) {
            const vapidPublicKey = page.props.vapid_public_key as string;
            if (!vapidPublicKey) {
                console.error('❌ VAPID Public Key tidak ditemukan!');
                return;
            }

            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });
        }
        
        // 3. Kirim subscription ke backend untuk disimpan
        console.log('📦 Mengirim subscription ke server...');
        await axios.post('/push-subscriptions/store', subscription);

        console.log('✅ Berhasil subscribe ke push notification.');

    } catch (error) {
        console.error('❌ Gagal subscribe ke push notification:', error);
    }
};

// ✅ FUNGSI TIMER
const startCallTimer = () => {
  if (callTimer) clearInterval(callTimer);
  callDuration.value = 0;
  callTimer = setInterval(() => {
    callDuration.value++;
  }, 1000);
};

const stopCallTimer = () => {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
  callDuration.value = 0;
};

// ✅ HANDLE MUTE TOGGLED - FUNGSI BARU
const handleMuteToggled = async () => {
  await toggleMute();
};

// ✅ FUNGSI MINIMIZE/EXPAND/END CALL
const handleMinimizeCall = () => {
  isCallMinimized.value = true;
};

const handleExpandCall = () => {
  isCallMinimized.value = false;
};

const handleEndCallFromWidget = () => {
  if (isGroupVoiceCallActive.value) {
    // ✅ PERBAIKAN: Berikan callId yang diperlukan
    const callId = groupVoiceCallData.value?.callId;
    if (callId) {
      isGroupCaller.value ? endGroupCall(callId) : handleLeaveGroupCall();
    }
  } else if (isInVoiceCall.value) {
    endVoiceCallWithReason('Diakhiri dari widget');
  }
  isCallMinimized.value = false;
};

// ✅ WATCHERS YANG BENAR
watch(isCallConnected, (isConnected) => {
  if (isConnected) {
    startCallTimer();
  }
});

watch(isAnyCallActive, (isActive) => {
    if (!isActive) {
        stopCallTimer();
    }
});

onMounted(() => {
    initializeGlobalListeners();
    initializePersonalCallListeners();
    setupListeners();
    requestPermissionAndSubscribe();
    loadContacts();
    echo.join('users')
      .here((users: UserPresence[]) => {
      console.log('Saat ini online:', users);
    })
    .joining((user: UserPresence) => {
      console.log(user.name, 'bergabung.');
    })
    .leaving((user: UserPresence) => {
      console.log(user.name, 'keluar.');
    })
    .listen('.UserProfileUpdated', (event: any) => {
        const updatedUser = event.user;
        updateUserInContacts(updatedUser);
    })
      .error((error: any) => {
          console.error('Terjadi error pada Echo channel "users":', error);
      });
    
    // Handle notification actions
    window.addEventListener('call-notification-action', (event: any) => {
        const { callId, action, callType } = event.detail;
        
        if (action === 'accept') {
            if (callType === 'personal') {
                // Handle personal call accept
            } else {
                // Handle group call accept
            }
        } else if (action === 'reject') {
            // Handle reject call logic
        }
    });

    // Inisialisasi listener untuk Panggilan Video Personal
    if (!currentUserId.value) return;
    echo.private(`call.${currentUserId.value}`)
        .listen('.IncomingCall', (payload: any) => {
            if (payload.callType === 'voice') {
                return; 
            }
            receiveIncomingCall(payload.from);
        });
});
</script>

<template>
    <AppSidebarLayout :breadcrumbs="breadcrumbs">
        <slot />
    </AppSidebarLayout>

    <IncomingCallModal
        :show="!!incomingCall"
        :callerName="incomingCall?.from.name"
        @accept="acceptIncomingCall"
        @reject="rejectIncomingCall"
    />

    <!-- ✅ KONDISI YANG BENAR UNTUK RENDER CALL COMPONENTS -->
    <div v-if="isAnyCallActive">
        <MinimizeCallWidget
            v-if="isCallMinimized"
            :name="minimizedWidgetData.name"
            :duration="minimizedWidgetData.duration"
            :profile-photo-url="minimizedWidgetData.profilePhotoUrl"
            @expand-call="handleExpandCall"
            @end-call="handleEndCallFromWidget"
        />

        <template v-else>
            <!-- GROUP CALL -->
            <VoiceCallGroup
                v-if="isGroupVoiceCallActive"
                :is-visible="isGroupVoiceCallActive"
                :formatted-duration="formattedCallDuration" 
                :group-call-data="groupVoiceCallData"
                :is-caller="isGroupCaller"
                :current-user-id="currentUserId"
                :calltimeoutcountdown="groupCallTimeoutCountdown"
                @accept-call="acceptGroupCall"
                @reject-call="rejectGroupCall"
                @end-call="endGroupCall"
                @cancel-call="cancelGroupCall"
                @leave-call="handleLeaveGroupCall"
                @recall-participant="handleRecallParticipant"
                @minimize-call="handleMinimizeCall"  
            />

            <!-- PERSONAL CALL -->
            <VoiceCallPersonal
              v-if="isInVoiceCall && activeCallData"
              :is-visible="isInVoiceCall"
              :formatted-duration="formattedCallDuration" 
              :call-data="activeCallData"
              :local-audio-track="localAudioTrack"
              :remote-audio-track="remoteAudioTrack"
              :is-muted="isMuted"
              @answer-call="answerVoiceCall"
              @mute-toggled="handleMuteToggled"
              @end-call="endVoiceCallWithReason"
              @minimize-call="handleMinimizeCall"
              @switch-to-video="handleSwitchToVideo"
            />
        </template>
    </div>

    <!-- ✅ INCOMING CALL MODAL UNTUK PERSONAL CALL -->
    <div v-if="incomingCallVoice" class="fixed inset-0 bg-white bg-opacity-70 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div class="w-full h-full bg-gradient-to-br from-white-200/90 to-blue-500/90 text-black dark:from-gray-900/90 dark:to-blue-900/90 dark:text-white shadow-2xl flex flex-col items-center justify-between p-6 transition-all duration-300 md:rounded-none rounded-[2rem] md:max-w-full md:max-h-full max-w-sm max-h-[85vh]">
            
            <div class="flex flex-col items-center mt-10">
                <div class="w-36 h-36 rounded-full mb-4 ring-4 ring-white/30 flex items-center justify-center text-white text-3xl overflow-hidden shadow-lg">
                    <img 
                        v-if="incomingCallVoice.caller?.profile_photo_url" 
                        :src="incomingCallVoice.caller.profile_photo_url" 
                        :alt="incomingCallVoice.caller?.name" 
                        class="w-full h-full object-cover"
                    >
                    <div v-else class="w-full h-full bg-blue-500/80 flex items-center justify-center font-bold">
                        {{ incomingCallVoice.caller?.name?.charAt(0).toUpperCase() || '?' }}
                    </div>
                </div>
                <h1 class="text-3xl font-extrabold text-white text-shadow-lg mb-1">
                    {{ incomingCallVoice.caller?.name || 'Unknown' }}
                </h1>
                <p class="text-white text-shadow-lg font-bold mb-7">Panggilan Suara Masuk</p>
                <div v-if="callTimeoutCountdown !== null" class="text-yellow-400 font-semibold mb-2 animate-pulse text-sm">
                    Berakhir dalam {{ callTimeoutCountdown }} detik
                </div>
            </div>

            <div class="w-full flex justify-around mb-8 max-w-xs">
                <div class="flex flex-col items-center">
                    <button 
                      @click="answerVoiceCall(false, 'Ditolak')"
                      class="bg-red-500 text-white p-4 rounded-full shadow-xl hover:bg-red-600 transition-transform transform hover:scale-105"
                      aria-label="Tolak Panggilan"
                    >
                      <PhoneOff class="w-8 h-8"/>
                    </button>
                    <span class="mt-2 text-sm text-shadow-lg font-medium text-white">Tolak</span>
                </div>
                
                <div class="flex flex-col items-center">
                    <button 
                        @click="answerVoiceCall(true)"
                        class="bg-green-500 text-white p-4 rounded-full shadow-xl hover:bg-green-600 transition-transform transform hover:scale-105"
                        aria-label="Terima Panggilan"
                    >
                        <PhoneCall class="w-8 h-8"/>
                    </button>
                    <span class="mt-2 text-sm text-shadow-lg font-medium text-white">Terima</span>
                </div>
            </div>
            
        </div>
    </div>

    <!-- ✅ OUTGOING CALL MODAL UNTUK PERSONAL CALL -->
    <div v-if="outgoingCallVoice && outgoingCallVoice.status === 'calling'" class="fixed inset-0 bg-white bg-opacity-70 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div class="w-full h-full bg-gradient-to-br from-white-200/90 to-blue-500/90 text-black dark:from-gray-900/90 dark:to-blue-900/90 dark:text-white shadow-2xl flex flex-col items-center justify-between p-6 transition-all duration-300 md:rounded-none rounded-[2rem] md:max-w-full md:max-h-full max-w-sm max-h-[85vh]">
            <div class="flex flex-col items-center mt-10">
                <div class="w-36 h-36 rounded-full mb-4 ring-4 ring-white/30 flex items-center justify-center text-white text-3xl overflow-hidden shadow-lg">
                    <img 
                        v-if="outgoingCallVoice.callee?.profile_photo_url" 
                        :src="outgoingCallVoice.callee.profile_photo_url" 
                        :alt="outgoingCallVoice.callee.name" 
                        class="w-full h-full object-cover"
                    >
                    <div v-else class="w-full h-full bg-blue-500/80 flex items-center justify-center font-bold">
                        {{ outgoingCallVoice.callee?.name?.charAt(0).toUpperCase() || '?' }}
                    </div>
                </div>
                <h1 class="text-3xl font-extrabold text-white text-shadow-lg mb-1">
                    {{ outgoingCallVoice.callee?.name || 'Unknown' }}
                </h1>
                <p class="text-white font-bold text-shadow-lg mb-7">Panggilan Suara</p>

                <div v-if="callTimeoutCountdown !== null" class="text-yellow-300 font-bold mb-4 animate-pulse text-sm text-shadow-lg">
                    Berakhir dalam {{ callTimeoutCountdown }} detik
                </div>

                <div class="animate-pulse text-white text-shadow-lg mb-4 text-xl font-medium">Memanggil...</div>
            </div>

            <div class="w-full flex justify-center mb-8 max-w-xs">
                <div class="flex flex-col items-center">
                    <button 
                        @click="endVoiceCallWithReason('Dibatalkan')"
                        class="bg-red-500 text-white p-4 rounded-full shadow-xl hover:bg-red-600 transition-transform transform hover:scale-105"
                        aria-label="Batalkan Panggilan"
                    >
                        <PhoneMissed class="w-8 h-8"/>
                    </button>
                    <span class="mt-2 text-sm font-medium text-white">Batalkan</span>
                </div>
            </div>
        </div>
    </div>

    <div v-else-if="outgoingCallVoice && outgoingCallVoice.status === 'calling'" class="fixed inset-0 bg-white bg-opacity-70 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div class="w-full h-full bg-gradient-to-br from-white-200/90 to-blue-500/90 text-black dark:from-gray-900/90 dark:to-blue-900/90 dark:text-white shadow-2xl flex flex-col items-center justify-between p-6 transition-all duration-300 md:rounded-none rounded-[2rem] md:max-w-full md:max-h-full max-w-sm max-h-[85vh]">
            <div class="flex flex-col items-center mt-10">
                <div class="w-24 h-24 rounded-full mb-4 ring-4 ring-white/30 flex items-center justify-center text-white text-3xl font-bold bg-blue-500/80 shadow-lg">
                    ?
                </div>
                <h1 class="text-3xl font-extrabold text-white text-shadow-lg mb-1">Unknown</h1>
                <p class="text-white font-bold text-shadow-lg mb-7">Panggilan Suara</p>

                <div v-if="callTimeoutCountdown !== null" class="text-yellow-200 font-bold text-shadow-lg mb-2 animate-pulse text-sm">
                    Berakhir dalam {{ callTimeoutCountdown }} detik
                </div>

                <div class="animate-pulse text-blue-400 text-shadow-lg mb-4 text-xl font-medium">Memanggil...</div>
            </div>

            <div class="w-full flex justify-center mb-8 max-w-xs">
                <div class="flex flex-col items-center">
                    <button 
                        @click="endVoiceCallWithReason('Dibatalkan')"
                        class="bg-red-500 text-white p-4 rounded-full shadow-xl hover:bg-red-600 transition-transform transform hover:scale-105"
                        aria-label="Batalkan Panggilan"
                    >
                        <PhoneMissed class="w-8 h-8"/>
                    </button>
                    <span class="mt-2 text-sm text-shadow-lg font-medium text-gray-200">Batalkan</span>
                </div>
            </div>
        </div>
    </div>

<!-- ✅ FALLBACK UI JIKA DATA TIDAK LENGKAP -->
<div v-else-if="outgoingCallVoice && outgoingCallVoice.status === 'calling'" 
     class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-96 text-center">
        <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
            ?
        </div>

        <p class="text-gray-600 mb-4">Menghubungi...</p>
        <h3 class="font-bold mb-2 text-black">Panggilan Suara</h3>

        <div v-if="callTimeoutCountdown !== null" class="text-red-500 font-semibold mb-2 animate-pulse">
            Berakhir dalam {{ callTimeoutCountdown }} detik
        </div>

        <div class="animate-pulse text-blue-500 mb-4">Berdering...</div>

        <button 
            @click="endVoiceCallWithReason('Dibatalkan')"
            class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600"
        >
            <PhoneMissed class="w-7 h-7"/>
        </button>
    </div>
</div>
</template>