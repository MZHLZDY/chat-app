<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import { Video, UserPlus, ChartArea} from 'lucide-vue-next';
import { formatDistanceToNowStrict, isSameDay, isToday, isYesterday, format } from 'date-fns';
import { id } from 'date-fns/locale';
import VideoCallModal from './VideoCallModal.vue';
import IncomingCallModal from './IncomingCallModal.vue';
import OutgoingCallModal from './OutgoingCallModal.vue';
import type { CallStatus, Participants } from '@/types/CallStatus.js';
import type { Contact, Group, User, Chat } from '@/types/index';
// import type { Participants } from './OutgoingCallModal.vue';

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
watch(messages, () => {
    scrollToBottom();
}, { deep: true });
const messagesPage = ref(1);
const hasMoreMessages = ref(true);
const isSending = ref(false);
const isLoadingMessages = ref(false);
const isLoadingMore = ref(false);
const searchQuery = ref('');
const props = defineProps<{
  participants?: Participants[];
}>();
const activeChat = ref<Chat | null>(null);
const showDeleteModal = ref(false);
const messageToDelete = ref<any | null>(null);
const deleteType = ref<'me' | 'everyone'>('everyone');


// --- Personal Video Call State ---
const activeCall = ref<null | { contactName: string }>(null);
const callPartnerId = ref<number|null>(null);
// const personalCallStatus = ref<CallStatus>('idle');
const incomingCall = ref<{ from: any, to: { id: number, name: string } } | null>(null);
const isMinimized = ref(false);
const callStatus = ref<CallStatus>('idle');
const callType = ref< 'none' | 'personal' | 'group'>('none');

let callTimer : any = null;

const startVideoCall = (contact: Chat) => {
  callType.value = 'personal';
  callPartnerId.value = contact.id;
  activeContact.value = contact;
  callStatus.value = 'calling';

  // set timeout 30dtk, klo ga diangkat dianggap "missed"
  callTimer = setTimeout(() => {
    if (callStatus.value === 'calling') {
      callStatus.value = 'missed';
      endCall();
    }
  }, 30000);

  // TODO: Init Agora/Video Call Service
};

// const endOutgoingCall = () => {
//   clearTimeout(callTimer);
//   callPartnerId.value = null;
//   callStatus.value = "idle"
// }

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
}

const rejectIncomingCall = () => {
  callStatus.value = 'rejected';
  incomingCall.value = null;
  setTimeout(() => {
    callStatus.value = 'idle';
  }, 2000);

}

const endPersonalCall = () => {
  endCall();
};

const minimizeVideoCall = () => {
  isMinimized.value = true;
};

const restoreVideoCall = () => {
  isMinimized.value = false;
};

// State minimize call yang sedang berjalan
const isCallActive = computed(() => {
  return callStatus.value === 'connected' || callStatus.value === 'calling' || isMinimized.value;
});

// State untuk modal peringatan
const showCallWarning = ref(false);
const pendingCall = ref<{ type: 'personal' | 'group', contact?: Chat, groupData?: any } | null>(null);

// Group Video Call State
// const callStatus = ref<CallStatus>('idle');
const activeGroupCall = ref<null | { groupId: number; name: string; participants: Participants[] }>(null);const joinedMembers = ref<any[]>([]);

// Start Group Video Call
const startGroupCall = (groupId: number, groupName: string, members: Participants[]) => {
  activeGroupCall.value = {
    groupId,
    name: groupName,
    participants: members.map(m => ({ ...m, status: 'calling' }))
  };

  callType.value = 'group';
  callStatus.value = 'calling';

  // timeout untuk group call
  callTimer = setTimeout(() => {
    if (callStatus.value === 'calling') {
      const hasAccepted = activeGroupCall.value?.participants.some(p => p.status === 'accepted');
      if (!hasAccepted) {
        callStatus.value = 'missed';
        endCall();
      }
    }
  }, 30000);

  // TODO: trigger backend untuk broadcast panggilan ke semua anggota
};

