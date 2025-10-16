<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage, router } from '@inertiajs/vue3';
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import { Video, UserPlus, ChartArea, Phone} from 'lucide-vue-next';
import { formatDistanceToNowStrict, isSameDay, isToday, isYesterday, format } from 'date-fns';
import { id } from 'date-fns/locale';
import VideoCallModal from './VideoCallModal.vue';
import IncomingCallModal from './IncomingCallModal.vue';
import OutgoingCallModal from './OutgoingCallModal.vue';
import { usePersonalCall } from '@/composables/usePersonalCall';
import { useGroupCall } from '@/composables/useGroupCall';
import type { CallStatus, Participants } from '@/types/CallStatus.js';
import type { Contact, Group, User, Chat, AppPageProps } from '@/types/index';
import { useContacts } from '@/composables/useContacts';
// import type { Participants } from './OutgoingCallModal.vue';

axios.defaults.withCredentials = true;

// TypeScript Interfaces
interface AuthUser {
    id: number;
    name: string;
    email: string;
}

const drafts = ref<{ [key: string]: string }>({});
const page = usePage<AppPageProps>();
const user = computed<User>(() => page.props.auth.user);
const currentUserId = computed<number>(() => page.props.auth.user.id);
const currentUserName = computed<string>(() => page.props.auth.user.name);

// --- State Management ---
const { contacts, loadContacts } = useContacts();
const groups = ref<Group[]>([]);
const allUsers = ref<User[]>([]);
const activeContact = ref<Chat | null>(null);
const activeContactDetails = computed(() => {
  if (!activeContact.value) {
    return null;
  }
  return contacts.value.find(c => c.id === activeContact.value?.id);
});
const messages = ref<any[]>([]);
const newMessage = ref('');
const onlineUsers = ref<number[]>([]); 
const notificationData = ref<any | null>(null);
const unreadCounts = ref<{ [key: string]: number }>({});
const fileInput = ref<HTMLInputElement | null>(null);
const uploadProgress = ref<number>(0);
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
const userBackgroundPath = computed<string | null>(() => page.props.auth.user.background_image_path);
const userBackgroundUrl = computed<string>(() => page.props.auth.user.background_image_url);


// --- Call State ---
const { startVoiceCall, isPersonalCallActive } = usePersonalCall();
const { startGroupVoiceCall, isGroupVoiceCallActive } = useGroupCall();
const isAnyCallInProgress = computed(() => isPersonalCallActive.value || isGroupVoiceCallActive.value);

// --- Personal Video Call State ---
const activeCall = ref<null | { contactName: string }>(null);
const callPartnerId = ref<number|null>(null);
// const personalCallStatus = ref<CallStatus>('idle');
const incomingCall = ref<{ from: any, to: { id: number, name: string }, callId?: string, channel?: string, callType?: string } | null>(null);
const isMinimized = ref(false);
const callStatus = ref<CallStatus>('idle');
const callType = ref< 'none' | 'personal' | 'group'>('none');

let callTimer : any = null;

const startVideoCall = async (contact: Chat) => {
  // cek apakah sedang ada call aktif
  if (isCallActive.value) {
    // simpan informasi call yang ingin dibuat
    pendingCall.value = { type: 'personal', contact };
    showCallWarning.value = true;
    return;
  }

  callType.value = 'personal';
  callPartnerId.value = contact.id;
  activeContact.value = contact;
  callStatus.value = 'calling';

  const tempId = Date.now();
  const optimisticMessage = {
    id: tempId,
    sender_id: currentUserId.value,
    sender_name: currentUserName.value,
    text: 'Panggilan Video • Memanggil',
    time: formatTime(new Date().toISOString()),
    created_at: new Date().toISOString(),
    type: 'call_event'
  };
  
  addMessage(optimisticMessage);

  // BE untuk trigger incoming call
  try {
    console.log('📞 Memulai panggilan ke:', contact.id);

    const response = await axios.post('/call/invite', {
      callee_id: contact.id,
      call_type: 'video'
    });

    console.log('✅ Panggilan berhasil dimulai:', response.data);

    // set timeout 30dtk, klo ga diangkat dianggap "missed"
    callTimer = setTimeout(() => {
      if (callStatus.value === 'calling') {
        callStatus.value = 'missed';
        endCall();
      }
    }, 30000); 

  } catch (error) {
    console.error('❌ Gagal memulai panggilan:', error);
    alert('Gagal memulai panggilan. Silakan coba lagi.');
    endCall();
    return;
  }
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
    to: { id: currentUserId.value, name: currentUserName.value },
    callId: 'temp-call-id',
    channel: 'temp-channel',
    callType: 'video'
  }
}

