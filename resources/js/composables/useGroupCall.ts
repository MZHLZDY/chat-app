// resources/js/composables/useGroupCall.ts

import { ref, computed } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import { echo } from '../echo.js';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { Chat, User } from '@/types/index';

// State variables
const groupVoiceCallData = ref<any>(null);
const isGroupVoiceCallActive = ref(false);
const isGroupCaller = ref(false);
const groupCallTimeoutCountdown = ref<number | null>(null);
const activeGroupChannel = ref<string | null>(null);
const groupCallTimeoutRef = ref<NodeJS.Timeout | null>(null);
let groupCallCountdownInterval: NodeJS.Timeout | null = null;

// Agora RTC instances
const groupClient = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const groupLocalAudioTrack = ref<any>(null);
const groupRemoteAudioTracks = ref<{ [uid: number]: any }>({});

// Audio context unlock utility
const unlockAudioContext = async () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    try {
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        // Create a short silent sound to unlock audio
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0; // Silent
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
        console.log('✅ Audio context unlocked.');
    } catch (e) {
        console.error("Failed to unlock audio context:", e);
    }
};

interface PageProps {
    auth: {
        user: User;
    };
    [key: string]: any;
}

export function useGroupCall() {
    const page = usePage<PageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);

    // --- IMPROVED AUDIO LISTENERS WITH ERROR HANDLING ---
    const setupGroupAudioListeners = () => {
        // Remove existing listeners first
        groupClient.value.removeAllListeners();
        
        // User published event with safe subscribe
        groupClient.value.on('user-published', async (user: any, mediaType: string) => {
    if (mediaType === 'audio') {
        console.log(`🔊 User ${user.uid} published audio, attempting to subscribe...`);
        try {
            // Langsung panggil safeSubscribeToUser yang sudah diperkuat
            await safeSubscribeToUser(user, mediaType);
        } catch (error) {
            console.error(`Error in user-published handler for user ${user.uid}:`, error);
        }
    }
});
        
        groupClient.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                console.log(`🔇 User unpublished audio: ${user.uid}`);
                safeUnsubscribeFromUser(user.uid);
            }
        });
        
        groupClient.value.on('user-joined', (user: any) => {
            console.log('👥 User joined group call:', user.uid);
        });
        
        groupClient.value.on('user-left', (user: any) => {
            console.log('👋 User left group call:', user.uid);
            safeUnsubscribeFromUser(user.uid);
        });
        
        groupClient.value.on('connection-state-change', (curState: string, prevState: string) => {
            console.log(`🔄 Connection state changed: ${prevState} -> ${curState}`);
        });
    };

    // Safe subscribe function with error handling
    // GANTI SELURUH FUNGSI safeSubscribeToUser dengan kode di bawah ini

