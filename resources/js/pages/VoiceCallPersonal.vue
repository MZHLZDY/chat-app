<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from 'vue';
import { PhoneForwarded, Volume2, Mic, MicOff } from 'lucide-vue-next';

// Props
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  callData: { type: Object as () => any, default: null },
  localAudioTrack: { type: Object as () => any, default: null },
  remoteAudioTrack: {
    type: Object as () => Record<string, any>, 
    default: () => ({}) 
  }
});

// Emits
const emit = defineEmits(['end-call', 'mute-toggled', 'speaker-toggled']);

// State
const isMuted = ref(false);
const isSpeakerOn = ref(false);
const callStartTime = ref<number | null>(null);
const callDuration = ref(0);
let durationInterval: NodeJS.Timeout | null = null;

// Computed properties
const isCaller = computed(() => props.callData?.isCaller || false);

const contactName = computed(() => {
    if (!props.callData) return 'Unknown';
    return isCaller.value ? props.callData.callee?.name : props.callData.caller?.name;
});

const contactInitial = computed(() => {
    const name = contactName.value;
    return name && name !== 'Unknown' ? name.charAt(0).toUpperCase() : '?';
});

const formatCallDuration = computed(() => {
  const minutes = Math.floor(callDuration.value / 60);
  const seconds = callDuration.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

const callStatusText = computed(() => {
    return isCaller.value ? 'Anda memulai panggilan' : 'Panggilan masuk';
});

// Methods
const toggleMute = async () => {
  try {
    if (props.localAudioTrack) {
      isMuted.value = !isMuted.value;
      await props.localAudioTrack.setEnabled(!isMuted.value);
      console.log(`🎤 Microphone ${isMuted.value ? 'muted' : 'unmuted'}`);
      emit('mute-toggled', isMuted.value);
    }
  } catch (error) {
    console.error('Error toggling mute:', error);
  }
};

const toggleSpeaker = async () => {
  isSpeakerOn.value = !isSpeakerOn.value;
  console.log(`🔊 Speaker toggled ${isSpeakerOn.value ? 'ON' : 'OFF'}`);
  emit('speaker-toggled', isSpeakerOn.value);
};

const endCall = () => {
  // PERBAIKAN: Gunakan computed property `isCaller.value`, bukan `props.isCaller`
  const reason = isCaller.value ? 'Diakhiri oleh pengirim' : 'Diakhiri oleh penerima';
  emit('end-call', reason);
};

// Timer untuk durasi panggilan
const startCallTimer = () => {
  callStartTime.value = Date.now();
  callDuration.value = 0;
  if (durationInterval) clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    if (callStartTime.value) {
      callDuration.value = Math.floor((Date.now() - callStartTime.value) / 1000);
    }
  }, 1000);
};

const stopCallTimer = () => {
  if (durationInterval) clearInterval(durationInterval);
  durationInterval = null;
  callDuration.value = 0;
  callStartTime.value = null;
};

// Watch untuk visibility
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    startCallTimer();
  } else {
    stopCallTimer();
  }
});

onUnmounted(() => {
  stopCallTimer();
});
</script>

<template>
  <div v-if="isVisible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 text-center">
      
      <!-- Avatar/Initial -->
      <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
        {{ contactInitial }}
      </div>
      
      <!-- Status Panggilan -->
      <h3 class="text-xl font-bold mb-2 dark:text-white">Sedang Berbicara</h3>
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Dengan {{ contactName }}
      </p>
      
      <!-- Timer Durasi Panggilan -->
      <div class="text-lg font-mono text-gray-700 dark:text-gray-200 mb-4">
        {{ formatCallDuration }}
      </div>
      
      <!-- Status Koneksi -->
      <div class="text-sm text-green-500 dark:text-green-400 mb-4">
        Terhubung
      </div>

      <!-- Audio Status Indicators -->
      <div class="absolute top-4 right-4 flex flex-col items-end space-y-2">
      <div :class="['px-2 py-1 rounded text-xs', isMuted ? 'bg-red-500 text-white' : 'bg-green-500 text-white']">
        {{ isMuted ? 'Muted' : 'Unmuted' }}
      </div>
      <div :class="['px-2 py-1 rounded text-xs', isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white']">
        {{ isSpeakerOn ? 'Speaker' : 'Earpiece' }}
      </div>
    </div>
      
      <!-- Control Buttons -->
      <div class="flex justify-center gap-4">
        <!-- Tombol Mute -->
        <button 
          @click="toggleMute"
          :class="['p-3 rounded-full transition-colors', 
                   isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white']"
          title="Mute/Unmute"
        >
          <MicOff v-if="isMuted" class="w-5 h-5"/>
          <Mic v-else class="w-5 h-5"/>
        </button>

        <!-- Tombol Speaker -->
        <button 
          @click="toggleSpeaker"
          :class="['p-3 rounded-full transition-colors', 
                   isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white']"
          title="Speaker"
        >
          <Volume2 class="w-5 h-5"/>
        </button>

        <!-- Tombol End Call -->
        <button 
          @click="endCall" 
          class="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-colors"
          title="Akhiri Panggilan"
        >
          <PhoneForwarded class="w-5 h-5"/>
        </button>
      </div>

      <!-- Info Status -->
      <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {{ callStatusText }}
      </div>
    </div>
  </div>
</template>
