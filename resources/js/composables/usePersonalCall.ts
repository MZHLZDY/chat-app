// resources/js/composables/usePersonalCall.ts

import { ref, computed, onUnmounted } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { Chat, User, Contact } from '@/types/index';
import { echo } from '../echo.js';
import { useCallNotification } from '@/composables/useCallNotification';

interface PageProps {
    auth: {
        user: User;
    };
    [key: string]: any;
}

// State Global (Singleton)
const contacts = ref<Contact[]>([]);
const allUsers = ref<User[]>([]);
const activeContact = ref<Chat | null>(null);
const voiceCallType = ref<'voice' | null>(null);
const isInVoiceCall = ref(false);
const localAudioTrack = ref<any>(null);
const remoteAudioTrack = ref<{ [uid: number]: any }>({});
const client = ref<any>(null);
const incomingCallVoice = ref<any>(null);
const outgoingCallVoice = ref<any>(null);
const activeCallData = ref<any>(null);
const callTimeoutRef = ref<NodeJS.Timeout | null>(null);
const callStartTime = ref<number | null>(null);
const callTimeoutCountdown = ref<number | null>(null); 
let countdownInterval: NodeJS.Timeout | null = null;
let incomingCallTimeout: NodeJS.Timeout | null = null;
let personalCallListenersInitialized = false;
const isMuted = ref(false);
const audioContextUnlocked = ref(false);
let notificationDebounceTimeout: NodeJS.Timeout | null = null;
let connectionMonitoringInterval: NodeJS.Timeout | null = null;

const subscribedUsers = ref<Set<number>>(new Set());

export function usePersonalCall() {
    const page = usePage<PageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);
    const { sendPersonalCallNotification, closeNotification } = useCallNotification();
    const isPersonalCallActive = computed(() => isInVoiceCall.value || !!outgoingCallVoice.value || !!incomingCallVoice.value);

    // Inisialisasi client Agora
    const initializeAgoraClient = () => {
        if (!client.value) {
            client.value = AgoraRTC.createClient({ 
                mode: 'rtc', 
                codec: 'vp8'
            });
            console.log('🎧 Agora client initialized');
        }
        return client.value;
    };

    const handleIncomingCallNotification = async (data: any) => {
        const notificationKey = `personal-${data.call_id}-${currentUserId.value}`;
        
        // Debounce notifikasi - tunggu 300ms
        if (notificationDebounceTimeout) {
            clearTimeout(notificationDebounceTimeout);
        }
        
        notificationDebounceTimeout = setTimeout(async () => {
            try {
                if (!isInVoiceCall.value && !incomingCallVoice.value) {
                    await sendPersonalCallNotification(data);
                    console.log('📢 Notifikasi panggilan personal dikirim');
                }
            } catch (error) {
                console.warn('Gagal mengirim notifikasi personal:', error);
            }
        }, 300);
    };

    const unlockAudioContext = async () => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
            console.warn('⚠️ Browser tidak mendukung AudioContext.');
            return;
        }

        const audioContext = new AudioContext();

        if (audioContext.state === 'running') {
            console.log('ℹ️ Audio context is already running.');
            await audioContext.close();
            return;
        }

        console.log('🎵 Attempting to unlock audio context...');

        try {
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            setTimeout(() => {
                if (source) {
                    source.disconnect();
                }
                if (audioContext.state === 'running') {
                    audioContext.close();
                }
                console.log('✅ Audio context unlocked and temporary context closed.');
            }, 300);

        } catch (error) {
            console.error('❌ Failed to unlock audio context:', error);
            if (audioContext) {
                await audioContext.close();
            }
        }
    };

    const startAudioLevelMonitoring = () => {
        if (!localAudioTrack.value) return;
        
        console.log('🎵 Starting audio level monitoring...');
        
        const monitorInterval = setInterval(() => {
            if (localAudioTrack.value) {
                try {
                    const volumeLevel = localAudioTrack.value.getVolumeLevel();
                    const isEnabled = localAudioTrack.value.enabled;
                    const isPlaying = localAudioTrack.value.isPlaying;
                    
                    console.log('📊 Audio stats:', {
                        volumeLevel: volumeLevel.toFixed(3),
                        enabled: isEnabled,
                        playing: isPlaying,
                        trackState: localAudioTrack.value.mediaStreamTrack.readyState
                    });
                    
                    if (volumeLevel === 0) {
                        console.warn('⚠️ Microphone mungkin tidak mendeteksi suara');
                    }
                    
                } catch (error) {
                    console.warn('Audio monitoring error:', error);
                }
            }
        }, 2000);
        
        return () => clearInterval(monitorInterval);
    };

