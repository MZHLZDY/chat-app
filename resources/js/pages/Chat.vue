<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, } from 'vue';
import AgoraRTC from 'agora-rtc-sdk-ng';
import axios from 'axios';
import { echo } from '../echo.js';

axios.defaults.withCredentials = true;

const drafts = ref<{ [key: string]: string }>({});
const page = usePage();
const currentUserId = computed(() => page.props.auth.user.id);
const currentUserName = computed(() => page.props.auth.user.name);

// State management
const contacts = ref<{ id: number, name: string }[]>([]);
const groups = ref<{ id: number, name: string, members_count: number, owner_id: number }[]>([]);
const allUsers = ref<{ id: number, name: string }[]>([]);
const activeContact = ref<{ id: number, name: string, type: 'user' | 'group' } | null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');

// Modal states
const showCreateGroupModal = ref(false);
const newGroupName = ref('');
const selectedUsers = ref<number[]>([]);

// agora
const isInCall = ref(false);
const callType = ref<'voice' | 'video' | null>(null);
const callStatus = ref('');
const localAudioTrack = ref<any>(null);
const localVideoTrack = ref<any>(null);
const remoteAudioTrack = ref<any>(null);
const remoteVideoTrack = ref<any>(null);
const client = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));

const APP_ID = "f853ee34890a43db9d949d2c5f4dab51"; // dari Agora Console
const TOKEN = "007eJxTYNh/pzPt8g5+z5cbDkcFhH3aGqckwD1r/idhfkbZ+2fl+A0VGNIsTI1TU41NLCwNEk2MU5IsUyxNLFOMkk3TTFISk0wNU68uzmgIZGR4rHSBiZEBAkF8DgbnjMQS3cSCAgYGALCyIHk=";
const CHANNEL = "Chat-app";

// Computed properties
const allChats = computed(() => [
  ...contacts.value.map(c => ({ ...c, type: 'user' as const })),
  ...groups.value.map(g => ({ ...g, type: 'group' as const }))
]);

// Helper function untuk format waktu yang aman
const formatTime = (dateString: string | null | undefined): string => {
  if (!dateString) return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
};

const addMessage = (message: any) => {
  if (!messages.value.some(msg => msg.id === message.id)) {
    messages.value.push(message);
  }
};

// --- Load Functions ---
const loadContacts = async () => {
  try {
    contacts.value = (await axios.get('/chat/contacts')).data;
  } catch (e) { console.error("Gagal memuat kontak:", e); }
};

const loadGroups = async () => {
  try {
    const response = await axios.get('/groups');
    groups.value = response.data.map((g: any) => ({
      id: g.id, name: g.name, members_count: g.members?.length || 0, owner_id: g.owner_id
    }));
  } catch (e) { console.error("Gagal memuat grup:", e); }
};

const loadAllUsers = async () => {
  try {
    // Panggil endpoint /users untuk mendapatkan daftar lengkap
    allUsers.value = (await axios.get('/users')).data;
  } catch(e) {
    console.error("Gagal memuat semua user:", e);
  }
};

const loadMessages = async (contactId: number, type: 'user' | 'group') => {
  try {
    const endpoint = type === 'group' ? `/groups/${contactId}/messages` : `/chat/${contactId}/messages`;
    const response = await axios.get(endpoint);
    messages.value = response.data.map((m: any) => ({
      id: m.id, sender_id: m.sender_id, sender_name: m.sender?.name || 'Unknown', text: m.message, time: formatTime(m.created_at)
    }));
  } catch (e) { console.error("Gagal memuat pesan:", e); }
};

