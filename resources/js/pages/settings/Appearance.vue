<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import { Head } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted } from 'vue';
import { Monitor, Moon, Sun, CheckCircle2, Smartphone } from 'lucide-vue-next';

// --- STATE ---
type Theme = 'light' | 'dark' | 'system';
const currentTheme = ref<Theme>('system');

// Media Query Listener untuk deteksi perubahan sistem realtime
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// --- ACTIONS ---
const applyTheme = () => {
    const root = document.documentElement;
    const isDark = 
        currentTheme.value === 'dark' || 
        (currentTheme.value === 'system' && mediaQuery.matches);
    
    if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (currentTheme.value === 'system') {
        applyTheme();
    }
};

const setTheme = (theme: Theme) => {
    currentTheme.value = theme;
    localStorage.setItem('theme', theme);
    applyTheme();
};

// --- LIFECYCLE ---
onMounted(() => {
    // 1. Load saved theme
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
        currentTheme.value = savedTheme;
    }
    
    // 2. Apply theme immediately
    applyTheme();

    // 3. Listen to system changes (Realtime Dynamic)
    mediaQuery.addEventListener('change', handleSystemThemeChange);
});

onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
});
</script>

<template>
    <Head title="Tampilan Aplikasi" />

    <AppLayout>
        <SettingsLayout>
            <div class="space-y-6">
                
                <!-- HEADER SECTION -->
                <div>
                    <h3 class="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Tampilan</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sesuaikan tema aplikasi dengan kenyamanan mata Anda.
                    </p>
                </div>

                <!-- THEME SELECTION CARD -->
                <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-8 shadow-sm">
                    <div class="space-y-6">
                        
                        <!-- Pilihan Grid -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            
                            <!-- Light Mode Option -->
                            <button 
                                @click="setTheme('light')"
                                :class="[
                                    'group relative flex items-center sm:flex-col sm:items-center gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98]',
                                    currentTheme === 'light' 
                                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-600/20' 
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                ]"
                            >
                                <!-- Mockup Visual (Desktop & Mobile Friendly) -->
                                <div class="w-20 sm:w-full aspect-square sm:aspect-video rounded-lg bg-[#f3f4f6] border border-gray-200 relative overflow-hidden shadow-sm shrink-0">
                                    <!-- UI Elements -->
                                    <div class="absolute top-2 left-2 right-2 h-1.5 sm:h-2 bg-white rounded-full shadow-sm"></div>
                                    <div class="absolute top-5 left-2 w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full shadow-sm"></div>
                                    <div class="absolute top-5 left-10 right-2 h-12 sm:h-16 bg-white rounded-lg shadow-sm"></div>
                                </div>
                                
                                <!-- Label & Check -->
                                <div class="flex-1 flex items-center justify-between sm:justify-center w-full">
                                    <div class="flex items-center gap-2">
                                        <Sun class="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
                                        <span class="text-sm font-medium text-gray-900 dark:text-white">Terang</span>
                                    </div>
                                    <CheckCircle2 v-if="currentTheme === 'light'" class="w-5 h-5 text-blue-600 sm:absolute sm:top-3 sm:right-3" />
                                </div>
                            </button>

                            <!-- Dark Mode Option -->
                            <button 
                                @click="setTheme('dark')"
                                :class="[
                                    'group relative flex items-center sm:flex-col sm:items-center gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98]',
                                    currentTheme === 'dark' 
                                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-600/20' 
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                ]"
                            >
                                <div class="w-20 sm:w-full aspect-square sm:aspect-video rounded-lg bg-[#111827] border border-gray-700 relative overflow-hidden shadow-sm shrink-0">
                                    <!-- UI Elements Dark -->
                                    <div class="absolute top-2 left-2 right-2 h-1.5 sm:h-2 bg-gray-800 rounded-full"></div>
                                    <div class="absolute top-5 left-2 w-6 h-6 sm:w-8 sm:h-8 bg-gray-800 rounded-full"></div>
                                    <div class="absolute top-5 left-10 right-2 h-12 sm:h-16 bg-gray-800 rounded-lg"></div>
                                </div>
                                
                                <div class="flex-1 flex items-center justify-between sm:justify-center w-full">
                                    <div class="flex items-center gap-2">
                                        <Moon class="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
                                        <span class="text-sm font-medium text-gray-900 dark:text-white">Gelap</span>
                                    </div>
                                    <CheckCircle2 v-if="currentTheme === 'dark'" class="w-5 h-5 text-blue-600 sm:absolute sm:top-3 sm:right-3" />
                                </div>
                            </button>

                            <!-- System Option -->
                            <button 
                                @click="setTheme('system')"
                                :class="[
                                    'group relative flex items-center sm:flex-col sm:items-center gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98]',
                                    currentTheme === 'system' 
                                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-600/20' 
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                ]"
                            >
                                <div class="w-20 sm:w-full aspect-square sm:aspect-video rounded-lg bg-gradient-to-br from-[#f3f4f6] to-[#111827] border border-gray-200 dark:border-gray-700 relative overflow-hidden shadow-sm flex items-center justify-center shrink-0">
                                    <!-- UI Elements System -->
                                    <div class="text-[10px] sm:text-xs text-gray-500 font-medium bg-white/90 dark:bg-black/80 px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                        Auto
                                    </div>
                                </div>
                                
                                <div class="flex-1 flex items-center justify-between sm:justify-center w-full">
                                    <div class="flex items-center gap-2">
                                        <div class="hidden sm:block">
                                            <Monitor class="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
                                        </div>
                                        <div class="block sm:hidden">
                                            <Smartphone class="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
                                        </div>
                                        <span class="text-sm font-medium text-gray-900 dark:text-white">Sistem</span>
                                    </div>
                                    <CheckCircle2 v-if="currentTheme === 'system'" class="w-5 h-5 text-blue-600 sm:absolute sm:top-3 sm:right-3" />
                                </div>
                            </button>

                        </div>

                        <!-- Info Text -->
                        <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div class="flex gap-3">
                                <div class="shrink-0 mt-0.5">
                                    <Monitor class="w-5 h-5 text-gray-400 hidden sm:block" />
                                    <Smartphone class="w-5 h-5 text-gray-400 block sm:hidden" />
                                </div>
                                <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Pilih <strong>Sistem</strong> untuk menyesuaikan tampilan aplikasi secara otomatis mengikuti pengaturan mode gelap/terang pada perangkat {{ 'HP/Laptop' }} Anda.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </SettingsLayout>
    </AppLayout>
</template>