const safeSubscribeToUser = async (user: any, mediaType: string) => {
    const maxRetries = 5; // Coba hingga 5 kali
    const retryDelay = 500; // Jeda antar percobaan (500ms)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Validasi Kunci: Periksa apakah user sudah ada di daftar remoteUsers SDK
            const isUserReady = groupClient.value.remoteUsers.some((remoteUser: any) => remoteUser.uid === user.uid);

            if (!isUserReady) {
                // Jika user belum siap, lempar error untuk memicu blok catch dan retry
                throw new Error(`User ${user.uid} is not in remoteUsers list yet. Attempt ${attempt}.`);
            }

            console.log(`[Attempt ${attempt}] User ${user.uid} is ready. Subscribing...`);

            // Lakukan subscribe
            await groupClient.value.subscribe(user, mediaType);

            if (user.audioTrack) {
                groupRemoteAudioTracks.value[user.uid] = user.audioTrack;
                
                // Mainkan audio
                try {
                    user.audioTrack.play();
                    console.log(`✅🔊 Successfully playing audio from user: ${user.uid}`);
                } catch (playError) {
                    console.warn(`⚠️ Failed to play audio from ${user.uid} after subscribing:`, playError);
                }
            }

            // Jika berhasil, keluar dari loop
            return; 

        } catch (error: any) {
            console.warn(`⚠️ Subscribe attempt ${attempt} for user ${user.uid} failed:`, error.message);

            if (attempt === maxRetries) {
                console.error(`❌ Failed to subscribe to user ${user.uid} after ${maxRetries} attempts.`, error);
                // Gagal total, hentikan proses untuk user ini
                return;
            }

            // Tunggu sebelum mencoba lagi
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

    // Safe unsubscribe function
    const safeUnsubscribeFromUser = (uid: number) => {
        if (groupRemoteAudioTracks.value[uid]) {
            try {
                groupRemoteAudioTracks.value[uid].stop();
            } catch (e) {
                // Ignore stop errors
            }
            delete groupRemoteAudioTracks.value[uid];
        }
    };

    // --- IMPROVED JOIN GROUP CHANNEL FUNCTION ---
    const joinGroupChannel = async (channelName: string) => {
        try {
            console.log('🔑 Requesting Agora group token for channel:', channelName);
            
            // 1. Unlock audio context first
            await unlockAudioContext();
            
            // 2. Check client state and cleanup if needed
            const connectionState = groupClient.value.connectionState;
            console.log('📊 Current connection state:', connectionState);
            
            if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
                console.log('🔄 Client already connected, leaving first...');
                await leaveGroupChannel();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 3. Request token from server
            const response = await axios.post('/group-call/token', {
             channel: channelName,
             uid: currentUserId.value.toString(), // <-- PASTIKAN INI STRING
             role: 'publisher'
            });

            
            console.log('✅ Group token response:', response.data);
            
            const { token, app_id } = response.data;
            
            if (!app_id) {
                throw new Error('Invalid app_id from server');
            }
            
            // 4. Setup audio listeners BEFORE join
            setupGroupAudioListeners();
            
            // 5. Join channel
            console.log('🔄 Joining Agora group channel with AppID:', app_id);
            
            await groupClient.value.join(
             app_id,
             channelName,
             token || null,
             currentUserId.value.toString()// <-- JOIN DENGAN UID SEBAGAI NUMBER
            );
            
            console.log('✅ Successfully joined Agora group channel');
            
            // 6. Wait before publishing audio
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 7. Setup and publish audio track
            try {
                // Clean up existing track
                if (groupLocalAudioTrack.value) {
                    try {
                        groupLocalAudioTrack.value.stop();
                        groupLocalAudioTrack.value.close();
                    } catch (e) {
                        console.warn('Error closing existing track:', e);
                    }
                    groupLocalAudioTrack.value = null;
                }
                
                // Create new microphone audio track
                groupLocalAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                    encoderConfig: 'music_standard',
                    AEC: true,
                    AGC: true,
                    ANS: true
                });
                
                // Wait before publish
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Publish audio track to channel
                await groupClient.value.publish([groupLocalAudioTrack.value]);
                console.log('✅ Successfully published audio to group channel');
                
            } catch (audioError: any) {
                console.error('❌ Failed to setup audio track:', audioError);
                
                if (audioError.name === 'NOT_SUPPORTED' || audioError.name === 'PERMISSION_DENIED') {
                    alert('Microphone permission is required for voice calls. Please allow microphone access.');
                }
                
                // Leave channel if audio setup fails
                await groupClient.value.leave();
                throw audioError;
            }
            
            return true;
            
        } catch (error: any) {
            console.error('❌ Join group channel error:', error);
            
            if (error.message.includes('already in connecting/connected state')) {
                console.log('🔄 Force leaving and retrying group channel...');
                try {
                    await leaveGroupChannel();
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return await joinGroupChannel(channelName);
                } catch (retryError) {
                    console.error('❌ Group retry failed:', retryError);
                    throw retryError;
                }
            }
            
            // Handle Agora specific errors
            if (error.code) {
                switch (error.code) {
                    case 'CANNOT_JOIN_CHANNEL':
                        alert('Cannot join channel. Please try again.');
                        break;
                    case 'INVALID_CHANNEL_NAME':
                        alert('Invalid channel name.');
                        break;
                    case 'INVALID_TOKEN':
                        alert('Invalid token. Please refresh the page.');
                        break;
                    default:
                        alert('Error joining call: ' + error.message);
                }
            }
            
            throw error;
        }
    };

    // --- IMPROVED LEAVE GROUP CHANNEL ---
    const leaveGroupChannel = async () => {
        try {
            console.log('🚪 Leaving group channel...');
            
            // Stop all remote tracks first
            Object.keys(groupRemoteAudioTracks.value).forEach(uid => {
                safeUnsubscribeFromUser(Number(uid));
            });
            groupRemoteAudioTracks.value = {};
            
            // Stop and close local track
            if (groupLocalAudioTrack.value) {
                try {
                    groupLocalAudioTrack.value.stop();
                    groupLocalAudioTrack.value.close();
                } catch (e) {
                    console.warn('Error closing local track:', e);
                }
                groupLocalAudioTrack.value = null;
            }
            
            // Leave channel if connected
            if (groupClient.value.connectionState !== 'DISCONNECTED') {
                await groupClient.value.leave();
            }
            
            console.log('✅ Successfully left group channel');
        } catch (error) {
            console.error('❌ Error leaving group channel:', error);
        }
    };

    // --- IMPROVED START GROUP VOICE CALL ---
    const startGroupVoiceCall = async (group: Chat | null) => {
        if (!group || group.type !== 'group') {
            console.log('No active group contact provided');
            return;
        }

        try {
            console.log('🚀 Starting group voice call to group:', group.name);
            const response = await axios.post('/group-call/invite', {
                group_id: group.id,
                call_type: 'voice'
            });
            
            groupVoiceCallData.value = {
                callId: response.data.call_id,
                group: response.data.group,
                caller: { id: currentUserId.value, name: currentUserName.value },
                callType: 'voice',
                channel: response.data.channel,
                status: 'calling',
                participants: response.data.participants
            };
            
            isGroupVoiceCallActive.value = true;
            isGroupCaller.value = true;
            
            // HOST AUTOMATICALLY JOINS AUDIO CHANNEL
            if (response.data.channel) {
                try {
                    await joinGroupChannel(response.data.channel);
                    console.log('🎉 Host successfully joined group channel');
                    
                    // UPDATE HOST STATUS TO 'accepted'
                    const hostParticipantIndex = groupVoiceCallData.value.participants?.findIndex(
                        (p: any) => p.id === currentUserId.value
                    );
                    
                    if (hostParticipantIndex !== undefined && hostParticipantIndex !== -1 && groupVoiceCallData.value.participants) {
                        groupVoiceCallData.value.participants[hostParticipantIndex].status = 'accepted';
                    }
                } catch (error) {
                    console.error('❌ Failed to join channel as host:', error);
                    alert('Failed to join audio channel. Please check microphone permissions.');
                    resetGroupCallState();
                    return;
                }
            }
            
            startGroupCallTimeout(30);

        } catch (error: any) {
            console.error('❌ Failed to start group call:', error);
            alert('Failed to start group call: ' + (error.response?.data?.error || error.message));
        }
    };

    // --- IMPROVED GROUP CALL STATE MANAGEMENT ---
    const resetGroupCallState = () => {
        console.log('🔄 Resetting group call state...');
        stopGroupCallTimeout();
        leaveGroupChannel();
        isGroupVoiceCallActive.value = false;
        groupVoiceCallData.value = null;
        isGroupCaller.value = false;
    };

    // --- IMPROVED EVENT LISTENERS ---
    const initializeGlobalListeners = () => {
        const userId = currentUserId.value;
        if (!userId) return;

        const privateChannel = echo.private(`user.${userId}`);
        console.log(`🎧 Setting up GLOBAL listeners on channel: user.${userId}`);

        // Group incoming call event
        privateChannel.listen('.group-incoming-call', (data: any) => {
    const isHost = data.caller.id === currentUserId.value;

    // JIKA SAYA BUKAN HOST, maka saya adalah penerima. Jalankan logic ini.
    if (!isHost) {
        console.log('📞 EVENT .group-incoming-call RECEIVED (as Callee):', data);

        // Hanya setup state jika Anda adalah penerima panggilan
        groupVoiceCallData.value = {
            callId: data.callId,
            group: data.group,
            caller: data.caller,
            callType: data.callType,
            channel: data.channel,
            status: 'ringing', // Status untuk penerima adalah 'ringing'
            participants: data.participants
        };
        
        isGroupVoiceCallActive.value = true;
        isGroupCaller.value = false; // Anda bukan penelepon

        // Mulai timeout untuk penerima
        startGroupCallTimeout(30);

    } else {
        // Jika saya adalah host, abaikan event ini.
        // State sudah di-setup dengan benar oleh fungsi startGroupVoiceCall.
        console.log('📞 EVENT .group-incoming-call IGNORED (as Host)');
    }
});
        
        // Other event listeners remain the same...
        privateChannel.listen('.group-call-cancelled', (data: any) => {
            console.log('🚫 EVENT .group-call-cancelled RECEIVED:', data);
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.callId) {
                alert(`Group call cancelled by ${data.caller.name}`);
                resetGroupCallState();
            }
        });

        privateChannel.listen('.group-call-answered', (data: any) => {
            console.log('✅ EVENT .group-call-answered RECEIVED:', data);

            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === data.user.id
                );
                
                if (participantIndex > -1) {
                    groupVoiceCallData.value.participants[participantIndex].status = data.accepted ? 'accepted' : 'rejected';
                }

                if (data.accepted && 
                    groupVoiceCallData.value.caller?.id === currentUserId.value &&
                    groupVoiceCallData.value.status === 'calling') {
                    
                    console.log('🎉 First participant joined! Changing host status to "accepted".');
                    stopGroupCallTimeout();
                    groupVoiceCallData.value.status = 'accepted';
                }
                
                const acceptedParticipants = groupVoiceCallData.value.participants?.filter(
                    (p: any) => p.status === 'accepted'
                );
                
                if (acceptedParticipants && acceptedParticipants.length > 0) {
                    stopGroupCallTimeout();
                }
            }
        });

        // ... rest of event listeners
    };

    // Keep the rest of your functions as they are (acceptGroupCall, rejectGroupCall, etc.)
    // but make sure to use the improved leaveGroupChannel and resetGroupCallState

    const acceptGroupCall = async (callId: string) => {
        await unlockAudioContext();
        try {
            console.log('✅ Accepting group call:', callId);
            
            stopGroupCallTimeout();
            
            const response = await axios.post('/group-call/answer', {
                call_id: callId,
                group_id: groupVoiceCallData.value?.group?.id,
                accepted: true
            });
            
            console.log('✅ Group call answer response:', response.data);
            
            if (groupVoiceCallData.value) {
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === currentUserId.value
                );
                
                if (participantIndex !== undefined && participantIndex !== -1 && groupVoiceCallData.value.participants) {
                    groupVoiceCallData.value.participants[participantIndex].status = 'accepted';
                }
                
                groupVoiceCallData.value.status = 'accepted';
                
                if (groupVoiceCallData.value.channel) {
                    if (groupClient.value.connectionState !== 'DISCONNECTED') {
                        await leaveGroupChannel();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    await joinGroupChannel(groupVoiceCallData.value.channel);
                    console.log('🎉 Callee successfully joined group channel');
                }
            }
            
        } catch (error: any) {
            console.error('❌ Failed to accept group call:', error);
            alert('Failed to accept call: ' + (error.response?.data?.error || error.message));
        }
    };

    const rejectGroupCall = async (callId: string, reason: string = 'Ditolak oleh penerima') => {
  try {
    console.log('❌ Menolak panggilan grup:', callId, 'Alasan:', reason);
    
    const response = await axios.post('/group-call/answer', {
      call_id: callId,
      group_id: groupVoiceCallData.value?.group?.id, // <-- TAMBAHKAN INI
      accepted: false,
      reason: reason
    });
    
    console.log('✅ Group call reject response:', response.data);
    
    // Update status participant di local state dengan alasan "diabaikan"
    if (groupVoiceCallData.value) {
      const participantIndex = groupVoiceCallData.value.participants?.findIndex(
        (p: any) => p.id === currentUserId.value
      );
      
      if (participantIndex !== undefined && participantIndex !== -1 && groupVoiceCallData.value.participants) {
        groupVoiceCallData.value.participants[participantIndex].status = 'rejected';
        groupVoiceCallData.value.participants[participantIndex].reason = reason; // Set alasan
      }
    }
    
    // Reset state untuk penerima panggilan
    isGroupVoiceCallActive.value = false;
    groupVoiceCallData.value = null;
    stopGroupCallTimeout();
    
  } catch (error: any) {
    console.error('❌ Gagal menolak panggilan grup:', error);
    
    let errorMessage = 'Gagal menolak panggilan grup';
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message;
    }
    
    alert(errorMessage);
  }
};

