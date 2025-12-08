<script setup lang="ts">
import { PhoneForwarded, Maximize2 } from 'lucide-vue-next';

defineProps({
  name: { type: String, required: true },
  duration: { type: String, default: '00:00' },
  profilePhotoUrl: { type: String, default: null },
});

defineEmits(['expand-call', 'end-call']);
</script>

<template>
  <div 
    class="fixed top-4 right-4 w-72 z-[101] 
           sm:top-5 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[90%] sm:max-w-sm 
           bg-gray-600 text-white rounded-lg shadow-2xl p-3 flex items-center justify-between animate-fade-in-down"
  >
    <div class="flex items-center gap-3 overflow-hidden">
      <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden">
        <img 
          v-if="profilePhotoUrl" 
          :src="profilePhotoUrl" 
          :alt="name" 
          class="w-full h-full object-cover"
        >
        <div v-else class="w-full h-full bg-blue-600 flex items-center justify-center">
          {{ name.charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="truncate">
        <p class="font-bold text-sm leading-tight truncate">{{ name }}</p>
        <p class="text-xs text-green-400">{{ duration }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <button @click="$emit('expand-call')" class="p-2 rounded-full hover:bg-gray-700" title="Kembali ke Maximize Mode">
        <Maximize2 class="w-5 h-5" />
      </button>
      <button @click="$emit('end-call')" class="p-2 bg-red-600 text-white rounded-full hover:bg-red-700" title="Akhiri Panggilan">
        <PhoneForwarded class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<style>
/* Animasi sederhana untuk widget */
@keyframes fade-in-down {
  from {
    opacity: 0;
    transform: translate(0, -20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

/* Penyesuaian animasi untuk desktop (yang terpusat) */
@media (min-width: 640px) {
  @keyframes fade-in-down {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
}

.animate-fade-in-down {
  animation: fade-in-down 0.3s ease-out forwards;
}
</style>