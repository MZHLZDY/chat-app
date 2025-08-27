<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import { Video } from 'lucide-vue-next';
import { formatDistanceToNowStrict } from 'date-fns';
import { id } from 'date-fns/locale';
import VideoCallModal from './VideoCallModal.vue';
import IncomingCallModal from './IncomingCallModal.vue';

axios.defaults.withCredentials = true;

const drafts = ref<{ [key: string]: string }>({});
const page = usePage();
const currentUserId = computed(() => page.props.auth.user.id);
const currentUserName = computed(() => page.props.auth.user.name);

// --- State Management ---
const contacts = ref<{ id: number, name: string, last_seen: string | null }[]>([]);
const groups = ref<{ id: number, name: string, members_count: number, owner_id: number }[]>([]);
const allUsers = ref<{ id: number, name: string }[]>([]);
const activeContact = ref<{ id: number, name: string, type: 'user' | 'group' } | null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const onlineUsers = ref<number[]>([]); 
const unreadChats = ref<string[]>([]);
const messageContainer = ref<HTMLElement | null>(null);
const isSending = ref(false);

// --- Personal Video Call State ---
const showVideoCall = ref(false);
const activeCall = ref<null | { contactName: string }>(null);
const callPartnerId = ref<number|null>(null);
const callStatus = ref<'idle' | 'ringing' | 'connected' | 'rejected' | 'missed'>('idle');
const incomingCall = ref<{ from: any, to: { id: number, name: string } } | null>(null);
const isMinimized = ref(false);

let callTimer : any = null;

const startVideoCall = (userId: number) => {
  callPartnerId.value = userId;
  showVideoCall.value = true;
  callStatus.value = 'ringing';

  // set timeout 60dtk, klo ga diangkat dianggap "missed"
  callTimer = setTimeout(() => {
    if (callStatus.value === 'ringing') {
      callStatus.value = 'missed';
    }
  }, 60000);

  // TODO: Init Agora/Video Call Service
};

// Trigger klo ada panggilan masuk
const receiveIncomingCall = (fromUser: any) => {
  incomingCall.value = {
    from: fromUser,
    to: { id: currentUserId.value, name: currentUserName.value }
  }
}

const acceptIncomingCall = () => {
  clearTimeout(callTimer)
  callStatus.value = 'connected';
  incomingCall.value = null;
  showVideoCall.value = true;
}

const rejectIncomingCall = () => {
  callStatus.value = 'rejected';
  incomingCall.value = null;
  setTimeout(() => {
    callStatus.value = 'idle';
  }, 2000);

}

const endVideoCall = () => {
  showVideoCall.value = false;
  callPartnerId.value = null;
  callStatus.value = 'idle';
};

const minimizeVideoCall = () => {
  isMinimized.value = true;
  showVideoCall.value = false;
};

const restoreVideoCall = () => {
  isMinimized.value = false;
  showVideoCall.value = true;
};

// Group Video Call State
const showGroupCall = ref(false);
const groupCallStatus = ref<'idle' | 'ringing' | 'connected' | 'rejected' | 'missed'>('idle');
const activeGroupCall = ref<null | { groupId: number; name: string; participants: { id: number; name: string }[] }>(null);const joinedMembers = ref<any[]>([]);

// Start Group Video Call
const startGroupCall = (groupId: number, groupName: string) => {
  activeGroupCall.value = { groupId, name: groupName, participants: [] };
  groupCallStatus.value = 'ringing';
  showGroupCall.value = true;

  // TODO: trigger backend untuk broadcast panggilan ke semua anggota
};

// Accept group call
const joinGroupCall = (user: any) => {
  groupCallStatus.value = 'connected';
  if (!joinedMembers.value.some(m => m.id === user.id)) {
    joinedMembers.value.push(user);
  }
};

// Leave group call
const leaveGroupCall = () => {
  showGroupCall.value = false;
  groupCallStatus.value = 'idle';
  activeGroupCall.value = null;
  joinedMembers.value = [];
};

// --- Modal States ---
const showCreateGroupModal = ref(false);
const newGroupName = ref('');
const selectedUsers = ref<number[]>([]);

// --- Computed Properties ---
const allChats = computed(() => [
  ...contacts.value.map(c => ({ ...c, type: 'user' as const })),
  ...groups.value.map(g => ({ ...g, type: 'group' as const }))
]);

// --- Helper Functions ---
const scrollToBottom = () => {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
  });
};

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

const formatLastSeen = (dateString: string | null | undefined): string => {
    if (!dateString) return 'offline';
    try {
        return `terakhir dilihat ${formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: id })}`;
    } catch (error) {
        return 'offline';
    }
};

