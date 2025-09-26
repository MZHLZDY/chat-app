<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { PhoneForwarded, PhoneOff, Phone, PhoneCall, PhoneMissed, Mic, Volume2, Volume } from 'lucide-vue-next';

// Interface untuk tipe data partisipan yang lebih jelas
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
  isCaller: { type: Boolean, default: false }, // Ini menentukan apakah user adalah Host
  currentUserId: { type: Number, required: true },
  callTimeoutCountdown: { type: Number, default: null }
});

// Emits
const emit = defineEmits([
    'accept-call',
    'reject-call',
    'end-call',
    'cancel-call',
    'leave-call',
    'recall-participant',
    'toggle-mute',
    'toggle-speaker'
]);

// State lokal
const isMuted = ref(false);
const isSpeakerOn = ref(true);
const callDuration = ref(0);
let callTimer: NodeJS.Timeout | null = null;

// Computed properties untuk menentukan tampilan UI
const isIncomingCall = computed(() => !props.isCaller && props.groupCallData?.status === 'ringing');
const isOngoingCall = computed(() => props.groupCallData?.status === 'accepted');
const isOutgoingCall = computed(() => props.isCaller && props.groupCallData?.status === 'calling');
const isCallEnded = computed(() => props.groupCallData?.status === 'ended');

const callTitle = computed(() => {
  if (isIncomingCall.value) return 'Panggilan Grup Masuk';
  if (isOngoingCall.value) return 'Panggilan Suara Grup';
  if (isOutgoingCall.value) return 'Memanggil Grup';
  if (isCallEnded.value) return 'Panggilan Selesai';
  return 'Panggilan Grup';
});

const groupName = computed(() => props.groupCallData?.group?.name || 'Grup Tidak Dikenal');
const callerName = computed(() => props.groupCallData?.caller?.name || 'Tidak Dikenal');

// Computed properties untuk statistik partisipan
const participants = computed((): Participant[] => props.groupCallData?.participants || []);

const acceptedParticipants = computed(() => 
  participants.value.filter((p: any) => p.status === 'accepted')
);

const ringingParticipants = computed(() => 
  participants.value.filter((p: any) => 
    p.status === 'ringing' || p.status === 'calling'
  )
);

const rejectedParticipants = computed(() => 
  participants.value.filter((p: any) => 
    p.status === 'rejected' || p.status === 'ended' || p.status === 'left'
  )
);