// --- WebSocket Management ---
let boundChannel = '';
const bindChannel = (contactId: number, type: 'user' | 'group') => {
  if (boundChannel) {
    echo.leave(boundChannel);
  }

  const handleNewMessage = (eventData: any) => {
    // 1. Abaikan pesan dari diri sendiri untuk mencegah duplikasi.
    // Ini adalah jaring pengaman jika Anda lupa .toOthers() di backend.
    if (eventData.sender_id === currentUserId.value) {
      return; 
    }

    // 2. Cek apakah pesan ini untuk grup yang sedang aktif dibuka.
    const isCurrentGroupChat = activeContact.value?.type === 'group' && activeContact.value?.id === eventData.group_id;

    if (isCurrentGroupChat) {
      console.log('Pesan grup baru diterima dan akan ditampilkan:', eventData);
      addMessage({
        id: eventData.id,
        sender_id: eventData.sender_id,
        sender_name: eventData.sender?.name || 'Unknown',
        text: eventData.message,
        time: formatTime(eventData.created_at)
      });
    }
  };

  if (type === 'group') {
    boundChannel = `group.${contactId}`;
    echo.private(boundChannel).listen('.GroupMessageSent', handleNewMessage);
  } else {
    // Logika untuk personal chat tidak diubah sesuai permintaan Anda
    boundChannel = `chat.${[currentUserId.value, contactId].sort().join('.')}`;
    echo.private(boundChannel).listen('.MessageSent', (e: any) => {
        const m = e.message ?? e;
        if (activeContact.value && 
            (m.sender_id === activeContact.value.id || m.receiver_id === activeContact.value.id) &&
            !messages.value.some(msg => msg.id === m.id)
        ) {
            messages.value.push({
                id: m.id, 
                sender_id: m.sender_id, 
                sender_name: 'User', // Anda mungkin perlu memperbaiki ini nanti
                text: m.message, 
                time: formatTime(m.created_at)
            });
        }
    });
  }
};

const setupGlobalListeners = () => {
  // Listener untuk grup baru dan kontak baru
  echo.private(`user.${currentUserId.value}`)
    .listen('.GroupCreated', (e: any) => {
      const newGroup = e.group ?? e;
      if (!groups.value.some(g => g.id === newGroup.id)) {
        groups.value.push({
          id: newGroup.id,
          name: newGroup.name,
          members_count: newGroup.members?.length || 0,
          owner_id: newGroup.owner_id
        });
      }
    })
    .listen('.NewContact', (e: any) => {
      const newContact = e.contact ?? e;
      if (!contacts.value.some(c => c.id === newContact.id)) {
        contacts.value.push({ id: newContact.id, name: newContact.name });
      }
    });
};

// --- Chat Functions ---
const selectContact = (contact: { id: number, name: string, type: 'user' | 'group' }) => {
  if (activeContact.value && newMessage.value.trim()) {
    drafts.value[`${activeContact.value.type}-${activeContact.value.id}`] = newMessage.value;
  }
  activeContact.value = contact;
  messages.value = [];
  newMessage.value = drafts.value[`${contact.type}-${contact.id}`] || '';
  loadMessages(contact.id, contact.type);
  bindChannel(contact.id, contact.type);
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !activeContact.value) return;

  const messageText = newMessage.value;
  const activeChat = activeContact.value;

  const optimisticMessage = {
    id: Date.now(),
    sender_id: currentUserId.value,
    sender_name: currentUserName.value,
    text: messageText,
    time: formatTime(new Date().toISOString()),
  };

  addMessage(optimisticMessage);
  newMessage.value = '';
  delete drafts.value[`${activeChat.type}-${activeChat.id}`];

  try {
    const endpoint = activeChat.type === 'group' ? `/groups/${activeChat.id}/send` : '/chat/send';
    const payload = activeChat.type === 'group' ? { message: messageText } : { receiver_id: activeChat.id, message: messageText };
    await axios.post(endpoint, payload);
  } catch (error) {
    console.error('Gagal mengirim pesan:', error);
    messages.value = messages.value.filter(m => m.id !== optimisticMessage.id);
    newMessage.value = messageText;
    alert('Pesan gagal terkirim.');
  }
};

// --- Group Functions ---
const openCreateGroupModal = () => {
  showCreateGroupModal.value = true;
  selectedUsers.value = [];
  newGroupName.value = '';
};
const closeCreateGroupModal = () => {
  showCreateGroupModal.value = false;
  selectedUsers.value = [];
  newGroupName.value = '';
};
const toggleUserSelection = (userId: number) => {
  const index = selectedUsers.value.indexOf(userId);
  if (index > -1) {
    selectedUsers.value.splice(index, 1);
  } else {
    selectedUsers.value.push(userId);
  }
};
const createGroup = async () => {
  if (!newGroupName.value.trim() || selectedUsers.value.length === 0) {
    alert('Nama grup dan minimal 1 anggota harus dipilih!');
    return;
  }
  try {
    const response = await axios.post('/groups', {
      name: newGroupName.value,
      member_ids: selectedUsers.value
    });
    const newGroup = response.data;
    groups.value.push({
      id: newGroup.id,
      name: newGroup.name,
      members_count: newGroup.members?.length || selectedUsers.value.length + 1,
      owner_id: newGroup.owner_id
    });
    closeCreateGroupModal();
    selectContact({ id: newGroup.id, name: newGroup.name, type: 'group' });
  } catch (e) {
    console.error('Gagal membuat grup:', e);
    alert('Gagal membuat grup!');
  }
};

