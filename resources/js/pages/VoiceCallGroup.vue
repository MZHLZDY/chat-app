<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { PhoneForwarded, PhoneOff, Phone, PhoneCall, PhoneMissed, Mic, MicOff, Volume2, VolumeOff, Video, Minimize, Minimize2 } from 'lucide-vue-next';

// Interface
interface Participant {
  id: number;
  name: string;
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'left';
  reason?: string;
  profile_photo_url?: string;
  email?: string;
}

// Props
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  groupCallData: { type: Object as () => any, default: null },
  isCaller: { type: Boolean, default: false },
  currentUserId: { type: Number, required: true },
  callTimeoutCountdown: { type: Number, default: null },
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

// ✅ PERBAIKAN: State untuk image errors per participant
const imageErrors = ref<Set<number>>(new Set());

// Computed properties
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

// ✅ PERBAIKAN: Enhanced photo URL computation untuk group
const getParticipantPhotoUrl = (participant: Participant): string => {
    if (!participant) return '';
    
    // Priority 1: profile_photo_url (full URL)
    if (participant.profile_photo_url) {
        return participant.profile_photo_url;
    }
    // Priority 2: Fallback ke generated avatar
    else if (participant.name) {
        const name = participant.name.replace(/\s/g, '+');
        return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true&size=128`;
    }
    
    // Fallback default
    return '';
};

// ✅ PERBAIKAN: Check if should show photo untuk participant
const shouldShowPhoto = (participantId: number, photoUrl: string | null): boolean => {
    return !!photoUrl && !imageErrors.value.has(participantId);
};

// ✅ PERBAIKAN: Get participant avatar class untuk fallback
const getParticipantAvatarClass = (participant: Participant): string => {
    if (!participant) return 'bg-blue-500';
    
    // Gunakan ID untuk warna yang konsisten
    if (participant.id) {
        const colors = ['bg-sky-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-yellow-500', 'bg-teal-500', 'bg-cyan-500'];
        const colorIndex = participant.id % colors.length;
        return colors[colorIndex];
    }
    
    return 'bg-sky-500';
};

const activeParticipants = computed<Participant[]>(() => {
    if (!props.groupCallData?.participants) return [];
    
    // Filter participants who are calling, ringing, or accepted
    return props.groupCallData.participants.filter((p: Participant) => 
        ['calling', 'ringing', 'accepted'].includes(p.status)
    ).sort((a: Participant, b: Participant) => {
        // Urutkan: Accepted > Calling/Ringing
        if (a.status === 'accepted' && b.status !== 'accepted') return -1;
        if (a.status !== 'accepted' && b.status === 'accepted') return 1;
        return a.name.localeCompare(b.name); // Urutkan berdasarkan nama
    });
});

// ✅ PERBAIKAN: Get participant initial
const getParticipantInitial = (participant: Participant): string => {
    const name = participant?.name || 'Unknown';
    return name && name !== 'Unknown' ? name.charAt(0).toUpperCase() : '?';
};

// ✅ PERBAIKAN: Enhanced error handling untuk participant images
const handleImageError = (event: Event, participantId: number, participantName: string) => {
    const target = event.target as HTMLImageElement;
    console.log('❌ Error loading participant image:', {
        participantId,
        participantName,
        src: target.src
    });
    imageErrors.value.add(participantId);
};

// ✅ PERBAIKAN: Enhanced load handling
const handleImageLoad = (event: Event, participantId: number, participantName: string) => {
    console.log('✅ Participant image loaded successfully:', {
        participantId,
        participantName
    });
    imageErrors.value.delete(participantId);
};

// ✅ PERBAIKAN: Reset image errors ketika groupCallData berubah
watch(() => props.groupCallData, () => {
    console.log('🔄 Group call data changed, reset image error state');
    imageErrors.value.clear();
}, { deep: true });

// ✅ DEBUG: Log ketika component mounted
onMounted(() => {
    console.log('🎯 VoiceCallGroup mounted');
});

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
      
      <!-- ✅ PERBAIKAN: Enhanced group photo display -->
      <div class="relative w-28 h-28 mx-auto my-4">
        <!-- Group photo atau fallback -->
        <div 
          class="w-full h-full rounded-full flex items-center justify-center text-white text-5xl font-bold bg-blue-500 border-4 border-white shadow-lg"
        >
          {{ groupName.charAt(0).toUpperCase() }}
        </div>
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
            
            <!-- ✅ PERBAIKAN BESAR: Enhanced participant photo display -->
            <div class="relative w-16 h-16 mb-2">
              <!-- Foto profil participant - hanya tampilkan jika URL tersedia dan tidak error -->
              <img 
                v-if="shouldShowPhoto(participant.id, getParticipantPhotoUrl(participant))"
                :src="getParticipantPhotoUrl(participant)" 
                :alt="participant.name" 
                class="w-full h-full rounded-full object-cover border-2 border-white shadow-md"
                @error="(event) => handleImageError(event, participant.id, participant.name)"
                @load="(event) => handleImageLoad(event, participant.id, participant.name)"
              />

              <!-- Fallback avatar - tampilkan jika tidak ada foto atau error -->
              <div 
                v-else
                :class="['w-full h-full rounded-full flex items-center justify-center text-white text-xl font-bold border-2 border-white shadow-md', getParticipantAvatarClass(participant)]"
              >
                {{ getParticipantInitial(participant) }}
              </div>
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

<style scoped>
/* Optional: Tambahkan animasi untuk smooth transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>