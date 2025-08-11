<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/vue3';
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Chat', href: '/dashboard' },
];

const currentUserId = ref<number | null>(null);

const contacts = ref<any[]>([]);
const activeContact = ref<any | null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');

const loadContacts = async () => {
    try {
        const res = await axios.get('/chat/contacts');
        contacts.value = res.data;
    } catch (err) {
        console.error('Gagal load contacts:', err);
    }
};

const loadMessages = async (contactId: number) => {
    try {
        const res = await axios.get(`/chat/${contactId}/messages`);
        messages.value = res.data.map((msg: any) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            text: msg.message, // backend kirim field "message"
            time: new Date(msg.created_at).toLocaleTimeString(),
        }));
    } catch (err) {
        console.error('Gagal load messages:', err);
    }
};

const selectContact = (contact: any) => {
    activeContact.value = contact;
    messages.value = [];
    loadMessages(contact.id);
};

const sendMessage = async () => {
    if (!newMessage.value.trim() || !activeContact.value) return;

    try {
        const res = await axios.post('/chat/send', {
            receiver_id: activeContact.value.id,
            message: newMessage.value,
        });

        messages.value.push({
            id: res.data.id,
            sender_id: currentUserId,
            text: newMessage.value,
            time: new Date(res.data.created_at ?? new Date()).toLocaleTimeString(),
        });

        newMessage.value = '';
    } catch (error) {
        console.error(error);
    }
};

onMounted(async() => {
    loadContacts();
    echo.private(`chat.${currentUserId}`)
    .listen('MessageSent', (e: any) => {
        if (activeContact.value &&
            (e.message.sender_id === activeContact.value.id || e.message.receiver_id === activeContact.value.id)) {
            messages.value.push({
                id: e.message.id,
                sender_id: e.message.sender_id,
                text: e.message.message,
                time: new Date(e.message.created_at).toLocaleTimeString(),
            });
        }
    });
});
</script>

<template>
    <Head title="Chat" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-[80vh] gap-4 rounded-xl overflow-hidden shadow-lg bg-white">
            <!-- Sidebar Contacts -->
            <div class="w-1/4 bg-gray-100 border-r overflow-y-auto">
                <div class="p-4 font-bold text-lg border-b">Kontak</div>
                <ul>
                    <li v-for="c in contacts" :key="c.id"
                        @click="selectContact(c)"
                        :class="['p-4 border-b hover:bg-gray-200 cursor-pointer', activeContact?.id === c.id ? 'bg-gray-300' : '']">
                        <div class="font-semibold">{{ c.name }}</div>
                        <div class="text-sm text-gray-500 truncate">{{ c.lastMessage ?? '' }}</div>
                    </li>
                </ul>
            </div>

            <!-- Chat Window -->
            <div class="flex flex-col flex-1" v-if="activeContact">
                <!-- Header -->
                <div class="p-4 border-b font-semibold">
                    {{ activeContact.name }}
                </div>

                <!-- Messages -->
                <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    <div v-for="m in messages" :key="m.id"
                        :class="m.sender_id === currentUserId ? 'text-right' : 'text-left'">
                        <div :class="m.sender_id === currentUserId ? 'inline-block bg-blue-500 text-white px-4 py-2 rounded-lg' : 'inline-block bg-gray-300 text-black px-4 py-2 rounded-lg'">
                            {{ m.text }}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">{{ m.time }}</div>
                    </div>
                </div>

                <!-- Input -->
                <div class="p-4 border-t flex gap-2">
                    <input type="text" v-model="newMessage" placeholder="Ketik sesuatu..."
                        @keyup.enter="sendMessage"
                        class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button @click="sendMessage" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                        Kirim
                    </button>
                </div>
            </div>

            <!-- Empty state -->
            <div v-else class="flex items-center justify-center flex-1 text-gray-500">
                Pilih kontak untuk memulai chat
            </div>
        </div>
    </AppLayout>
</template>