const endGroupCall = async (callId: string) => {
  // Pastikan ada data panggilan sebelum mengirim
  if (!groupVoiceCallData.value || !groupVoiceCallData.value.group) {
    console.error('Tidak ada data panggilan grup untuk diakhiri, mereset secara lokal.');
    resetGroupCallState();
    return;
  }

  try {
    console.log('📞 Membubarkan panggilan grup:', callId);

    await axios.post('/group-call/end', {
      call_id: callId,
      group_id: groupVoiceCallData.value.group.id, // <-- KIRIM group_id
      reason: 'Dibubarkan oleh host'
    });

    console.log('✅ Perintah bubarkan berhasil dikirim.');
    // Tidak perlu reset state di sini, biarkan event yang diterima yang melakukannya

  } catch (error: any) {
    console.error('❌ Gagal membubarkan panggilan grup:', error);
    alert('Gagal membubarkan panggilan.');
    // Reset state sebagai fallback jika request gagal
    resetGroupCallState();
  }
};

const cancelGroupCall = async (callId: string) => {
  if (!groupVoiceCallData.value || !groupVoiceCallData.value.participants) {
    console.error('Tidak ada data panggilan grup untuk dibatalkan');
    return;
  }

  try {
    console.log('🚫 Membatalkan panggilan grup:', callId);

    // Kumpulkan ID semua peserta untuk dikirim ke event
    const participantIds = groupVoiceCallData.value.participants.map((p: any) => p.id);

    await axios.post('/group-call/cancel', {
      call_id: callId,
      participant_ids: participantIds
    });

    // UI di sisi penelepon akan langsung ditutup
    resetGroupCallState(); // Kita buat fungsi reset terpisah nanti

  } catch (error: any) {
    console.error('❌ Gagal membatalkan panggilan grup:', error);
    alert('Gagal membatalkan panggilan.');
    // Tetap reset state jika gagal
    resetGroupCallState();
  }
};

