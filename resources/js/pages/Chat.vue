<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';

axios.defaults.withCredentials = true;

const page = usePage();
const currentUserId = ref(page.props.auth.user.id);

const contacts = ref<{id:number,name:string}[]>([]);
const activeContact = ref<{id:number,name:string}|null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');

// Helper function untuk format waktu yang aman
const formatTime = (dateString: string | null | undefined): string => {
  if (!dateString) return new Date().toLocaleTimeString();
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return new Date().toLocaleTimeString();
    }
    return date.toLocaleTimeString();
  } catch (error) {
    console.error('Error formatting time:', error);
    return new Date().toLocaleTimeString();
  }
};

const loadContacts = async () => {
  try { 
    contacts.value = (await axios.get('/chat/contacts')).data; 
  } catch(e){ 
    console.error(e); 
  }
};

const loadMessages = async (contactId:number) => {
  try {
    messages.value = (await axios.get(`/chat/${contactId}/messages`)).data.map((m:any) => ({
      id: m.id,
      sender_id: m.sender_id,
      text: m.message,
      time: formatTime(m.created_at)
    }));
  } catch(e){ 
    console.error(e); 
  }
};

// Simplified channel binding
let boundChannel = '';
const bindChannel = (contactId:number) => {
  if(boundChannel) echo.leave(`private-${boundChannel}`);
  boundChannel = [currentUserId.value, contactId].sort().join('.');
  
  echo.private(`chat.${boundChannel}`).listen('.MessageSent', (e:any) => {
    const m = e.message ?? e;
    
    // Pastikan pesan untuk kontak yang aktif dan belum ada di array
    if(activeContact.value && 
       (m.sender_id === activeContact.value.id || m.receiver_id === activeContact.value.id) &&
       !messages.value.some(msg => msg.id === m.id)) {
      
      messages.value.push({
        id: m.id, 
        sender_id: m.sender_id, 
        text: m.message, 
        time: formatTime(m.created_at)
      });
    }
  });
};

const selectContact = (c:{id:number,name:string}) => {
  activeContact.value = c;
  messages.value = [];
  loadMessages(c.id);
  bindChannel(c.id);
};

const sendMessage = async () => {
  if(!newMessage.value.trim() || !activeContact.value) return;
  
  const messageText = newMessage.value;
  newMessage.value = ''; // Clear input immediately
  
  try {
    const res = await axios.post('/chat/send', {
      receiver_id: activeContact.value.id, 
      message: messageText
    });
    
    // Hanya tambahkan jika belum ada di array (untuk menghindari duplikasi dari WebSocket)
    // const messageExists = messages.value.some(m => m.id === res.data.message.id);
    // if (!messageExists) {
    //   messages.value.push({
    //     id: res.data.message.id,
    //     sender_id: currentUserId.value,
    //     text: messageText,
    //     time: formatTime(res.data.message.created_at)
    //   });
    // }
  } catch(e){ 
    console.error('Error sending message:', e);
    // Kembalikan pesan ke input jika gagal
    newMessage.value = messageText;
  }
};

onMounted(loadContacts);
</script>

<template>
    <Head title="Chat" />
    <AppLayout>
        <div class="flex h-[90vh] gap-4 rounded-xl overflow-hidden shadow-lg bg-white">
            <!-- Sidebar Contacts -->
            <div class="w-1/4 bg-gray-100 border-r overflow-y-auto">
                <div class="p-4 font-bold text-lg border-b">Kontak</div>
                <ul>
                    <li v-for="c in contacts" :key="c.id"
                        @click="selectContact(c)"
                        :class="['p-4 border-b hover:bg-gray-200 cursor-pointer', activeContact?.id === c.id ? 'bg-gray-300' : '']">
                        <div class="font-semibold">{{ c.name }}</div>
                        <div class="text-sm text-gray-500 truncate">Klik untuk chat</div>
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
                    <button @click="sendMessage" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
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