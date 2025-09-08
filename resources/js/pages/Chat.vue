<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import { Video, UserPlus, ChartArea} from 'lucide-vue-next';
import { formatDistanceToNowStrict } from 'date-fns';
import { id } from 'date-fns/locale';
import VideoCallModal from './VideoCallModal.vue';
import IncomingCallModal from './IncomingCallModal.vue';
import OutgoingCallModal from './OutgoingCallModal.vue';
import type { CallStatus } from '@/types/CallStatus';
import type { Contact, Group, User, Chat } from '@/types/index';

axios.defaults.withCredentials = true;

// TypeScript Interfaces
interface AuthUser {
    id: number;
    name: string;
    email: string;
}

interface PageProps {
    auth: {
        user: AuthUser;
    };
    [key: string]: any;
}

const drafts = ref<{ [key: string]: string }>({});
const page = usePage<PageProps>();
const currentUserId = computed<number>(() => page.props.auth.user.id);
const currentUserName = computed<string>(() => page.props.auth.user.name);

// --- State Management ---
// const contacts = ref<{ id: number, name: string, last_seen: string | null, phone_number: string | null}[]>([]);
const contacts = ref<Contact[]>([]);
const groups = ref<Group[]>([]);
const allUsers = ref<User[]>([]);
// const activeContact = ref<{ id: number, name: string, type: 'user' | 'group' } | null>(null);
const activeContact = ref<Chat | null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const onlineUsers = ref<number[]>([]); 
const unreadCounts = ref<{ [key: string]: number }>({});
const messageContainer = ref<HTMLElement | null>(null);
const isSending = ref(false);
const searchQuery = ref('');

// --- Personal Video Call State ---
const showVideoCall = ref(false);
const activeCall = ref<null | { contactName: string }>(null);
const callPartnerId = ref<number|null>(null);
const callStatus = ref<CallStatus>('idle');
const incomingCall = ref<{ from: any, to: { id: number, name: string } } | null>(null);
const isMinimized = ref(false);

let callTimer : any = null;

const startVideoCall = (userId: number) => {
  callPartnerId.value = userId;
  showVideoCall.value = true;
  callStatus.value = 'calling';

  // set timeout 60dtk, klo ga diangkat dianggap "missed"
  callTimer = setTimeout(() => {
    if (callStatus.value === 'ringing') {
      callStatus.value = 'missed';
    }
  }, 60000);

  // TODO: Init Agora/Video Call Service
};

const endOutgoingCall = () => {
  clearTimeout(callTimer);
  showVideoCall.value = false;
  callPartnerId.value = null;
  callStatus.value = "idle"
}

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
const allChats = computed((): Chat[] => [
  ...contacts.value.map(c => ({ ...c, type: 'user' as const })),
  ...groups.value.map(g => ({ ...g, type: 'group' as const }))
]);

// search query
const filteredChats = computed(() => {
    if (!searchQuery.value) {
        return allChats.value; // Lek kotak pencarian kosong, tampilno kabeh
    }
    // Lek onok isine, saringen berdasarkan jeneng
    return allChats.value.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});


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

const updateLatestMessage = (contactId: number, message: { text: string, sender_id: number }) => {
    const contactIndex = contacts.value.findIndex(c => c.id === contactId);
    if (contactIndex !== -1) {
        contacts.value[contactIndex].latest_message = {
            message: message.text,
            sender_id: message.sender_id
        };
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
    groups.value = response.data;
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
          updateLatestMessage(messageData.sender_id, { text: messageData.message, sender_id: messageData.sender_id });
        } else {
        // Lek chat e GAK aktif, berarti p  esene durung diwoco
        let unreadChatId: string;
        
        if (messageData.group_id) { // Lek iki pesan grup
            unreadChatId = `group-${messageData.group_id}`;
        } else { // Lek iki pesan personal
            unreadChatId = `user-${messageData.sender_id}`;
        }
        
        // GANTI LOGIKA IKI gawe NGITUNG
        const currentCount = unreadCounts.value[unreadChatId] || 0;
        unreadCounts.value = {
            ...unreadCounts.value,
            [unreadChatId]: currentCount + 1
        };
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
const selectContact = (contact: Chat) => {
    if (activeContact.value && newMessage.value.trim()) {
        drafts.value[`${activeContact.value.type}-${activeContact.value.id}`] = newMessage.value;
    }
    
    const chatIdentifier = `${contact.type}-${contact.id}`;
    // Hapus ID chat iki teko daftar "durung diwoco"
    if (unreadCounts.value[chatIdentifier]) {
    const newCounts = { ...unreadCounts.value };
    delete newCounts[chatIdentifier];
    unreadCounts.value = newCounts;
}

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
    if (activeChat.type === 'user') {
    updateLatestMessage(activeChat.id, { text: messageText, sender_id: currentUserId.value });
  }
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
      owner_id: newGroup.owner_id,
      members: newGroup.members,
    });
    closeCreateGroupModal();
    selectContact({ id: newGroup.id, name: newGroup.name, members_count: newGroup.members_count, owner_id: newGroup.owner_id, members: newGroup.member, type: 'group' });
  } catch (e) {
    console.error('Gagal membuat grup:', e);
    alert('Gagal membuat grup!');
  }
};

