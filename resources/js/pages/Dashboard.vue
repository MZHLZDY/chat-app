<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/vue3';
import PlaceholderPattern from '../components/PlaceholderPattern.vue';
import type { User } from '../types';
import { usePage } from '@inertiajs/vue3'

const page = usePage();
const user = page.props.auth.user as User;
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];
</script>

<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
            <h1>Selamat Datang {{ user.name }} di Chat App, selamat berinteraksi!</h1>
        </div>
    </AppLayout>
</template>