const acceptIncomingCall = async () => {
  if (!incomingCall.value) return;

  try {
    console.log('✅ Menerima panggilan dari');

    await axios.post('/call/answer', {
      call_id: incomingCall.value.callId || 'temp-call-id',
      caller_id: incomingCall.value.from.id,
      accepted: true
    });
    
    clearTimeout(callTimer)

    // Set call partner info untuk personal call
    callStatus.value = 'connected';
    callType.value = 'personal'
    callPartnerId.value = incomingCall.value.from.id;

    incomingCall.value = null;

    console.log('✅ Panggilan berhasil diterima')
    
  } catch (error) {
    console.error('❌ Gagal menerima panggilan:', error);
    alert('Gagal menerima panggilan. Silakan coba lagi.');
  }
}

const rejectIncomingCall = async () => {
  if (!incomingCall.value) return;

  try {
    console.log('❌ Menolak panggilan dari');

    await axios.post('/call/answer', {
      call_id: incomingCall.value.callId || 'temp-call-id',
      caller_id: incomingCall.value.from.id,
      accepted: false,
      reason: 'User menolak'
    });
    
    console.log('❌ Panggilan berhasil ditolak');

  } catch (error) {
    console.error('❌ Gagal untuk menolak panggilan:', error);
  }

  callStatus.value = 'rejected';
  incomingCall.value = null;

  setTimeout(() => {
    callStatus.value = 'idle';
  }, 2000);
};

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
  // cek apakah sedang ada call aktif
  if (isCallActive.value) {
    // simpan informasi call yang ingin dibuat
    pendingCall.value = {
      type: 'group',
      groupData: { groupId, groupName, members }
    };
    showCallWarning.value = true;
    return;
  }

  activeGroupCall.value = {
    groupId,
    name: groupName,
    participants: members.map(m => ({ ...m, status: 'calling' }))
  };

  callType.value = 'group';
  callStatus.value = 'calling';
  isMinimized.value = false;

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
const endCall = async () => {
  clearTimeout(callTimer);

  // notfiy BE jika ada active call
  if ((callStatus.value === 'calling' || callStatus.value === 'connected') &&
      (callPartnerId.value || activeGroupCall.value)) {
    
    try {
      const participantIds = [];

      if (callType.value === 'personal' && callPartnerId.value) {
        participantIds.push(callPartnerId.value);
      } else if (callType.value === 'group' && activeGroupCall.value) {
        participantIds.push(...activeGroupCall.value.participants.map(p => p.id));
      }

      if (participantIds.length > 0) {
        await axios.post('/call/end', {
          call_id: 'temp-call-id',
          participant_ids: participantIds,
          reason: 'User mengakhiri panggilan'
        });

        console.log('☎️ Notifikasi panggilan diakhiri dikirimkan ke BE')
      }

    } catch (error) {
      console.error('❌ Gagal mengirim notifikasi akhiri panggilan ke BE:', error);
    }
  }

  // Reset semua state dengan benar
  callType.value = 'none';
  callStatus.value = 'idle';
  callPartnerId.value = null;
  activeGroupCall.value = null;
  joinedMembers.value = [];
  isMinimized.value = false;
  incomingCall.value = null;

  console.log('✅ Panggilan diakhiri, semua state direset');
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
        return allChats.value;
    }
    return allChats.value.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});

