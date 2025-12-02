<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useCallEventFormatter } from '@/composables/useCallEventFormatter';
import { PhoneForwarded, Volume2, Mic, MicOff, VolumeOff, Minimize2, Video } from 'lucide-vue-next';

// Props
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  callData: { type: Object as () => any, default: null },
  callStartTime: { 
    type: Number as () => number | null, 
    default: null 
  },
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
const imageError = ref(false);

// Computed properties
const isCaller = computed(() => props.callData?.isCaller || false);
const isConnected = computed(() => props.callData?.status === 'connected');

const { useLiveDuration, formatCallDuration } = useCallEventFormatter();

const liveDuration = useLiveDuration(props.callStartTime);

// Format durasi untuk display
const displayDuration = computed(() => {
    if (props.formattedDuration) return props.formattedDuration;
    return liveDuration.value;
});

const contactName = computed(() => {
    if (!props.callData) return 'Unknown';
    return isCaller.value ? props.callData.callee?.name : props.callData.caller?.name;
});

const contactInitial = computed(() => {
    const name = contactName.value;
    return name && name !== 'Unknown' ? name.charAt(0).toUpperCase() : '?';
});

// ✅ PERBAIKAN BESAR: Enhanced photo URL computation
const contactPhotoUrl = computed(() => {
    if (!props.callData) {
        console.log('❌ No call data available');
        return null;
    }
    
    // Tentukan siapa kontak yang ditelepon
    const contactData = isCaller.value ? props.callData.callee : props.callData.caller;
    
    if (!contactData) {
        console.log('❌ No contact data available');
        return null;
    }
    
    console.log('🔍 DEBUG Contact data in VoiceCallPersonal:', contactData);
    
    // Coba berbagai kemungkinan properti foto profil dengan priority
    let photoUrl = null;
    
    // Priority 1: profile_photo_url (full URL)
    if (contactData.profile_photo_url) {
        photoUrl = contactData.profile_photo_url;
        console.log('✅ Using profile_photo_url:', photoUrl);
    }
    // Priority 2: profile_photo_path (storage path) - convert to URL
    else if (contactData.profile_photo_path) {
        photoUrl = `/storage/${contactData.profile_photo_path}`;
        console.log('✅ Using profile_photo_path -> URL:', photoUrl);
    }
    // Priority 3: avatar URL
    else if (contactData.avatar) {
        photoUrl = contactData.avatar;
        console.log('✅ Using avatar:', photoUrl);
    }
    // Priority 4: photo_url
    else if (contactData.photo_url) {
        photoUrl = contactData.photo_url;
        console.log('✅ Using photo_url:', photoUrl);
    }
    // Priority 5: Fallback ke generated avatar
    else if (contactData.name) {
        const name = contactData.name.replace(/\s/g, '+');
        photoUrl = `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true&size=128`;
        console.log('✅ Using generated avatar:', photoUrl);
    }
    
    console.log('🔍 Final photo URL:', photoUrl);
    return photoUrl;
});

// ✅ PERBAIKAN: Reset image error ketika callData berubah
watch(() => props.callData, () => {
    imageError.value = false;
    console.log('🔄 Call data changed, reset image error state');
}, { deep: true });

// ✅ PERBAIKAN: Computed untuk menentukan apakah harus menampilkan foto atau fallback
const shouldShowPhoto = computed(() => {
    return contactPhotoUrl.value && !imageError.value;
});

const contactAvatarClass = computed(() => {
    if (!props.callData) return 'bg-blue-500';
    
    const contactData = isCaller.value ? props.callData.callee : props.callData.caller;
    
    if (!contactData) return 'bg-blue-500';
    
    // Gunakan ID untuk warna yang konsisten
    if (contactData.id) {
        const colors = ['bg-sky-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
        const colorIndex = contactData.id % colors.length;
        return colors[colorIndex];
    }
    
    return 'bg-sky-500';
});

// ✅ PERBAIKAN: Enhanced error handling
const handleImageError = (event: Event) => {
    const target = event.target as HTMLImageElement;
    console.log('❌ Error loading image:', target.src);
    imageError.value = true;
    
    // Coba fallback URL alternatif jika ada
    const contactData = isCaller.value ? props.callData.callee : props.callData.caller;
    if (contactData?.profile_photo_path && !target.src.includes('/storage/')) {
        console.log('🔄 Trying fallback with storage path...');
        // Tidak perlu melakukan apa-apa karena computed property sudah handle fallback
    }
};

// ✅ PERBAIKAN: Enhanced load handling
const handleImageLoad = (event: Event) => {
    console.log('✅ Image loaded successfully:', (event.target as HTMLImageElement).src);
    imageError.value = false;
};

// Methods
const toggleMute = () => emit('mute-toggled');
const toggleSpeaker = () => {
  if (!isConnected.value) return;
  isSpeakerOn.value = !isSpeakerOn.value;
  emit('speaker-toggled', isSpeakerOn.value);
};

const endCall = () => {
  console.log('📞 Tombol End Call ditekan di VoiceCallPersonal');
  emit('end-call', 'Panggilan diakhiri oleh pengguna');
};

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
        <!-- ✅ PERBAIKAN BESAR: Enhanced photo display dengan better fallback -->
        <div class="flex flex-col items-center justify-center space-y-4">
          <!-- Debug info (sementara untuk troubleshooting) -->
          <div class="text-xs text-gray-400 bg-black bg-opacity-50 p-2 rounded" v-if="false">
            <div>Photo URL: {{ contactPhotoUrl }}</div>
            <div>Show Photo: {{ shouldShowPhoto }}</div>
            <div>Image Error: {{ imageError }}</div>
            <div>Contact: {{ contactName }}</div>
          </div>
          
          <!-- Container untuk foto profil dengan fallback -->
          <div class="relative w-32 h-32">
            <!-- Foto profil - hanya tampilkan jika URL tersedia dan tidak error -->
            <img 
              v-if="shouldShowPhoto"
              :src="contactPhotoUrl" 
              :alt="contactName" 
              class="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
              @error="handleImageError"
              @load="handleImageLoad"
            />

            <!-- Fallback avatar - tampilkan jika tidak ada foto atau error -->
            <div 
              v-else
              :class="['w-full h-full rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg', contactAvatarClass]"
            >
              {{ contactInitial }}
            </div>
          </div>

          <h2 class="text-3xl font-bold text-white">{{ contactName }}</h2>
        </div>
        
        <p v-if="isConnected" class="text-gray-300">
          Panggilan terhubung
        </p>

        <div v-if="isConnected" class="text-2xl font-mono mt-2">
          {{ formattedDuration }}
        </div>
        
        <div v-else class="text-yellow-400 animate-pulse mt-2">
          Menghubungkan...
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