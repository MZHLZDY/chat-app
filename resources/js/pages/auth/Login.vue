<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3';
import { MessageCircle, User, Lock, Loader2 } from 'lucide-vue-next';

defineProps<{
    canResetPassword?: boolean;
    status?: string;
}>();

const form = useForm({
    // Kita gunakan nama field 'login' atau 'email' sesuai yang diminta backend. 
    // Umumnya jika custom backend pakai 'login', tapi kalau default breeze pakai 'email'.
    // Disini saya pakai 'email' tapi inputnya teks bebas agar kompatibel dengan validasi backendmu.
    email: '', 
    password: '',
    remember: false,
});

const submit = () => {
    form.post(route('login'), {
        onFinish: () => {
            form.reset('password');
        },
    });
};
</script>

<template>
    <Head title="Masuk" />

    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 relative overflow-hidden">
        
        <!-- Background Blobs -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative z-10">
            
            <!-- Logo & Header -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 transform transition-transform hover:scale-110 duration-300">
                    <MessageCircle class="w-8 h-8" />
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Selamat Datang! 👋</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Silakan masuk untuk melanjutkan obrolan.</p>
            </div>

            <div v-if="status" class="mb-4 p-3 rounded-lg bg-green-50 text-green-600 text-sm font-medium text-center">
                {{ status }}
            </div>

            <form @submit.prevent="submit" class="space-y-5">
                <!-- Input Identity (Email/Phone/Username) -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email / No. HP / Username</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User class="h-5 w-5 text-gray-400" />
                        </div>
                        <!-- Tipe text agar bisa input nomor HP atau Username -->
                        <input 
                            id="identity" 
                            type="text" 
                            v-model="form.email" 
                            required 
                            autofocus 
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="Masukan email, username, atau no hp"
                        />
                    </div>
                    <p v-if="form.errors.email" class="text-red-500 text-xs mt-1">{{ form.errors.email }}</p>
                </div>

                <!-- Input Password -->
                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                    </div>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="password" 
                            type="password" 
                            v-model="form.password" 
                            required 
                            autocomplete="current-password"
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="••••••••"
                        />
                    </div>
                    <p v-if="form.errors.password" class="text-red-500 text-xs mt-1">{{ form.errors.password }}</p>
                </div>

                <!-- Remember & Forgot Password -->
                <div class="flex items-center justify-between">
                    <label class="flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            v-model="form.remember" 
                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500 w-4 h-4 cursor-pointer" 
                        />
                        <span class="ml-2 text-sm text-gray-600 dark:text-gray-400 select-none">Ingat saya</span>
                    </label>

                    <Link 
                        v-if="canResetPassword" 
                        :href="route('password.request')" 
                        class="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
                    >
                        Lupa password?
                    </Link>
                </div>

                <!-- Tombol Submit -->
                <button 
                    :disabled="form.processing" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                    <Loader2 v-if="form.processing" class="w-5 h-5 animate-spin" />
                    <span v-else>Masuk Sekarang</span>
                </button>
            </form>

            <!-- Footer Link -->
            <div class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-center">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    Belum punya akun? 
                    <Link :href="route('register')" class="text-blue-600 font-bold hover:text-blue-500 hover:underline transition-all">
                        Daftar disini
                    </Link>
                </p>
            </div>
        </div>
    </div>
</template>