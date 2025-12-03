<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3';
import { User, Mail, Phone, Lock, CheckCircle, Loader2 } from 'lucide-vue-next';

const form = useForm({
    name: '',
    email: '',
    phone_number: '', // Field baru untuk backend
    password: '',
    password_confirmation: '',
});

const submit = () => {
    form.post(route('register'), {
        onFinish: () => {
            form.reset('password', 'password_confirmation');
        },
    });
};
</script>

<template>
    <Head title="Daftar Akun Baru" />

    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 relative overflow-hidden">
        
        <!-- Background Blobs -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative z-10">
            
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 shadow-sm">
                    <User class="w-7 h-7" />
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Buat Akun Baru</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Lengkapi data diri untuk mulai chatting!</p>
            </div>

            <form @submit.prevent="submit" class="space-y-4">
                
                <!-- Input Nama -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nama Lengkap</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="name" 
                            type="text" 
                            v-model="form.name" 
                            required 
                            autofocus 
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="Contoh: Budi Santoso"
                        />
                    </div>
                    <p v-if="form.errors.name" class="text-red-500 text-xs mt-1">{{ form.errors.name }}</p>
                </div>

                <!-- Input Email -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="email" 
                            type="email" 
                            v-model="form.email" 
                            required 
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="nama@email.com"
                        />
                    </div>
                    <p v-if="form.errors.email" class="text-red-500 text-xs mt-1">{{ form.errors.email }}</p>
                </div>

                <!-- Input Nomor Telepon (BARU) -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nomor Telepon</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="phone" 
                            type="tel" 
                            v-model="form.phone_number" 
                            required 
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="08123456789"
                        />
                    </div>
                    <p v-if="form.errors.phone_number" class="text-red-500 text-xs mt-1">{{ form.errors.phone_number }}</p>
                </div>

                <!-- Input Password -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="password" 
                            type="password" 
                            v-model="form.password" 
                            required 
                            autocomplete="new-password"
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="Minimal 8 karakter"
                        />
                    </div>
                    <p v-if="form.errors.password" class="text-red-500 text-xs mt-1">{{ form.errors.password }}</p>
                </div>

                <!-- Input Konfirmasi Password -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ulangi Password</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CheckCircle class="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            id="password_confirmation" 
                            type="password" 
                            v-model="form.password_confirmation" 
                            required 
                            autocomplete="new-password"
                            class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                            placeholder="Ketik ulang password tadi"
                        />
                    </div>
                    <p v-if="form.errors.password_confirmation" class="text-red-500 text-xs mt-1">{{ form.errors.password_confirmation }}</p>
                </div>

                <!-- Tombol Submit -->
                <div class="pt-2">
                    <button 
                        :disabled="form.processing" 
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                        <Loader2 v-if="form.processing" class="w-5 h-5 animate-spin" />
                        <span v-else>Daftar Sekarang</span>
                    </button>
                </div>
            </form>

            <div class="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 text-center">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    Sudah punya akun? 
                    <Link :href="route('login')" class="text-blue-600 font-bold hover:text-blue-500 hover:underline transition-all">
                        Masuk disini
                    </Link>
                </p>
            </div>
        </div>
    </div>
</template>