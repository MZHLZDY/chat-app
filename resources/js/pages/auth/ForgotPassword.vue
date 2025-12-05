<script setup lang="ts">
import { Head, useForm, Link } from '@inertiajs/vue3';
import { Mail, ArrowLeft, Loader2, KeyRound, CheckCircle } from 'lucide-vue-next';

defineProps<{
    status?: string;
}>();

const form = useForm({
    email: '',
});

const submit = () => {
    form.post(route('password.email'));
};
</script>

<template>
    <Head title="Lupa Password" />

    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 relative overflow-hidden">
        
        <!-- Background Blobs (Konsisten dengan Login/Register) -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative z-10">
            
            <!-- Header Icon -->
            <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 shadow-sm">
                    <KeyRound class="w-7 h-7" />
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Lupa Kata Sandi?</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    Jangan khawatir. Masukkan email Anda dan kami akan mengirimkan link untuk mereset password.
                </p>
            </div>

            <!-- Status Message -->
            <div v-if="status" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl flex items-start gap-3">
                <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <span class="text-sm font-medium text-green-700 dark:text-green-300">
                    {{ status }}
                </span>
            </div>

            <form @submit.prevent="submit" class="space-y-6">
                
                <!-- Input Email -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Terdaftar</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="email" 
                            type="email" 
                            v-model="form.email" 
                            required 
                            autofocus 
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="nama@email.com"
                        />
                    </div>
                    <p v-if="form.errors.email" class="text-red-500 text-xs mt-1">{{ form.errors.email }}</p>
                </div>

                <!-- Tombol Submit -->
                <button 
                    :disabled="form.processing" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Loader2 v-if="form.processing" class="w-5 h-5 animate-spin" />
                    <span v-else>Kirim Link Reset</span>
                </button>

                <!-- Back to Login -->
                <div class="pt-2 text-center">
                    <Link 
                        :href="route('login')" 
                        class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-medium group"
                    >
                        <ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Kembali ke Login
                    </Link>
                </div>
            </form>
        </div>
    </div>
</template>