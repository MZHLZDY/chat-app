<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next';
</script>

<template>
    <div class="flex items-center justify-center bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
        <MessageCircle class="w-6 h-6 text-white" />
    </div>
    <div class="ml-1 grid flex-1 text-left text-sm">
        <span class="mb-0.5 truncate leading-tight font-semibold">Chat App</span>
    </div>
</template>