const notificationAvatarUrl = computed(() => {
  if (!notificationData.value?.sender?.name) return '';
  const name = notificationData.value.sender.name.replace(/\s/g, '+');
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true`;
});

// Fungsi untuk MENAMPILKAN notifikasi dengan data pesan yang masuk
const showNotification = (message: any) => {
  notificationData.value = message;
  setTimeout(() => {
    notificationData.value = null;
  }, 5000);
};

const hideNotification = () => {
  notificationData.value = null;
};

const handleNotificationClick = () => {
  const message = notificationData.value;
  if (!message) return;

  let chatToOpen: Chat | undefined;
  if (message.group_id) {
  const group = groups.value.find(g => g.id === message.group_id);
    if (group) {
      chatToOpen = { ...group, type: 'group' };
    }
  } else {
    const contact = contacts.value.find(c => c.id === message.sender_id);
    if (contact) {
      chatToOpen = { ...contact, type: 'user' };
    }
  }
  if (chatToOpen) {
    selectContact(chatToOpen);
  }

  hideNotification();
};


// --- Helper Functions ---
const triggerFileInput = () => {
    fileInput.value?.click();
};

const onFileSelected = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
        return;
    }

    const file = target.files[0];
    uploadProgress.value = 0;
    const formData = new FormData();
    formData.append('file', file);

    let endpoint = '';
    if (activeContact.value?.type === 'group') {
        endpoint = `/groups/${activeContact.value.id}/messages/file`;
    } else { 
        endpoint = `/messages/file`;
        formData.append('receiver_id', String(activeContact.value?.id));
    }

    try {
        const response = await axios.post(endpoint, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.lengthComputable && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    uploadProgress.value = percentCompleted;
                }
            },
        });

        addMessage(response.data);
        
    } catch (error) {
        console.error('Gagal mengirim file:', error);
        alert('Gagal mengirim file. Silakan coba lagi.');
    } finally {
        setTimeout(() => {
            uploadProgress.value = 0;
        }, 1500);
    }
};

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

const updateLatestMessage = (contactId: number, message: { text: string, sender_id: number, sender: { id: number, name: string } }) => {
    const contactIndex = contacts.value.findIndex(c => c.id === contactId);
    if (contactIndex !== -1) {
        contacts.value[contactIndex].latest_message = {
            message: message.text,
            sender: message.sender,
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
    return format(date, 'EEEE, d MMM yyyy', { locale: id });
};

// --- Load Functions ---
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
    
    messages.value = response.data.data.reverse().map((m: any) => {
      const baseMessage = {
        id: m.id,
        sender_id: m.sender_id,
        sender_name: m.sender?.name || 'Unknown',
        text: m.message,
        time: formatTime(m.created_at),
        read_at: m.read_at,
        created_at: m.created_at,
        type: m.type,
        call_event: m.call_event,
        file_path: m.file_path,
        file_name: m.file_name,
        file_mime_type: m.file_mime_type,
        file_size: m.file_size,
      };

      return baseMessage;
    });
    
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
            text: m.message,
            time: formatTime(m.created_at),
            read_at: m.read_at,
            created_at: m.created_at,
            type: m.type, 
            file_path: m.file_path, 
            file_name: m.file_name, 
            file_mime_type: m.file_mime_type, 
            file_size: m.file_size
        }));
        const container = messageContainer.value;
        const oldScrollHeight = container?.scrollHeight || 0;

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

// Fungsi 'Hapus untuk Semua'
const deleteMessageForEveryone = async (message: any) => {
    try {
        const endpoint = activeContact.value?.type === 'group'
            ? `/group-messages/${message.id}`
            : `/messages/${message.id}`;
        await axios.delete(endpoint);
        messages.value = messages.value.filter(m => m.id !== message.id);
    } catch (error) { console.error('Gagal menghapus pesan:', error); }
};

const setupEchoListener = (chat: Chat) => {
    let channelName = '';
    if (chat.type === 'group') {
        channelName = `group.${chat.id}`;
    } else {
        const participants = [currentUserId.value, chat.id];
        participants.sort((a, b) => a - b);
        channelName = `chat.${participants.join('.')}`;
    }

    console.log(`Bergabung ke channel real-time: ${channelName}`);

    window.Echo.private(channelName)
        .listen('.MessageSent', (event: any) => {
            console.log('Pesan baru diterima dari Echo:', event.message);
            
            // ✅ PERBAIKAN: Handle semua pesan, termasuk dari pengirim sendiri
            const formattedMessage = {
                ...event.message,
                time: formatTime(event.message.created_at),
                sender_name: event.message.sender?.name || 'Unknown'
            };
            
            // Cek apakah pesan sudah ada untuk menghindari duplikasi
            const messageIndex = messages.value.findIndex(m => m.id === formattedMessage.id);

            if (messageIndex !== -1) {
              // Pesan sudah ada, UPDATE isinya.
              // Ini adalah kunci untuk memperbarui status panggilan di bubble yang sama.
              console.log(`🔄 Memperbarui pesan yang ada dengan ID: ${formattedMessage.id}`);
              const targetMessage = messages.value[messageIndex];
              targetMessage.text = formattedMessage.message || formattedMessage.text;
              targetMessage.call_event = formattedMessage.call_event; // Update juga data call event-nya
            } else {
              // Pesan benar-benar baru, TAMBAHKAN ke array.
              // Ini untuk pesan teks biasa atau pesan panggilan pertama ("Memanggil").
              console.log(`➕ Menambahkan pesan baru dengan ID: ${formattedMessage.id}`);
              messages.value.push(formattedMessage);
            }
        })
        .listen('.message.deleted', (event: { messageId: number }) => {
            console.log('Event message.deleted diterima!', event);
            
            const messageIndex = messages.value.findIndex(m => m.id === event.messageId);
            if (messageIndex !== -1) {
                messages.value[messageIndex].text = 'Pesan ini telah dihapus';
        }
      })
};

watch(activeContact, (newContact, oldContact) => {
    if (oldContact) {
        let oldChannelName = '';
        if (oldContact.type === 'group') {
            oldChannelName = `group.${oldContact.id}`;
        } else {
            const participants = [currentUserId.value, oldContact.id];
            participants.sort((a, b) => a - b);
            oldChannelName = `chat.${participants.join('.')}`;
        }
        window.Echo.leave(oldChannelName);
        console.log(`Meninggalkan channel: ${oldChannelName}`);
    }
    if (newContact) {
        setupEchoListener(newContact);
    }
});

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
                created_at: messageData.created_at,
                type: messageData.type,
                call_event: messageData.call_event
            });
          updateLatestMessage(messageData.sender_id, { text: messageData.message, sender_id: messageData.sender_id, sender: messageData.sender });
          if (activeContact.value?.type === 'user' && activeContact.value.id === messageData.sender_id) {
            axios.post('/chat/messages/read', { sender_id: messageData.sender_id });
        }
        } else {
        let unreadChatId: string;
        
        if (messageData.group_id) {
            unreadChatId = `group-${messageData.group_id}`;
        } else {
            unreadChatId = `user-${messageData.sender_id}`;
        }
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
    
    // logic untuk minimize / restore call saat pindah chat
    if (callStatus.value === 'calling' || callStatus.value === 'connected') {
      let shouldMinimize = false;
      let shouldRestore = false;
      
      if (callType.value === 'personal') {
        // jika sedang call personal
        if (contact.type === 'user' && contact.id === callPartnerId.value) {
          // pindah ke chat yang sama dengan call -> restore
          shouldRestore = true;
        } else {
          // pindah ke chat yang berbeda dengan call -> minimize
          shouldMinimize = true;
        }
      
      } else if (callType.value === 'group') {
        // jika sedang call group
        if (contact.type === 'group' && contact.id === activeGroupCall.value?.groupId) {
          // pindah ke grup yang sama dengan call -> restore
          shouldRestore = true;
        } else {
          // pindah ke chat yang berbeda dengan call -> minimize
          shouldMinimize = true;
        }
      }

      if (shouldMinimize) {
        isMinimized.value = true;
      } else if (shouldRestore) {
        isMinimized.value = false;
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
    updateLatestMessage(activeChat.id, { text: messageText, sender_id: currentUserId.value, sender: {id: currentUserId.value , name: currentUserName.value } });
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

const parseCallEventMessage = (message: string) => {
  try {
    return JSON.parse(message);
  } catch (e) {
    return null;
  }
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null || seconds < 0) return '';
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} mnt`;
};

// Tambahkan method ini di bagian methods/setup Chat.vue
const formatCallEventMessage = (message: any) => {
  if (!message.text && !message.message) return 'Panggilan Suara';
  
  const text = message.text || message.message;
  
  // Jika sudah dalam format yang diinginkan, langsung return
  if (text.includes('Panggilan Suara')) {
    return text;
  }
  
  // Format untuk berbagai jenis status panggilan
  if (text.includes('answered') || text.includes('•')) {
    return text; // Sudah diformat oleh backend
  }
  
  // Fallback
  return 'Panggilan Suara';
};

const setupGlobalListeners = () => {
  echo.channel('users')
    .listen('.UserRegistered', (event: { user: any }) => {
        const newUser = event.user;

        if (!allUsers.value.some(u => u.id === newUser.id)) {
            const fullUserObject = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email || '', 
                email_verified_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                profile_photo_url: '',
                background_image_url: '',
                background_image_path: null,
                last_seen: null,
                phone_number: null,
                latest_message: null
            };

            allUsers.value.push(fullUserObject);
            
            if (!contacts.value.some(c => c.id === newUser.id)) {
                contacts.value.push(fullUserObject);
            }
        }
    });
    

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
        const isChatCurrentlyActive = activeContact.value?.type === 'user' && activeContact.value?.id === messageData.sender_id;

        // Update latest message di sidebar untuk semua kasus
        if (messageData.group_id) {
            updateLatestGroupMessage(messageData.group_id, messageData);
        } else {
            updateLatestMessage(messageData.sender_id, { 
                text: messageData.message, 
                sender_id: messageData.sender_id, 
                sender: messageData.sender 
            });
        }

        // JANGAN TAMBAHKAN PESAN DI SINI JIKA CHAT AKTIF
        // Biarkan setupEchoListener yang menanganinya.
        if (!isChatCurrentlyActive) {
            // Tambahkan ke unread counts dan tampilkan notifikasi jika chat tidak aktif
            const unreadChatId = messageData.group_id ? `group-${messageData.group_id}` : `user-${messageData.sender_id}`;
            const currentCount = unreadCounts.value[unreadChatId] || 0;
            unreadCounts.value[unreadChatId] = currentCount + 1;

            showNotification({ ...messageData, time: formatTime(messageData.created_at) });
        }
        
        // Namun, jika ini adalah pesan call_event, kita tetap perlu mengupdate
        // gelembung pesan yang sudah ada, bahkan jika chat tidak aktif.
        // Ini untuk kasus di mana Anda melihat chat lain saat panggilan berakhir.
        if (messageData.type === 'call_event') {
            const messageIndex = messages.value.findIndex(m => m.id === messageData.id);
            if (messageIndex !== -1) {
                console.log(`🔄 Memperbarui pesan panggilan dari listener global: ID ${messageData.id}`);
                const targetMessage = messages.value[messageIndex];
                targetMessage.text = messageData.message || messageData.text;
                targetMessage.call_event = messageData.call_event;
            }
        }
    })
    .listen('.GroupMessageSent', (eventData: any) => {
        const messageData = eventData.message ? eventData.message : eventData;
        const isGroupChatCurrentlyActive = activeContact.value?.type === 'group' && activeContact.value?.id === messageData.group_id;
        
        if (messageData.sender_id === currentUserId.value) return;

        updateLatestGroupMessage(messageData.group_id, messageData);

        if (!isGroupChatCurrentlyActive) {
            const unreadChatId = `group-${messageData.group_id}`;
            const currentCount = unreadCounts.value[unreadChatId] || 0;
            unreadCounts.value[unreadChatId] = currentCount + 1;

            showNotification(messageData);
        }
    })  
    .listen('.MessageRead', (eventData: any) => {
        if (activeContact.value && activeContact.value.id === eventData.readerId) {
            messages.value.forEach(msg => {
                if (msg.sender_id === currentUserId.value && !msg.read_at) {
                    msg.read_at = new Date().toISOString();
                }
            });
        }
    });

    // listening incoming call
    echo.private(`user.${currentUserId.value}`)
      .listen('.incoming-call', (payload: any) => {
        console.log('🤙 Raw payload diterima:', JSON.stringify(payload, null, 2));
        console.log('📋 Caller object:', payload.caller);
        console.log('📋 Caller ID', payload.caller?.id);
        console.log('📋 Caller name:', payload.caller?.name);
        console.log('📋 Caller email:', payload.caller?.email);

        // Detektor Telepon Suara
        if (payload.call_type === 'voice') {
          console.log('🎤 Panggilan suara terdeteksi, diabaikan oleh listener.');
          return;
        }

        // Validasi payload
        if (!payload.caller || !payload.caller.name) {
          console.error('❌ Payload caller tidak valid:', payload);
          return;
        }

        callStatus.value = 'ringing';
        incomingCall.value = {
          from: {
            id: payload.caller.id,
            name: payload.caller.name || 'Unknown User',
            email: payload.caller.email
          },
          to: { id: currentUserId.value, name: currentUserName.value },
          callId: payload.call_id || 'temp',
          channel: payload.channel,
          callType: payload.call_type
        };

        console.log('✅ IncomingCall object set:', incomingCall.value);
      })
      .listen('.call-accepted', (payload: any) => {
        console.log('✅ Panggilan diterima:', payload);
        if (callStatus.value === 'calling') {
          callStatus.value = 'connected'
        }
      })
      .listen('.call-rejected', (payload: any) => {
        console.log('❌ Panggilan ditolak:', payload);
        if (callStatus.value === 'calling') {
          callStatus.value = 'rejected';
          setTimeout(() => {
            callStatus.value = 'idle';
            endCall();
          }, 2000);
        }
      })
      .listen('.call-ended', (payload:any) => {
        console.log('☎️ Panggilan diakhiri:', payload)
      })
};

