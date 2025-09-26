// resources/js/composables/usePersonalCall.ts

import { ref, computed, onUnmounted } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { Chat, User, Contact } from '@/types/index';
import { echo } from '../echo.js';

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
const isMuted = ref(false); 
let countdownInterval: NodeJS.Timeout | null = null;
let incomingCallTimeout: NodeJS.Timeout | null = null;
let personalCallListenersInitialized = false;

const subscribedUsers = ref<Set<number>>(new Set());

export function usePersonalCall() {
    const page = usePage<PageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);

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

    const toggleMute = async () => {
        if (!localAudioTrack.value) return;
        isMuted.value = !isMuted.value;
        try {
            // Ubah status enabled pada track audio
            await localAudioTrack.value.setEnabled(!isMuted.value);
            console.log(`🎤 Audio ${isMuted.value ? 'dimatikan' : 'dinyalakan'}`);
        } catch (error) {
            console.error("Gagal mengubah status mute:", error);
            isMuted.value = !isMuted.value; // Kembalikan state jika gagal
        }
    };

    const resetVoiceCallState = () => {
        console.log('🔄 RESET VOICE CALL STATE - Memulai reset...');
        
        // ✅ RESET subscribed users
        subscribedUsers.value.clear();
        
        if (callTimeoutRef.value) {
            clearTimeout(callTimeoutRef.value);
            callTimeoutRef.value = null;
            console.log('⏰ Timer timeout dihapus');
        }
        stopCallTimeout();

        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
            incomingCallTimeout = null;
        }

        callStartTime.value = null;
        isInVoiceCall.value = false;
        voiceCallType.value = null;
        callTimeoutCountdown.value = null;
        
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

        // Hapus event listeners lama untuk menghindari duplikasi
        client.value.removeAllListeners();

        // ✅ PERBAIKAN: User published event dengan validasi yang lebih ketat
        client.value.on('user-published', async (user: any, mediaType: string) => {
            if (mediaType !== 'audio') return;
            
            const userId = user.uid;
            console.log(`🔊 User published audio: ${userId}`);
            
            // ✅ CEK: Apakah user sudah di-subscribe?
            if (subscribedUsers.value.has(userId)) {
                console.log(`⚠️ User ${userId} sudah di-subscribe, skip...`);
                return;
            }
            
            // ✅ CEK: Apakah user masih di channel?
            if (!user || user.uid === undefined) {
                console.warn('⚠️ Invalid user object, skipping subscribe');
                return;
            }

            // ✅ TUNGGU SEBENTAR sebelum subscribe (hindari race condition)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // ✅ LOGIKA SUBSCRIBE DENGAN ERROR HANDLING YANG LEBIH BAIK
            const maxRetries = 3;
            const retryDelay = 1000;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`🔍 Mencoba subscribe ke user ${userId}, percobaan ke-${attempt}...`);
                    
                    // ✅ CEK: Apakah client masih terhubung?
                    if (client.value.connectionState !== 'CONNECTED') {
                        console.warn(`⚠️ Client not connected, cannot subscribe to user ${userId}`);
                        return;
                    }
                    
                    // ✅ CEK: Apakah user masih available?
                    const remoteUsers = client.value.remoteUsers;
                    const userStillInChannel = remoteUsers.some((u: any) => u.uid === userId);
                    
                    if (!userStillInChannel) {
                        console.warn(`⚠️ User ${userId} sudah keluar dari channel, skip subscribe`);
                        return;
                    }
                    
                    // ✅ LAKUKAN SUBSCRIBE
                    await client.value.subscribe(user, 'audio');
                    
                    // ✅ CEK: Apakah audio track tersedia setelah subscribe?
                    if (user.audioTrack) {
                        // ✅ TANDAI USER SUDAH DI-SUBSCRIBE
                        subscribedUsers.value.add(userId);
                        
                        remoteAudioTrack.value[userId] = user.audioTrack;
                        
                        // ✅ TUNGGU SEBENTAR SEBELUM PLAY (hindari race condition)
                        setTimeout(() => {
                            try {
                                user.audioTrack.play();
                                console.log(`✅ Berhasil memutar audio dari user: ${userId}`);
                            } catch (playError) {
                                console.warn(`⚠️ Gagal memutar audio dari ${userId}:`, playError);
                            }
                        }, 500);
                        
                        console.log(`✅ Berhasil subscribe ke user: ${userId}`);
                        return; // Berhasil, keluar dari loop
                    } else {
                        throw new Error('Audio track tidak ditemukan setelah subscribe berhasil');
                    }
                    
                } catch (error: any) {
                    console.warn(`❌ Gagal subscribe percobaan ke-${attempt} untuk user ${userId}:`, error);
                    
                    // ✅ HANDLE ERROR SPECIFIC
                    if (error.code === 'CANNOT_SUBSCRIBE_STREAM' || 
                        error.message?.includes('not in the channel')) {
                        console.warn(`⚠️ User ${userId} tidak dalam channel, stop retry`);
                        return;
                    }
                    
                    if (attempt < maxRetries) {
                        console.log(`🔄 Menunggu ${retryDelay}ms sebelum retry...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        console.error(`❌ Gagal total subscribe ke user ${userId} setelah ${maxRetries} percobaan`);
                        // Jangan alert di sini, biarkan flow continue
                    }
                }
            }
        });
        
        // ✅ PERBAIKAN: User unpublished event
        client.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                const userId = user.uid;
                console.log(`🔇 User unpublished audio: ${userId}`);
                
                // ✅ HAPUS DARI SUBSCRIBED USERS
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
            
            // ✅ HAPUS DARI SUBSCRIBED USERS
            subscribedUsers.value.delete(userId);
            
            if (remoteAudioTrack.value[userId]) {
                try {
                    remoteAudioTrack.value[userId].stop();
                } catch (e) {
                    // Ignore stop errors
                }
                delete remoteAudioTrack.value[userId];
            }
            
            // ✅ RESET JIKA TIDAK ADA USER LAGI
            if (Object.keys(remoteAudioTrack.value).length === 0 && 
                client.value.remoteUsers.length === 0) {
                console.log('📞 Tidak ada user lain di channel, reset state');
                // Jangan reset otomatis, biarkan user yang memutuskan
            }
        });

        // ✅ LISTENER LAINNYA TETAP SAMA
        client.value.on('connection-state-change', (curState: string, prevState: string) => {
            console.log('🔗 Connection state changed:', prevState, '→', curState);
        });
        
        client.value.on('network-quality', (quality: any) => {
            console.log('📶 Network quality:', quality);
        });

        client.value.on('user-joined', (user: any) => {
            console.log('👤 User joined channel:', user.uid);
        });

        client.value.on('exception', (event: any) => {
            console.error('❌ Agora exception:', event);
        });

        console.log('✅ Audio listeners setup completed');
    };

    const checkCodecSupport = async (): Promise<void> => {
        try {
            console.log('🔍 Checking codec support...');
            
            // --- PERBAIKAN 1: Mengubah getSupportedCodecs menjadi getSupportedCodec ---
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
            console.log('🎯 Memulai proses join channel:', channelName);
            
            // ✅ RESET SUBSCRIBED USERS SEBELUM JOIN BARU
            subscribedUsers.value.clear();
            
            // 1. Bersihkan koneksi sebelumnya
            if (client.value && client.value.connectionState !== 'DISCONNECTED') {
                console.log('🔄 Membersihkan koneksi sebelumnya...');
                await client.value.leave();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 2. Buat client baru
            client.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            
            // 3. Setup listeners SEBELUM join
            setupAudioListeners();

            // 4. Minta token
            const response = await axios.post('/call/token', {
                channel: channelName,
                uid: currentUserId.value.toString(),
            });
            
            const { app_id, token, uid } = response.data;
            if (!app_id) throw new Error('App ID tidak ditemukan dari server');
            
            console.log('🔑 Token received, joining channel...');
            
            // 5. Join channel dengan timeout
            const joinPromise = client.value.join(app_id, channelName, token, uid);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Join timeout setelah 10 detik')), 10000)
            );
            
            await Promise.race([joinPromise, timeoutPromise]);
            console.log(`✅ Berhasil join ke channel: ${channelName}`);

            // 6. Setup audio track
            console.log('🎵 Setting up audio track...');
            
            if (localAudioTrack.value) {
                try {
                    localAudioTrack.value.stop();
                    localAudioTrack.value.close();
                } catch (error) {
                    console.warn('Error closing existing track:', error);
                }
                localAudioTrack.value = null;
            }

            // Buat track baru
            try {
                localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                    encoderConfig: 'music_standard',
                    AEC: true,
                    ANS: true,
                    AGC: true
                });
                console.log('✅ Audio track created successfully');
            } catch (error) {
                console.warn('Music standard failed, trying basic config...');
                localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
                console.log('✅ Audio track created with basic config');
            }

            // Pastikan track enabled
            await localAudioTrack.value.setEnabled(true);
            isMuted.value = false;

            // 7. Publish track
            console.log('📤 Publishing audio track...');
            await client.value.publish([localAudioTrack.value]);
            console.log('🎤 Audio track published successfully');

            // 8. Test audio playback
            try {
                const volume = localAudioTrack.value.getVolumeLevel();
                console.log('📊 Audio level:', volume);
            } catch (levelError) {
                console.warn('Cannot get audio level:', levelError);
            }

            isInVoiceCall.value = true;
            console.log('🎉 Join channel process completed successfully');
            return true;
                
        } catch (error: any) {
            console.error('❌ Gagal dalam proses join channel:', error);
            
            // Debug detailed error
            if (error.code) {
                console.error('Agora error code:', error.code);
            }
            if (error.message) {
                console.error('Error message:', error.message);
            }
            
            const errorMessage = error.message || 'Error tidak diketahui';
            alert(`Gagal terhubung ke panggilan: ${errorMessage}`);
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
        
        // ✅ PERBAIKAN: CALLER TIDAK JOIN CHANNEL DULUAN!
        // Hanya setup outgoing call data, TANPA join channel
        
        // Setup outgoing call data dengan status 'calling'
        outgoingCallVoice.value = {
            callId: call_id,
            callee: contact,
            callType: 'voice',
            channel: channel,
            status: 'calling' // Status masih memanggil, belum terhubung
        };

        activeCallData.value = {
            callId: call_id,
            channel: channel,
            caller: { id: currentUserId.value, name: currentUserName.value },
            callee: { id: contact.id, name: contact.name },
            callType: 'voice',
            isCaller: true,
            status: 'calling' // Tambahkan status
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
                status: 'connected' // Status sudah terhubung
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
                const reason = data.reason ? ` - Alasan: ${data.reason}` : '';
                alert(`Panggilan diakhiri oleh ${endedByName}${reason}`);
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
    })
        
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

    /**
     * Handle incoming call timeout
     */
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
        resetVoiceCallState();
    });

    return {
        isInVoiceCall, 
        localAudioTrack, 
        remoteAudioTrack, 
        incomingCallVoice,
        outgoingCallVoice, 
        activeCallData, 
        client,
        startVoiceCall, 
        answerVoiceCall, 
        endVoiceCallWithReason,
        initializePersonalCallListeners, 
        callTimeoutCountdown,
        resetVoiceCallState
    };
}