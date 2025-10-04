<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhoneForwarded, PhoneOff, Phone, PhoneCall, PhoneMissed, Mic, MicOff, Volume2, VolumeOff, Video, Minimize, Minimize2 } from 'lucide-vue-next';

// Interface
interface Participant {
  id: number;
  name: string;
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'left';
  reason?: string;
}

// Props
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  groupCallData: { type: Object as () => any, default: null },
  isCaller: { type: Boolean, default: false },
  currentUserId: { type: Number, required: true },
  callTimeoutCountdown: { type: Number, default: null },
  // Prop baru untuk menerima durasi dari induk
  formattedDuration: { type: String, default: '00:00' }
});

// Emits
const emit = defineEmits([
    'accept-call', 'reject-call', 'end-call', 'cancel-call', 'leave-call',
    'recall-participant', 'toggle-mute', 'toggle-speaker', 'minimize-call'
]);

// State lokal HANYA untuk UI (mute/speaker)
const isMuted = ref(false);
const isSpeakerOn = ref(true);

// Computed properties (tanpa timer)
const isIncomingCall = computed(() => !props.isCaller && props.groupCallData?.status === 'ringing');
const isOngoingCall = computed(() => props.groupCallData?.status === 'accepted');
const isOutgoingCall = computed(() => props.isCaller && props.groupCallData?.status === 'calling');
const isCallEnded = computed(() => props.groupCallData?.status === 'ended');
const callerId = computed(() => props.groupCallData?.caller?.id || null);

const callTitle = computed(() => {
  if (isIncomingCall.value) return 'Panggilan Grup Masuk';
  if (isOngoingCall.value) return 'Panggilan Suara Grup';
  if (isOutgoingCall.value) return 'Memanggil Grup';
  if (isCallEnded.value) return 'Panggilan Selesai';
  return 'Panggilan Grup';
});

const groupName = computed(() => props.groupCallData?.group?.name || 'Grup');
const callerName = computed(() => props.groupCallData?.caller?.name || 'Unknown');
const participants = computed((): Participant[] => props.groupCallData?.participants || []);

// Methods
const acceptCall = () => emit('accept-call', props.groupCallData?.callId);
const rejectCall = () => emit('reject-call', props.groupCallData?.callId, 'diabaikan');
const cancelCall = () => emit('cancel-call', props.groupCallData?.callId);
const endCall = () => emit('end-call', props.groupCallData?.callId);
const leaveCall = () => emit('leave-call');
const recallParticipant = (participantId: number) => emit('recall-participant', participantId);
const toggleMute = () => { isMuted.value = !isMuted.value; emit('toggle-mute', isMuted.value); };
const toggleSpeaker = () => { isSpeakerOn.value = !isSpeakerOn.value; emit('toggle-speaker', isSpeakerOn.value); };
</script>