// --- Initialize ---
onMounted(() => {
  loadContacts();
  loadGroups();
  loadAllUsers();
  loadUnreadCounts();
  setupGlobalListeners();

  // Listener untuk menambahkan pesan panggilan suara dari usePersonalCall.ts
  const handleAddOptimisticMessage = (event: Event) => {
    // Pastikan event adalah CustomEvent sebelum mengakses detail
    if (event instanceof CustomEvent) {
      console.log('📢 Menerima event untuk menambah pesan panggilan suara:', event.detail);
      addMessage(event.detail);
    }
  };

  // Listener untuk menghapus pesan jika panggilan suara gagal dimulai
  const handleRemoveOptimisticMessage = (event: Event) => {
    if (event instanceof CustomEvent) {
      console.log('🗑️ Menerima event untuk menghapus pesan panggilan suara:', event.detail);
      // Hapus pesan dari array berdasarkan ID sementara (tempId)
      messages.value = messages.value.filter(m => m.id !== event.detail.id);
    }
  };

  window.addEventListener('add-optimistic-message', handleAddOptimisticMessage);
  window.addEventListener('remove-optimistic-message', handleRemoveOptimisticMessage);

  // Polling gawe update 'last_seen'
  const pollingInterval = setInterval(() => {
    loadContacts();
  }, 30000); // 30 detik

  onUnmounted(() => {
    clearInterval(pollingInterval);

    window.removeEventListener('add-optimistic-message', handleAddOptimisticMessage);
    window.removeEventListener('remove-optimistic-message', handleRemoveOptimisticMessage);
  });
});