// Accept group call
const joinGroupCall = (user: any) => {
  callStatus.value = 'connected';
  if (!joinedMembers.value.some(m => m.id === user.id)) {
    joinedMembers.value.push(user);
  }
};

// Leave group call
const leaveGroupCall = () => {
  endCall();
};

// State End call untuk semua (personal + group)
const endCall = () => {
  clearTimeout(callTimer);
  callType.value = 'none';
  callStatus.value = 'idle';
  callPartnerId.value = null;
  activeGroupCall.value = null;
  joinedMembers.value = []; // Reset joined members
  isMinimized.value = false; // Reset minimize state
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

  const updateLatestGroupMessage = (groupId: number, message: any) => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId);
    if (groupIndex !== -1) {
        // Update properti latest_message pada grup yang sesuai
        groups.value[groupIndex].latest_message = {
            message: message.message,
            sender_id: message.sender_id,
            sender: message.sender
        };
    }
};


const shouldShowDateSeparator = (currentMessage: any, previousMessage: any): boolean => {
    // Jika ini adalah pesan pertama, selalu tampilkan tanggalnya.
    if (!previousMessage) {
        return true;
    }

    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);
    
    return !isSameDay(currentDate, previousDate);
};

const formatDateSeparator = (dateString: string): string => {
    const date = new Date(dateString);

    if (isToday(date)) {
        return 'Hari Ini';
    }
    if (isYesterday(date)) {
        return 'Kemarin';
    }
    // Format untuk tanggal lainnya, contoh: "Selasa, 11 Sep 2025"
    return format(date, 'EEEE, d MMM yyyy', { locale: id });
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
    messages.value = response.data.data.reverse().map((m: any) => ({
      id: m.id, sender_id: m.sender_id, sender_name: m.sender?.name || 'Unknown', text: m.message, time: formatTime(m.created_at), read_at: m.read_at, created_at: m.created_at
    }));
    messagesPage.value = 1;
    hasMoreMessages.value = !!response.data.next_page_url; 
  } catch (e) { 
    console.error("Gagal memuat pesan:", e); 
  } finally {
        isLoadingMessages.value = false;
  }
};

const handleScroll = (event: Event) => {
    const container = event.target as HTMLElement;

    // Tambahkan pengecekan ini:
    // Hanya jalankan jika ADA scrollbar (tinggi konten lebih besar dari tinggi wadah)
    if (container.scrollHeight <= container.clientHeight) {
        return;
    }

    if (container.scrollTop === 0 && hasMoreMessages.value && !isLoadingMore.value) {
        loadMoreMessages();
    }
};


const loadMoreMessages = async () => {
    if (!hasMoreMessages.value || isLoadingMore.value || !activeContact.value) return;

    isLoadingMore.value = true;
    messagesPage.value++;

    try {
        const contact = activeContact.value;
        const endpoint = contact.type === 'group' 
            ? `/groups/${contact.id}/messages?page=${messagesPage.value}` 
            : `/chat/${contact.id}/messages?page=${messagesPage.value}`;
        
        const response = await axios.get(endpoint);
        const olderMessages = response.data.data.reverse().map((m: any) => ({
            id: m.id,
            sender_id: m.sender_id,
            sender_name: m.sender?.name || 'Unknown',
            text: m.message, // Mengubah 'message' menjadi 'text'
            time: formatTime(m.created_at),
            read_at: m.read_at,
            created_at: m.created_at
        }));
        // Simpan posisi scroll saat ini
        const container = messageContainer.value;
        const oldScrollHeight = container?.scrollHeight || 0;

        // Tambahkan pesan lama di bagian ATAS array
        messages.value = [...olderMessages, ...messages.value];
        hasMoreMessages.value = !!response.data.next_page_url;
        
        setTimeout(() => {
            if (container) {
                container.scrollTop = container.scrollHeight - oldScrollHeight;
            }
        }, 0);

    } catch (e) {
        console.error("Gagal memuat pesan lama:", e);
    } finally {
        isLoadingMore.value = false;
    }
};