const addMessage = (message: any) => {
  if (!messages.value.some(msg => msg.id === message.id)) {
    messages.value.push(message);
    scrollToBottom();
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
    allUsers.value = (await axios.get('/users')).data;
  } catch (e) { console.error("Gagal memuat semua user:", e); }
};

const loadMessages = async (contactId: number, type: 'user' | 'group') => {
  try {
    const endpoint = type === 'group' ? `/groups/${contactId}/messages` : `/chat/${contactId}/messages`;
    const response = await axios.get(endpoint);
    messages.value = response.data.map((m: any) => ({
      id: m.id, sender_id: m.sender_id, sender_name: m.sender?.name || 'Unknown', text: m.message, time: formatTime(m.created_at)
    }));
    scrollToBottom();
  } catch (e) { console.error("Gagal memuat pesan:", e); }
};

// --- WebSocket Management ---
let boundChannel = '';
const bindChannel = (contactId: number, type: 'user' | 'group') => {
    if (boundChannel) {
        echo.leave(boundChannel);
    }

    const handleNewMessage = (eventData: any) => {
        const messageData = eventData.message ? eventData.message : eventData;

        if (!messageData || !messageData.id || !messageData.message || messageData.sender_id === currentUserId.value) {
            return;
        }

        let isChatActive = false;
        if (activeContact.value) {
            const isGroupChat = activeContact.value.type === 'group' && (activeContact.value.id === messageData.receiver_id || activeContact.value.id === messageData.group_id);
            const isPersonalChat = activeContact.value.type === 'user' && activeContact.value.id === messageData.sender_id;
            isChatActive = isGroupChat || isPersonalChat;
        }

        if (isChatActive) {
            addMessage({
                id: messageData.id,
                sender_id: messageData.sender_id,
                sender_name: messageData.sender_name || messageData.sender?.name || 'Unknown',
                text: messageData.message,
                time: formatTime(messageData.created_at)
            });
        } else {
            let unreadChatId: string;
            if (messageData.group_id) {
                unreadChatId = `group-${messageData.group_id}`;
            } else {
                unreadChatId = `user-${messageData.sender_id}`;
            }
            if (!unreadChats.value.includes(unreadChatId)) {
                unreadChats.value.push(unreadChatId);
            }
        }
    };

    const channelName = type === 'group'
        ? `group.${contactId}`
        : `chat.${[currentUserId.value, contactId].sort().join('.')}`;
    
    const eventName = type === 'group' ? '.GroupMessageSent' : '.MessageSent';

    boundChannel = channelName;

    if (type === 'user') {
        echo.join(channelName)
            .here((users: Array<{ id: number, name: string }>) => {
                onlineUsers.value = users.map(u => u.id);
            })
            .joining((user: { id: number, name: string }) => {
                if (!onlineUsers.value.includes(user.id)) {
                    onlineUsers.value.push(user.id);
                }
            })
            .leaving((user: { id: number, name: string }) => {
                onlineUsers.value = onlineUsers.value.filter(id => id !== user.id);
            })
            .listen(eventName, handleNewMessage);
    } else {
        echo.private(channelName)
            .listen(eventName, handleNewMessage);
    }
};

// --- Chat Functions ---
const selectContact = (contact: { id: number, name: string, type: 'user' | 'group' }) => {
    if (activeContact.value && newMessage.value.trim()) {
        drafts.value[`${activeContact.value.type}-${activeContact.value.id}`] = newMessage.value;
    }
    
    const chatIdentifier = `${contact.type}-${contact.id}`;
    // Hapus ID chat iki teko daftar "durung diwoco"
    unreadChats.value = unreadChats.value.filter(id => id !== chatIdentifier);
    // =======================================================

    activeContact.value = contact;
    messages.value = [];
    onlineUsers.value = [];
    newMessage.value = drafts.value[`${contact.type}-${contact.id}`] || '';
    loadMessages(contact.id, contact.type);
    bindChannel(contact.id, contact.type);
};