const formattedCallDuration = computed(() => {
  const minutes = Math.floor(callDuration.value / 60);
  const seconds = callDuration.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// Methods untuk emit event ke parent
const acceptCall = () => emit('accept-call', props.groupCallData?.callId);
const rejectCall = () => emit('reject-call', props.groupCallData?.callId, 'diabaikan');
const cancelCall = () => emit('cancel-call', props.groupCallData?.callId);
const endCall = () => emit('end-call', props.groupCallData?.callId); // Untuk "Bubarkan"
const leaveCall = () => emit('leave-call'); // Untuk "Keluar"
const recallParticipant = (participantId: number) => emit('recall-participant', participantId);
const toggleMute = () => { isMuted.value = !isMuted.value; emit('toggle-mute', isMuted.value); };
const toggleSpeaker = () => { isSpeakerOn.value = !isSpeakerOn.value; emit('toggle-speaker', isSpeakerOn.value); };

// Watcher untuk timer durasi panggilan
watch(() => isOngoingCall.value, (isOngoing) => {
  if (isOngoing && !callTimer) {
    callDuration.value = 0;
    callTimer = setInterval(() => { callDuration.value++; }, 1000);
  } else if (!isOngoing && callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
}, { immediate: true });

onUnmounted(() => {
  if (callTimer) clearInterval(callTimer);
});
</script>

<template>
  <div v-if="isVisible" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 text-center shadow-2xl">
      
      <!-- TAMPILAN UNTUK PENERIMA PANGGILAN (INCOMING CALL) -->
      <div v-if="isIncomingCall">
        <h3 class="text-xl font-bold mb-2 dark:text-white">Panggilan Grup Masuk</h3>
        <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto my-4 flex items-center justify-center text-white text-3xl font-bold">G</div>
        <p class="font-semibold dark:text-gray-200">{{ groupName }}</p>
        <p class="text-gray-600 dark:text-gray-300 mb-6">{{ callerName }} mengundang Anda</p>
        <div class="flex justify-center gap-4">
            <button @click="rejectCall" class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 flex items-center justify-center gap-2 px-6">
                <PhoneOff class="w-5 h-5"/> <span>Abaikan</span>
            </button>
            <button @click="acceptCall" class="bg-green-500 text-white p-3 rounded-full hover:bg-green-600 flex items-center justify-center gap-2 px-6">
                <PhoneCall class="w-5 h-5"/> <span>Gabung</span>
            </button>
        </div>
      </div>
      
      <!-- TAMPILAN UNTUK HOST (OUTGOING CALL) DAN PANGGILAN BERJALAN -->
      <div v-else>
        <!-- COUNTDOWN TIMER HANYA UNTUK HOST YANG SEDANG MEMANGGIL -->
        <div v-if="isOutgoingCall && callTimeoutCountdown !== null" class="text-red-500 font-semibold mb-2 animate-pulse">
          Berakhir dalam {{ callTimeoutCountdown }} detik
        </div>
        
        <h3 class="text-xl font-bold mb-2 dark:text-white">{{ callTitle }}</h3>
        
        <!-- ICON GRUP (HANYA TAMPIL JIKA BUKAN PANGGILAN BERAKHIR) -->
        <div v-if="!isCallEnded" class="w-20 h-20 bg-blue-500 rounded-full mx-auto my-4 flex items-center justify-center text-white text-3xl font-bold">G</div>
        
        <p class="font-semibold dark:text-gray-200">{{ groupName }}</p>

       <!-- Di bagian outgoing call (host) -->
<div v-if="isOutgoingCall">
  <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Memanggil {{ participants.length }} anggota grup</p>
  
  <!-- TAMPILAN STATUS HOST -->
  <div class="mb-3 p-2 bg-green-100 text-green-800 rounded text-sm">
    <strong>Anda (Host)</strong> - ✓ Bergabung
  </div>
  
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
  
  <div class="flex justify-center mt-4">
    <button @click="cancelCall" class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 flex items-center justify-center gap-2">
      <PhoneMissed class="w-5 h-5"/> <span>Batalkan</span>
    </button>
  </div>
</div>

        <!-- TAMPILAN UNTUK PANGGILAN YANG SEDANG BERJALAN -->
        <div v-if="isOngoingCall">
          <div class="text-2xl font-mono text-gray-700 dark:text-gray-200 my-2">{{ formattedCallDuration }}</div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Sedang berbicara dengan {{ acceptedParticipants.length }} orang</p>
          
          <!-- SEKARANG HANYA UNTUK HOST -->
          <div class="grid grid-cols-3 gap-2 mb-3 text-xs">
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
              <div>Keluar</div>
            </div>
          </div>

          <!-- DAFTAR PESERTA -->
          <div class="max-h-32 overflow-y-auto mb-4 border-t border-b dark:border-gray-700">
            <div v-for="participant in participants" :key="participant.id" class="flex items-center justify-between p-2 text-sm">
              <span class="truncate">
                {{ participant.name }}
                <span v-if="participant.id === currentUserId" class="text-xs text-gray-500"> (Anda)</span>
                <span v-else-if="participant.id === groupCallData?.caller?.id" class="text-xs text-blue-500 font-semibold"> (Host)</span>
              </span>
              <div class="flex items-center gap-2">
                <span :class="{ 
                  'text-green-500': participant.status === 'accepted', 
                  'text-yellow-500': participant.status === 'ringing' || participant.status === 'calling', 
                  'text-red-500': participant.status === 'rejected' || participant.status === 'left' || participant.status === 'ended'
                }" class="text-xs font-semibold">
                  {{ 
                    participant.status === 'accepted' ? 'Bergabung' : 
                    participant.status === 'ringing' ? 'Berdering' : 
                    participant.status === 'calling' ? 'Memanggil' : 
                    participant.status === 'rejected' ? 'Diabaikan' : 
                    participant.status === 'left' ? 'Keluar' : 
                    participant.status === 'ended' ? 'Berakhir' : ''
                  }}
                </span>
                <button 
                  v-if="isCaller && (participant.status === 'left' || participant.status === 'rejected')" 
                  @click="recallParticipant(participant.id)" 
                  class="text-gray px-2 py-0.5 text-xs rounded-full hover:bg-gray-300"
                  title="Panggil Lagi"
                >
                  <Phone class="w-3 h-3"/>
                </button>
              </div>
            </div>
          </div>
          
          <!-- TOMBOL AKSI -->
          <div class="flex justify-center gap-4">
            <button @click="toggleMute" :class="['p-3 rounded-full', isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white']" title="Mute">
              <Mic class="w-5 h-5"/>
            </button>
            
            <button v-if="isCaller" @click="endCall" class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 flex items-center justify-center gap-2 px-6" title="Bubarkan Panggilan">
              <PhoneForwarded class="w-5 h-5"/> <span>Bubarkan</span>
            </button>
            
            <button v-else @click="leaveCall" class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 flex items-center justify-center gap-2 px-6" title="Keluar dari Panggilan">
              <PhoneForwarded class="w-5 h-5"/> <span>Keluar</span>
            </button>
            
            <button @click="toggleSpeaker" :class="['p-3 rounded-full', isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white']" title="Speaker">
              <Volume2 class="w-5 h-5"/>
            </button>
          </div>
        </div>

        <!-- TAMPILAN UNTUK PANGGILAN YANG BERAKHIR -->
        <div v-if="isCallEnded">
          <p class="text-gray-600 dark:text-gray-300 my-4">{{ groupCallData?.reason || 'Panggilan telah berakhir' }}</p>
          <button @click="endCall" class="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600">Tutup</button>
        </div>

      </div>
    </div>
  </div>
</template>