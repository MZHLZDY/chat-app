<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useGroupCall } from '@/composables/useGroupCall';
import { PhoneForwarded, PhoneOff, Phone, PhoneCall, PhoneMissed, Mic, MicOff, Volume2, VolumeOff, Video, Minimize } from 'lucide-vue-next';

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
const { initializeGlobalListeners } = useGroupCall();

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
    initializeGlobalListeners;
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
  <div v-if="isVisible" class="fixed inset-0 bg-gray-900 flex flex-col z-[100] text-white">
    <!-- Header dengan tombol minimize -->
    <div class="relative py-4 px-3 border-b border-gray-700">
      <button
        v-if="isOngoingCall"
        @click="$emit('minimize-call')"
        class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white transition-opacity z-30"
        title="Minimize Panggilan"
      >
        <Minimize class="w-5 h-5" />
      </button>
      
      <div class="text-center mx-auto max-w-xs">
        <h3 class="text-lg font-bold truncate">{{ callTitle }}</h3>
        <p v-if="!isCallEnded" class="text-sm text-gray-300 truncate">{{ groupName }}</p>
        <div v-if="isOngoingCall" class="text-base font-mono mt-1">{{ formattedDuration }}</div>
        <div v-if="isOutgoingCall && callTimeoutCountdown !== null" class="text-red-500 text-sm font-semibold mt-1 animate-pulse">
          Berakhir dalam {{ callTimeoutCountdown }} detik
        </div>
      </div>
    </div>

    <!-- Konten Utama -->
    <div class="flex-1 overflow-hidden">
      <!-- Tampilan Panggilan Masuk -->
      <div v-if="isIncomingCall" class="flex flex-col items-center justify-center h-full px-4 text-center">
        <!-- Group Avatar -->
        <div class="relative w-24 h-24 mx-auto my-6">
          <div 
            class="w-full h-full rounded-full flex items-center justify-center text-white text-4xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 border-4 border-white/20 shadow-xl"
          >
            {{ groupName.charAt(0).toUpperCase() }}
          </div>
          <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-900">
            <PhoneCall class="w-5 h-5" />
          </div>
        </div>
        
        <!-- Info Pemanggil -->
        <div class="mb-2">
          <p class="text-lg font-semibold">{{ callerName }}</p>
          <p class="text-sm text-gray-300">Mengundang Anda ke grup</p>
        </div>
        
        <!-- Nama Grup -->
        <div class="bg-gray-800/50 rounded-lg px-4 py-2 mb-8">
          <p class="text-xl font-bold">{{ groupName }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ activeParticipants.length }} orang dalam panggilan</p>
        </div>
        
        <!-- Tombol Aksi -->
        <div class="absolute bottom-8 left-0 right-0 px-6">
          <div class="flex justify-center items-center gap-12">
            <div class="flex flex-col items-center gap-2">
              <button @click="rejectCall" class="bg-red-500 text-white w-14 h-14 rounded-full hover:bg-red-600 flex items-center justify-center shadow-lg transform active:scale-95 transition-transform">
                <PhoneOff class="w-6 h-6"/>
              </button>
              <span class="text-xs font-medium">Abaikan</span>
            </div>
            
            <div class="flex flex-col items-center gap-2">
              <button @click="acceptCall" class="bg-green-500 text-white w-16 h-16 rounded-full hover:bg-green-600 flex items-center justify-center shadow-lg transform active:scale-95 transition-transform animate-pulse">
                <PhoneCall class="w-7 h-7"/>
              </button>
              <span class="text-xs font-medium">Gabung</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tampilan Panggilan Berlangsung/Selesai -->
      <div v-else class="flex flex-col h-full px-2">
        <!-- Status Panggilan Selesai -->
        <div v-if="isCallEnded" class="flex flex-col items-center justify-center h-full px-4 text-center">
          <div class="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-6">
            <PhoneOff class="w-10 h-10 text-gray-400" />
          </div>
          <p class="text-xl font-bold mb-2">Panggilan Selesai</p>
          <p class="text-gray-300 mb-8">{{ groupCallData?.reason || 'Panggilan telah berakhir' }}</p>
          <button @click="endCall" class="bg-blue-500 text-white px-8 py-3 rounded-full hover:bg-blue-600 w-full max-w-xs">
            Tutup
          </button>
        </div>

        <!-- Daftar Peserta -->
        <div v-else class="flex-1 overflow-y-auto pb-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
            <div 
              v-for="participant in participants" 
              :key="participant.id"
              class="relative bg-gray-800/50 rounded-xl p-3 flex flex-col items-center justify-center min-h-[140px]"
              :class="{ 
                'ring-2 ring-green-500 ring-offset-1 ring-offset-gray-900': participant.id === currentUserId && participant.status === 'accepted',
                'ring-2 ring-yellow-500 ring-offset-1 ring-offset-gray-900': participant.id === callerId && participant.status === 'accepted'
              }"
            >
              <!-- Tombol Panggil Ulang untuk Host -->
              <button 
                v-if="isCaller && (participant.status === 'left' || participant.status === 'rejected')" 
                @click="recallParticipant(participant.id)" 
                class="absolute top-2 right-2 z-20 bg-green-600 text-white p-1.5 rounded-full hover:bg-green-700 shadow"
                title="Panggil Lagi"
              >
                <Phone class="w-3.5 h-3.5"/>
              </button>
              
              <!-- Overlay Status -->
              <div v-if="participant.status !== 'accepted'" class="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center z-10 p-2">
                <div class="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  :class="{
                    'bg-yellow-500/20': participant.status === 'ringing' || participant.status === 'calling',
                    'bg-red-500/20': participant.status === 'rejected' || participant.status === 'left'
                  }">
                  <PhoneMissed 
                    v-if="participant.status === 'rejected' || participant.status === 'left'" 
                    class="w-5 h-5 text-red-400" 
                  />
                  <PhoneCall 
                    v-else-if="participant.status === 'ringing' || participant.status === 'calling'" 
                    class="w-5 h-5 text-yellow-400 animate-pulse" 
                  />
                </div>
                <span class="text-xs font-semibold text-center">
                  {{ participant.status === 'ringing' || participant.status === 'calling' ? 'Memanggil...' : 
                     participant.status === 'rejected' ? 'Diabaikan' : 'Keluar' }}
                </span>
              </div>
              
              <!-- Avatar Peserta -->
              <div class="relative w-14 h-14 mb-3">
                <!-- Foto Profil -->
                <img 
                  v-if="shouldShowPhoto(participant.id, getParticipantPhotoUrl(participant))"
                  :src="getParticipantPhotoUrl(participant)" 
                  :alt="participant.name" 
                  class="w-full h-full rounded-full object-cover border-2 border-white/30 shadow"
                  @error="(event) => handleImageError(event, participant.id, participant.name)"
                  @load="(event) => handleImageLoad(event, participant.id, participant.name)"
                />

                <!-- Fallback Avatar -->
                <div 
                  v-else
                  :class="['w-full h-full rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-white/30 shadow', getParticipantAvatarClass(participant)]"
                >
                  {{ getParticipantInitial(participant) }}
                </div>

                <!-- Status Indicator -->
                <div v-if="participant.status === 'accepted'" 
                  class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900">
                </div>
              </div>
              
              <!-- Nama Peserta -->
              <div class="text-center w-full">
                <p class="text-white font-medium text-sm truncate px-1">
                  {{ participant.name }}
                </p>
                <div class="flex flex-col items-center gap-0.5 mt-1">
                  <span v-if="participant.id === currentUserId" 
                    class="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
                    Anda
                  </span>
                  <span v-else-if="participant.id === callerId" 
                    class="text-xs font-semibold text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer dengan Kontrol Panggilan -->
        <div v-if="!isIncomingCall && !isCallEnded" class="border-t border-gray-700 pt-4 pb-6 px-4">
          <!-- Tombol Batalkan (Outgoing Call) -->
          <div v-if="isOutgoingCall" class="flex justify-center">
            <button @click="cancelCall" 
              class="bg-red-500 text-white w-16 h-16 rounded-full hover:bg-red-600 flex items-center justify-center shadow-lg transform active:scale-95 transition-transform">
              <PhoneMissed class="w-8 h-8"/>
            </button>
          </div>

          <!-- Kontrol Panggilan Berlangsung -->
          <div v-if="isOngoingCall" class="flex justify-center items-center gap-4">
            <!-- Mute/Unmute -->
            <div class="flex flex-col items-center gap-1">
              <button @click="toggleMute" 
                :class="['w-12 h-12 rounded-full flex items-center justify-center shadow transform active:scale-95 transition-transform', 
                  isMuted ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600']"
                :title="isMuted ? 'Bunyikan' : 'Bisukan'">
                <MicOff v-if="isMuted" class="w-6 h-6"/><Mic v-else class="w-6 h-6"/>
              </button>
              <span class="text-xs text-gray-300">{{ isMuted ? 'Bunyikan' : 'Bisukan' }}</span>
            </div>

            <!-- Speaker -->
            <div class="flex flex-col items-center gap-1">
              <button @click="toggleSpeaker" 
                :class="['w-12 h-12 rounded-full flex items-center justify-center shadow transform active:scale-95 transition-transform', 
                  isSpeakerOn ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-700/80 text-white hover:bg-gray-600']"
                :title="isSpeakerOn ? 'Matikan Speaker' : 'Nyalakan Speaker'">
                <Volume2 v-if="isSpeakerOn" class="w-6 h-6"/><VolumeOff v-else class="w-6 h-6"/>
              </button>
              <span class="text-xs text-gray-300">Speaker</span>
            </div>

            <!-- End/Leave Call -->
            <div class="flex flex-col items-center gap-1">
              <button 
                v-if="isCaller" 
                @click="endCall" 
                class="bg-red-500 text-white w-14 h-14 rounded-full hover:bg-red-600 flex items-center justify-center shadow-lg transform active:scale-95 transition-transform"
                title="Akhiri Panggilan">
                <PhoneForwarded class="w-7 h-7"/>
              </button>
              <button 
                v-else 
                @click="leaveCall" 
                class="bg-red-500 text-white w-14 h-14 rounded-full hover:bg-red-600 flex items-center justify-center shadow-lg transform active:scale-95 transition-transform"
                title="Keluar Panggilan">
                <PhoneForwarded class="w-7 h-7"/>
              </button>
              <span class="text-xs text-gray-300">{{ isCaller ? 'Bubarkan' : 'Keluar' }}</span>
            </div>

            <!-- Switch to Video -->
            <div class="flex flex-col items-center gap-1">
              <button @click="" 
                class="bg-gray-700/80 text-white w-12 h-12 rounded-full hover:bg-gray-600 flex items-center justify-center shadow transform active:scale-95 transition-transform"
                title="Beralih ke Video Call">
                <Video class="w-6 h-6"/>
              </button>
              <span class="text-xs text-gray-300">Video</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar untuk mobile */
.flex-1.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Responsive grid untuk berbagai ukuran layar */
@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Animasi untuk tombol */
.transform {
  transition: transform 0.2s ease;
}

/* Smooth transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>