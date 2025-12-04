<script setup lang="ts">
import Heading from '@/components/Heading.vue';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

// --- LOGIC (Dipertahankan) ---
const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: '/settings/profile',
    },
    {
        title: 'Password',
        href: '/settings/password',
    },
    {
        title: 'Appearance',
        href: '/settings/appearance',
    },
];

const page = usePage();
const currentPath = computed(() => page.props.ziggy?.location ? new URL(page.props.ziggy.location).pathname : '');
</script>

<template>
    <div class="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            
            <!-- Header Section -->
            <div class="mb-8">
                <Heading 
                    title="Pengaturan" 
                    description="Kelola preferensi akun dan profil Anda di sini." 
                    class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
                />
            </div>

            <Separator class="my-6 opacity-60" />

            <div class="flex flex-col lg:flex-row lg:space-x-12 lg:space-y-0 space-y-8">
                
                <!-- SIDEBAR NAVIGATION -->
                <aside class="lg:w-1/5 order-1">
                    <nav class="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 sticky top-20">
                        <Button
                            v-for="item in sidebarNavItems"
                            :key="item.href"
                            variant="ghost"
                            as-child
                            :class="[
                                'justify-start w-full lg:w-auto text-sm font-medium transition-all duration-200 rounded-lg px-4 py-2.5',
                                currentPath === item.href 
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700' 
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                            ]"
                        >
                            <Link :href="item.href" class="flex items-center gap-2 whitespace-nowrap">
                                <!-- Indikator Aktif (Dot Biru) -->
                                <span 
                                    v-if="currentPath === item.href" 
                                    class="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mr-1 hidden lg:block"
                                ></span>
                                {{ item.title }}
                            </Link>
                        </Button>
                    </nav>
                </aside>

                <!-- MAIN CONTENT AREA -->
                <div class="flex-1 lg:max-w-4xl order-2">
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[500px] p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <slot />
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>