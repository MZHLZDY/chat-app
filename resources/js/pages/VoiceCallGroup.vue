<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  },
  groupCallData: {
    type: Object as () => {
      callId?: string;
      group?: {
        id: number;
        name: string;
      };
      caller?: {
        id: number;
        name: string;
      };
      callType?: 'voice' | 'video';
      channel?: string;
      status?: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended';
      reason?: string;
      participants?: Array<{
        id: number;
        name: string;
        status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended';
        reason?: string;
      }>;
    } | null,
    default: null
  },
  isCaller: {
    type: Boolean,
    default: false
  },
  currentUserId: {
    type: Number,
    required: true
  },
  currentUserName: {
    type: String,
    required: true
  },
  callTimeoutCountdown: {
    type: Number,
    default: null
  }
});

// Emits
const emit = defineEmits(['accept-call', 'reject-call', 'end-call', 'toggle-mute', 'toggle-speaker']);

// Local state
const isMuted = ref(false);
const isSpeakerOn = ref(true);
const callDuration = ref(0);
let callTimer: NodeJS.Timeout | null = null;

// Computed properties
const isIncomingCall = computed(() => !props.isCaller && props.groupCallData?.status === 'ringing');
const isOngoingCall = computed(() => props.groupCallData?.status === 'accepted');
const isOutgoingCall = computed(() => props.isCaller && props.groupCallData?.status === 'calling');
const isCallEnded = computed(() => props.groupCallData?.status === 'ended' || props.groupCallData?.status === 'rejected');

const callTitle = computed(() => {
  if (isIncomingCall.value) {
    return 'Panggilan Grup Masuk';
  } else if (isOngoingCall.value) {
    return 'Sedang Berbicara';
  } else if (isOutgoingCall.value) {
    return 'Memanggil Grup';
  } else if (isCallEnded.value) {
    return 'Panggilan Selesai';
  } else {
    return 'Panggilan Grup';
  }
});

const callerName = computed(() => {
  return props.groupCallData?.caller?.name || 'Unknown';
});

const groupName = computed(() => {
  return props.groupCallData?.group?.name || 'Unknown Group';
});