// Fungsi toggleMute yang diperbaiki
const toggleMute = async () => {
    if (!localAudioTrack.value) {
        console.warn('❌ Tidak ada local audio track untuk di-mute');
        return;
    }

    try {
        // ✅ Pastikan audio context sudah di-unlock sebelum unmute
        if (!isMuted.value && !audioContextUnlocked.value) {
            console.log('🔓 Unlocking audio context sebelum unmute...');
            await unlockAudioContext();
            audioContextUnlocked.value = true;
        }

        const newMuteState = !isMuted.value;
        
        console.log(`🎤 Mengubah status mute dari ${isMuted.value} ke ${newMuteState}`);
        
        // ✅ METHOD 1: Gunakan setEnabled (primary method)
        await localAudioTrack.value.setEnabled(!newMuteState);
        
        // ✅ METHOD 2: Backup - setVolume untuk memastikan
        if (newMuteState) {
            localAudioTrack.value.setVolume(0);
        } else {
            localAudioTrack.value.setVolume(100);
            
            // ✅ METHOD 3: Re-publish track jika diperlukan
            setTimeout(async () => {
                try {
                    if (client.value && client.value.connectionState === 'CONNECTED') {
                        await client.value.unpublish([localAudioTrack.value]);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await client.value.publish([localAudioTrack.value]);
                        console.log('✅ Audio track re-published setelah unmute');
                    }
                } catch (rePublishError) {
                    console.warn('⚠️ Gagal re-publish audio track:', rePublishError);
                }
            }, 200);
        }
        
        isMuted.value = newMuteState;
        
        // ✅ Play test sound saat unmute untuk konfirmasi
        if (!newMuteState) {
            playUnmuteConfirmationSound();
        }
        
        console.log(`✅ Audio ${isMuted.value ? 'dimatikan' : 'dinyalakan'} berhasil`);
        
    } catch (error) {
        console.error('❌ Gagal mengubah status mute:', error);
        // Rollback state jika gagal
        isMuted.value = !isMuted.value;
    }
};

// ✅ FUNGSI BARU: Konfirmasi unmute dengan sound
const playUnmuteConfirmationSound = () => {
    if (typeof window !== 'undefined') {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.05; // Sangat pelan agar tidak mengganggu
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            
            console.log('🔊 Play unmute confirmation sound');
        } catch (e) {
            console.log('ℹ️ Tidak bisa play unmute sound (browser limitation)');
        }
    }
};

// ✅ FUNGSI BARU: Force unmute dengan reset komprehensif
const forceUnmuteAudio = async () => {
    console.log('🔄 FORCE UNMUTE: Memulai proses unmute paksa...');
    
    if (!localAudioTrack.value) {
        console.warn('❌ Tidak ada audio track untuk force unmute');
        return false;
    }

    try {
        // 1. Stop track lama
        try {
            localAudioTrack.value.stop();
            localAudioTrack.value.close();
        } catch (e) {
            // Ignore stop errors
        }

        // 2. Unpublish dari channel
        if (client.value && client.value.connectionState === 'CONNECTED') {
            await client.value.unpublish([localAudioTrack.value]);
        }

        // 3. Buat track baru
        await new Promise(resolve => setTimeout(resolve, 500));
        await unlockAudioContext();
        
        localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
            AGC: true
        });

        // 4. Publish track baru
        if (client.value && client.value.connectionState === 'CONNECTED') {
            await client.value.publish([localAudioTrack.value]);
        }

        // 5. Set state
        localAudioTrack.value.setVolume(100);
        await localAudioTrack.value.setEnabled(true);
        isMuted.value = false;
        audioContextUnlocked.value = true;

        console.log('✅ FORCE UNMUTE: Berhasil membuat audio track baru');
        return true;

    } catch (error) {
        console.error('❌ FORCE UNMUTE: Gagal:', error);
        return false;
    }
};

// ✅ PERBAIKAN: Enhanced toggleMute dengan fallback
const toggleMuteEnhanced = async () => {
    if (!localAudioTrack.value) {
        console.warn('❌ Tidak ada audio track');
        return;
    }

    const desiredMuteState = !isMuted.value;

    try {
        // Jika mau unmute, coba force unmute jika diperlukan
        if (desiredMuteState === false) {
            console.log('🔄 Attempting to unmute dengan enhanced method...');
            
            // Coba method normal dulu
            await localAudioTrack.value.setEnabled(true);
            localAudioTrack.value.setVolume(100);
            
            // Test apakah audio bekerja
            const testSuccess = await testAudioWorking();
            
            if (!testSuccess) {
                console.warn('⚠️ Unmute normal gagal, mencoba force unmute...');
                await forceUnmuteAudio();
            }
        } else {
            // Untuk mute, cukup gunakan method normal
            await localAudioTrack.value.setEnabled(false);
            localAudioTrack.value.setVolume(0);
        }
        
        isMuted.value = desiredMuteState;
        console.log(`✅ Enhanced mute: ${isMuted.value ? 'MUTED' : 'UNMUTED'}`);
        
    } catch (error) {
        console.error('❌ Enhanced mute gagal:', error);
    }
};

