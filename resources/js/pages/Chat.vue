<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { Head, usePage } from '@inertiajs/vue3';
import { ref, onMounted, computed, nextTick } from 'vue';
import axios from 'axios';
import { echo } from '../echo.js';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Video, Phone } from 'lucide-vue-next';

axios.defaults.withCredentials = true;

const drafts = ref<{ [key: string]: string }>({});
const page = usePage();
const currentUserId = computed(() => page.props.auth.user.id);
const currentUserName = computed(() => page.props.auth.user.name);

// --- State Management ---
const contacts = ref<{ id: number, name: string }[]>([]);
const groups = ref<{ id: number, name: string, members_count: number, owner_id: number }[]>([]);
const allUsers = ref<{ id: number, name: string }[]>([]);
const activeContact = ref<{ id: number, name: string, type: 'user' | 'group' } | null>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const messageContainer = ref<HTMLElement | null>(null);
const isSending = ref(false);

// --- Agora Call State ---
const isInCall = ref(false);
const callType = ref<'voice' | 'video' | null>(null);
const callStatus = ref('');
const localAudioTrack = ref<any>(null);
const localVideoTrack = ref<any>(null);
const remoteAudioTrack = ref<any>(null);
const remoteVideoTrack = ref<any>(null);
const client = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const APP_ID = "f853ee34890a43db9d949d2c5f4dab51";

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

const addMessage = (message: any) => {
  if (!messages.value.some(msg => msg.id === message.id)) {
    messages.value.push(message);
    scrollToBottom();
  }
};

// --- Load Functions ---
const loadContacts = async () => {
  try {
    const response = await axios.get('/chat/contacts');
    contacts.value = response.data;
    console.log('Contacts loaded:', contacts.value);
  } catch (e) { 
    console.error("Gagal memuat kontak:", e); 
  }
};

const loadGroups = async () => {
  try {
    const response = await axios.get('/groups');
    groups.value = response.data.map((g: any) => ({
      id: g.id, 
      name: g.name, 
      members_count: g.members?.length || 0, 
      owner_id: g.owner_id
    }));
    console.log('Groups loaded:', groups.value);
  } catch (e) { 
    console.error("Gagal memuat grup:", e); 
  }
};

const loadAllUsers = async () => {
  try {
    const response = await axios.get('/users');
    allUsers.value = response.data;
    console.log('All users loaded:', allUsers.value);
  } catch (e) { 
    console.error("Gagal memuat semua user:", e); 
  }
};

const loadMessages = async (contactId: number, type: 'user' | 'group') => {
  try {
    const endpoint = type === 'group' ? `/groups/${contactId}/messages` : `/chat/${contactId}/messages`;
    const response = await axios.get(endpoint);
    messages.value = response.data.map((m: any) => ({
      id: m.id, 
      sender_id: m.sender_id, 
      sender_name: m.sender?.name || 'Unknown', 
      text: m.message, 
      time: formatTime(m.created_at)
    }));
    scrollToBottom();
    console.log('Messages loaded:', messages.value);
  } catch (e) { 
    console.error("Gagal memuat pesan:", e); 
  }
};

// --- WebSocket Management ---
let boundChannel = '';
const bindChannel = (contactId: number, type: 'user' | 'group') => {
  if (boundChannel) {
    echo.leave(boundChannel);
  }

  const handleNewMessage = (eventData: any) => {
    const messageData = eventData.message || eventData;
    
    console.log('New message received:', messageData);
    
    // Validasi data
    if (!messageData || !messageData.id || !messageData.message || messageData.sender_id === currentUserId.value) {
      return;
    }

    // Cek apakah chat relevan sedang aktif
    let isChatActive = false;
    if (activeContact.value) {
      if (activeContact.value.type === 'group') {
        isChatActive = activeContact.value.id === messageData.receiver_id || 
                       activeContact.value.id === messageData.group_id;
      } else {
        isChatActive = activeContact.value.id === messageData.sender_id ||
                       activeContact.value.id === messageData.receiver_id;
      }
    }

    if (isChatActive) {
      addMessage({
        id: messageData.id,
        sender_id: messageData.sender_id,
        sender_name: messageData.sender_name || messageData.sender?.name || 'Unknown',
        text: messageData.message,
        time: formatTime(messageData.created_at)
      });
    }
  };

  const channelName = type === 'group' 
    ? `group.${contactId}` 
    : `chat.${[currentUserId.value, contactId].sort((a, b) => a - b).join('.')}`;
  
  const eventName = type === 'group' ? '.GroupMessageSent' : '.MessageSent';

  console.log('Binding to channel:', channelName, 'with event:', eventName);
  
  boundChannel = channelName;
  echo.private(channelName)
    .listen(eventName, handleNewMessage)
    .listen('.MessageRead', (data: any) => {
      console.log('Message read event:', data);
    });
};

