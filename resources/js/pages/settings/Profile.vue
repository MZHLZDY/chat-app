<script setup lang="ts">
import { ref } from 'vue';
import { Head, Link, useForm, usePage } from '@inertiajs/vue3';
import DeleteUser from '@/components/DeleteUser.vue';
import HeadingSmall from '@/components/HeadingSmall.vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import type { BreadcrumbItem, User, AppPageProps } from '@/types/index.d.ts';

interface Props {
    mustVerifyEmail: boolean;
    status?: string;
}
defineProps<Props>();

const breadcrumbItems: BreadcrumbItem[] = [{ title: 'Profile settings', href: '/settings/profile' }];
const page = usePage<AppPageProps>();
const user = page.props.auth.user as User;

const form = useForm({
    name: user.name,
    email: user.email,
});
const submit = () => form.patch(route('profile.update'), { preserveScroll: true });

const photoInput = ref<HTMLInputElement | null>(null);
const photoPreview = ref<string | null>(null);
const photoForm = useForm({ photo: null as File | null });

function updateProfilePhoto() {
    const photoFile = photoInput.value?.files?.[0];
    if (!photoFile) return;

    photoForm.photo = photoFile;
    const reader = new FileReader();
    reader.onload = (e) => (photoPreview.value = e.target?.result as string);
    reader.readAsDataURL(photoFile);

    photoForm.post(route('profile.photo.update'), {
        preserveScroll: true,
        onSuccess: () => {
            photoPreview.value = null;
            photoForm.reset();
        },
    });
}

const backgroundInput = ref<HTMLInputElement | null>(null);
const backgroundPreview = ref<string | null>(null);
const backgroundForm = useForm({ background: null as File | null });

function updateBackground() {
    const backgroundFile = backgroundInput.value?.files?.[0];
    if (!backgroundFile) return;

    backgroundForm.background = backgroundFile;
    const reader = new FileReader();
    reader.onload = (e) => (backgroundPreview.value = e.target?.result as string);
    reader.readAsDataURL(backgroundFile);

    backgroundForm.post(route('profile.background.update'), {
        preserveScroll: true,
        onSuccess: () => {
            backgroundPreview.value = null;
            backgroundForm.reset();
        },
    });
}
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbItems">
        <Head title="Profile settings" />
        <SettingsLayout>
            <div class="flex flex-col space-y-12">
                <div>
                    <HeadingSmall title="Foto & Background" description="Perbarui foto profil dan gambar background Anda." />

                    <div class="mt-6 flex items-center space-x-6">
                        <input type="file" class="hidden" ref="photoInput" @change="updateProfilePhoto">
                        <div class="relative">
                            <img :src="photoPreview || user.profile_photo_url" :alt="user.name" class="h-24 w-24 rounded-full object-cover">
                            <div v-if="photoForm.progress" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                                <span class="text-white text-lg">{{ photoForm.progress.percentage }}%</span>
                            </div>
                        </div>
                        <Button @click="photoInput?.click()" :disabled="photoForm.processing">Pilih Foto</Button>
                        <InputError class="mt-2" :message="photoForm.errors.photo" />
                    </div>

                    <div class="mt-6">
                        <Label>Gambar Background</Label>
                        <input type="file" class="hidden" ref="backgroundInput" @change="updateBackground">
                        <div class="mt-2 w-full h-48 rounded-md border-2 border-dashed flex items-center justify-center" :style="{ backgroundImage: `url(${backgroundPreview || user.background_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }">
                            <div v-if="backgroundForm.progress" class="w-full h-full flex items-center justify-center bg-black bg-opacity-50">
                                <span class="text-white text-lg">{{ backgroundForm.progress.percentage }}%</span>
                            </div>
                            <Button v-else @click="backgroundInput?.click()" :disabled="backgroundForm.processing">Pilih Gambar</Button>
                        </div>
                        <InputError class="mt-2" :message="backgroundForm.errors.background" />
                    </div>
                </div>

                <div>
                    <HeadingSmall title="Informasi profil" description="Perbarui alamat emailmu dan namamu" />
                    <form @submit.prevent="submit" class="mt-6 space-y-6">
                        <div class="grid gap-2">
                            <Label for="name">Nama</Label>
                            <Input id="name" v-model="form.name" required placeholder="Nama lengkap"/>
                            <InputError :message="form.errors.name" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="email">Alamat email</Label>
                            <Input id="email" type="email" v-model="form.email" required placeholder="Alamat email"/>
                            <InputError :message="form.errors.email" />
                        </div>
                        <div class="flex items-center gap-4">
                            <Button :disabled="form.processing">Simpan</Button>
                            <Transition enter-active-class="transition ease-in-out" enter-from-class="opacity-0">
                                <p v-if="form.recentlySuccessful" class="text-sm">Tersimpan.</p>
                            </Transition>
                        </div>
                    </form>
                </div>
                <DeleteUser />
            </div>
        </SettingsLayout>
    </AppLayout>
</template>