const loadUnreadCounts = async () => {
  try {
    const response = await axios.get('/chat/unread-counts');
    unreadCounts.value = response.data;
  } catch (e) {
    console.error("Gagal memuat jumlah pesan belum dibaca:", e);
  }
};

const openDeleteModal = (message: any) => {
    messageToDelete.value = message;
    showDeleteModal.value = true;
    deleteType.value = 'everyone';
};

// Fungsi untuk mengeksekusi penghapusan
const confirmDeletion = () => {
    if (!messageToDelete.value) return;
    if (deleteType.value === 'everyone') {
        deleteMessageForEveryone(messageToDelete.value);
    } else {
        deleteMessageForMe(messageToDelete.value);
    }
    showDeleteModal.value = false;
    messageToDelete.value = null;
};

// Fungsi 'Hapus untuk Saya'
const deleteMessageForMe = async (message: any) => {
    messages.value = messages.value.filter(m => m.id !== message.id);
    try {
        await axios.post('/messages/hide', {
            message_id: message.id,
            message_type: activeContact.value?.type === 'group' ? 'group' : 'chat',
        });
    } catch (error) { console.error('Gagal menyembunyikan pesan:', error); }
};

// Fungsi 'Hapus untuk Semua' (sebelumnya bernama deleteMessage)
const deleteMessageForEveryone = async (message: any) => {
    try {
        const endpoint = activeContact.value?.type === 'group'
            ? `/group-messages/${message.id}`
            : `/messages/${message.id}`;
        await axios.delete(endpoint);
        messages.value = messages.value.filter(m => m.id !== message.id);
    } catch (error) { console.error('Gagal menghapus pesan:', error); }
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
        if (messageData.group_id) {
          updateLatestGroupMessage(messageData.group_id, messageData);
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
                time: formatTime(messageData.created_at),
                created_at: messageData.created_at
            });
          updateLatestMessage(messageData.sender_id, { text: messageData.message, sender_id: messageData.sender_id });
          if (activeContact.value?.type === 'user' && activeContact.value.id === messageData.sender_id) {
            // Langsung kirim sinyal "sudah dibaca" ke server
            axios.post('/chat/messages/read', { sender_id: messageData.sender_id });
        }
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
    
    // reset call UI saat pindah chat (kecuali ke chat yang sama dengan call yang sedang berlangsung)
    if (callStatus.value === 'calling' || callStatus.value === 'connected') {
      let shouldEndCall = false;
      
      if (callType.value === 'personal') {
        // Jika sedang call personal, end call jika:
        // 1. Pindah ke group chat (apapun groupnya)
        // 2. Pindah ke personal chat yang BERBEDA dari yang sedang di-call
        if (contact.type === 'group' || (contact.type === 'user' && contact.id !== callPartnerId.value)) {
          shouldEndCall = true;
        }
      } else if (callType.value === 'group') {
        // Jika sedang call group, end call jika:
        // 1. Pindah ke personal chat (apapun orangnya)  
        // 2. Pindah ke group chat yang BERBEDA dari yang sedang di-call
        if (contact.type === 'user' || (contact.type === 'group' && contact.id !== activeGroupCall.value?.groupId)) {
          shouldEndCall = true;
        }
      }
      
      if (shouldEndCall) {
        endCall();
      }
    }

    isLoadingMessages.value = true;
    activeContact.value = contact;
    messages.value = [];
    onlineUsers.value = [];
    newMessage.value = drafts.value[`${contact.type}-${contact.id}`] || '';
    loadMessages(contact.id, contact.type);
    bindChannel(contact.id, contact.type);
    if (contact.type === 'user') {
      axios.post('/chat/messages/read', { sender_id: contact.id });
    }
};

// handler untuk OutgoingCallModal events
const handleOutgoingCallTimeout = () => {
  callStatus.value = 'missed';
  endCall();
}