const sendMessage = async () => {
    if (!newMessage.value.trim() || !activeContact.value || isSending.value) return;
    isSending.value = true;

    const messageText = newMessage.value;
    const activeChat = activeContact.value;
    const tempId = Date.now();

    const optimisticMessage = {
        id: tempId,
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
        
        const response = await axios.post(endpoint, payload);
        const savedMessage = response.data;

        const messageIndex = messages.value.findIndex(m => m.id === tempId);

        if (messageIndex !== -1) {
            messages.value[messageIndex].id = savedMessage.id;
            messages.value[messageIndex].time = formatTime(savedMessage.created_at);
        }
    } catch (error) {
        console.error('Gagal mengirim pesan:', error);
        messages.value = messages.value.filter(m => m.id !== tempId);
        newMessage.value = messageText;
        alert('Pesan gagal terkirim.');
    } finally {
        isSending.value = false;
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

const setupGlobalListeners = () => {
  echo.channel('users')
    .listen('.UserRegistered', (newUser: any) => {
      if (!allUsers.value.some(u => u.id === newUser.id)) {
        allUsers.value.push({ id: newUser.id, name: newUser.name });
      }
      if (!contacts.value.some(c => c.id === newUser.id)) {
        contacts.value.push({ id: newUser.id, name: newUser.name, last_seen: null });
      }
    });

  // Listener iki opsional lek awakmu nggawe sistem logout event
  echo.channel('users-status')
    .listen('.UserStatusChanged', (event: any) => {
        const updatedUser = event.user;
        const contactIndex = contacts.value.findIndex(c => c.id === updatedUser.id);
        if (contactIndex !== -1) {
            contacts.value[contactIndex].last_seen = updatedUser.last_seen;
        }
    });

    echo.private(`notifications.${currentUserId.value}`)
        .listen('.MessageSent', (eventData: any) => {
            const messageData = eventData.message;

            // Cek disik, opo chat teko pengirim iki lagi aktif dibuka?
            const isChatCurrentlyActive = activeContact.value?.type === 'user' && activeContact.value?.id === messageData.sender_id;

            // Lek chat e GAK lagi aktif, baru dewe munculno notif unread
            if (!isChatCurrentlyActive) {
                const unreadChatId = `user-${messageData.sender_id}`;
                if (!unreadChats.value.includes(unreadChatId)) {
                    unreadChats.value.push(unreadChatId);
                }
            }
        })
        .listen('.GroupMessageSent', (eventData: any) => { // <-- TAMBAHNO IKI
            const messageData = eventData.message ? eventData.message : eventData;

            // Cek disik, opo grup e lagi aktif dibuka?
            const isGroupChatCurrentlyActive = activeContact.value?.type === 'group' && activeContact.value?.id === messageData.group_id;

            // Lek GAK aktif, baru munculno notif unread
            if (!isGroupChatCurrentlyActive) {
                const unreadChatId = `group-${messageData.group_id}`;
                if (!unreadChats.value.includes(unreadChatId)) {
                    unreadChats.value.push(unreadChatId);
                }
            }
        });
};

// --- Initialize ---
onMounted(() => {
  loadContacts();
  loadGroups();
  loadAllUsers();
  setupGlobalListeners();

  // Polling gawe update 'last_seen'
  const pollingInterval = setInterval(() => {
    loadContacts();
  }, 30000); // 30 detik

  onUnmounted(() => {
    clearInterval(pollingInterval);
  });
});
</script>

<template>
    <Head title="Chat" />
    <AppLayout>
      <!-- section sidebar atas -->
        <div class="flex h-[89vh] gap-4 rounded-xl overflow-hidden shadow-lg bg-white">
            <div class="w-1/4 bg-gray-100 border-r overflow-y-auto">
                <div class="p-4 border-b flex justify-between items-center">
                    <span class="font-bold text-lg">Chat</span>
                    <button @click="openCreateGroupModal"
                            class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
                        + Group
                    </button>
                </div>
                <!-- sidebar contact dan grup -->
                <ul>
                   <li v-for="chat in allChats" :key="`${chat.type}-${chat.id}`"
                        @click="selectContact(chat)"
                        :class="['p-4 border-b hover:bg-gray-200 cursor-pointer flex items-center gap-3',
                                 activeContact?.id === chat.id && activeContact?.type === chat.type ? 'bg-gray-300' : '']">
                        <div :class="chat.type === 'group' ? 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold' : 'w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-bold'">
                            {{ chat.type === 'group' ? 'G' : chat.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="flex-1">
                            <div class="font-semibold">{{ chat.name }}</div>
                            <div class="text-sm text-gray-500 truncate">
                                {{ chat.type === 'group' ? `${(chat as any).members_count || 0} anggota` : 'Personal chat' }}
                            </div>
                        </div>
                        <div v-if="unreadChats.includes(`${chat.type}-${chat.id}`)" class="w-3 h-3 bg-green-500 rounded-full ml-auto mr-2 animate-pulse"></div>
                        <div v-if="drafts[`${chat.type}-${chat.id}`]" class="w-2 h-2 bg-orange-500 rounded-full"></div>
                    </li>
                </ul>
            </div>
            <!-- section room chat -->
            <div class="flex flex-col flex-1" v-if="activeContact">
                <div class="p-4 border-b font-semibold flex items-center gap-3">
                    <div :class="activeContact.type === 'group' ? 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm' : 'w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm'">
                        {{ activeContact.type === 'group' ? 'G' : activeContact.name.charAt(0).toUpperCase() }}
                    </div>
                    {{ activeContact.name }}
                    <span v-if="activeContact.type === 'group'" class="text-sm text-gray-500">(Group Chat)</span>
                    <!-- last seen method -->
                      <span v-if="activeContact.type === 'user'" class="ml-2">
                        <span v-if="onlineUsers.includes(activeContact.id)" 
                          class="text-green-500 text-xs font-normal flex items-center gap-1">
                        <svg class="w-2 h-2 fill-current" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
                            Online
                        </span>
                      <span v-else-if="(contacts.find(c => c.id === activeContact?.id) as any)?.last_seen"
                          class="text-gray-400 text-xs font-normal">
                          {{ formatLastSeen((contacts.find(c => c.id === activeContact?.id) as any)?.last_seen) }}
                      </span>
                      <span v-else class="text-gray-400 text-xs font-normal">
                        Offline
                      </span>
                    </span>
                    <!-- Tambahkan button video call -->
                    <button
                      v-if="activeContact.type === 'user'"
                      @click="startVideoCall(activeContact.id)"
                      class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 transition"
                      >
                        <Video class="w-5 h-5"/>
                    </button>

                    <button
                      v-if="activeContact.type === 'group'"
                      @click="startGroupCall(activeContact.id, activeContact.name)"
                      class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 transition"
                      >
                        <Video class="w-5 h-5"/>
                    </button>

                    <VideoCallModal
                        :show="showVideoCall"
                        :contactName="activeContact.name"
                        :status="callStatus"
                        @end="endVideoCall"
                    />

                    <VideoCallModal
                        :show="showGroupCall"
                        :isGroup="true"
                        :groupName="activeGroupCall?.name"
                        :participants="activeGroupCall?.participants"
                        :status="callStatus"
                        @end="leaveGroupCall"
                    />

                    <IncomingCallModal
                        :show="! ! incomingCall"
                        v-if="incomingCall"
                        :fromName="incomingCall.from.name"
                        @accept="acceptIncomingCall"
                        @reject="rejectIncomingCall"
                    />
                </div>

                <!-- Video Call UI -->
                <!-- <div v-if="showVideoCall" class="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50">
                  <div class="text-white text-lg mb-4">
                    Video Call With {{ activeContact?.name }}
                  </div> -->

                  <!-- <div class="w-[600px] h-[400px] bg-gray-800 rounded-xl flex items-center justify-center"> -->
                    <!-- nanti di sini stream agora -->
                     <!-- <span class="text-gray-400">[ Video Stream Area ]</span>
                  </div> -->

                  <!-- <button
                    @click="endVideoCall" 
                    class="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                    >
                      End Call
                  </button>
                </div> -->
                <!-- input teks -->
                <div ref="messageContainer" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
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

                <div class="p-4 border-t flex gap-2">
                    <input
                        type="text"
                        v-model="newMessage"
                        :placeholder="`Ketik pesan ke ${activeContact.name}...`"
                        @keyup.enter="sendMessage"
                        class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button
                        @click="sendMessage"
                        class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                        Kirim
                    </button>
                </div>
            </div>

            <div v-else class="flex items-center justify-center flex-1 text-gray-500">
                Pilih kontak atau group untuk memulai chat
            </div>
        </div>
        <!-- create group method -->
        <div v-if="showCreateGroupModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
                <h3 class="text-lg font-bold mb-4">Buat Group Baru</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Nama Group</label>
                    <input type="text" v-model="newGroupName" placeholder="Masukkan nama group..." class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Pilih Anggota</label>
                    <div class="max-h-48 overflow-y-auto border rounded-lg">
                        <div v-for="user in allUsers" :key="user.id"
                             @click="toggleUserSelection(user.id)"
                             :class="['p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2', selectedUsers.includes(user.id) ? 'bg-blue-100' : '']">
                            <input type="checkbox" :checked="selectedUsers.includes(user.id)" class="pointer-events-none">
                            <span>{{ user.name }}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button @click="createGroup" class="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">Buat Group</button>
                    <button @click="closeCreateGroupModal" class="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600">Batal</button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>