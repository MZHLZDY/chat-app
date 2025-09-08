<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/vue3';
import PlaceholderPattern from '../components/PlaceholderPattern.vue';
import type { User } from '../types';
import { usePage } from '@inertiajs/vue3'

interface PageProps {
    auth: {
        user: User;
    };
    [key: string]: any;
}

const page = usePage<PageProps>();
const user = page.props.auth.user as User;
const breadcrumbs: BreadcrumbItem[] = [
    {
        text: 'Dashboard',
        href: '/dashboard',
        active: true
    },
];
</script>

<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
            <h1>Selamat datang {{ user.name }} di Chat App, selamat berinteraksi!</h1>
        </div>
    </AppLayout>
</template>
