<script setup lang="ts">
import { ref, computed } from 'vue';
import { Head, useForm, usePage, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import DeleteUser from '@/components/DeleteUser.vue'; // Pastikan komponen ini ada atau sesuaikan
import { 
    Camera, Image as ImageIcon, Save, Loader2, 
    User, Mail, Phone, UploadCloud 
} from 'lucide-vue-next';
import axios from 'axios';

// --- TYPE DEFINITION ---
import type { User as UserType } from '@/types';

const page = usePage();
const user = computed(() => page.props.auth.user as UserType);

// --- STATE ---
const form = useForm({
    name: user.value.name,
    email: user.value.email,
    phone_number: user.value.phone_number || '',
});

const photoInput = ref<HTMLInputElement | null>(null);
const bgInput = ref<HTMLInputElement | null>(null);
const photoPreview = ref<string | null>(null);
const bgPreview = ref<string | null>(null);
const isUploadingPhoto = ref(false);
const isUploadingBg = ref(false);

// --- ACTIONS ---

// 1. Update Profile Info
const updateProfileInformation = () => {
    form.patch(route('profile.update'), {
        preserveScroll: true,
        onSuccess: () => {
            // Optional: Show toast
        },
    });
};

// 2. Upload Photo (Via Axios karena Controller return JSON)
const selectPhoto = () => photoInput.value?.click();

const updatePhoto = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
        const file = input.files[0];
        
        // Preview Instant
        const reader = new FileReader();
        reader.onload = (e) => { photoPreview.value = e.target?.result as string; };
        reader.readAsDataURL(file);

        // Upload
        const formData = new FormData();
        formData.append('photo', file);
        isUploadingPhoto.value = true;

        try {
            await axios.post(route('profile.photo.update'), formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Reload data user di Inertia agar header/sidebar ikut berubah
            router.reload({ only: ['auth'] });
        } catch (error) {
            console.error("Gagal upload foto", error);
            photoPreview.value = null; // Revert preview
        } finally {
            isUploadingPhoto.value = false;
        }
    }
};

// 3. Upload Background (Via Inertia Form karena Controller return Back)
const selectBg = () => bgInput.value?.click();

const updateBackground = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
        const file = input.files[0];
        
        // Preview Instant
        const reader = new FileReader();
        reader.onload = (e) => { bgPreview.value = e.target?.result as string; };
        reader.readAsDataURL(file);

        // Upload
        const bgForm = useForm({ background: file });
        isUploadingBg.value = true;
        
        bgForm.post(route('profile.background.update'), {
            preserveScroll: true,
            onSuccess: () => {
                isUploadingBg.value = false;
                if(bgInput.value) bgInput.value.value = '';
            },
            onError: () => {
                isUploadingBg.value = false;
                bgPreview.value = null;
            }
        });
    }
};
</script>

