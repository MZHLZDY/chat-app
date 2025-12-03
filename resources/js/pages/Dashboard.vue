<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, Link, usePage } from '@inertiajs/vue3';
import { 
    MessageSquare, 
    Users, 
    UserPlus, 
    Settings, 
    Clock,
    Search
} from 'lucide-vue-next';
import type { User as UserType } from '@/types';

const page = usePage();
const user = page.props.auth.user as UserType;

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
];
</script>

<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            
            <!-- 1. Header Section (Simpel & To-the-point) -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                        Halo, {{ user.name }} 👋
                    </h1>
                    <p class="text-gray-500 dark:text-gray-400 mt-1">
                        Selamat datang kembali di pusat obrolan Anda.
                    </p>
                </div>
                
                <Link :href="route('chat')" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md">
                    <MessageSquare class="w-4 h-4" />
                    Mulai Chat Baru
                </Link>
            </div>

            <!-- 2. Statistik Ringkas (Kartu Grid) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Card Pesan -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <MessageSquare class="w-6 h-6" />
                        </div>
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Status Chat</p>
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white">Siap Terhubung</h3>
                        </div>
                    </div>
                </div>

                <!-- Card Teman -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                            <Users class="w-6 h-6" />
                        </div>
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Status Akun</p>
                            <h3 class="text-lg font-bold text-green-600 dark:text-green-400">Online Active</h3>
                        </div>
                    </div>
                </div>

                <!-- Card Waktu -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <Clock class="w-6 h-6" />
                        </div>
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Login Terakhir</p>
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white">Baru Saja</h3>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Layout Utama (Kiri Konten, Kanan Sidebar) -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <!-- Kiri: Area Aktivitas (Placeholder) -->
                <div class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <h3 class="font-semibold text-gray-900 dark:text-white">Aktivitas Terakhir</h3>
                        <span class="text-xs font-medium text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Hari Ini</span>
                    </div>
                    
                    <!-- Empty State: Tampilan kalau belum ada chat recent di dashboard -->
                    <div class="flex-1 p-8 text-center flex flex-col items-center justify-center">
                        <div class="w-20 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-600">
                            <Search class="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum ada aktivitas terbaru</h4>
                        <p class="text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">
                            Dashboard ini akan menampilkan riwayat chat terakhirmu nanti. Untuk sekarang, yuk mulai cari teman baru!
                        </p>
                        <Link :href="route('chat')" class="text-blue-600 hover:text-blue-500 font-semibold hover:underline flex items-center gap-1">
                            Ke Halaman Chat <MessageSquare class="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                <!-- Kanan: Menu Cepat (Sidebar) -->
                <div class="space-y-6">
                    <!-- Quick Actions Card -->
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                        <h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Settings class="w-4 h-4" /> Menu Cepat
                        </h3>
                        <div class="space-y-2">
                            <Link :href="route('profile.edit')" class="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                                <span class="text-gray-600 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">Edit Profil</span>
                                <Settings class="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            </Link>
                            <Link :href="route('chat')" class="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                                <span class="text-gray-600 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">Cari Teman</span>
                                <UserPlus class="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            </Link>
                        </div>
                    </div>

                    <!-- Banner Info Kecil -->
                    <div class="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                        <h4 class="font-bold text-lg mb-1">Tips Hari Ini 💡</h4>
                        <p class="text-blue-100 text-sm leading-relaxed">
                            Jangan lupa melengkapi foto profilmu agar teman-teman mudah mengenali akunmu saat chatting!
                        </p>
                    </div>
                </div>

            </div>

        </div>
    </AppLayout>
</template>