const formattedCallDuration = computed(() => {
  const minutes = Math.floor(callDuration.value / 60);
  const seconds = callDuration.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

const participants = computed(() => {
  return props.groupCallData?.participants || [];
});

const acceptedParticipants = computed(() => {
  return participants.value.filter(p => p.status === 'accepted');
});

const rejectedParticipants = computed(() => {
  return participants.value.filter(p => p.status === 'rejected' || p.status === 'ended');
});

const ringingParticipants = computed(() => {
  return participants.value.filter(p => p.status === 'ringing' || p.status === 'calling');
});

// Methods
const acceptCall = () => {
  emit('accept-call', props.groupCallData?.callId);
};

const rejectCall = () => {
  emit('reject-call', props.groupCallData?.callId, 'diabaikan');
};

const endCall = () => {
  emit('end-call', props.groupCallData?.callId);
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  emit('toggle-mute', isMuted.value);
};

const toggleSpeaker = () => {
  isSpeakerOn.value = !isSpeakerOn.value;
  emit('toggle-speaker', isSpeakerOn.value);
};

// Watch for call status changes
watch(() => props.groupCallData?.status, (newStatus, oldStatus) => {
  console.log('Call status changed:', oldStatus, '->', newStatus);
  
  // Start timer when call is accepted
  if (newStatus === 'accepted' && oldStatus !== 'accepted') {
    if (callTimer) {
      clearInterval(callTimer);
    }
    callTimer = setInterval(() => {
      callDuration.value++;
    }, 1000);
  }
  
  // Stop timer when call ends
  if ((newStatus === 'ended' || newStatus === 'rejected') && callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
});

// Auto-close when call ends after 3 seconds
watch(() => props.groupCallData?.status, (newStatus) => {
  if (newStatus === 'ended' || newStatus === 'rejected') {
    setTimeout(() => {
      if (props.groupCallData?.status === 'ended' || props.groupCallData?.status === 'rejected') {
        emit('end-call', props.groupCallData?.callId);
      }
    }, 3000);
  }
});

// Start/stop call timer based on visibility and status
watch(() => props.isVisible, (newVal) => {
  if (newVal && isOngoingCall.value) {
    if (callTimer) {
      clearInterval(callTimer);
    }
    callTimer = setInterval(() => {
      callDuration.value++;
    }, 1000);
  } else if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
    callDuration.value = 0;
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (callTimer) {
    clearInterval(callTimer);
  }
});
</script>

<template>
  <div v-if="isVisible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-96 text-center">
      <!-- Countdown timer untuk outgoing call -->
      <div v-if="isOutgoingCall && callTimeoutCountdown !== null" 
           class="text-red-500 font-semibold mb-2 animate-pulse">
        Berakhir dalam {{ callTimeoutCountdown }} detik
      </div>

      <!-- Header dengan nama grup -->
      <div class="mb-4">
        <p class="text-gray-600 font-semibold">{{ callTitle }}</p>
      </div>

      <!-- Untuk panggilan masuk (incoming call) -->
      <div v-if="isIncomingCall" class="call-content">
        <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
          G
        </div>
        <h2 class="text-xl font-bold">{{ groupName }}</h2>
        <p class="text-gray-600 mb-2">{{ callerName }} mengundang Anda ke panggilan grup</p>
        
        <div class="flex justify-center gap-4 mt-6">
          <button @click="rejectCall" class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600">
            Abaikan
          </button>
          <button @click="acceptCall" class="bg-green-500 text-white p-3 rounded-full hover:bg-green-600">
            Gabung
          </button>
        </div>
      </div>
      
      <!-- Untuk panggilan berlangsung (ongoing call) -->
      <div v-else-if="isOngoingCall" class="call-content">
        <h2 class="text-xl font-bold">{{ groupName }}</h2>
        <div class="mb-4">
          <div class="text-2xl font-semibold">{{ formattedCallDuration }}</div>
          <p class="text-gray-600">Sedang berbicara dengan {{ acceptedParticipants.length }} orang</p>
        </div>
        
        <!-- Daftar peserta -->
        <div class="max-h-40 overflow-y-auto mb-4">
          <div v-for="participant in participants" :key="participant.id" 
               class="flex items-center justify-between p-2 border-b">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                {{ participant.name.charAt(0).toUpperCase() }}
              </div>
              <span class="text-sm">{{ participant.name }}</span>
              <span v-if="participant.id === currentUserId" class="ml-2 text-xs text-gray-500">(Anda)</span>
            </div>
            <div :class="{
              'text-green-500': participant.status === 'accepted',
              'text-yellow-500': participant.status === 'ringing' || participant.status === 'calling',
              'text-red-500': participant.status === 'rejected' || participant.status === 'ended'
            }" class="text-xs">
              {{ participant.status === 'accepted' ? '✓ Bergabung' : 
                 participant.status === 'ringing' ? '⌛ Berdering' : 
                 participant.status === 'calling' ? '⌛ Memanggil' :
                 participant.status === 'rejected' ? (participant.reason === 'diabaikan' ? '✗ Diabaikan' : '✗ Ditolak') : 
                 participant.status === 'ended' ? '☎ Selesai' : '❓ Unknown' }}
            </div>
          </div>
        </div>
        
        <!-- Tombol kontrol panggilan -->
        <div class="flex justify-center gap-4">
          <button @click="toggleMute" :class="['p-3 rounded-full', isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700']">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="isMuted" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path v-if="isMuted" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </button>
          
          <button @click="endCall" class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <button @click="toggleSpeaker" :class="['p-3 rounded-full', isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700']">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6a9 9 0 010 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Untuk panggilan keluar (outgoing call) -->
      <div v-else-if="isOutgoingCall" class="call-content">
        <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
          G
        </div>
        <h2 class="text-xl font-bold">{{ groupName }}</h2>
        <p class="text-gray-600 mb-2">Memanggil {{ participants.length }} anggota grup</p>
        
        <!-- Statistik peserta -->
        <div class="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div class="bg-green-100 text-green-800 p-2 rounded">
            <div class="font-bold">{{ acceptedParticipants.length }}</div>
            <div>Bergabung</div>
          </div>
          <div class="bg-yellow-100 text-yellow-800 p-2 rounded">
            <div class="font-bold">{{ ringingParticipants.length }}</div>
            <div>Memanggil</div>
          </div>
          <div class="bg-red-100 text-red-800 p-2 rounded">
            <div class="font-bold">{{ rejectedParticipants.length }}</div>
            <div>Menolak</div>
          </div>
        </div>
        
        <!-- Daftar peserta detail -->
        <div class="max-h-32 overflow-y-auto mb-4">
          <div v-for="participant in participants" :key="participant.id" 
               class="flex items-center justify-between p-1 text-xs">
            <div class="flex items-center">
              <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                {{ participant.name.charAt(0).toUpperCase() }}
              </div>
              <span>{{ participant.name }}</span>
            </div>
            <div :class="{
              'text-green-500': participant.status === 'accepted',
              'text-yellow-500': participant.status === 'ringing' || participant.status === 'calling',
              'text-red-500': participant.status === 'rejected' || participant.status === 'ended'
            }">
              {{ participant.status === 'accepted' ? '✓ Bergabung' : 
                 participant.status === 'ringing' ? '⌛ Berdering' : 
                 participant.status === 'calling' ? '⌛ Memanggil' :
                 participant.status === 'rejected' ? (participant.reason === 'diabaikan' ? '✗ Diabaikan' : '✗ Ditolak') : 
                 participant.status === 'ended' ? '☎ Selesai' : '❓ Unknown' }}
            </div>
          </div>
        </div>
        
        <button @click="endCall" class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
          Batalkan
        </button>
      </div>

      <!-- Untuk panggilan yang sudah selesai -->
      <div v-else-if="isCallEnded" class="call-content">
        <div class="w-20 h-20 bg-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
          G
        </div>
        <h2 class="text-xl font-bold">{{ groupName }}</h2>
        <p class="text-gray-600 mb-4">
          {{ props.groupCallData?.reason || 'Panggilan telah berakhir' }}
        </p>
        <button @click="endCall" class="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600">
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-content {
  transition: all 0.3s ease;
}

button {
  transition: all 0.2s ease;
}

button:hover {
  transform: scale(1.05);
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>