<template>
    <Head title="Pengaturan Profil" />

    <AppLayout>
        <SettingsLayout>
            
            <div class="space-y-8 pb-10">
                
                <!-- BAGIAN 1: VISUAL HEADER (Cover & Avatar) -->
                <section class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    
                    <!-- Cover Image Area -->
                    <div class="relative h-48 bg-gray-100 dark:bg-gray-900 group">
                        <img 
                            :src="bgPreview || user.background_image_url || 'https://via.placeholder.com/800x300?text=No+Cover'" 
                            class="w-full h-full object-cover transition-opacity duration-500"
                            alt="Cover Image"
                        />
                        
                        <!-- Overlay Edit Cover -->
                        <div class="absolute inset-0 bg-black/10 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <input type="file" ref="bgInput" class="hidden" @change="updateBackground" accept="image/*">
                            <button 
                                @click="selectBg"
                                :disabled="isUploadingBg"
                                class="bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                                <Loader2 v-if="isUploadingBg" class="w-4 h-4 animate-spin" />
                                <ImageIcon v-else class="w-4 h-4" />
                                <span>Ganti Sampul</span>
                            </button>
                        </div>
                    </div>

                    <!-- Profile Info Area -->
                    <div class="px-6 pb-6 relative">
                        <div class="flex flex-col sm:flex-row items-center sm:items-end -mt-12 sm:-mt-14 mb-4 gap-6">
                            
                            <!-- Avatar Circle -->
                            <div class="relative group">
                                <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-700 overflow-hidden shadow-md">
                                    <img 
                                        :src="photoPreview || user.profile_photo_url" 
                                        class="w-full h-full object-cover"
                                        alt="Avatar"
                                    />
                                </div>
                                <!-- Edit Avatar Button -->
                                <input type="file" ref="photoInput" class="hidden" @change="updatePhoto" accept="image/*">
                                <button 
                                    @click="selectPhoto"
                                    :disabled="isUploadingPhoto"
                                    class="absolute bottom-1 right-1 p-2 bg-blue-600 text-white rounded-full border-2 border-white dark:border-gray-800 shadow-sm hover:bg-blue-700 transition-colors z-10"
                                    title="Ubah Foto Profil"
                                >
                                    <Loader2 v-if="isUploadingPhoto" class="w-4 h-4 animate-spin" />
                                    <Camera v-else class="w-4 h-4" />
                                </button>
                            </div>

                            <!-- User Name & Email -->
                            <div class="text-center sm:text-left flex-1 space-y-1">
                                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ user.name }}</h2>
                                <p class="text-gray-500 dark:text-gray-400 font-medium">{{ user.email }}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- BAGIAN 2: EDIT FORMULIR -->
                <section class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
                    <div class="mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <User class="w-5 h-5 text-blue-600" />
                            Informasi Pribadi
                        </h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Perbarui informasi dasar profil Anda di sini.
                        </p>
                    </div>

                    <form @submit.prevent="updateProfileInformation" class="space-y-6 max-w-2xl">
                        
                        <!-- Nama -->
                        <div class="space-y-1">
                            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User class="h-5 w-5 text-gray-400" />
                                </div>
                                <input 
                                    id="name" 
                                    v-model="form.name" 
                                    type="text" 
                                    class="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all" 
                                    placeholder="Masukkan nama lengkap" 
                                />
                            </div>
                            <p v-if="form.errors.name" class="text-xs text-red-500 mt-1">{{ form.errors.name }}</p>
                        </div>

                        <!-- Email -->
                        <div class="space-y-1">
                            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Alamat Email</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail class="h-5 w-5 text-gray-400" />
                                </div>
                                <input 
                                    id="email" 
                                    v-model="form.email" 
                                    type="email" 
                                    class="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all" 
                                    placeholder="nama@email.com" 
                                />
                            </div>
                            <p v-if="form.errors.email" class="text-xs text-red-500 mt-1">{{ form.errors.email }}</p>
                        </div>

                        <!-- Phone -->
                        <div class="space-y-1">
                            <label for="phone" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor Telepon</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone class="h-5 w-5 text-gray-400" />
                                </div>
                                <input 
                                    id="phone" 
                                    v-model="form.phone_number" 
                                    type="tel" 
                                    class="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all" 
                                    placeholder="0812..." 
                                />
                            </div>
                            <p v-if="form.errors.phone_number" class="text-xs text-red-500 mt-1">{{ form.errors.phone_number }}</p>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-4 pt-4">
                            <button 
                                type="submit" 
                                :disabled="form.processing || !form.isDirty"
                                class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Loader2 v-if="form.processing" class="w-4 h-4 animate-spin" />
                                <Save v-else class="w-4 h-4" />
                                Simpan Perubahan
                            </button>

                            <Transition
                                enter-active-class="transition ease-out duration-300"
                                enter-from-class="opacity-0 translate-y-2"
                                enter-to-class="opacity-100 translate-y-0"
                                leave-active-class="transition ease-in duration-300"
                                leave-from-class="opacity-100"
                                leave-to-class="opacity-0"
                            >
                                <span v-if="form.recentlySuccessful" class="text-sm text-green-600 font-medium">
                                    Berhasil disimpan!
                                </span>
                            </Transition>
                        </div>

                    </form>
                </section>

                <!-- BAGIAN 3: HAPUS AKUN -->
                <!-- Menggunakan komponen DeleteUser yang sudah ada di project kamu -->
                <section class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-6 sm:p-8">
                    <DeleteUser />
                </section>

            </div>
        </SettingsLayout>
    </AppLayout>
</template>