const selectChat = (chat: Chat) => {
  activeChat.value = chat;

  // Logic call management yang sama dengan selectContact
  if (callStatus.value === 'calling' || callStatus.value === 'connected') {
    let shouldMinimize = false;
    let shouldRestore = false;
    
    if (callType.value === 'personal') {
      // Jika sedang call personal, end call jika:
      // 1. Pindah ke group chat (apapun groupnya)
      // 2. Pindah ke personal chat yang BERBEDA dari yang sedang di-call
      if (chat.type === 'user' && chat.id === callPartnerId.value) {
        let shouldRestore = true;
      } else {
        shouldMinimize = true;
      }
    
    } else if (callType.value === 'group') {
      // Jika sedang call group, end call jika:
      // 1. Pindah ke personal chat (apapun orangnya)  
      // 2. Pindah ke group chat yang BERBEDA dari yang sedang di-call
      if (chat.type === 'group' && chat.id !== activeGroupCall.value?.groupId) {
        shouldRestore = true;
      } else {
        shouldMinimize = true;
      }
    }
    
    if (shouldMinimize) {
      isMinimized.value = true;
    } else if (shouldRestore) {
      isMinimized.value = false;
    }
  }
}

// function untuk warning modal
const handleEndCurrentCallAndStart = () => {
  endCall();

  // start new call setelah delay singkat
  setTimeout(() => {
    if (pendingCall.value) {
      if (pendingCall.value.type === 'personal' && pendingCall.value.contact) {
        startVideoCall(pendingCall.value.contact);
      } else if (pendingCall.value.type === 'group' && pendingCall.value.groupData) {
        const { groupId, groupName, members } = pendingCall.value.groupData;
        startGroupCall(groupId, groupName, members);
      }
    }
    pendingCall.value = null;
    showCallWarning.value = false;
  }, 100);
};

