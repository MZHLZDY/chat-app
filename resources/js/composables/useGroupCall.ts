// resources/js/composables/useGroupCall.ts

import { ref, computed } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import { echo } from '../echo.js';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { Chat, User } from '@/types/index';

// const activeContact = ref<Chat | null>(null);
const groupVoiceCallData = ref<any>(null);
const isGroupVoiceCallActive = ref(false);
const isGroupCaller = ref(false);
const groupCallTimeoutCountdown = ref<number | null>(null);
const activeGroupChannel = ref<string | null>(null);
// const localAudioTrack = ref<any>(null); // Pindahkan juga state Agora
// const client = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const groupCallTimeoutRef = ref<NodeJS.Timeout | null>(null);
let groupCallCountdownInterval: NodeJS.Timeout | null = null;

const groupClient = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const groupLocalAudioTrack = ref<any>(null);
const groupRemoteAudioTracks = ref<{ [uid: number]: any }>({});

groupClient.value.on('user-published', async (user: any, mediaType: string) => {
    if (mediaType === 'audio') {
        await groupClient.value.subscribe(user, mediaType);
        if (user.audioTrack) {
            groupRemoteAudioTracks.value[user.uid] = user.audioTrack;
            user.audioTrack.play();
            console.log(`🔊 [GRUP] Memainkan audio dari: ${user.uid}`);
        }
    }
});
groupClient.value.on('user-unpublished', (user: any) => {
    delete groupRemoteAudioTracks.value[user.uid];
    console.log(`🔇 [GRUP] Pengguna berhenti mengirim audio: ${user.uid}`);
});

const unlockAudioContext = async () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const audioContext = new AudioContext();
    if (audioContext.state === 'running') {
        await audioContext.close();
        return;
    }
    try {
        await audioContext.resume();
        await audioContext.close();
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

    // --- SEMUA FUNGSI PANGGILAN GRUP PINDAH KE SINI ---

    const resetGroupCallState = () => {
        console.log('🔄 Mereset state panggilan grup...');
        leaveGroupChannel();
        isGroupVoiceCallActive.value = false;
        groupVoiceCallData.value = null;
        isGroupCaller.value = false;
        stopGroupCallTimeout();
    };

const setupGroupAudioListeners = () => {
        groupClient.value.on('user-published', async (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                await groupClient.value.subscribe(user, mediaType);
                if (user.audioTrack) {
                    groupRemoteAudioTracks.value[user.uid] = user.audioTrack;
                    user.audioTrack.play();
                }
            }
        });
        groupClient.value.on('user-unpublished', (user: any) => {
            delete groupRemoteAudioTracks.value[user.uid];
        });
    };

const joinGroupChannel = async (channelName: string) => {
  // const audioReady = await setupAudio();
  //       if (!audioReady) throw new Error("Audio setup failed");
        try {
    console.log('🔑 Requesting Agora group token for channel:', channelName);
    
    // Cek state client terlebih dahulu
    const connectionState = groupClient.value.connectionState;
    console.log('📊 Current connection state:', connectionState);
    
    // Jika sudah connected, leave dulu
    if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
      console.log('🔄 Client already connected, leaving first...');
      await groupClient.value.leave();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const response = await axios.post('/group-call/token', {
      channel: channelName,
      uid: currentUserId.value.toString(),
      role: 'publisher'
    });
    
    console.log('✅ Group token response:', response.data);
    
    const { token, app_id } = response.data;
    
    if (!app_id) {
      throw new Error('Invalid app_id from server');
    }
    
    console.log('🔄 Joining Agora group channel with AppID:', app_id);
    
    await groupClient.value.join(
      app_id,
      channelName,
      token,
      currentUserId.value.toString()
    );
    
    console.log('✅ Successfully joined Agora group channel');
    
    // Setup audio tracks untuk grup call
    try {
            if (groupLocalAudioTrack.value) {
                groupLocalAudioTrack.value.stop();
                groupLocalAudioTrack.value.close();
            }
            groupLocalAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();

            const response = await axios.post('/group-call/token', {
                channel: channelName,
                uid: currentUserId.value.toString(),
            });

            const { token, app_id } = response.data;
            await groupClient.value.join(app_id, channelName, token, currentUserId.value);
            await groupClient.value.publish([groupLocalAudioTrack.value]);
            console.log('✅ Berhasil join dan publish audio ke channel grup.');
        } catch (error) {
            console.error('❌ Gagal join channel grup:', error);
        }
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Join group channel error:', error);
    
    // Handle specific error
    if (error.message.includes('already in connecting/connected state')) {
      console.log('🔄 Force leaving and retrying group channel...');
      try {
        await groupClient.value.leave();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await joinGroupChannel(channelName); // Recursive retry
      } catch (retryError) {
        console.error('❌ Group retry failed:', retryError);
      }
    }
    
    throw error;
  }
    };

    const leaveGroupChannel = async () => {
        if (groupLocalAudioTrack.value) {
            groupLocalAudioTrack.value.stop();
            groupLocalAudioTrack.value.close();
            groupLocalAudioTrack.value = null;
        }
        if (groupClient.value.connectionState !== 'DISCONNECTED') {
            await groupClient.value.leave();
        }
        groupRemoteAudioTracks.value = {};
    };