const handleLeaveGroupCall = async () => {
  console.log('🚶 Meninggalkan panggilan grup...');
  
  if (!groupVoiceCallData.value) {
    return resetGroupCallState();
  }

  try {
    // Kirim notifikasi ke backend bahwa Anda meninggalkan panggilan
    await axios.post('/group-call/leave', { 
      call_id: groupVoiceCallData.value.callId,
      group_id: groupVoiceCallData.value.group?.id
    });
    console.log('✅ Notifikasi keluar berhasil dikirim ke server.');
  } catch (error) {
    console.error("Gagal memberitahu server saat leave call:", error);
  } finally {
    // Tutup UI dan reset state HANYA untuk diri sendiri
    resetGroupCallState(); 
  }
};

const handleRecallParticipant = async (participantId: number) => {
  if (!groupVoiceCallData.value || !groupVoiceCallData.value.participants) return;

  console.log(`📞 Memanggil kembali peserta dengan ID: ${participantId}`);
  try {
    // PERBAIKAN: Kirim daftar peserta saat ini ke backend
    await axios.post('/group-call/recall', {
      call_id: groupVoiceCallData.value.callId,
      group_id: groupVoiceCallData.value.group?.id,
      user_id_to_recall: participantId,
      current_participants: groupVoiceCallData.value.participants // <-- DATA BARU
    });

    // Setelah request terkirim, ubah status lokal user tersebut kembali menjadi 'calling'
    const participantIndex = groupVoiceCallData.value.participants.findIndex(
      (p: any) => p.id === participantId
    );
    if (participantIndex > -1) {
      groupVoiceCallData.value.participants[participantIndex].status = 'calling';
    }

  } catch (error) {
    console.error('Gagal memanggil kembali peserta:', error);
    alert('Gagal memanggil kembali peserta tersebut.');
  }
};