<template>
  <div v-if="isVisible" class="fixed inset-0 bg-gray-900 flex flex-col p-4 z-[100] text-white">
    <button
      v-if="isOngoingCall"
      @click="$emit('minimize-call')"
      class="absolute top-4 left-4 text-gray-300 hover:text-white transition-opacity z-30"
      title="Minimize Panggilan"
    >
      <Minimize class="w-6 h-6" />
    </button>

    <div v-if="isIncomingCall" class="flex flex-col items-center justify-center h-full text-center">
      <h3 class="text-2xl font-bold mb-2">Panggilan Grup Masuk</h3>
      <p class="text-gray-300 mb-6">{{ callerName }} mengundang Anda ke grup</p>
      <div class="w-28 h-28 bg-blue-500 rounded-full mx-auto my-4 flex items-center justify-center text-white text-5xl font-bold">
        {{ groupName.charAt(0).toUpperCase() }}
      </div>
      <p class="text-xl font-semibold mt-2">{{ groupName }}</p>
      <div class="absolute bottom-10 flex w-full justify-center gap-10">
        <div class="flex flex-col items-center gap-2">
          <button @click="rejectCall" class="bg-red-500 text-white w-16 h-16 rounded-full hover:bg-red-600 flex items-center justify-center">
            <PhoneOff class="w-8 h-8"/>
          </button>
          <span>Abaikan</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <button @click="acceptCall" class="bg-green-500 text-white w-16 h-16 rounded-full hover:bg-green-600 flex items-center justify-center">
            <PhoneCall class="w-8 h-8"/>
          </button>
          <span>Gabung</span>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col h-full">
      <div class="text-center pt-8 pb-4">
        <h3 class="text-xl font-bold">{{ callTitle }}</h3>
        <p v-if="!isCallEnded" class="font-semibold text-gray-300">{{ groupName }}</p>
        <div v-if="isOngoingCall" class="text-2xl font-mono mt-2">{{ formattedDuration }}</div>
        <div v-if="isOutgoingCall && callTimeoutCountdown !== null" class="text-red-500 font-semibold mt-2 animate-pulse">
          Berakhir dalam {{ callTimeoutCountdown }} detik
        </div>
      </div>

      <div class="flex-grow overflow-y-auto">
        <div v-if="isCallEnded" class="flex items-center justify-center h-full">
            <div class="text-center">
                <p class="text-gray-300 my-4 text-lg">{{ groupCallData?.reason || 'Panggilan telah berakhir' }}</p>
            </div>
        </div>
        <div v-else class="grid grid-cols-2 gap-3 p-2 max-w-md mx-auto">
          <div 
            v-for="participant in participants" 
            :key="participant.id"
            class="relative bg-gray-800 p-4 rounded-lg flex flex-col items-center justify-center aspect-square"
            :class="{ 'border-2 border-green-500': participant.id === currentUserId && participant.status === 'accepted' }"
          >
            <button 
              v-if="isCaller && (participant.status === 'left' || participant.status === 'rejected')" 
              @click="recallParticipant(participant.id)" 
              class="absolute top-2 right-2 z-20 bg-green-600 text-white p-1.5 rounded-full hover:bg-green-700"
              title="Panggil Lagi"
            >
              <Phone class="w-4 h-4"/>
            </button>
            <div v-if="participant.status !== 'accepted'" class="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center z-10">
              <span v-if="participant.status === 'ringing' || participant.status === 'calling'" class="text-yellow-400 font-semibold">Memanggil...</span>
              <span v-else class="text-red-400 font-semibold">{{ participant.status === 'rejected' ? 'Diabaikan' : 'Keluar' }}</span>
            </div>
            <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2">
              {{ participant.name.charAt(0).toUpperCase() }}
            </div>
            <p class="text-white font-semibold text-sm truncate w-full text-center">
              {{ participant.name }}
              <span v-if="participant.id === currentUserId" class="text-xs font-semibold text-blue-400">(Anda)</span>
              <span v-else-if="participant.id === callerId" class="text-xs font-semibold text-yellow-400">(Host)</span>
            </p>
          </div>
        </div>
      </div>

      <div class="py-6">
        <div v-if="isOutgoingCall" class="flex justify-center">
          <button @click="cancelCall" class="bg-red-500 text-white w-16 h-16 rounded-full hover:bg-red-600 flex items-center justify-center gap-2">
            <PhoneMissed class="w-8 h-8"/>
          </button>
        </div>
        <div v-if="isOngoingCall" class="flex justify-center items-center gap-5">
          <button @click="toggleMute" :class="['w-12 h-12 rounded-full flex items-center justify-center', isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white']">
            <MicOff v-if="isMuted" class="w-6 h-6"/><Mic v-else class="w-6 h-6"/>
          </button>
          <button @click="toggleSpeaker" :class="['w-12 h-12 rounded-full flex items-center justify-center', isSpeakerOn ? 'bg-blue-500' : 'bg-gray-700']">
            <Volume2 v-if="isSpeakerOn" class="w-6 h-6"/><VolumeOff v-else class="w-6 h-6"/>
          </button>
          <button v-if="isCaller" @click="endCall" class="bg-red-500 text-white w-16 h-16 rounded-full hover:bg-red-600 flex items-center justify-center">
            <PhoneForwarded class="w-7 h-7"/>
          </button>
          <button v-else @click="leaveCall" class="bg-red-500 text-white w-16 h-16 rounded-full hover:bg-red-600 flex items-center justify-center">
            <PhoneForwarded class="w-7 h-7"/>
          </button>
          <button @click="" class="bg-gray-700 text-white p-3 rounded-full hover:bg-gray-800" title="Beralih ke Video Call?">
          <Video class="w-6 h-6"/>
        </button>
        </div>
        <div v-if="isCallEnded" class="flex justify-center">
          <button @click="endCall" class="bg-blue-500 text-white px-8 py-3 rounded-full hover:bg-blue-600">Tutup</button>
        </div>
      </div>
    </div>
  </div>
</template>