// ---- Telephony by agora ----
async function joinChannel() {
  try {
    const response = await axios.post('/agora-token', {
      channel: `call-${activeContact.value?.id}`,
      uid: currentUserId.value
    });
    
    const { token, channel, uid } = response.data;

    // Join the channel
    await client.value.join(APP_ID, channel, token, uid);

    // Create and publish local track
    localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
    
    if (callType.value === 'video') {
      localVideoTrack.value = await AgoraRTC.createCameraVideoTrack();
      // Play local tracks
      localVideoTrack.value.play('local-video');
      // Publish tracks to channel
      await client.value.publish([localAudioTrack.value, localVideoTrack.value]);
    } else {
      // Voice call only
      await client.value.publish([localAudioTrack.value]);
    }

    // Subscribe to remote users
    client.value.on('user-published', async (user: any, mediaType: any) => {
      await client.value.subscribe(user, mediaType);

      if (mediaType === 'video') {
        remoteVideoTrack.value = user.videoTrack;
        remoteVideoTrack.value?.play('remote-video');
      }

      if (mediaType === 'audio') {
        remoteAudioTrack.value = user.audioTrack;
        remoteAudioTrack.value?.play();
      }
    });
    
  } catch (error) {
    console.error('Join channel error:', error);
    endCall();
  }
}

// Method untuk memulai panggilan
const startVoiceCall = async () => {
  if (!activeContact.value) return;
  
  try {
    isInCall.value = true;
    callType.value = 'voice';
    callStatus.value = 'Memulai panggilan suara...';
    
    await joinChannel();
    callStatus.value = 'Sedang menelepon...';
    
  } catch (error) {
    console.error('Voice call error:', error);
    endCall();
    alert('Gagal memulai panggilan suara');
  }
};

const startVideoCall = async () => {
  if (!activeContact.value) return;
  
  try {
    isInCall.value = true;
    callType.value = 'video';
    callStatus.value = 'Memulai panggilan video...';
    
    await joinChannel();
    callStatus.value = 'Sedang melakukan video call...';
    
  } catch (error) {
    console.error('Video call error:', error);
    endCall();
    alert('Gagal memulai panggilan video');
  }
};

const endCall = async () => {
  try {
    // Stop dan unpublish semua track
    if (localAudioTrack.value) {
      localAudioTrack.value.stop();
      localAudioTrack.value.close();
    }
    
    if (localVideoTrack.value) {
      localVideoTrack.value.stop();
      localVideoTrack.value.close();
    }
    
    // Leave channel
    await client.value.leave();
    
    // Reset state
    isInCall.value = false;
    callType.value = null;
    callStatus.value = '';
    localAudioTrack.value = null;
    localVideoTrack.value = null;
    remoteAudioTrack.value = null;
    remoteVideoTrack.value = null;
    
  } catch (error) {
    console.error('Error ending call:', error);
  }
};

// --- Initialize ---
onMounted(() => {
  loadContacts();
  loadGroups();
  loadAllUsers();
  setupGlobalListeners();
  
});
</script>

