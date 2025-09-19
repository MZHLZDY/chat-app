<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { onMounted, computed, ref } from 'vue';
import AppSidebarLayout from '@/layouts/app/AppSidebarLayout.vue';
import { PhoneCall, PhoneOff, PhoneMissed } from 'lucide-vue-next';
import IncomingCallModal from '@/pages/IncomingCallModal.vue';
import type { User } from '@/types';
import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
import type { BreadcrumbItem, AppPageProps } from '@/types';

interface Props {
    breadcrumbs?: BreadcrumbItem[];
}

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});

const page = usePage<AppPageProps>();
const currentUserId = computed(() => page.props.auth?.user?.id ?? null);
const currentUserName = computed(() => page.props.auth.user.name);


// --- STATE UNTUK PANGGILAN VIDEO PERSONAL (DARI TEMAN ANDA) ---
const incomingCall = ref<{ from: User } | null>(null);
const callStatus = ref<'idle' | 'ringing' | 'connected' | 'rejected'>('idle');

const receiveIncomingCall = (from: User) => {
    incomingCall.value = { from };
    callStatus.value = 'ringing';
};

const acceptIncomingCall = () => {
    callStatus.value = 'connected';
    incomingCall.value = null;
    // TODO: Buka UI video call di sini
};

const rejectIncomingCall = () => {
    callStatus.value = 'rejected';
    incomingCall.value = null;
    setTimeout(() => (callStatus.value = 'idle'), 2000);
};


// --- STATE UNTUK PANGGILAN SUARA GRUP (DARI COMPOSABLE) ---
const {
  isGroupVoiceCallActive,
  groupVoiceCallData,
  isGroupCaller,
  groupCallTimeoutCountdown,
  acceptGroupCall,
  rejectGroupCall,
  endGroupCall,
  cancelGroupCall,
  handleLeaveGroupCall,
  handleRecallParticipant,
  initializeGlobalListeners
} = useGroupCall();

const {
    isInVoiceCall, localAudioTrack, remoteAudioTrack, incomingCallVoice,
    outgoingCallVoice, activeCallData, answerVoiceCall, endVoiceCallWithReason,
    initializePersonalCallListeners, callTimeoutCountdown
} = usePersonalCall();


// --- GABUNGAN onMounted HOOK ---
onMounted(() => {
    // Inisialisasi listener untuk Panggilan Suara Grup
    initializeGlobalListeners();
    initializePersonalCallListeners();

    // Inisialisasi listener untuk Panggilan Video Personal
    if (!currentUserId.value) return;
    echo.private(`call.${currentUserId.value}`)
        .listen('.IncomingCall', (payload: any) => {
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

    <VoiceCallGroup
     v-if="isGroupVoiceCallActive"
     :is-visible="isGroupVoiceCallActive"
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
    />

    <div v-if="incomingCallVoice" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white rounded-lg p-6 w-96 text-center">
                <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
                  {{ incomingCallVoice.caller?.name?.charAt(0).toUpperCase() || '?' }}
                </div>
                <h3 class="text-xl font-bold mb-2">Panggilan {{ incomingCallVoice.callType === 'video' ? 'Video' : 'Suara' }}</h3>
                <p class="text-gray-600 mb-4">{{ incomingCallVoice.caller?.name || 'Unknown' }} sedang menelpon Anda</p>
    
                <div class="flex justify-center gap-4">
                  <button @click="answerVoiceCall(false, 'Ditolak')"
                   class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
                   <PhoneOff class="w-7 h-7"/>
                  </button>
                  <button @click="answerVoiceCall(true)"
                   class="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600">
                   <PhoneCall class="w-7 h-7"/>
                 </button>
               </div>
             </div>
           </div>

<div v-if="outgoingCallVoice && outgoingCallVoice.status === 'calling'" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white rounded-lg p-6 w-96 text-center">
                <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
                 {{ outgoingCallVoice.callee.name.charAt(0).toUpperCase() }}
                </div>

                 <p class="text-gray-600 mb-4">{{ outgoingCallVoice.callee.name }}</p>
                 <h3 class="text-xl font-bold mb-2">Panggilan Suara</h3>

                 <!-- Countdown Timer -->
                <div v-if="callTimeoutCountdown !== null" class="text-red-500 font-semibold mb-2 animate-pulse">
                 Berakhir dalam {{ callTimeoutCountdown }} detik
                </div>

               <div class="animate-pulse text-blue-500 mb-4">Berdering...</div>

                <button @click="endVoiceCallWithReason('Dibatalkan')"
                  class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
                  <PhoneMissed class="w-7 h-7"/>
                </button>
            </div>
          </div>

<VoiceCallPersonal
 :is-visible="isInVoiceCall"
 :call-data="activeCallData"
 :local-audio-track="localAudioTrack"
 :remote-audio-track="remoteAudioTrack"
 @end-call="endVoiceCallWithReason"
 @mute-toggled="(isMuted: boolean) => localAudioTrack && localAudioTrack.setEnabled(!isMuted)"
/>
</template>