const handleCancelNewCall = () => {
  pendingCall.value = null;
  showCallWarning.value = false;
};

// computed untuk mendapatkan nama contact yang sedang di-call
const currentCallContactName = computed(() => {
  if (callType.value === 'personal' && callPartnerId.value) {
    const contact = contacts.value.find(c => c.id === callPartnerId.value);
    return contact?.name || 'Unknown';
  } else if (callType.value === 'group' && activeGroupCall.value) {
    return activeGroupCall.value.name;
  }
  return '';
});
</script>

<template>
    <Head title="Chat" />
    <AppLayout>
      <transition
            enter-active-class="transform ease-out duration-300 transition"
            enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0">
            
            <div v-if="notificationData" class="fixed top-5 right-5 w-full max-w-sm z-50">
                <div @click="handleNotificationClick" class="bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden cursor-pointer">
                    <div class="p-4">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <img class="h-10 w-10 rounded-full" :src="notificationAvatarUrl" alt="Avatar">
                            </div>
                            <div class="ml-3 w-0 flex-1 pt-0.5">
                                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {{ notificationData.sender?.name || 'Grup' }}
                                    <span v-if="notificationData.group" class="font-normal text-gray-500">
                                        di {{ notificationData.group.name }}
                                    </span>
                                </p>
                                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {{ notificationData.message || notificationData.text }}
                                </p>
                            </div>
                            <div class="ml-4 flex-shrink-0 flex">
                                <button @click.stop="hideNotification" class="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                                    <span class="sr-only">Close</span>
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
        <div class="flex h-[89vh] rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 relative">
          <!-- sidebar bagian atas -->
            <div class="w-full md:w-1/4 bg-gray-100 dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col h-full absolute md:static inset-0 transition-transform duration-300 ease-in-out"
                 :class="{ 'translate-x-full md:translate-x-0': activeContact }"> 
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
                        <img v-if="chat.type === 'user' && (chat as any).profile_photo_url"
                            :src="(chat as any).profile_photo_url"
                            :alt="chat.name"
                            class="w-10 h-10 rounded-full object-cover"
                        />
                        <div v-else :class="['w-10 h-10 rounded-full flex items-center justify-center text-white font-bold', chat.type === 'group' ? 'bg-green-500' : 'bg-sky-500']">
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
                <div v-if="activeContact" class="flex flex-col h-full">
                  <!-- navbar personal chat -->
                  <div v-if="activeContact.type === 'user'"class="p-1.5 border-b dark:border-gray-700 font-semibold flex items-center gap-3">
                    <button @click="activeContact = null" class="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/>
                      </svg>
                    </button>
                    <div class="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm">
                      <span v-if="activeContact.name">{{ activeContact.name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate text-gray-800 dark:text-gray-200">
                        {{ activeContact.name }}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        <span v-if="onlineUsers.includes(activeContact.id)" class="text-green-500 flex items-center gap-1.5">
                          <svg class="w-2 h-2 fill-current" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
                          <span>Online</span>
                        </span>
                        <span v-else-if="activeContactDetails?.last_seen">
                          {{ formatLastSeen(activeContactDetails.last_seen) }}
                        </span>
                        <span v-else>Offline</span>
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ activeContact.phone_number }}
                      </div>
                    </div>
                    
                    <button @click="startVideoCall(activeContact)"class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
                    </button>
                    <button
                      v-if="activeContact.type === 'user'"
                      @click="startVoiceCall(activeContact)" title="Voice Call Personal"
                      :disabled="isAnyCallInProgress"
                       class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Phone class="w-5 h-5 ..."/>
                    </button>
                  </div>

                  <!-- navbar group -->
                  <div v-else-if="activeContact.type === 'group'"class="p-3.5 border-b dark:border-gray-700 font-semibold flex items-center gap-3">
                    <button @click="activeContact = null" class="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/>
                      </svg>
                    </button>
                    <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
                      G
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate text-gray-800 dark:text-gray-200">
                        {{ activeContact.name }}
                      </div>
                      <div v-if="activeContact.members" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {{ activeContact.members.map(member => member.id === currentUserId ? 'Anda' : member.name).join(', ') }}
                      </div>
                    </div>
                    
                    <button @click="startGroupCall(activeContact.id, activeContact.name, (activeContact.members || []).map(m => ({...m, status: 'calling'})))"class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Video class="w-5 h-5 text-gray-700 dark:text-gray-300"/>
                    </button>
                    <button
                       v-if="activeContact.type === 'group'"
                       @click="startGroupVoiceCall(activeContact)" title="Voice Call Group"
                       :disabled="isAnyCallInProgress"
                       class="flex ml-auto flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                       <Phone class="w-5 h-5 ..."/>
                    </button>
                  </div>
                  <div v-if="isCallActive && isMinimized"@click="restoreVideoCall"class="absolute right-14 top-3 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer flex items-center gap-2 transition-all duration-200 z-10">
                  </div>

                        <!-- minimize call button -->
                        <div v-if="isCallActive && isMinimized"
                            @click="restoreVideoCall"
                            class="absolute right-14 top-3 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer flex items-center gap-2 transition-all duration-200 z-10">
                          <Video class="w-4 h-4"/>
                          <div class="text-sm font-medium">
                            {{ callType === 'personal' ? currentCallContactName : activeGroupCall?.name || 'Group Call' }}
                          </div>
                          <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </div>

                        <!-- Outgoing Personal Call Modal -->
                        <OutgoingCallModal
                          v-if="callType === 'personal' && callStatus === 'calling' && !isMinimized"
                          :show="true"
                          :calleeName="currentCallContactName"
                          @cancel="endCall"
                          @timeout="handleOutgoingCallTimeout"
                        />

                        <!-- Outgoing Group Call Modal -->
                        <OutgoingCallModal
                          v-if="callType === 'group' && callStatus === 'calling' && !isMinimized"
                          :show="true"
                          :isGroup="true"
                          :groupName="currentCallContactName"
                          :participants="activeGroupCall?.participants"
                          @cancel="endCall"
                        />

                        <!-- Video Call Modal (untuk personal / group setelah connected) -->
                        <VideoCallModal
                          v-if="callStatus === 'connected' && !isMinimized && (
                            (callType === 'personal' && activeContact?.type === 'user' && activeContact?.id === callPartnerId) ||
                            (callType === 'group' && activeContact?.type === 'group' && activeContact?.id === activeGroupCall?.groupId)
                          )"
                          :show="true"
                          :isGroup="callType === 'group'"
                          :contactName="callType === 'personal' ? currentCallContactName : undefined"
                          :groupName="callType === 'group' ? currentCallContactName : undefined"
                          :participants="callType === 'group' ? activeGroupCall?.participants : undefined"
                          :status="callStatus"
                          @end="endCall"
                          @minimize="minimizeVideoCall"
                        />

                        <!-- Incoming Call Modal -->
                        <IncomingCallModal
                          :show="callStatus === 'ringing'"
                          :caller-name="incomingCall?.from?.name"
                          @accept="acceptIncomingCall"
                          @reject="rejectIncomingCall"
                        />

                     <!-- call warning modal -->
                    <div v-if="showCallWarning" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
                        <h3 class="text-lg font-bold mb-4 dark:text-gray-200">Panggilan sedang berlangsung</h3>
                        <p class="mb-4 text-gray-700 dark:text-gray-300">
                          Anda sedang dalam panggilan. Apakah anda ingin mengakhiri panggilan saat ini dan memulai panggilan baru?
                        </p>
                        <div class="flex gap-3">
                          <button @click="handleEndCurrentCallAndStart"
                                  class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg">
                            Akhiri & Panggil
                          </button>
                          <button @click="handleCancelNewCall"
                                  class="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg">
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                    <!-- room chat -->
                    <div ref="messageContainer" @scroll="handleScroll" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800 relative" :class="{'bg-gray-50 dark:bg-gray-800' : !userBackgroundPath}"
                    :style="userBackgroundPath?{
                      backgroundImage: `url(${userBackgroundUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      backgroundAttachment: 'fixed'
                    } : {}">
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
                                  <div :class="[m.sender_id == currentUserId ? 'inline-block bg-green-500 text-white px-4 py-2 rounded-lg max-w-xs break-words text-left' : 'inline-block bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded-lg max-w-xs break-words text-left']"
                                  @click.self="m.sender_id === currentUserId ? openDeleteModal(m) : null"
                                  @contextmenu.prevent="m.sender_id === currentUserId ? openDeleteModal(m) : null">
                                  <div v-if="activeContact.type === 'group' && m.sender_id !== currentUserId" class="text-xs font-semibold mb-1 opacity-75"> 
                                    {{ m.sender_name }} 
                                  </div>

                                  <!-- Pesan Penanda telepon video / suara -->
                                  <div v-if="m.type === 'call_event'" class="text-center my-4">
                                    <div class="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-full text-sm text-gray-600 dark:text-gray-300">
                                      <Video v-if="m.call_event?.call_type === 'video'" class="w-4 h-4" />
                                      <Phone v-else class="w-4 h-4" />

                                      <span>
                                       {{ m.text || m.message }}
                                      </span>
                                    </div>
                                  </div>
                                   
                                  <div v-if="m.type === 'image'" class="flex flex-col space-y-2">
                                    <a :href="`/storage/${m.file_path}`" target="_blank">
                                      <img v-if="m.file_path" :src="`/storage/${m.file_path}`" class="w-full rounded-lg cursor-pointer">
                                      <p v-else class="text-xs italic opacity-75">[Gagal memuat gambar]</p>
                                    </a>
                                    <p v-if="m.text">{{ m.text }}</p> 
                                  </div>
                                  
                                  <div v-else-if="m.type === 'video'" class="flex flex-col space-y-2">
                                    <video v-if="m.file_path" controls class="w-full rounded-lg">
                                      <source :src="`/storage/${m.file_path}`" :type="m.file_mime_type">
                                    </video>
                                    <p v-else class="text-xs italic opacity-75">[Gagal memuat video]</p>
                                    <p v-if="m.text">{{ m.text }}</p>
                                  </div>
                                  
                                  <div v-else-if="m.type === 'file'" class="flex flex-col space-y-2">
                                    <a v-if="m.file_path" :href="`/storage/${m.file_path}`" target="_blank" download class="flex items-center space-x-3 p-2 bg-gray-500 bg-opacity-20 rounded-lg hover:bg-opacity-30">
                                      <svg class="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                      </svg>
                                      <div class="flex flex-col text-left">
                                        <span class="font-bold">
                                          {{ m.file_name }}
                                        </span>
                                        <span v-if="m.file_size" class="text-xs">{{ (m.file_size / 1024).toFixed(2) }} KB</span>
                                      </div>
                                    </a>
                                    <p v-else class="text-xs italic opacity-75">[Gagal memuat file]</p>
                                    <p v-if="m.text">
                                      {{ m.text }}
                                    </p> 
                                  </div>

                                  <p v-else-if="m.type !== 'call_event'">
                                   {{ m.text }}
                                  </p>
                                    <div class="text-xs opacity-80 mt-1 flex items-center justify-end gap-1">
                                        <span>{{ m.time }}</span>
                                          <span v-if="m.sender_id === currentUserId">
                                              <svg v-if="m.read_at" xmlns="http://www.w.org/2000/svg" width="16" height="16" class="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                  <path d="M4 12.75L9 17.75L20 6.75"></path>
                                                  <path d="M1 12.75L6 17.75L17 6.75"></path>
                                              </svg>
                                              <svg v-else-if="m.id" xmlns="http://www.w.org/2000/svg" width="16" height="16" class="text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M4 12.75L9 17.75L20 6.75"></path>
                                                <path d="M1 12.75L6 17.75L17 6.75"></path>
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                              </div>
                            </template>
                        </template>
                    </div>
                    <!-- input text -->
                    <div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <div v-if="uploadProgress > 0 && uploadProgress < 100" class="p-2 text-center text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                        <p>Mengunggah file... {{ uploadProgress }}%</p>
                        <div class="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mt-1">
                            <div class="bg-blue-600 h-1.5 rounded-full" :style="{ width: uploadProgress + '%' }"></div>
                        </div>
                    </div>

                    <div class="p-2 md:p-2">
                        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
                            
                            <button
                                @click="triggerFileInput"
                                class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                </svg>
                            </button>
                            
                            <input 
                                type="file" 
                                ref="fileInput" 
                                @change="onFileSelected" 
                                hidden
                            >

                            <input
                                type="text"
                                v-model="newMessage"
                                :placeholder="`Ketik pesan ke ${activeContact?.name || ''}...`"
                                @keyup.enter="sendMessage"
                                class="flex-1 w-full bg-transparent focus:outline-none focus:ring-0 px-3 text-gray-900 dark:text-gray-200"
                            />

                            <button
                                @click="sendMessage"
                                class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m22 2-7 20-4-9-9-4Z"/>
                                    <path d="M22 2 11 13"/>
                                </svg>
                            </button>
                        </div>
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