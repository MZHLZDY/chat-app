<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhoneForwarded, Volume2, Mic, MicOff, VolumeOff, Minimize2, Video } from 'lucide-vue-next';

// Props
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  callData: { type: Object as () => any, default: null },
  localAudioTrack: { type: Object as () => any, default: null },
  remoteAudioTrack: {
    type: Object as () => Record<string, any>, 
    default: () => ({}) 
  },
  formattedDuration: { type: String, default: '00:00' },
  isMuted: { type: Boolean, default: false }
});

// Emits
const emit = defineEmits(['end-call', 'mute-toggled', 'speaker-toggled', 'minimize-call', 'switch-to-video']);

// State lokal UI speaker
const isSpeakerOn = ref(false);

// Computed properties
const isCaller = computed(() => props.callData?.isCaller || false);
const isConnected = computed(() => props.callData?.status === 'connected');

const contactName = computed(() => {
    if (!props.callData) return 'Unknown';
    return isCaller.value ? props.callData.callee?.name : props.callData.caller?.name;
});

const contactInitial = computed(() => {
    const name = contactName.value;
    return name && name !== 'Unknown' ? name.charAt(0).toUpperCase() : '?';
});

// Methods
const toggleMute = () => emit('mute-toggled');
const toggleSpeaker = () => {
  if (!isConnected.value) return;
  isSpeakerOn.value = !isSpeakerOn.value;
  emit('speaker-toggled', isSpeakerOn.value);
};

// ✅ PERBAIKAN: Fungsi endCall yang lebih baik
const endCall = () => {
  console.log('📞 Tombol End Call ditekan di VoiceCallPersonal');
  
  // ✅ Langsung emit dengan reason yang jelas
  emit('end-call', 'Panggilan diakhiri oleh pengguna');
};

// ✅ FUNGSI BARU: Handle switch to video dengan end call
const switchToVideo = () => {
  console.log('🎥 Switch to video ditekan');
  emit('end-call', 'Beralih ke panggilan video');
  emit('switch-to-video');
};

</script>

<template>
  <div v-if="isVisible" 
       class="fixed inset-0 z-[200] text-white
              flex items-center justify-center 
              sm:bg-black sm:bg-opacity-70 sm:p-8">

    <div class="relative bg-gray-800 w-full h-full
                flex flex-col justify-between
                sm:rounded-lg sm:max-w-lg sm:h-auto">

      <button
        v-if="isConnected"
        @click="$emit('minimize-call')"
        class="absolute top-4 left-4 text-gray-300 hover:text-white transition-opacity"
        title="Mode Minimize Panggilan">
        <Minimize2 class="w-6 h-6" />
      </button>
      
      <div class="flex flex-col items-center justify-center text-center flex-grow">
        <div class="w-29 h-29 bg-blue-500 rounded-full mb-4 flex items-center justify-center text-white text-5xl">
          {{ contactInitial }}
        </div>
        
        <h3 class="text-3xl font-bold mb-2">{{ contactName }}</h3>
        
        <p v-if="isConnected" class="text-gray-300">
          Panggilan terhubung
        </p>

        <div v-if="isConnected" class="text-2xl font-mono mt-2">
          {{ formattedDuration }}
        </div>
        
        <div v-else class="text-yellow-400 animate-pulse mt-2">
          Menunggu jawaban...
        </div>
      </div>

      <div class="p-6">
        <div class="flex justify-center items-center gap-5">
          <button 
            @click="toggleMute"
            :class="['w-16 h-16 rounded-full flex items-center justify-center', 
                     isMuted ? 'bg-red-500 text-white' : 'bg-gray-700', 
                     !isConnected && 'opacity-50 cursor-not-allowed']"
            :disabled="!isConnected">
            <MicOff v-if="isMuted" class="w-8 h-8"/>
            <Mic v-else class="w-8 h-8"/>
          </button>

          <!-- ✅ TOMBOL END CALL YANG DIPERBAIKI -->
          <button 
            @click="endCall" 
            class="w-20 h-20 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center justify-center transform hover:scale-105 transition-transform"
            :disabled="!isConnected">
            <PhoneForwarded class="w-10 h-10"/>
          </button>

          <button 
            @click="toggleSpeaker"
            :class="['w-16 h-16 rounded-full flex items-center justify-center', 
                     isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-700', 
                     !isConnected && 'opacity-50 cursor-not-allowed']"
            :disabled="!isConnected">
            <Volume2 v-if="isSpeakerOn" class="w-8 h-8"/>
            <VolumeOff v-else class="w-8 h-8"/>
          </button>

          <!-- ✅ TOMBOL SWITCH TO VIDEO YANG DIPERBAIKI -->
          <button 
            @click="switchToVideo" 
            class="w-16 h-16 bg-gray-700 text-white rounded-full hover:bg-green-800 flex items-center justify-center transform hover:scale-105 transition-transform"
            :disabled="!isConnected"
            title="Beralih ke Video Call">
            <Video class="w-8 h-8"/>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>