const startGroupCallTimeout = (duration: number = 30) => {
  // Reset previous countdown jika ada
  if (groupCallCountdownInterval) {
    clearInterval(groupCallCountdownInterval);
    groupCallCountdownInterval = null;
  }

  groupCallTimeoutCountdown.value = duration;

  groupCallCountdownInterval = setInterval(() => {
    if (groupCallTimeoutCountdown.value !== null && groupCallTimeoutCountdown.value > 0) {
      groupCallTimeoutCountdown.value--;
      console.log('⏰ Group call countdown:', groupCallTimeoutCountdown.value);
    } else {
      // Countdown finished
      if (groupCallCountdownInterval) {
        clearInterval(groupCallCountdownInterval);
        groupCallCountdownInterval = null;
      }
      handleGroupCallTimeout();
    }
  }, 1000);
};

// Function untuk handle ketika timeout panggilan grup
const handleGroupCallTimeout = () => {
  // Pastikan ada data panggilan dan statusnya masih 'calling' atau 'ringing'
  if (groupVoiceCallData.value?.status === 'calling' || groupVoiceCallData.value?.status === 'ringing') {
    console.log('⏰ Group call timeout - memeriksa kondisi setelah 30 detik');
    
    // Cek apakah ada peserta yang sudah menerima panggilan
    const acceptedParticipants = groupVoiceCallData.value.participants?.filter(
      (p: any) => p.status === 'accepted'
    );
    
    // Jika ADA yang bergabung, panggilan dianggap berhasil dan berlanjut. Hentikan timer.
    if (acceptedParticipants && acceptedParticipants.length > 0) {
      console.log('✅ Timeout diabaikan karena sudah ada peserta yang bergabung.');
      stopGroupCallTimeout(); // Hentikan countdown dan timer
      return; // Hentikan eksekusi fungsi ini
    }

    // Langsung akhiri panggilan.
    console.log('❌ Tidak ada peserta yang menerima panggilan. Mengakhiri panggilan...');

    if (groupVoiceCallData.value) {
      // 1. Ubah status di UI menjadi berakhir
      groupVoiceCallData.value.status = 'ended';
      groupVoiceCallData.value.reason = 'Tidak ada yang bergabung';
      
      // 2. Kirim notifikasi ke server bahwa panggilan ini tidak terjawab
      axios.post('/group-call/missed', {
        call_id: groupVoiceCallData.value.callId,
        reason: 'timeout'
      }).catch(error => {
        console.error('Failed to send missed group call notification:', error);
      });
      
      // 3. Hentikan semua timer
      stopGroupCallTimeout(); 
      
      // 4. Tutup UI panggilan setelah jeda singkat (misal, 1 detik)
      setTimeout(() => {
        isGroupVoiceCallActive.value = false;
        groupVoiceCallData.value = null;
      }, 1500); // Diberi jeda agar user bisa lihat status 'Tidak ada yang menjawab'
    }
  }
};