const setupGlobalListeners = () => {
  echo.channel('users')
    .listen('.UserRegistered', (newUser: any) => {
      if (!allUsers.value.some(u => u.id === newUser.id)) {
        allUsers.value.push({ id: newUser.id, name: newUser.name, });
      }
      if (!contacts.value.some(c => c.id === newUser.id)) {
        contacts.value.push({ id: newUser.id, name: newUser.name, last_seen: null, phone_number: null, latest_message: null});
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
                const currentCount = unreadCounts.value[unreadChatId] || 0;
                unreadCounts.value = {
                    ...unreadCounts.value,
                    [unreadChatId]: currentCount + 1
                };
              updateLatestMessage(messageData.sender_id, { text: messageData.message, sender_id: messageData.sender_id });
            }
        })
        .listen('.GroupMessageSent', (eventData: any) => { // <-- TAMBAHNO IKI
            const messageData = eventData.message ? eventData.message : eventData;

            // Cek disik, opo grup e lagi aktif dibuka?
            const isGroupChatCurrentlyActive = activeContact.value?.type === 'group' && activeContact.value?.id === messageData.group_id;

            // Lek GAK aktif, baru munculno notif unread
            if (!isGroupChatCurrentlyActive) {
                const unreadChatId = `group-${messageData.group_id}`;
                const currentCount = unreadCounts.value[unreadChatId] || 0;
                unreadCounts.value = {
                    ...unreadCounts.value,
                    [unreadChatId]: currentCount + 1
                };
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
        <div class="flex h-[89vh] rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 relative">

            <div class="w-full md:w-1/4 bg-gray-100 dark:bg-gray-800 border-r dark:border-gray-700 overflow-y-auto absolute md:static inset-0 transition-transform duration-300 ease-in-out"
                 :class="{ '-translate-x-full md:translate-x-0': activeContact }"> <div class="p-4 border-b dark:border-gray-700 flex flex justify-between items-center">
                    <span class="font-bold text-lg">Chat</span>
                    <button @click="openCreateGroupModal"
                            class="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-full text-sm hover:bg-blue-600 transition-colors">
                        <UserPlus class="w-5 h-5"/>
                    </button>
                </div>
                <div class="p-2">
                  <input type="text" v-model="searchQuery" placeholder="Cari kontak atau grup..."
                         class="w-full px-3 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-400">
                </div>
                <ul>
                   <li v-for="chat in filteredChats" :key="`${chat.type}-${chat.id}`"
                       @click="selectContact(chat)"
                       :class="['p-4 border-b dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-3',activeContact?.id === chat.id && activeContact?.type === chat.type ? 'bg-gray-dark:bg-gray-600' : '']">
                       <div :class="chat.type === 'group' ? 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold' : 'w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-bold'">
                           {{ chat.type === 'group' ? 'G' : chat.name.charAt(0).toUpperCase() }}
                       </div>
                       <div class="flex-1 min-w-0 overflow-hidden">
                           <div class="font-semibold">{{ chat.name }}</div>
                           <div class="text-sm text-gray-500 dark:text-gray-400 truncate break">
                             <span v-if="chat.type === 'user' && (chat as Contact).latest_message">
                                 <span v-if="(chat as Contact).latest_message?.sender_id === currentUserId">Anda: </span>
                                 {{ (chat as Contact).latest_message?.message }}
                             </span>
                           </div>
                           <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                               <template v-if="chat.type === 'group'">
                                   {{ chat.members_count }} anggota
                               </template>
                           </div>
                       </div>
                       <div v-if="unreadCounts[`${chat.type}-${chat.id}`]" class="ml-auto mr-2 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"> {{ unreadCounts[`${chat.type}-${chat.id}`] }}</div>
                       <div v-if="drafts[`${chat.type}-${chat.id}`]" class="w-2 h-2 bg-orange-500 rounded-full"></div>
                   </li>
                </ul>
            </div>

            <div class="w-full md:w-3/4 flex flex-col flex-1 absolute md:static inset-0 transition-transform duration-300 ease-in-out"
                 :class="{ 'translate-x-0': activeContact, 'translate-x-full md:translate-x-0': !activeContact }">

                <div v-if="activeContact" class="flex flex-col h-full">
                    <div class="p-4 border-b dark:border-gray-700 font-semibold flex items-center gap-3">
                        <button @click="activeContact = null" class="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>

                        <div :class="activeContact.type === 'group' ? 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm' : 'w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm'">
                           {{ activeContact.type === 'group' ? 'G' : activeContact.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="flex flex-col">
                          <span class="leading-tight">{{ activeContact.name }}</span>
                          <span v-if="activeContact.type === 'group'" class="text-xs text-gray-500">{{ activeContact.members?.map(member => member.name).join(', ') }}</span>
                          <span v-if="activeContact.type === 'user'" class="text-xs text-gray-500">
                            {{ activeContact.phone_number }}
                          </span>
                        </div>

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
                        <button
                          v-if="activeContact.type === 'user'"
                          @click="startVideoCall(activeContact.id)"
                          class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full
                                 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
                        </button>
                        <button
                          v-if="activeContact.type === 'group'"
                          @click="startGroupCall(activeContact.id, activeContact.name)"
                          class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full
                                 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
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
                            :show="!!incomingCall"
                            v-if="incomingCall"
                            :fromName="incomingCall.from.name"
                            @accept="acceptIncomingCall"
                            @reject="rejectIncomingCall"
                        />
                        <OutgoingCallModal
                          :show="callStatus === 'calling'"
                          :calleeName="activeContact?.name"
                          @cancel="endOutgoingCall"
                        />
                    </div>

                    <div ref="messageContainer" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
                        <div v-for="m in messages" :key="m.id"
                             :class="m.sender_id === currentUserId ? 'text-right' : 'text-left'">
                            <div :class="m.sender_id === currentUserId ? 'inline-block bg-blue-500 text-white px-4 py-2 rounded-lg max-w-xs break-words text-left' : 'inline-block bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded-lg max-w-xs break-words text-left'">
                                <div v-if="activeContact.type === 'group' && m.sender_id !== currentUserId"
                                     class="text-xs font-semibold mb-1 opacity-75">
                                    {{ m.sender_name }}
                                </div>
                                {{ m.text }}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">{{ m.time }}</div>
                        </div>
                    </div>

                    <div class="p-2 md:p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
                            <input
                                type="text"
                                v-model="newMessage"
                                :placeholder="`Ketik pesan ke ${activeContact.name}...`"
                                @keyup.enter="sendMessage"
                                class="flex-1 w-full bg-transparent focus:outline-none focus:ring-0 px-3 text-gray-900 dark:text-gray-200"
                            />
                            <button
                                @click="sendMessage"
                                class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="hidden md:flex items-center justify-center flex-1 text-gray-500">
                    Pilih kontak atau group untuk memulai chat
                </div>
            </div>
        </div>

        <div v-if="showCreateGroupModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
                <h3 class="text-lg font-bold mb-4 dark:text-gray-200">Buat Group Baru</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nama Group</label>
                    <input type="text" v-model="newGroupName" placeholder="Masukkan nama group..." class="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Pilih Anggota</label>
                    <div class="max-h-48 overflow-y-auto border rounded-lg">
                        <div v-for="user in allUsers" :key="user.id"
                             @click="toggleUserSelection(user.id)"
                             :class="['p-2 border-b dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2']">
                            <input type="checkbox" :value="user.id" v-model="selectedUsers">
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