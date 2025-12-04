<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import { Head, useForm } from '@inertiajs/vue3';
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, KeyRound, Loader2, CheckCircle2 } from 'lucide-vue-next';

// --- STATE ---
const passwordInput = ref<HTMLInputElement | null>(null);
const currentPasswordInput = ref<HTMLInputElement | null>(null);

const form = useForm({
    current_password: '',
    password: '',
    password_confirmation: '',
});

// --- ACTIONS ---
const updatePassword = () => {
    form.put(route('password.update'), {
        preserveScroll: true,
        onSuccess: () => form.reset(),
        onError: () => {
            if (form.errors.password) {
                form.reset('password', 'password_confirmation');
                passwordInput.value?.focus();
            }
            if (form.errors.current_password) {
                form.reset('current_password');
                currentPasswordInput.value?.focus();
            }
        },
    });
};
</script>

<template>
    <Head title="Keamanan Akun" />

    <AppLayout>
        <SettingsLayout>
            <div class="space-y-6 max-w-2xl">
                
                <!-- HEADER SECTION -->
                <div>
                    <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Password</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Pastikan akun Anda menggunakan password yang panjang dan acak agar tetap aman.
                    </p>
                </div>

                <!-- FORM CARD -->
                <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-sm">
                    <form @submit.prevent="updatePassword" class="space-y-6">
                        
                        <!-- Current Password -->
                        <div class="space-y-2">
                            <Label for="current_password">Password Saat Ini</Label>
                            <div class="relative">
                                <Lock class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input 
                                    id="current_password"
                                    ref="currentPasswordInput"
                                    v-model="form.current_password"
                                    type="password"
                                    class="pl-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                                    autocomplete="current-password"
                                    placeholder="••••••••"
                                />
                            </div>
                            <InputError :message="form.errors.current_password" />
                        </div>

                        <!-- New Password -->
                        <div class="space-y-2">
                            <Label for="password">Password Baru</Label>
                            <div class="relative">
                                <KeyRound class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input 
                                    id="password"
                                    ref="passwordInput"
                                    v-model="form.password"
                                    type="password"
                                    class="pl-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                                    autocomplete="new-password"
                                    placeholder="Minimal 8 karakter"
                                />
                            </div>
                            <InputError :message="form.errors.password" />
                        </div>

                        <!-- Confirm Password -->
                        <div class="space-y-2">
                            <Label for="password_confirmation">Konfirmasi Password</Label>
                            <div class="relative">
                                <KeyRound class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input 
                                    id="password_confirmation"
                                    v-model="form.password_confirmation"
                                    type="password"
                                    class="pl-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-colors"
                                    autocomplete="new-password"
                                    placeholder="Ulangi password baru"
                                />
                            </div>
                            <InputError :message="form.errors.password_confirmation" />
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-4 pt-2">
                            <Button :disabled="form.processing">
                                <Loader2 v-if="form.processing" class="mr-2 h-4 w-4 animate-spin" />
                                Simpan Password
                            </Button>

                            <Transition
                                enter-active-class="transition ease-in-out duration-300"
                                enter-from-class="opacity-0 translate-y-2"
                                enter-to-class="opacity-100 translate-y-0"
                                leave-active-class="transition ease-in duration-200"
                                leave-from-class="opacity-100"
                                leave-to-class="opacity-0"
                            >
                                <p v-if="form.recentlySuccessful" class="text-sm text-green-600 font-medium flex items-center gap-2">
                                    <CheckCircle2 class="w-4 h-4" />
                                    Tersimpan.
                                </p>
                            </Transition>
                        </div>
                    </form>
                </div>

            </div>
        </SettingsLayout>
    </AppLayout>
</template>