const startGroupVoiceCall = async (group: Chat | null) => {
  await unlockAudioContext();
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
            participants: response.data.participants // <-- Langsung gunakan data dari server
        };
        
        isGroupVoiceCallActive.value = true;
        isGroupCaller.value = true;
        startGroupCallTimeout(30);

      } catch (error: any) {
        console.error('❌ Gagal memulai panggilan grup:', error);
        alert('Gagal memulai panggilan grup');
      }
    };

    const acceptGroupCall = async (callId: string) => {
      await unlockAudioContext();
  try {
    console.log('✅ Menerima panggilan grup:', callId);
    
    // Hapus timer timeout jika panggilan diterima
    if (groupCallTimeoutRef.value) {
      clearTimeout(groupCallTimeoutRef.value);
      groupCallTimeoutRef.value = null;
      console.log('⏰ Group call timeout dibatalkan');
    }
    
    // Stop countdown timer
    stopGroupCallTimeout();
    
    const response = await axios.post('/group-call/answer', {
      call_id: callId,
      group_id: groupVoiceCallData.value?.group?.id,
      accepted: true
    });
    
    console.log('✅ Group call answer response:', response.data);
    
    // Update status participant dan panggilan
    if (groupVoiceCallData.value) {
      const participantIndex = groupVoiceCallData.value.participants?.findIndex(
        (p: any) => p.id === currentUserId.value
      );
      
      if (participantIndex !== undefined && participantIndex !== -1 && groupVoiceCallData.value.participants) {
        groupVoiceCallData.value.participants[participantIndex].status = 'accepted';
      }
      
      groupVoiceCallData.value.status = 'accepted';
      
      if (groupVoiceCallData.value.channel) {
        // Pastikan client clean state sebelum join
        if (groupClient.value.connectionState !== 'DISCONNECTED') {
          await groupClient.value.leave();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        await joinGroupChannel(groupVoiceCallData.value.channel);
        console.log('🎉 Callee berhasil join channel grup');
      } else {
        console.error('❌ Channel tidak ditemukan untuk join');
        throw new Error('Channel tidak valid');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Gagal menerima panggilan grup:', error);
    // ... error handling tetap sama
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

    // --- FUNGSI UNTUK INISIALISASI LISTENER GLOBAL ---
    const initializeGlobalListeners = () => {
  const userId = currentUserId.value; // Asumsikan Anda sudah mendefinisikan ini
  if (!userId) return;

  const privateChannel = echo.private(`user.${userId}`);
  console.log(`🎧 Menyiapkan listener GLOBAL di channel: user.${userId}`);

  // Event: Notifikasi panggilan grup masuk (dikirim ke "kotak surat" Anda)
  privateChannel.listen('.group-incoming-call', (data: any) => {
    console.log('📞 EVENT .group-incoming-call DITERIMA di composable:', data);
    // (Tempatkan logika untuk menampilkan UI panggilan grup masuk di sini)
    // Contoh:
    groupVoiceCallData.value = {
      callId: data.callId,
      group: data.group,
      caller: data.caller,
      callType: data.callType,
      channel: data.channel,
      status: 'ringing',
      participants: data.participants
    };
    isGroupVoiceCallActive.value = true;
    isGroupCaller.value = false;
    startGroupCallTimeout(30);
  });
  
  // Event: Notifikasi panggilan dibatalkan (dikirim ke "kotak surat" Anda)
  privateChannel.listen('.group-call-cancelled', (data: any) => {
    console.log('🚫 EVENT .group-call-cancelled DITERIMA di composable:', data);
    if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.callId) {
        alert(`Panggilan grup dibatalkan oleh ${data.caller.name}`);
        resetGroupCallState(); // Fungsi reset dari composable
    }
  });
};

    // --- FUNGSI UNTUK LISTENER DINAMIS PER GRUP ---
    const setupDynamicGroupListeners = (groupId: number) => {
         const newChannelName = `group.${groupId}`;
         
           // Jika sudah mendengarkan channel yang sama, tidak perlu melakukan apa-apa
           if (activeGroupChannel.value === newChannelName) {
             return;
           }
         
           // Jika sebelumnya mendengarkan channel lain, hentikan dulu
           if (activeGroupChannel.value) {
             echo.leave(activeGroupChannel.value);
             console.log(`🔌 Berhenti mendengarkan channel grup lama: ${activeGroupChannel.value}`);
           }
         
           // Simpan nama channel baru yang sedang aktif
           activeGroupChannel.value = newChannelName;
           console.log(`🎧 Mulai mendengarkan channel grup baru: ${newChannelName}`);
         
           // 1. LISTENER UNTUK LARAVEL ECHO (Memperbarui UI)
           echo.private(newChannelName)
           .listen('.group-call-answered', (data: any) => {
    console.log('✅ EVENT group-call-answered DITERIMA:', data);

    // Pastikan event ini untuk panggilan yang sedang aktif di UI Anda
    if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
        
      // Cari partisipan yang dimaksud di dalam state lokal
      const participantIndex = groupVoiceCallData.value.participants?.findIndex(
          (p: any) => p.id === data.user.id
      );

      if (participantIndex !== undefined && participantIndex > -1 && groupVoiceCallData.value.participants) {
          
          // --- PERBAIKAN LOGIKA DIMULAI DI SINI ---

          // 1. Update status partisipan menjadi 'accepted' atau 'rejected'
          const newStatus = data.accepted ? 'accepted' : 'rejected';
          groupVoiceCallData.value.participants[participantIndex].status = newStatus;
          console.log(`Status partisipan ${data.user.name} diubah menjadi ${newStatus}`);
          
          // 2. Jika ditolak (diabaikan), tambahkan alasannya
          if (!data.accepted) {
              groupVoiceCallData.value.participants[participantIndex].reason = data.reason || 'Ditolak';
              // Kita juga bisa menambahkan fungsi untuk mengecek apakah semua sudah menolak
              checkIfAllParticipantsRejected();
          } 
          // 3. Jika diterima, jalankan logika untuk Host
          else {
            // Cek langsung apakah SAYA adalah caller dari data panggilan.
            if (groupVoiceCallData.value.caller?.id === currentUserId.value) {
                console.log('Kondisi SAYA ADALAH HOST terpenuhi. Mengubah status...');
                stopGroupCallTimeout();
                groupVoiceCallData.value.status = 'accepted';
                if (groupVoiceCallData.value.channel) {
                    joinGroupChannel(groupVoiceCallData.value.channel);
                }
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
                 // Ubah statusnya menjadi 'left' atau sejenisnya
                 groupVoiceCallData.value.participants[participantIndex].status = 'left';
                 console.log(`Status partisipan ${data.user.name} diubah menjadi 'left'`);
               }
             }
           });

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
         
         
           // 2. LISTENER UNTUK AGORA (Menangani Audio Stream) - Kode ini sudah Anda miliki
           groupClient.value.on('user-published', async (user: any, mediaType: string) => {
             if (mediaType === 'audio') {
               try {
                 await groupClient.value.subscribe(user, mediaType);
                 console.log('🔊 Remote user audio subscribed:', user.uid);
                 if (user.audioTrack) {
                   user.audioTrack.play();
                 }
               } catch (error) {
                 console.error('Error subscribing to remote audio:', error);
               }
             }
           });
           
           groupClient.value.on('user-unpublished', (user: any, mediaType: string) => {
             if (mediaType === 'audio') {
               console.log('🔇 Remote user audio unpublished:', user.uid);
             }
           });
           
           groupClient.value.on('user-joined', (user: any) => {
             console.log('👥 User joined group call:', user.uid);
           });
           
           groupClient.value.on('user-left', (user: any) => {
             console.log('👋 User left group call:', user.uid);
           });
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
        groupVoiceCallData, isGroupVoiceCallActive, isGroupCaller, groupCallTimeoutCountdown,
        startGroupVoiceCall, acceptGroupCall, rejectGroupCall, endGroupCall,
        cancelGroupCall, handleLeaveGroupCall, handleRecallParticipant,
        initializeGlobalListeners, setupDynamicGroupListeners, leaveDynamicGroupChannel, resetGroupCallState, leaveGroupChannel
    };
}