// Function untuk stop countdown panggilan grup
const stopGroupCallTimeout = () => {
  if (groupCallCountdownInterval) {
    clearInterval(groupCallCountdownInterval);
    groupCallCountdownInterval = null;
  }
  groupCallTimeoutCountdown.value = null;
  
  // Hapus timeout reference juga
  if (groupCallTimeoutRef.value) {
    clearTimeout(groupCallTimeoutRef.value);
    groupCallTimeoutRef.value = null;
  }
};

const setupDynamicGroupListeners = (groupId: number) => {
    // PERBAIKAN: Gunakan backticks (`) untuk template string, bukan tanda petik biasa
    const newChannelName = `group.${groupId}`;
    
    if (activeGroupChannel.value === newChannelName) {
        return;
    }
    
    if (activeGroupChannel.value) {
        echo.leave(activeGroupChannel.value);
        console.log(`🔌 Berhenti mendengarkan channel grup lama: ${activeGroupChannel.value}`);
    }
    
    activeGroupChannel.value = newChannelName;
    console.log(`🎧 Mulai mendengarkan channel grup baru: ${newChannelName}`);
    
    // 1. LISTENER UNTUK LARAVEL ECHO (Memperbarui UI)
    echo.private(newChannelName)
        .listen('.group-call-answered', async (data: any) => { // Tambahkan async di sini
    console.log('✅ EVENT group-call-answered DITERIMA:', data);
    
    if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
        // Update status partisipan (ini sudah benar)
        const participantIndex = groupVoiceCallData.value.participants?.findIndex((p: any) => p.id === data.user.id);
        if (participantIndex > -1) {
            groupVoiceCallData.value.participants[participantIndex].status = data.accepted ? 'accepted' : 'rejected';
        }
        
        // --- PERBAIKAN LOGIKA UNTUK HOST ---
        const isHost = groupVoiceCallData.value.caller?.id === currentUserId.value;
        const isFirstAnswer = groupVoiceCallData.value.status === 'calling';

        if (data.accepted && isHost && isFirstAnswer) {
            console.log('🎉 Peserta pertama bergabung! Menyegarkan koneksi Host...');
            stopGroupCallTimeout();
            groupVoiceCallData.value.status = 'accepted';
            
            // PAKSA HOST UNTUK RE-JOIN AGAR KONEKSI SEGAR
            // Ini akan meninggalkan channel lama dan bergabung kembali dengan state yang benar
            if (groupVoiceCallData.value.channel) {
                try {
                    // Beri jeda singkat agar event lain selesai diproses
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                    console.log('Host is re-joining the channel...');
                    // Fungsi joinGroupChannel sudah memiliki logika leave terlebih dahulu
                    await joinGroupChannel(groupVoiceCallData.value.channel); 
                    console.log('✅ Host re-joined successfully.');
                } catch (error) {
                    console.error('❌ Host failed to re-join channel:', error);
                    // Lakukan reset jika re-join gagal
                    resetGroupCallState(); 
                }
            }
        }
    }
})
        .listen('.group-call-ended', (data: any) => {
            console.log('🚫 EVENT group-call-ended DITERIMA:', data);
            
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                if (data.ended_by.id !== currentUserId.value) {
                    alert(`Panggilan dibubarkan oleh ${data.ended_by.name}`);
                }
                resetGroupCallState();
            }
        })
        .listen('.group-participant-left', (data: any) => {
            console.log('🚶 EVENT group-participant-left DITERIMA:', data);
            
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                // Cari partisipan yang keluar
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === data.user.id
                );
                
                if (participantIndex !== undefined && participantIndex > -1 && groupVoiceCallData.value.participants) {
                    // Ubah statusnya menjadi 'left'
                    groupVoiceCallData.value.participants[participantIndex].status = 'left';
                    console.log(`Status partisipan ${data.user.name} diubah menjadi 'left'`);
                }
            }
        });
    
    // Hapus bagian yang duplicate dengan setupGroupAudioListeners utama
    // Karena sudah ada di fungsi setupGroupAudioListeners yang dipanggil di akhir
};