// --- Setup Global Listeners ---
const setupGlobalListeners = () => {
  echo.private(`user.${currentUserId.value}`)
    .listen('.GroupCreated', (e: any) => {
      const newGroup = e.group || e;
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
      const newContact = e.contact || e;
      if (!contacts.value.some(c => c.id === newContact.id)) {
        contacts.value.push({ id: newContact.id, name: newContact.name });
      }
    });
};

// --- Chat Functions ---
const selectContact = (contact: { id: number, name: string, type: 'user' | 'group' }) => {
  console.log('Selecting contact:', contact);
  
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
    const payload = activeChat.type === 'group' ? { message: messageText } : { 
      receiver_id: activeChat.id, 
      message: messageText 
    };
    
    const response = await axios.post(endpoint, payload);
    const savedMessage = response.data;

    // Replace optimistic message with real message
    const messageIndex = messages.value.findIndex(m => m.id === tempId);
    if (messageIndex !== -1) {
      messages.value[messageIndex].id = savedMessage.id;
      messages.value[messageIndex].time = formatTime(savedMessage.created_at);
    }
    
    console.log('Message sent successfully:', savedMessage);
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
const showCreateGroupModal = ref(false);
const newGroupName = ref('');
const selectedUsers = ref<number[]>([]);

const openCreateGroupModal = async () => {
  showCreateGroupModal.value = true;
  selectedUsers.value = [];
  newGroupName.value = '';
  await loadAllUsers();
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

// --- Call Functions by Agora ---
async function joinChannel(channelName?: string) {
  try {
    const channel = channelName || `call-${activeContact.value?.id}`;
    
    const response = await axios.post('/agora-token', {
      channel: channel,
      uid: currentUserId.value
    });
    
    const { token, channel: responseChannel, uid } = response.data;

    await client.value.join(APP_ID, responseChannel, token, uid);

    localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
    
    if (callType.value === 'video') {
      localVideoTrack.value = await AgoraRTC.createCameraVideoTrack();
      localVideoTrack.value.play('local-video');
      await client.value.publish([localAudioTrack.value, localVideoTrack.value]);
    } else {
      await client.value.publish([localAudioTrack.value]);
    }

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
    endCallWithReason('Error joining channel');
  }
}

// State Voice Call
const startVoiceCall = async () => {
  if (!activeContact.value || activeContact.value.type !== 'user') return;
  
  try {
    const response = await axios.post('/call/invite', {
      callee_id: activeContact.value.id,
      call_type: 'voice'
    });

    outgoingCall.value = {
      callId: response.data.call_id,
      callee: activeContact.value,
      callType: 'voice',
      channel: response.data.channel,
      status: 'calling'
    };

  } catch (error) {
    console.error('Failed to start call:', error);
    alert('Gagal memulai panggilan');
  }
};

const incomingCall = ref<{
  callId: string;
  caller: any;
  callType: 'voice' | 'video';
  channel: string;
} | null>(null);

const outgoingCall = ref<{
  callId: string;
  callee: any;
  callType: 'voice' | 'video';
  channel: string;
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended';
  reason?: string;
} | null>(null);

// Menjawab panggilan
const answerCall = async (accepted: boolean, reason?: string) => {
  if (!incomingCall.value) return;

  try {
    await axios.post('/call/answer', {
      call_id: incomingCall.value.callId.replace('call-', ''),
      caller_id: incomingCall.value.caller.id,
      accepted: accepted,
      reason: reason
    });

    if (accepted) {
      // Jika diterima, mulai join channel
      isInCall.value = true;
      callType.value = incomingCall.value.callType;
      await joinChannel(incomingCall.value.channel);
    }

    incomingCall.value = null;

  } catch (error) {
    console.error('Failed to answer call:', error);
  }
};

// Mengakhiri panggilan
const endCallWithReason = async (reason?: string) => {
  try {
    if (outgoingCall.value) {
      const participantIds = [currentUserId.value, outgoingCall.value.callee.id];
      
      await axios.post('/call/end', {
        call_id: outgoingCall.value.callId,
        participant_ids: participantIds,
        reason: reason
      });
    } else if (incomingCall.value) {
      await axios.post('/call/end', {
        call_id: incomingCall.value.callId,
        participant_ids: [currentUserId.value, incomingCall.value.caller.id],
        reason: reason || 'Ditolak'
      });
    }
  } catch (error) {
    console.error('Error ending call:', error);
  } finally {
    // Reset state
    outgoingCall.value = null;
    incomingCall.value = null;
    isInCall.value = false;
    callType.value = null;
    callStatus.value = '';
    
    // Cleanup Agora
    if (localAudioTrack.value) {
      localAudioTrack.value.stop();
      localAudioTrack.value.close();
      localAudioTrack.value = null;
    }
    if (localVideoTrack.value) {
      localVideoTrack.value.stop();
      localVideoTrack.value.close();
      localVideoTrack.value = null;
    }
    if (client.value) {
      await client.value.leave();
    }
    
    // Reset remote tracks
    remoteAudioTrack.value = null;
    remoteVideoTrack.value = null;
  }
};

// State Video Call
const showVideoCall = ref(false);
const callPartnerId = ref<number|null>();

const startVideoCall = (UserId: number) => {
  callPartnerId.value = UserId;
  showVideoCall.value = true;

  // TODO: Setelah ini selesai, kita init agora
};

const endVideoCall = () => {
  showVideoCall.value = false;
  callPartnerId.value = null;
};

// --- Modal States ---
// const showCreateGroupModal = ref(false);
// const newGroupName = ref('');
// const selectedUsers = ref<number[]>([]);

// agora


const setupCallListeners = () => {
  echo.private(`user.${currentUserId.value}`)
    .listen('incoming-call', (data: any) => { // HAPUS TITIK DI DEPAN
      console.log('IncomingCall event received:', data);
      incomingCall.value = {
        callId: data.call_id || data.channel?.replace('call-', ''),
        caller: data.caller,
        callType: data.call_type || data.callType,
        channel: data.channel
      };
    })
    .listen('call-accepted', (data: any) => { // HAPUS TITIK DI DEPAN
      console.log('CallAccepted event received:', data);
      if (outgoingCall.value) {
        outgoingCall.value.status = 'accepted';
        isInCall.value = true;
        callType.value = outgoingCall.value.callType;
        joinChannel(outgoingCall.value.channel);
      }
    })
    .listen('call-rejected', (data: any) => { // HAPUS TITIK DI DEPAN
      console.log('CallRejected event received:', data);
      if (outgoingCall.value) {
        outgoingCall.value.status = 'rejected';
        outgoingCall.value.reason = data.reason || 'Ditolak';
        setTimeout(() => {
          outgoingCall.value = null;
        }, 3000);
      }
    })
    .listen('call-ended', (data: any) => { // HAPUS TITIK DI DEPAN
      console.log('CallEnded event received:', data);
      endCallWithReason(data.reason || 'Panggilan diakhiri');
    });
};

// --- Initialize ---
onMounted(() => {
  loadContacts();
  loadGroups();
  loadAllUsers();
  setupGlobalListeners();
  setupCallListeners();

  echo.connector.pusher.connection.bind('connected', () => {
    console.log('✅ Pusher CONNECTED - Socket ID:', echo.connector.pusher.connection.socket_id);
  });
  
  echo.connector.pusher.connection.bind('error', (error: any) => {
    console.error('❌ Pusher ERROR:', error);
  });
  
  // DEBUG: Test listen channel manual
  const testChannel = echo.private(`user.${currentUserId.value}`);
  testChannel.listen('incoming-call', (data: any) => {
    console.log('✅ TEST incoming-call received:', data);
  });
  
  console.log('🔔 Listening on channel:', `user.${currentUserId.value}`);
  console.log('Chat component mounted');
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
                                {{ chat.type === 'group' ? `${chat.members_count} anggota` : 'Personal chat' }}
                            </div>
                        </div>
                        <div v-if="drafts[`${chat.type}-${chat.id}`]" class="w-2 h-2 bg-orange-500 rounded-full"></div>
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

                    <!-- Tombol Call hanya untuk personal chat -->
                    <div v-if="activeContact.type === 'user' && !isInCall" class="ml-auto flex gap-2">
                        <!-- Voice Call Button -->
                        <button
                          @click="startVoiceCall"
                          title="Voice Call"
                          class="flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 transition"
                        >
                         <Phone class="w-5 h-5"/>
                        </button>

                        <!-- Video Call Button (SEMENTARA DISABLE) -->
                        <button
                            @click="startVideoCall"
                            class="flex items-center gap-1 px-3 py-1 rounded-full hover:bg-gray-100 transition opacity-50"
                            title="Video Call"
                        >
                            <Video class="w-5 h-5"/>
                        </button>
                    </div>
                </div>

                <!-- Messages -->
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

                <!-- Input -->
                <div class="p-4 border-t flex gap-2">
                    <input
                        type="text"
                        v-model="newMessage"
                        :placeholder="`Ketik pesan ke ${activeContact.name}...`"
                        @keyup.enter="sendMessage"
                        class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button
                        @click="sendMessage"
                        :disabled="isSending"
                        class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50">
                        {{ isSending ? 'Mengirim...' : 'Kirim' }}
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
            <div class="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
                <h3 class="text-lg font-bold mb-4">Buat Group Baru</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Nama Group</label>
                    <input type="text" v-model="newGroupName" placeholder="Masukkan nama group..." class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Pilih Anggota</label>
                    <div class="max-h-48 overflow-y-auto border rounded-lg">
                        <div v-for="user in allUsers.filter(u => u.id !== currentUserId)" :key="user.id"
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

        <!-- Incoming Call Modal -->
        <div v-if="incomingCall" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-96 text-center">
            <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
              {{ incomingCall.caller.name.charAt(0).toUpperCase() }}
            </div>
            <h3 class="text-xl font-bold mb-2">Panggilan {{ incomingCall.callType === 'video' ? 'Video' : 'Suara' }}</h3>
            <p class="text-gray-600 mb-4">{{ incomingCall.caller.name }} sedang menelpon...</p>
            
            <div class="flex justify-center gap-4">
              <button @click="answerCall(false, 'Ditolak')" 
                      class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
                Tolak
              </button>
              <button @click="answerCall(true)" 
                      class="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600">
                Terima
              </button>
            </div>
          </div>
        </div>

        <!-- Outgoing Call Modal -->
        <div v-if="outgoingCall" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-96 text-center">
            <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
              {{ outgoingCall.callee.name.charAt(0).toUpperCase() }}
            </div>
            
            <h3 class="text-xl font-bold mb-2" v-if="outgoingCall.status === 'calling'">Memanggil...</h3>
            <h3 class="text-xl font-bold mb-2" v-else-if="outgoingCall.status === 'accepted'">Terhubung</h3>
            <h3 class="text-xl font-bold mb-2" v-else-if="outgoingCall.status === 'rejected'">Panggilan Ditolak</h3>
            <h3 class="text-xl font-bold mb-2" v-else-if="outgoingCall.status === 'ended'">Panggilan Berakhir</h3>
            
            <p class="text-gray-600 mb-4"> {{ outgoingCall.callee.name }}</p>
            
            <div v-if="outgoingCall.status === 'calling'" class="animate-pulse text-blue-500 mb-4">
              🎵 Berdering...
            </div>
            
            <div v-if="outgoingCall.status === 'rejected' && outgoingCall.reason" class="text-red-500 mb-4">
              ❌ {{ outgoingCall.reason }}
            </div>
            
            <div v-if="outgoingCall.status === 'ended' && outgoingCall.reason" class="text-gray-500 mb-4">
              📞 {{ outgoingCall.reason }}
            </div>
            
            <button v-if="outgoingCall.status === 'calling'" 
                    @click="endCallWithReason('Dibatalkan')" 
                    class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
              Batalkan
            </button>
            
            <button v-if="outgoingCall.status === 'accepted'" 
                    @click="endCallWithReason('Diakhiri')" 
                    class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
              Akhiri Panggilan
            </button>
          </div>
        </div>

        <!-- Active Call UI -->
        <div v-if="isInCall" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-96 text-center">
            <div class="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl">
              {{ outgoingCall?.callee?.name?.charAt(0).toUpperCase() || incomingCall?.caller?.name?.charAt(0).toUpperCase() || '?' }}
            </div>
            <h3 class="text-xl font-bold mb-2">Sedang Berbicara</h3>
            <p class="text-gray-600 mb-4">
              Dengan {{ outgoingCall?.callee?.name || incomingCall?.caller?.name || 'Unknown' }}
            </p>
            
            <button @click="endCallWithReason('Diakhiri')" 
                    class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">
              Akhiri Panggilan
            </button>
          </div>
        </div>
    </AppLayout>
</template>

<style scoped>
/* Custom styles for better UX */
.btn-call {
    padding: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    transition: all 0.3s;
}

.btn-call:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-call.voice-call {
    background: #4CAF50;
    color: white;
}

.btn-call.video-call {
    background: #2196F3;
    color: white;
}

.btn-call.end-call {
    background: #F44336;
    color: white;
}

.btn-call:hover:not(:disabled) {
    transform: scale(1.1);
}
</style>