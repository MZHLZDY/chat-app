<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { MessageCircle, ArrowRight } from 'lucide-vue-next';

defineProps<{
    canLogin?: boolean;
    canRegister?: boolean;
}>();
</script>

<template>
    <Head title="Selamat Datang" />

    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 selection:bg-blue-500 selection:text-white relative overflow-hidden flex flex-col">
        
        <!-- Background Blobs (Sama kayak Login biar konsisten) -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl opacity-50"></div>
        </div>

        <!-- Navbar -->
        <nav class="relative z-50 w-full p-6 flex justify-between items-center max-w-6xl mx-auto">
            <div class="flex items-center gap-2">
                <div class="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                    <MessageCircle class="w-6 h-6 text-white" />
                </div>
                <span class="font-bold text-xl tracking-tight">ChatApp</span>
            </div>

            <div v-if="canLogin" class="flex items-center gap-6">
                <Link 
                    v-if="$page.props.auth.user" 
                    :href="route('dashboard')" 
                    class="font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                    Dashboard
                </Link>

                <template v-else>
                    <Link 
                        :href="route('login')" 
                        class="font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                        Masuk
                    </Link>

                    <Link 
                        v-if="canRegister" 
                        :href="route('register')" 
                        class="hidden sm:inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition shadow-lg shadow-blue-600/20 hover:-translate-y-0.5"
                    >
                        Daftar Akun
                    </Link>
                </template>
            </div>
        </nav>

        <!-- Main Hero -->
        <main class="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center max-w-4xl mx-auto mt-10 mb-20">
            
            <!-- Badge Kecil -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm mb-8 animate-fade-in-up">
                <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Online & Siap Chatting</span>
            </div>

            <!-- Judul Besar -->
            <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 dark:from-white dark:via-blue-200 dark:text-white">
                Ngobrol Jadi Lebih <br/>
                <span class="text-blue-600 dark:text-blue-400">Seru & Gampang.</span>
            </h1>

            <p class="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl leading-relaxed">
                Gak perlu ribet. Cukup login, cari temen, dan mulai obrolan seru kapan aja dan dimana aja. Simpel banget kan?
            </p>

            <!-- Tombol CTA -->
            <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-16">
                <Link 
                    :href="$page.props.auth.user ? route('chat') : route('register')" 
                    class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/30 transition transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                >
                    {{ $page.props.auth.user ? 'Lanjut Chatting' : 'Mulai Sekarang' }}
                    <ArrowRight class="w-5 h-5" />
                </Link>
            </div>

            <!-- Mockup Chat Sederhana -->
            <div class="w-full max-w-2xl relative mx-auto">
                <div class="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20"></div>
                <div class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-2xl">
                    <!-- Fake Chat Header -->
                    <div class="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">
                        <div class="flex gap-1.5">
                            <div class="w-3 h-3 rounded-full bg-red-400"></div>
                            <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div class="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div class="ml-auto text-xs font-mono text-gray-400">ChatApp Demo v1.0</div>
                    </div>
                    
                    <!-- Fake Chat Bubbles -->
                    <div class="space-y-4 px-2">
                        <!-- Teman -->
                        <div class="flex gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-bold text-blue-600">A</div>
                            <div class="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-2xl rounded-tl-none text-sm max-w-xs text-gray-700 dark:text-gray-200">
                                Woi bro! Aplikasi chatnya udah jadi nih? 🤔
                            </div>
                        </div>
                        
                        <!-- Kita -->
                        <div class="flex gap-3 flex-row-reverse">
                            <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-xs font-bold text-purple-600">M</div>
                            <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm max-w-xs shadow-md">
                                Udah dong! Tampilannya simpel tapi keren banget. Cobain deh login sekarang! 🔥
                            </div>
                        </div>

                         <!-- Teman Balas -->
                         <div class="flex gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-bold text-blue-600">A</div>
                            <div class="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-2xl rounded-tl-none text-sm max-w-xs text-gray-700 dark:text-gray-200">
                                Wah mantap! Otw daftar nih 🚀
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </main>

        <footer class="py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
            &copy; 2025 ChatApp 
        </footer>
    </div>
</template>