// Pindahkan ke luar fungsi setupDynamicGroupListeners atau hapus jika tidak digunakan
const checkIfAllParticipantsRejected = () => {
    if (!groupVoiceCallData.value?.participants) return;
    
    const allRejected = groupVoiceCallData.value.participants.every(
        (p: any) => p.status === 'rejected'
    );
    
    if (allRejected) {
        console.log('❌ Semua peserta menolak panggilan');
        
        // Update status panggilan menjadi rejected
        if (groupVoiceCallData.value) {
            groupVoiceCallData.value.status = 'ended';
            groupVoiceCallData.value.reason = 'Semua peserta menolak';
            
            // Hentikan timeout karena semua sudah menolak
            stopGroupCallTimeout();
            
            // Reset setelah 3 detik
            setTimeout(() => {
                isGroupVoiceCallActive.value = false;
                groupVoiceCallData.value = null;
            }, 3000);
        }
    }
};

const leaveDynamicGroupChannel = () => {
    // Cek apakah saat ini kita sedang mendengarkan sebuah channel grup
    if (activeGroupChannel.value) {
        // Perintahkan Echo untuk berhenti mendengarkan (leave) channel tersebut
        echo.leave(activeGroupChannel.value);
        
        // Tulis log untuk debugging
        console.log(`🔌 Berhenti mendengarkan channel grup: ${activeGroupChannel.value}`);
        
        // Reset state kembali ke null agar kita tahu sudah tidak ada channel yang aktif
        activeGroupChannel.value = null;
    }
};
    setupGroupAudioListeners();

    return {
        groupVoiceCallData,
        isGroupVoiceCallActive,
        isGroupCaller,
        groupCallTimeoutCountdown,
        startGroupVoiceCall,
        acceptGroupCall,
        rejectGroupCall,
        endGroupCall,
        cancelGroupCall,
        handleLeaveGroupCall,
        handleRecallParticipant,
        initializeGlobalListeners,
        setupDynamicGroupListeners,
        leaveDynamicGroupChannel,
        resetGroupCallState,
        leaveGroupChannel
    };
}