const handleGroupMemberAccepted = (memberId: number) => {
    if (activeGroupCall.value) {
        activeGroupCall.value.participants = activeGroupCall.value.participants.map(p =>
            p.id === memberId ? { ...p, status: 'accepted' } : p
        );
        
        // Jika ada yang terima, pindah ke VideoCallModal
        callStatus.value = 'connected';
    }
};

const handleGroupMemberRejected = (memberId: number) => {
    if (activeGroupCall.value) {
        activeGroupCall.value.participants = activeGroupCall.value.participants.map(p =>
            p.id === memberId ? { ...p, status: 'rejected' } : p
        );
    }
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
        created_at: new Date().toISOString()
    };
    
    addMessage(optimisticMessage);
    if (activeChat.type === 'user') {
    updateLatestMessage(activeChat.id, { text: messageText, sender_id: currentUserId.value });
  } else updateLatestGroupMessage(activeChat.id, { message: messageText, sender_id: currentUserId.value, sender: { id: currentUserId.value, name: currentUserName.value }})
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
      latest_message: newGroup.latest_message
    });
    closeCreateGroupModal();
    selectContact({ id: newGroup.id, name: newGroup.name, members_count: newGroup.members_count, owner_id: newGroup.owner_id, members: newGroup.member,latest_message: newGroup.latest_message, type: 'group' });
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
                updateLatestGroupMessage(messageData.group_id, messageData);
            }
        })
        .listen('.MessageRead', (eventData: any) => {
        // Cek jika chat yang relevan sedang aktif
        if (activeContact.value && activeContact.value.id === eventData.readerId) {
            // Update status pesan di state `messages`
            messages.value.forEach(msg => {
                if (msg.sender_id === currentUserId.value && !msg.read_at) {
                    msg.read_at = new Date().toISOString();
                }
            });
        }
    });
};

// --- Initialize ---
onMounted(() => {
  loadContacts();
  loadGroups();
  loadAllUsers();
  loadUnreadCounts();
  setupGlobalListeners();

  // Polling gawe update 'last_seen'
  const pollingInterval = setInterval(() => {
    loadContacts();
  }, 30000); // 30 detik

  onUnmounted(() => {
    clearInterval(pollingInterval);
  });
});

const selectChat = (chat: Chat) => {
  activeChat.value = chat;

  // Logic call management yang sama dengan selectContact
  if (callStatus.value === 'calling' || callStatus.value === 'connected') {
    let shouldEndCall = false;
    
    if (callType.value === 'personal') {
      // Jika sedang call personal, end call jika:
      // 1. Pindah ke group chat (apapun groupnya)
      // 2. Pindah ke personal chat yang BERBEDA dari yang sedang di-call
      if (chat.type === 'group' || (chat.type === 'user' && chat.id !== callPartnerId.value)) {
        shouldEndCall = true;
      }
    } else if (callType.value === 'group') {
      // Jika sedang call group, end call jika:
      // 1. Pindah ke personal chat (apapun orangnya)  
      // 2. Pindah ke group chat yang BERBEDA dari yang sedang di-call
      if (chat.type === 'user' || (chat.type === 'group' && chat.id !== activeGroupCall.value?.groupId)) {
        shouldEndCall = true;
      }
    }
    
    if (shouldEndCall) {
      endCall();
    }
  }
}
</script>

