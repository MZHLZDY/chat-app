<script setup lang="ts">
import { computed } from 'vue';
import { Head, Link, useForm } from '@inertiajs/vue3';
import { LoaderCircle } from 'lucide-vue-next';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Button } from '@/components/ui/button';
import TextLink from '@/components/TextLink.vue';

// --- Props ---
const props = defineProps<{
    status?: string;
}>();

// --- State & Logic ---
const form = useForm({});
const verificationLinkSent = computed(() => props.status === 'verification-link-sent');

const submit = () => {
    form.post(route('verification.send'));
};

const pageTitle = 'Verifikasi Email';
const layoutTitle = 'Satu Langkah Terakhir!';
const layoutDescription = 'Kami telah mengirimkan tautan ke email Anda. Silakan klik untuk memverifikasi akun Anda.';
const successMessage = 'Tautan verifikasi baru telah berhasil dikirim ke alamat email Anda.';
const resendButtonText = 'Kirim Ulang Email Verifikasi';
const logoutButtonText = 'Logout';
</script>

<template>
    <AuthLayout :title="layoutTitle" :description="layoutDescription">
        <Head :title="pageTitle" />

        <div v-if="verificationLinkSent" class="mb-4 text-center text-sm font-medium text-green-600 dark:text-green-400">
            {{ successMessage }}
        </div>

        <form @submit.prevent="submit" class="space-y-6 text-center">
            <Button :disabled="form.processing" variant="secondary" class="w-full">
                <LoaderCircle v-if="form.processing" class="mr-2 h-4 w-4 animate-spin" />
                {{ resendButtonText }}
            </Button>

            <TextLink :href="route('logout')" method="post" as="button" class="mx-auto block text-sm">
                {{ logoutButtonText }}
            </TextLink>
        </form>
    </AuthLayout>
</template>