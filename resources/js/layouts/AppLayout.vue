<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { onMounted, ref, computed } from 'vue';
import { echo } from '@/echo';
import IncomingCallModal from '@/pages/IncomingCallModal.vue';
import type { User } from '@/types';
import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
import type { BreadcrumbItem, AppPageProps } from '@/types';

interface Props {
    breadcrumbs?: BreadcrumbItem[];
}

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});

const page = usePage<AppPageProps>();
const currentUserId = computed(() => page.props.auth?.user?.id ?? null);

// State Panggilan
const incomingCall = ref<{ from: User } | null>(null);
const callStatus = ref<'idle' | 'ringing' | 'connected' | 'rejected'>('idle');

// Handler Terima Panggilan
const receiveIncomingCall = (from: User) => {
    incomingCall.value = { from };
    callStatus.value = 'ringing';
};

// User klik "Terima"
const acceptIncomingCall = () => {
    callStatus.value = 'connected';
    // TODO: buka UI video call disini
    incomingCall.value = null;
};

// User klik "Tolak"
const rejectIncomingCall = () => {
    callStatus.value = 'rejected';
    incomingCall.value = null;
    setTimeout(() => (callStatus.value = 'idle'), 2000);
};

// Listener waktu layout dimount
onMounted(() => {
    if (!currentUserId.value) return;

    echo.private(`call.${currentUserId.value}`)
        .listen('.IncomingCall', (payload: any) => {
            receiveIncomingCall(payload.from);
        });
});

</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <slot />
    </AppLayout>

<!-- Modal Panggilan Masuk -->
<IncomingCallModal
    :show="! ! incomingCall"
    :callerName="incomingCall?.from.name"
    @accept="acceptIncomingCall"
    @reject="rejectIncomingCall"
/>
</template>