<template>
    <Head title="Chat" />
    <AppLayout>
        <div class="flex h-[89vh] rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 relative">
          <!-- sidebar bagian atas -->
            <div class="w-full md:w-1/4 bg-gray-100 dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col h-full absolute md:static inset-0 transition-transform duration-300 ease-in-out"
                 :class="{ '-translate-x-full md:translate-x-0': activeContact }"> 
                 <div class="p-4 border-b dark:border-gray-700 flex flex justify-between items-center">
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
                <!-- sidebar bagian chat -->
                <div class="flex-1 overflow-y-auto">
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
                                <span v-if="chat.type === 'group' && chat.latest_message">
                                  <span v-if="chat.type === 'group' && chat.latest_message.sender_id === currentUserId">
                                      Anda:
                                  </span>
                                  <span v-else-if="chat.type === 'group'">
                                      {{ chat.latest_message.sender.name }}:
                                  </span>
                                  {{ chat.latest_message.message }}
                              </span>
                            </div>
                       </div>
                       <div v-if="unreadCounts[`${chat.type}-${chat.id}`]" class="ml-auto mr-2 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse"> {{ unreadCounts[`${chat.type}-${chat.id}`] }}</div>
                       <div v-if="drafts[`${chat.type}-${chat.id}`]" class="w-2 h-2 bg-orange-500 rounded-full"></div>
                   </li>
                </ul>
            </div>
            </div>
            <!-- layout responsive -->
            <div class="w-full md:w-3/4 flex flex-col flex-1 absolute md:static inset-0 transition-transform duration-300 ease-in-out"
                 :class="{ 'translate-x-0': activeContact, 'translate-x-full md:translate-x-0': !activeContact }">
              <!-- navbar contact -->
                <div v-if="activeContact" class="flex flex-col h-full">
                    <div class="p-2 border-b dark:border-gray-700 font-semibold flex items-center gap-3">
                        <button @click="activeContact = null" class="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <div :class="activeContact.type === 'group' ? 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm' : 'w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm'">
                           {{ activeContact.type === 'group' ? 'G' : activeContact.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-semibold truncate text-gray-800 dark:text-gray-200">
                              {{ activeContact.name }}
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400">
                              <span v-if="activeContact.type === 'user'">
                                  <span v-if="onlineUsers.includes(activeContact.id)" class="text-green-500 flex items-center gap-1.5">
                                      <svg class="w-2 h-2 fill-current" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
                                      <span>Online</span>
                                  </span>
                                  <span v-else-if="(contacts.find((c: Contact) => c.id === activeContact?.id) as any)?.last_seen">
                                      {{ formatLastSeen((contacts.find((c: Contact) => c.id === activeContact?.id) as any)?.last_seen) }}
                                  </span>
                                  <span v-else>
                                      Offline
                                  </span>
                              </span>
                              <span v-else-if="activeContact.type === 'group'" class="truncate">
                                  {{ activeContact.members?.map((member: User) => member.id === currentUserId ? 'Anda' : member.name).join(', ') }}
                              </span>
                          </div>
                          <div v-if="activeContact.type === 'user'" class="text-xs text-gray-500 dark:text-gray-400">
                              {{ activeContact.phone_number }}
                          </div>
                      </div>
                        <button
                          v-if="activeContact.type === 'user'"
                          @click="startVideoCall(activeContact)"
                          class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full
                                 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
                        </button>
                        <button
                          v-if="activeContact.type === 'group'"
                          @click="startGroupCall(
                            activeContact.id,
                            activeContact.name,
                            (activeContact.members || []).map((m: User) => ({
                              ...m,
                              status: 'calling'
                             }))
                            )"
                          class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full
                                 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
                        </button>

                        <!-- Outgoing Personal Call Modal -->
                        <OutgoingCallModal
                          v-if="callType === 'personal' && callStatus === 'calling'"
                          :show="true"
                          :calleeName="activeContact?.name"
                          @cancel="endCall"
                          @timeout="handleOutgoingCallTimeout"
                        />

                        <!-- Outgoing Group Call Modal -->
                        <OutgoingCallModal
                          v-if="callType === 'group' && callStatus === 'calling'"
                          :show="true"
                          :isGroup="true"
                          :groupName="activeGroupCall?.name"
                          :participants="activeGroupCall?.participants"
                          @cancel="endCall"
                        />

                        <!-- Video Call Modal (untuk personal / group setelah connected) -->
                        <VideoCallModal
                          v-if="callStatus === 'connected' && (
                            (callType === 'personal' && activeContact?.type === 'user' && activeContact?.id === callPartnerId) ||
                            (callType === 'group' && activeContact?.type === 'group' && activeContact?.id === activeGroupCall?.groupId)
                          )"
                          :show="true"
                          :isGroup="callType === 'group'"
                          :contactName="callType === 'personal' ? activeContact?.name : undefined"
                          :groupName="callType === 'group' ? activeGroupCall?.name : undefined"
                          :participants="callType === 'group' ? activeGroupCall?.participants : undefined"
                          :status="callStatus"
                          @end="endCall"
                        />

                        <!-- Incoming Call Modal -->
                        <IncomingCallModal
                          v-if="callStatus === 'ringing'"
                          :show="true"
                          :fromName="incomingCall?.from.name"
                          @accept="acceptIncomingCall"
                          @reject="rejectIncomingCall"
                        />
                    </div>
                    <!-- room chat -->
                    <div ref="messageContainer" @scroll="handleScroll" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800 relative">
                        <div v-if="isLoadingMessages" class="absolute inset-0 flex justify-center items-center bg-gray-50 dark:bg-gray-800">
                            <span class="text-gray-500">Memuat pesan...</span>
                        </div>
                        <template v-else>
                            <div v-if="isLoadingMore" class="text-center text-gray-500 text-sm py-2">
                                Memuat pesan lama...
                            </div>
                            <template v-for="(m, index) in messages" :key="m.id">
                                <div v-if="shouldShowDateSeparator(m, messages[index - 1])"
                                    class="text-center my-4">
                                    <span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold px-3 py-2 rounded-full">
                                        {{ formatDateSeparator(m.created_at) }}
                                    </span>
                                </div>
                                <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="showDeleteModal = false">
                                  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6">
                                    <h3 class="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">Hapus Pesan?</h3>
                                    <div class="space-y-4 text-gray-700 dark:text-gray-300">
                                      <label class="flex items-center space-x-3 cursor-pointer">
                                        <input type="radio" v-model="deleteType" value="me" class="form-radio h-5 w-5 text-blue-600">
                                        <span>Hapus untuk Saya</span>
                                      </label>
                                      <label class="flex items-center space-x-3 cursor-pointer">
                                        <input type="radio" v-model="deleteType" value="everyone" class="form-radio h-5 w-5 text-blue-600">
                                        <span>Hapus untuk Semua</span>
                                      </label>
                                    </div>
                                    <div class="mt-6 flex justify-end space-x-4">
                                      <button @click="showDeleteModal = false" class="px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
                                      <button @click="confirmDeletion" class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Hapus</button>
                                    </div>
                                  </div>
                                </div>
                                <div :class="m.sender_id == currentUserId ? 'text-right' : 'text-left'">
                                    <div @click="m.sender_id == currentUserId ? openDeleteModal(m) : null" :class="[m.sender_id == currentUserId ? 'inline-block bg-green-700 text-white px-4 py-2 rounded-lg max-w-xs break-words text-left cursor-pointer' : 'inline-block bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded-lg max-w-xs break-words text-left']"> 
                                        <div v-if="activeContact.type === 'group' && m.sender_id !== currentUserId"
                                            class="text-xs font-semibold mb-1 opacity-75">
                                            {{ m.sender_name }}
                                        </div>
                                        <div>
                                            {{ m.text }}
                                            <div class="text-xs text-black-200 opacity-80 mt-1 flex items-center justify-end">
                                                <span>{{ m.time }}</span>
                                                <span v-if="m.sender_id === currentUserId" class="ml-2 flex items-center">
                                                    <svg v-if="m.read_at" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                                                        <path d="M18 6 7 17l-5-5"/>
                                                        <path d="m22 10-7.5 7.5L13 16"/>
                                                    </svg>
                                                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M20 6 9 17l-5-5"/>
                                                    </svg>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>
                    <!-- input text -->
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
                <!-- blank page -->
                <div v-else class="hidden md:flex items-center justify-center flex-1 text-gray-500">
                    Pilih kontak atau group untuk memulai chat
                </div>
            </div>
        </div>
        <!-- create group -->
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