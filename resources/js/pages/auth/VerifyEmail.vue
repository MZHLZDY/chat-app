<script setup lang="ts">
import { computed } from 'vue';
import { Head, Link, useForm } from '@inertiajs/vue3';
import { Mail, LogOut, Loader2, CheckCircle } from 'lucide-vue-next';

const props = defineProps<{
    status?: string;
}>();

const form = useForm({});

const submit = () => {
    form.post(route('verification.send'));
};

const verificationLinkSent = computed(() => props.status === 'verification-link-sent');
</script>

<template>
    <Head title="Verifikasi Email" />

    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 relative overflow-hidden">
        
        <!-- Dekorasi Background (Sama persis kayak Login/Register) -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative z-10 text-center">
            
            <!-- Icon Header -->
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6 shadow-sm">
                <Mail class="w-8 h-8" />
            </div>

            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Cek Email Kamu Yuk!</h2>
            
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Terima kasih sudah mendaftar! Sebelum mulai chatting, tolong klik link verifikasi yang baru saja kami kirim ke email kamu ya.
            </p>

            <!-- Notifikasi Sukses -->
            <transition
                enter-active-class="transition ease-out duration-300"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
            >
                <div v-if="verificationLinkSent" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl flex items-center gap-3 text-left">
                    <div class="bg-green-100 dark:bg-green-800 rounded-full p-1 shrink-0">
                        <CheckCircle class="w-4 h-4 text-green-600 dark:text-green-300" />
                    </div>
                    <span class="text-green-700 dark:text-green-300 text-sm font-medium">
                        Link verifikasi baru sudah dikirim! Cek inbox atau folder spam kamu ya. 🚀
                    </span>
                </div>
            </transition>

            <form @submit.prevent="submit" class="space-y-4">
                <button 
                    :disabled="form.processing" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Loader2 v-if="form.processing" class="w-5 h-5 animate-spin" />
                    <span v-else>Kirim Ulang Link Verifikasi</span>
                </button>

                <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Link 
                        :href="route('logout')" 
                        method="post" 
                        as="button" 
                        class="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto group"
                    >
                        <LogOut class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        Keluar / Log Out
                    </Link>
                </div>
            </form>
        </div>
    </div>
</template>