// ✅ FUNGSI BARU: Test apakah audio benar-benar bekerja
const testAudioWorking = async (): Promise<boolean> => {
    if (!localAudioTrack.value) return false;

    try {
        const volumeLevel = localAudioTrack.value.getVolumeLevel();
        const isEnabled = localAudioTrack.value.enabled;
        
        console.log('🎵 Audio test:', {
            volumeLevel: volumeLevel.toFixed(3),
            enabled: isEnabled,
            trackState: localAudioTrack.value.mediaStreamTrack.readyState
        });
        
        return isEnabled && volumeLevel > 0;
    } catch (error) {
        console.warn('❌ Audio test failed:', error);
        return false;
    }
};

    // ✅ FUNGSI BARU: Konfirmasi audio working
    const confirmAudioWorking = (userId: number) => {
        console.log(`🎉🎉🎉 AUDIO CONNECTED SUCCESSFULLY dengan user ${userId} 🎉🎉🎉`);
        
        // Optional: Play success sound
        if (typeof window !== 'undefined') {
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                // Ignore audio context errors
            }
        }
    };

    // ✅ FUNGSI BARU: Subscribe dengan validasi ekstra ketat
    const subscribeToUserWithRetry = async (user: any, mediaType: string, retryCount = 0) => {
        const userId = user.uid;
        const maxRetries = 2;
        const baseDelay = 1000;

        try {
            console.log(`🔍 Subscribe attempt ${retryCount + 1}/${maxRetries} for user ${userId}...`);
            
            // ✅ VALIDASI EKSTRA: Cek connection state
            if (client.value.connectionState !== 'CONNECTED') {
                console.warn(`⚠️ Client not connected, waiting...`);
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, baseDelay));
                    return subscribeToUserWithRetry(user, mediaType, retryCount + 1);
                }
                return;
            }
            
            // ✅ VALIDASI EKSTRA: Cek user benar-benar ada di remoteUsers
            const remoteUsers = client.value.remoteUsers;
            const userInChannel = remoteUsers.some((u: any) => u.uid === userId);
            
            if (!userInChannel) {
                console.warn(`⚠️ User ${userId} not in remoteUsers, waiting...`);
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, baseDelay));
                    return subscribeToUserWithRetry(user, mediaType, retryCount + 1);
                }
                return;
            }

            console.log(`✅ Conditions met, attempting subscribe to user ${userId}...`);
            
            // ✅ LAKUKAN SUBSCRIBE
            await client.value.subscribe(user, mediaType);
            
            // ✅ CEK: Apakah audio track tersedia setelah subscribe?
            if (user.audioTrack) {
                // ✅ TANDAI USER SUDAH DI-SUBSCRIBE
                subscribedUsers.value.add(userId);
                
                remoteAudioTrack.value[userId] = user.audioTrack;
                
                // ✅ PLAY AUDIO
                setTimeout(() => {
                    try {
                        user.audioTrack.play();
                        console.log(`🎉 BERHASIL! Audio dari user ${userId} sedang diputar`);
                        
                        // ✅ KONFIRMASI FINAL
                        confirmAudioWorking(userId);
                    } catch (playError) {
                        console.warn(`⚠️ Gagal memutar audio dari ${userId}:`, playError);
                    }
                }, 500);
                
                console.log(`✅ Subscribe BERHASIL pada attempt ${retryCount + 1} untuk user ${userId}`);
                return true;
            } else {
                throw new Error('Audio track tidak ditemukan setelah subscribe');
            }
            
        } catch (error: any) {
            console.warn(`❌ Subscribe attempt ${retryCount + 1} gagal: ${error.message}`);
            
            // ✅ AUTO-RETRY UNTUK SEMUA ERROR
            if (retryCount < maxRetries) {
                const delay = baseDelay * (retryCount + 1);
                console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return subscribeToUserWithRetry(user, mediaType, retryCount + 1);
            } else {
                console.error(`❌ Gagal total subscribe ke user ${userId} setelah ${maxRetries} percobaan`);
                return false;
            }
        }
    };

    // ✅ FUNGSI BARU: Manual trigger untuk subscribe
    const manuallyTriggerSubscribe = async (immediate = false) => {
      console.log('🔊 MANUAL SUBSCRIBE: Starting...');
    
      if (!client.value || client.value.connectionState !== 'CONNECTED') {
          console.warn('⚠️ Client not ready for manual subscribe');
          return;
      }

      const remoteUsers = client.value.remoteUsers;
      console.log(`👥 MANUAL SUBSCRIBE: Found ${remoteUsers.length} remote users`);
    
      if (remoteUsers.length === 0) {
          console.log('⏳ No remote users yet, will retry in 1s...');
          // ⚡ RETRY CEPAT jika belum ada user
          setTimeout(() => manuallyTriggerSubscribe(true), 1000);
          return;
        }

      // ⚡ SUBSCRIBE KE SEMUA USER SECARA PARALEL
      const subscribePromises = remoteUsers.map(user => 
         fastSubscribeToUser(user)
      );
    
      const results = await Promise.allSettled(subscribePromises);
      const successCount = results.filter(result => result.status === 'fulfilled').length;
    
      console.log(`✅ MANUAL SUBSCRIBE: ${successCount}/${remoteUsers.length} users subscribed`);
    
      // ⚡ JIKA GAGAL, RETRY SEKALI LAGI
      if (successCount === 0 && remoteUsers.length > 0) {
          console.log('🔄 Manual subscribe failed, retrying in 500ms...');
          setTimeout(() => manuallyTriggerSubscribe(true), 500);
      }
    };

    const fastSubscribeToUser = async (user: any): Promise<boolean> => {
    const userId = user.uid;
    
    // Skip jika sudah subscribed
    if (subscribedUsers.value.has(userId)) {
        console.log(`✅ User ${userId} already subscribed`);
        return true;
    }

    try {
        console.log(`⚡ FAST SUBSCRIBE: Attempting subscribe to user ${userId}`);
        
        // ⚡ LANGSUNG SUBSCRIBE TANPA VALIDASI BERLEBIHAN
        await client.value.subscribe(user, 'audio');
        
        if (user.audioTrack) {
            subscribedUsers.value.add(userId);
            remoteAudioTrack.value[userId] = user.audioTrack;
            
            // ⚡ PLAY IMMEDIATELY
            try {
                user.audioTrack.play();
                console.log(`🎉 FAST SUCCESS: Audio dari user ${userId} BERHASIL!`);
                return true;
            } catch (playError) {
                console.warn(`⚠️ Play failed for ${userId}:`, playError);
                return false;
            }
        } else {
            console.warn(`⚠️ No audio track for user ${userId}`);
            return false;
        }
        
    } catch (error: any) {
        console.warn(`❌ Fast subscribe failed for ${userId}:`, error.message);
        return false;
    }
};

    // ✅ FUNGSI: Monitor connection status
    const monitorConnectionStatus = () => {
        if (!client.value) return;
        
        console.log('🔍 Connection Status:', {
            connectionState: client.value.connectionState,
            remoteUsers: client.value.remoteUsers.map((u: any) => ({
                uid: u.uid,
                hasAudio: u.hasAudio,
                audioTrack: !!u.audioTrack
            })),
            subscribedUsers: Array.from(subscribedUsers.value)
        });
    };

    const startConnectionMonitoring = () => {
        if (connectionMonitoringInterval) clearInterval(connectionMonitoringInterval);
        connectionMonitoringInterval = setInterval(monitorConnectionStatus, 3000);
    };

    const stopConnectionMonitoring = () => {
        if (connectionMonitoringInterval) {
            clearInterval(connectionMonitoringInterval);
            connectionMonitoringInterval = null;
        }
    };

    const resetVoiceCallState = () => {
        console.log('🔄 RESET VOICE CALL STATE - Memulai reset...');
        
        // ✅ RESET subscribed users dan mute/unmute
        isMuted.value = false;
        audioContextUnlocked.value = false;
        subscribedUsers.value.clear();
        
        if (callTimeoutRef.value) {
            clearTimeout(callTimeoutRef.value);
            callTimeoutRef.value = null;
            console.log('⏰ Timer timeout dihapus');
        }
        stopCallTimeout();
        stopConnectionMonitoring();

        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
            incomingCallTimeout = null;
        }

        callStartTime.value = null;
        isInVoiceCall.value = false;
        voiceCallType.value = null;
        callTimeoutCountdown.value = null;

        if (notificationDebounceTimeout) {
            clearTimeout(notificationDebounceTimeout);
            notificationDebounceTimeout = null;
        }
        
        console.log('📊 State flags direset');
        
        const resetAudioTracks = () => {
            try {
                if (localAudioTrack.value) {
                    localAudioTrack.value.stop();
                    localAudioTrack.value.close();
                    localAudioTrack.value = null;
                    console.log('🎤 Local audio track direset');
                }
                
                Object.values(remoteAudioTrack.value).forEach((track, uid) => {
                    try {
                        track.stop();
                        track.close();
                        console.log(`🔇 Remote audio track ${uid} direset`);
                    } catch (error) {
                        console.warn(`⚠️ Error resetting remote track ${uid}:`, error);
                    }
                });
                remoteAudioTrack.value = {};
                
            } catch (error) {
                console.warn('⚠️ Error resetting audio tracks:', error);
            }
        };

        const leaveChannel = async () => {
            try {
                if (client.value && client.value.connectionState !== 'DISCONNECTED') {
                    console.log('🔌 Leaving Agora channel...');
                    await client.value.leave();
                    console.log('✅ Berhasil leave Agora channel');
                }
            } catch (error) {
                console.warn('⚠️ Error during client leave:', error);
            }
        };

        const performReset = async () => {
            resetAudioTracks();
            await leaveChannel();
            
            console.log('🧹 Membersihkan outgoing dan incoming call data');
            outgoingCallVoice.value = null;
            incomingCallVoice.value = null;
            activeCallData.value = null;
            
            console.log('✅ Voice call state reset completed');
        };

        performReset().catch(error => {
            console.error('❌ Error during reset process:', error);
        });
    };

    const setupAudioListeners = () => {
        if (!client.value) {
            console.error('❌ Client not initialized for audio listeners');
            return;
        }

        console.log('🎧 Setting up audio listeners for Agora client');

        // Hapus event listeners lama
        client.value.removeAllListeners();

        // ✅ PERBAIKAN BESAR: Gunakan user-joined sebagai primary trigger
        // client.value.on('user-joined', async (user: any) => {
        //     const userId = user.uid;
        //     console.log(`👤 USER JOINED CHANNEL: ${userId} - Starting subscription process...`);
            
        //     if (subscribedUsers.value.has(userId)) {
        //         console.log(`⚠️ User ${userId} already subscribed, skipping...`);
        //         return;
        //     }

        //     // ✅ TUNGGU LEBIH LAMA untuk pastikan user benar-benar ready
        //     console.log(`⏳ Quick wait 1s for user ${userId}...`);
        //     await new Promise(resolve => setTimeout(resolve, 1000));

        //     await subscribeToUserWithRetry(user, 'audio');
        // });

        // // ✅ BACKUP: Tetap pertahankan user-published sebagai fallback
        // client.value.on('user-published', async (user: any, mediaType: string) => {
        //     if (mediaType !== 'audio') return;
            
        //     const userId = user.uid;
        //     console.log(`🔊 User published audio: ${userId} (Fallback trigger)`);
            
        //     if (subscribedUsers.value.has(userId)) {
        //         console.log(`⚠️ User ${userId} already subscribed, skipping...`);
        //         return;
        //     }

        //     // Jika user-joined belum trigger, coba subscribe
        //     console.log(`⏳ Fallback: Waiting 2 seconds for user ${userId}...`);
        //     await new Promise(resolve => setTimeout(resolve, 2000));

        //     await subscribeToUserWithRetry(user, 'audio');
        // });
        
        // ✅ PERBAIKAN: User unpublished event
        client.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                const userId = user.uid;
                console.log(`🔇 User unpublished audio: ${userId}`);
                
                subscribedUsers.value.delete(userId);
                
                if (remoteAudioTrack.value[userId]) {
                    try {
                        remoteAudioTrack.value[userId].stop();
                    } catch (e) {
                        // Ignore stop errors
                    }
                    delete remoteAudioTrack.value[userId];
                }
            }
        });
        
        // ✅ PERBAIKAN: User left event
        client.value.on('user-left', (user: any, reason: string) => {
            const userId = user.uid;
            console.log(`👋 User ${userId} left channel: ${reason}`);
            
            subscribedUsers.value.delete(userId);
            
            if (remoteAudioTrack.value[userId]) {
                try {
                    remoteAudioTrack.value[userId].stop();
                } catch (e) {
                    // Ignore stop errors
                }
                delete remoteAudioTrack.value[userId];
            }
        });

        // ✅ LISTENER LAINNYA
        client.value.on('connection-state-change', (curState: string, prevState: string) => {
            console.log('🔗 Connection state changed:', prevState, '→', curState);
        });
        
        client.value.on('network-quality', (quality: any) => {
            console.log('📶 Network quality:', quality);
        });

        client.value.on('exception', (event: any) => {
            console.error('❌ Agora exception:', event);
        });

        console.log('✅ Audio listeners setup completed');
    };

    const checkCodecSupport = async (): Promise<void> => {
        try {
            console.log('🔍 Checking codec support...');
            
            const support = await AgoraRTC.getSupportedCodec(); 
            console.log('✅ Supported codecs:', support);
            
            const opusSupported = support.audio.includes('opus');
            console.log('🎵 Opus codec supported:', opusSupported);
            
            console.log('🌐 Browser info:', {
                name: navigator.userAgent,
                platform: navigator.platform
            });
            
        } catch (error) {
            console.warn('⚠️ Cannot check codec support:', error);
        }
    };

    const checkAudioPermissions = async (): Promise<boolean> => {
        try {
            console.log('🔍 Checking audio permissions...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('❌ Browser tidak mendukung getUserMedia');
                return false;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false 
            });
            
            console.log('✅ Microphone access granted');
            
            const audioTracks = stream.getAudioTracks();
            console.log('🎤 Audio tracks found:', audioTracks.length);
            
            if (audioTracks.length === 0) {
                console.error('❌ Tidak ada audio track yang ditemukan');
                return false;
            }
            
            audioTracks.forEach((track, index) => {
                console.log(`🎤 Audio track ${index}:`, {
                    id: track.id,
                    label: track.label,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState,
                    kind: track.kind
                });
            });
            
            audioTracks.forEach(track => track.stop());
            
            return true;
            
        } catch (error) {
            console.error('❌ Microphone access denied atau error:', error);
            return false;
        }
    };

    const setupAudio = async (): Promise<boolean> => {
        try {
            console.log('🎵 Setting up audio...');
            
            if (localAudioTrack.value) {
                localAudioTrack.value.stop();
                localAudioTrack.value.close();
                localAudioTrack.value = null;
            }
            
            try {
                localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                    encoderConfig: 'music_standard',
                    AEC: true,
                    ANS: true,
                    AGC: true
                });
                console.log('✅ Microphone audio track created with music_standard config');
            } catch (configError) {
                console.warn('⚠️ Music standard config failed, trying speech standard...');
                try {
                    localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                        encoderConfig: 'speech_standard',
                        AEC: true,
                        ANS: true,
                        AGC: true
                    });
                    console.log('✅ Microphone audio track created with speech_standard config');
                } catch (secondError) {
                    console.warn('⚠️ Speech standard config failed, trying basic...');
                    localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
                    console.log('✅ Microphone audio track created with basic config');
                }
            }
            
            localAudioTrack.value.setVolume(100);
            
            const stream = localAudioTrack.value.getMediaStreamTrack();
            console.log('🎤 Audio track details:', {
                enabled: stream.enabled,
                readyState: stream.readyState,
                label: stream.label,
                muted: stream.muted
            });
            
            if (localAudioTrack.value) {
                try {
                    const volume = localAudioTrack.value.getVolumeLevel();
                    console.log('📊 Initial audio level:', volume);
                    
                    const testElement = document.createElement('audio');
                    testElement.srcObject = new MediaStream([localAudioTrack.value.getMediaStreamTrack()]);
                    testElement.play().then(() => {
                        console.log('✅ Audio track can be played successfully');
                        testElement.pause();
                    }).catch((playError) => {
                        console.warn('⚠️ Audio track play test failed:', playError);
                    });
                    
                } catch (levelError) {
                    console.warn('⚠️ Cannot get initial audio level:', levelError);
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to setup audio:', error);
            return false;
        }
    };

    const joinChannel = async (channelName: string) => { 
    try {
        console.log('🎯 OPTIMIZED JOIN PROCESS:', channelName);

        isMuted.value = false;
        audioContextUnlocked.value = false;
        subscribedUsers.value.clear();
        
        // 1. Quick cleanup
        if (client.value && client.value.connectionState !== 'DISCONNECTED') {
            await client.value.leave();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 2. New client & simple listeners
        client.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        setupAudioListeners(); // ⚡ YANG SUDAH DISIMPLE

        // 3. Join channel
        const response = await axios.post('/call/token', {
            channel: channelName,
            uid: currentUserId.value.toString(),
        });
        
        const { app_id, token, uid } = response.data;
        await client.value.join(app_id, channelName, token, uid);
        console.log(`✅ JOINED channel: ${channelName}`);

        // 4. Setup audio track
        if (localAudioTrack.value) {
            try {
                localAudioTrack.value.stop();
                localAudioTrack.value.close();
            } catch (e) {}
        }
        
        localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
        await client.value.publish([localAudioTrack.value]);
        console.log('✅ AUDIO published');

        isInVoiceCall.value = true;

        // ⚡ 5. TRIGGER MANUAL SUBSCRIBE LEBIH CEPAT & MULTIPLE TIMES
        console.log('🔊 STARTING FAST SUBSCRIBE PROCESS...');
        
        // ⚡ TRIGGER PERTAMA: Segera setelah join
        setTimeout(() => manuallyTriggerSubscribe(true), 800);
        
        // ⚡ TRIGGER KEDUA: Backup setelah 2 detik  
        setTimeout(() => {
            console.log('🔊 BACKUP SUBSCRIBE TRIGGER');
            manuallyTriggerSubscribe(true);
        }, 2000);
        
        // ⚡ TRIGGER KETIGA: Final attempt setelah 4 detik
        setTimeout(() => {
            console.log('🔊 FINAL SUBSCRIBE TRIGGER');
            manuallyTriggerSubscribe(true);
        }, 4000);

        console.log('🎉 OPTIMIZED JOIN: Process started with fast subscribe triggers');
        return true;
                
    } catch (error: any) {
        console.error('❌ Optimized join failed:', error);
        resetVoiceCallState();
        throw error;
    }
};

    const startVoiceCall = async (contact: Chat | null) => {
        if (!contact || contact.type !== 'user') {
            console.log('No active contact or contact is not a user');
            return;
        }

        await unlockAudioContext();
        await checkCodecSupport();

        const hasAudioPermission = await checkAudioPermissions();
        if (!hasAudioPermission) {
            alert('Tidak dapat mengakses microphone. Mohon berikan izin microphone.');
            return;
        }

        try {
            console.log('🚀 Starting voice call to:', contact.name);
            
            // Reset state sebelumnya
            if (isInVoiceCall.value || outgoingCallVoice.value || incomingCallVoice.value) {
                resetVoiceCallState();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            stopCallTimeout();
            
            // Kirim undangan panggilan
            const response = await axios.post('/call/invite', {
                callee_id: contact.id,
                call_type: 'voice'
            });
            
            console.log('📞 Call invite response:', response.data);
            
            if (!response.data.call_id || !response.data.channel) {
                throw new Error('Invalid response from server - missing call_id or channel');
            }
            
            const { call_id, channel } = response.data;
            
            // Setup outgoing call data dengan status 'calling'
            outgoingCallVoice.value = {
                callId: call_id,
                callee: contact,
                callType: 'voice',
                channel: channel,
                status: 'calling'
            };

            activeCallData.value = {
                callId: call_id,
                channel: channel,
                caller: { id: currentUserId.value, name: currentUserName.value },
                callee: { id: contact.id, name: contact.name },
                callType: 'voice',
                isCaller: true,
                status: 'calling'
            };
            
            callStartTime.value = Date.now();
            startCallTimeout(30);
            
            console.log('✅ Panggilan berhasil dimulai, menunggu penerima...');
            
        } catch (error: any) {
            console.error('❌ Failed to start call:', error);
            stopCallTimeout();
            alert('Gagal memulai panggilan: ' + (error.message || 'Unknown error'));
            resetVoiceCallState();
        }
    };

    const answerVoiceCall = async (accepted: boolean, reason?: string) => {
        const callData = incomingCallVoice.value;
        if (!callData) {
            console.error('❌ Tidak ada panggilan masuk untuk dijawab.');
            return;
        }

        closeNotification(callData.callId, 'personal');

        // Hapus UI panggilan masuk terlebih dahulu
        incomingCallVoice.value = null;

        try {
            // 1. Kirim jawaban ke backend
            await axios.post('/call/answer', {
                call_id: callData.callId,
                caller_id: callData.caller.id,
                accepted: accepted,
                reason: accepted ? null : (reason || 'Ditolak')
            });

            console.log(`✅ Jawaban panggilan (accepted: ${accepted}) berhasil dikirim.`);

            if (accepted) {
                console.log('📞 Panggilan diterima, bergabung ke channel:', callData.channel);

                // ✅ CALLEE JOIN CHANNEL SETELAH MENERIMA PANGGILAN
                await joinChannel(callData.channel);

                // Setup state untuk callee
                isInVoiceCall.value = true;
                activeCallData.value = {
                    callId: callData.callId,
                    channel: callData.channel,
                    caller: callData.caller,
                    callee: { id: currentUserId.value, name: currentUserName.value },
                    callType: 'voice',
                    isCaller: false,
                    status: 'connected'
                };
            } else {
                resetVoiceCallState();
            }

        } catch (error: any) {
            console.error('❌ Gagal merespons panggilan:', error);
            alert('Gagal merespons panggilan.');
            resetVoiceCallState();
        }
    };

    // ✅ PERBAIKAN: Function khusus untuk caller join channel setelah panggilan diterima
    const joinCallAsCaller = async () => {
        if (!outgoingCallVoice.value || !activeCallData.value) {
            console.error('❌ Tidak ada data panggilan untuk caller');
            return;
        }

        try {
            console.log('🎯 Caller joining channel setelah panggilan diterima...');
            
            // ✅ TUNGGU SEBENTAR SEBELUM JOIN (beri waktu callee untuk join dulu)
            console.log('⏳ Quick wait 1.5 detik untuk memastikan callee join...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await joinChannel(activeCallData.value.channel);
            
            // Update status menjadi connected
            activeCallData.value.status = 'connected';
            outgoingCallVoice.value.status = 'connected';
            
            console.log('✅ Caller berhasil join channel setelah panggilan diterima');
        } catch (error) {
            console.error('❌ Gagal join channel sebagai caller:', error);
            alert('Gagal terhubung ke panggilan.');
            resetVoiceCallState();
        }
    };

    const endVoiceCallWithReason = async (reason?: string) => {
        console.log('📞 Mengakhiri panggilan dengan alasan:', reason);

        let callInfo = null;
        if (activeCallData.value) {
            callInfo = activeCallData.value;
            console.log('ℹ️ Menggunakan `activeCallData` sebagai sumber info.');
        } else if (outgoingCallVoice.value) {
            callInfo = {
                callId: outgoingCallVoice.value.callId,
                caller: { id: currentUserId.value, name: currentUserName.value },
                callee: outgoingCallVoice.value.callee,
            };
            console.log('ℹ️ Menggunakan `outgoingCallVoice` sebagai sumber info.');
        } else if (incomingCallVoice.value) {
            callInfo = {
                callId: incomingCallVoice.value.callId,
                caller: incomingCallVoice.value.caller,
                callee: { id: currentUserId.value, name: currentUserName.value },
            };
            console.log('ℹ️ Menggunakan `incomingCallVoice` sebagai sumber info (fallback).');
        }

        if (!callInfo || !callInfo.callId) {
            console.log('❌ Tidak ada panggilan aktif untuk diakhiri. Melakukan reset paksa.');
            resetVoiceCallState();
            return;
        }

        try {
            const participantIds: number[] = [];
            if (callInfo.caller?.id) participantIds.push(callInfo.caller.id);
            if (callInfo.callee?.id) participantIds.push(callInfo.callee.id);

            const uniqueParticipantIds = [...new Set(participantIds)];

            console.log('🔚 Mengakhiri panggilan:', {
                call_id: callInfo.callId,
                reason: reason || 'Panggilan diakhiri',
                participant_ids: uniqueParticipantIds,
            });

            await axios.post('/call/end', {
                call_id: callInfo.callId,
                participant_ids: uniqueParticipantIds,
                ended_by: { id: currentUserId.value, name: currentUserName.value },
                reason: reason || 'Panggilan diakhiri'
            });
            
            setTimeout(() => {
                if (isInVoiceCall.value || outgoingCallVoice.value || incomingCallVoice.value || activeCallData.value) {
                    console.log('⏰ Safety net: Reset manual karena event call-ended mungkin tidak diterima');
                    resetVoiceCallState();
                }
            }, 2000);

        } catch (error: any) {
            console.error('❌ Error ending call:', error);
            let errorMessage = 'Gagal mengakhiri panggilan';
            if (axios.isAxiosError(error)) {
                errorMessage = error.response?.data?.message || error.message;
            }
            alert(errorMessage);
            resetVoiceCallState();
        }
    };

    const initializePersonalCallListeners = () => {
        if (personalCallListenersInitialized) {
            console.log('⚠️ Personal call listeners sudah terpasang, skip...');
            return;
        }

        const userId = currentUserId.value;
        if (!userId) return;

        const privateChannel = echo.private(`user.${userId}`);
        console.log(`🎧 Menyiapkan listener PANGGILAN PERSONAL di channel: user.${userId}`);
        
        // Hapus listener lama untuk menghindari duplikasi
        privateChannel.stopListening('.incoming-call');
        privateChannel.stopListening('.call-ended');
        privateChannel.stopListening('.call-accepted');
        privateChannel.stopListening('.call-rejected');
        privateChannel.stopListening('.call-timeout');

        // Listener untuk panggilan masuk
        privateChannel.listen('.incoming-call', (data: any) => {
            console.log('📞 EVENT incoming-call DITERIMA:', data);
            
            // Abaikan jika sedang dalam panggilan
            if (isInVoiceCall.value) {
                console.log('⚠️ Sedang dalam panggilan, abaikan incoming call');
                return;
            }
            
            if (!data.caller) {
                console.error('❌ Data caller tidak ada dalam event');
                return;
            }
            
            // Cari nama caller dari contacts
            let callerName = data.caller.name;
            if (!callerName && data.caller.id) {
                const callerUser = contacts.value.find(c => c.id === data.caller.id);
                callerName = callerUser ? callerUser.name : `User ${data.caller.id}`;
            }
            
            incomingCallVoice.value = {
                callId: data.call_id,
                caller: {
                    id: data.caller.id,
                    name: callerName
                },
                callType: data.call_type || 'voice',
                channel: data.channel
            };
            
            console.log('📞 Panggilan masuk diproses:', incomingCallVoice.value);

            handleIncomingCallNotification(data);
            
            // Setup timeout untuk panggilan masuk (30 detik)
            if (incomingCallTimeout) {
                clearTimeout(incomingCallTimeout);
            }
            
            incomingCallTimeout = setTimeout(() => {
                if (incomingCallVoice.value?.callId === data.call_id) {
                    console.log('⏰ Auto rejecting call due to timeout (30 seconds)');
                    handleIncomingCallTimeout(data.call_id);
                }
            }, 30000);
        });
        
        // Listener untuk panggilan diakhiri
        privateChannel.listen('.call-ended', (data: any) => {
            console.log('📞 CALL ENDED EVENT DITERIMA:', data);

            closeNotification(data.call_id, 'personal');
            
            // Hentikan timeout incoming call
            if (incomingCallTimeout) {
                clearTimeout(incomingCallTimeout);
                incomingCallTimeout = null;
            }
            
            // Reset state
            resetVoiceCallState();
            
            // Tampilkan alert jika panggilan diakhiri oleh lawan
            if (data.ended_by && data.ended_by.id !== currentUserId.value) {
                let endedByName = data.ended_by.name || `User ${data.ended_by.id}`;
                // const reason = data.reason ? ` - Alasan: ${data.reason}` : '';
                alert(`Panggilan diakhiri oleh ${endedByName}`);
            }
        });
        
        // Listener untuk panggilan diterima (UNTUK CALLER)
        privateChannel.listen('.call-accepted', async (data: any) => {
            console.log('✅ EVENT .call-accepted DITERIMA oleh CALLER:', data);

            // Hentikan timeout outgoing call
            if (callTimeoutRef.value) {
                clearTimeout(callTimeoutRef.value);
                callTimeoutRef.value = null;
            }
            stopCallTimeout();

            // ✅ PERBAIKAN: CALLER JOIN CHANNEL SETELAH MENDAPAT KONFIRMASI
            if (outgoingCallVoice.value && outgoingCallVoice.value.callId === data.call_id) {
                console.log('🎯 Caller menerima konfirmasi, sekarang join channel...');
                
                try {
                    await joinCallAsCaller();
                    
                    // Update state
                    outgoingCallVoice.value.status = 'connected';
                    isInVoiceCall.value = true;

                    activeCallData.value = {
                        callId: data.call_id,
                        channel: data.channel,
                        caller: data.caller,
                        callee: data.callee,
                        callType: 'voice',
                        isCaller: true,
                        status: 'connected'
                    };

                    console.log('✅ Panggilan terhubung! Caller dan callee sudah di channel.');
                } catch (error) {
                    console.error('❌ Caller gagal join channel:', error);
                    resetVoiceCallState();
                }
            }
        });
        
        // Listener untuk panggilan ditolak
        privateChannel.listen('.call-rejected', (data: any) => {
            console.log('❌ CALL REJECTED EVENT DITERIMA:', data);
            
            // Hentikan semua timeout
            if (callTimeoutRef.value) {
                clearTimeout(callTimeoutRef.value);
                callTimeoutRef.value = null;
            }
            stopCallTimeout();
            
            if (incomingCallTimeout) {
                clearTimeout(incomingCallTimeout);
                incomingCallTimeout = null;
            }

            // Update state untuk outgoing call yang ditolak
            if (outgoingCallVoice.value && outgoingCallVoice.value.callId === data.call_id) {
                console.log('❌ Panggilan ditolak oleh penerima');
                outgoingCallVoice.value.status = 'rejected';
                outgoingCallVoice.value.reason = data.reason || 'Panggilan Ditolak';
                
                setTimeout(() => {
                    resetVoiceCallState();
                }, 3000);
            }
            
            // Hapus incoming call jika ada
            if (incomingCallVoice.value && incomingCallVoice.value.callId === data.call_id) {
                incomingCallVoice.value = null;
            }

            alert('Panggilan ditolak: ' + (data.reason || 'Tidak ada alasan'));
        });
        
        // Listener untuk panggilan timeout
        privateChannel.listen('.call-timeout', (data: any) => {
            console.log('⏰ CALL TIMEOUT EVENT DITERIMA:', data);
            
            if (incomingCallTimeout && data.call_id === incomingCallVoice.value?.callId) {
                clearTimeout(incomingCallTimeout);
                incomingCallTimeout = null;
                
                if (incomingCallVoice.value?.callId === data.call_id) {
                    console.log('⏰ Panggilan timeout dari sisi pemanggil');
                    incomingCallVoice.value = null;
                    alert('Panggilan tidak diangkat dan telah berakhir');
                }
            }
        });

        personalCallListenersInitialized = true;
    };

    const handleIncomingCallTimeout = async (callId: string) => {
        console.log('⏰ Handling incoming call timeout for:', callId);
        
        if (incomingCallVoice.value?.callId === callId) {
            try {
                await axios.post('/call/timeout', {
                    call_id: callId,
                    reason: 'Tidak diangkat',
                    side: 'receiver'
                });
                console.log('✅ Timeout notified to server');
            } catch (error) {
                console.error('❌ Failed to notify timeout:', error);
            }
            
            incomingCallVoice.value = null;
            alert('Panggilan tidak diangkat dan telah berakhir');
        }
    };

    const startCallTimeout = (duration: number = 30) => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        callTimeoutCountdown.value = duration;

        countdownInterval = setInterval(() => {
            if (callTimeoutCountdown.value !== null && callTimeoutCountdown.value > 0) {
                callTimeoutCountdown.value--;
                console.log('⏰ Countdown:', callTimeoutCountdown.value);
            } else {
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                handleCallTimeout();
            }
        }, 1000);
    };

    const handleCallTimeout = () => {
        if (outgoingCallVoice.value?.status === 'calling') {
            console.log('⏰ Call timeout - no response from callee after 30 seconds');
            
            outgoingCallVoice.value.status = 'ended';
            outgoingCallVoice.value.reason = 'Diabaikan';
            callTimeoutCountdown.value = null;
            
            axios.post('/call/missed', {
                call_id: outgoingCallVoice.value.callId,
                reason: 'timeout'
            }).catch(error => {
                console.error('Failed to send missed call notification:', error);
            });
            
            setTimeout(() => {
                outgoingCallVoice.value = null;
                callStartTime.value = null;
            }, 3000);
        }
    };

    const stopCallTimeout = () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        callTimeoutCountdown.value = null;
    };

    // Cleanup on unmount
    onUnmounted(() => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
        }
        if (callTimeoutRef.value) {
            clearTimeout(callTimeoutRef.value);
        }
        if (connectionMonitoringInterval) {
            clearInterval(connectionMonitoringInterval);
        }
        resetVoiceCallState();
    });

    return {
        isPersonalCallActive,
        isInVoiceCall, 
        localAudioTrack, 
        remoteAudioTrack, 
        incomingCallVoice,
        outgoingCallVoice, 
        activeCallData, 
        client,
        isMuted,
        startVoiceCall, 
        answerVoiceCall, 
        endVoiceCallWithReason,
        initializePersonalCallListeners, 
        callTimeoutCountdown,
        resetVoiceCallState,
        toggleMute: toggleMuteEnhanced,
        forceUnmuteAudio,
        manuallyTriggerSubscribe, // ⚡ Export untuk manual trigger
        fastSubscribeToUser // ✅ Export untuk debugging
    };
}