<template>
    <Head title="Chat" />
    <AppLayout>
        <div class="flex h-[90vh] gap-4 rounded-xl overflow-hidden shadow-lg bg-white">
            <!-- Sidebar Contacts -->
            <div class="w-1/4 bg-gray-100 border-r overflow-y-auto">
                <div class="p-4 border-b flex justify-between items-center">
                    <span class="font-bold text-lg">Chat</span>
                    <button @click="openCreateGroupModal" 
                            class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
                        + Group
                    </button>
                </div>
                
                <ul>
                    <li v-for="chat in allChats" :key="`${chat.type}-${chat.id}`"
                        @click="selectContact(chat)"
                        :class="['p-4 border-b hover:bg-gray-200 cursor-pointer flex items-center gap-3', 
                                 activeContact?.id === chat.id && activeContact?.type === chat.type ? 'bg-gray-300' : '']">
                        <div :class="chat.type === 'group' ? 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold' : 'w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold'">
                            {{ chat.type === 'group' ? 'G' : chat.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="flex-1">
                            <div class="font-semibold">{{ chat.name }}</div>
                            <div class="text-sm text-gray-500 truncate">
                                {{ chat.type === 'group' ? `${(chat as any).members_count || 0} anggota` : 'Personal chat' }}
                            </div>
                        </div>
                        <!-- Draft indicator -->
                        <div v-if="drafts[`${chat.type}-${chat.id}`]" 
                             class="w-2 h-2 bg-orange-500 rounded-full"></div>
                    </li>
                </ul>
            </div>

            <!-- Chat Window -->
            <div class="flex flex-col flex-1" v-if="activeContact">
                <!-- Header -->
                <div class="p-4 border-b font-semibold flex items-center gap-3">
                    <div :class="activeContact.type === 'group' ? 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm' : 'w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm'">
                        {{ activeContact.type === 'group' ? 'G' : activeContact.name.charAt(0).toUpperCase() }}
                    </div>
                    {{ activeContact.name }}
                    <span v-if="activeContact.type === 'group'" class="text-sm text-gray-500">
                        (Group Chat)
                    </span>
                    <div class="call-actions">
                  <button 
            @click="startVoiceCall" 
            class="btn-call voice-call"
            :disabled="isInCall"
            title="Voice Call"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
        </button>
                  <button 
            @click="startVideoCall" 
            class="btn-call video-call"
            :disabled="isInCall"
            title="Video Call"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
        </button>
                  <button 
                     v-if="isInCall" 
                     @click="endCall" 
                     class="btn-call end-call"
                  >
                     <i class="fas fa-phone-slash"></i>
                  </button>
                  <span v-if="callStatus" class="text-sm text-gray-600 ml-2">
            {{ callStatus }}
        </span>
                </div>
                </div>

                <!-- Video Container -->
                <div v-if="isInCall && callType === 'video'" class="fixed bottom-4 right-4 w-64 h-48 bg-black rounded-lg overflow-hidden z-50">
                    <div id="remote-video" class="w-full h-full"></div>
                    <div id="local-video" class="absolute bottom-2 right-2 w-16 h-16 rounded border-2 border-white"></div>
                </div>
                

                <!-- Messages -->
                <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    <div v-for="m in messages" :key="m.id"
                        :class="m.sender_id === currentUserId ? 'text-right' : 'text-left'">
                        <div :class="m.sender_id === currentUserId ? 'inline-block bg-blue-500 text-white px-4 py-2 rounded-lg max-w-xs' : 'inline-block bg-gray-300 text-black px-4 py-2 rounded-lg max-w-xs'">
                            <div v-if="activeContact.type === 'group' && m.sender_id !== currentUserId" 
                                 class="text-xs font-semibold mb-1 opacity-75">
                                {{ m.sender_name }}
                            </div>
                            {{ m.text }}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">{{ m.time }}</div>
                    </div>
                </div>

                <!-- Input -->
                <div class="p-4 border-t flex gap-2">
                    <input type="text" v-model="newMessage" 
                           :placeholder="`Ketik pesan ${activeContact.type === 'group' ? 'ke group' : 'ke ' + activeContact.name}...`"
                           @keyup.enter="sendMessage"
                           class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button @click="sendMessage" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                        Kirim
                    </button>
                </div>
            </div>

            <!-- Empty state -->
            <div v-else class="flex items-center justify-center flex-1 text-gray-500">
                Pilih kontak atau group untuk memulai chat
            </div>
        </div>

        <!-- Create Group Modal -->
        <div v-if="showCreateGroupModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
                <h3 class="text-lg font-bold mb-4">Buat Group Baru</h3>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Nama Group</label>
                    <input type="text" v-model="newGroupName" 
                           placeholder="Masukkan nama group..."
                           class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Pilih Anggota</label>
                    <div class="max-h-32 overflow-y-auto border rounded-lg">
                        <div v-for="user in allUsers.filter(u => u.id !== currentUserId)" :key="user.id"
                             @click="toggleUserSelection(user.id)"
                             :class="['p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2', 
                                      selectedUsers.includes(user.id) ? 'bg-blue-100' : '']">
                            <input type="checkbox" :checked="selectedUsers.includes(user.id)" class="pointer-events-none">
                            <span>{{ user.name }}</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <button @click="createGroup" 
                            class="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                        Buat Group
                    </button>
                    <button @click="closeCreateGroupModal" 
                            class="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600">
                        Batal
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>