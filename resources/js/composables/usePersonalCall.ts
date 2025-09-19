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
const client = ref<any>(null); // Diubah jadi null, akan diinisialisasi nanti
const incomingCallVoice = ref<any>(null);
const outgoingCallVoice = ref<any>(null);
const activeCallData = ref<any>(null);
const callTimeoutRef = ref<NodeJS.Timeout | null>(null);
const callStartTime = ref<number | null>(null);
const callTimeoutCountdown = ref<number | null>(null);
let countdownInterval: NodeJS.Timeout | null = null;
let incomingCallTimeout: NodeJS.Timeout | null = null;

export function usePersonalCall() {
    const page = usePage<PageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);

    // Inisialisasi client Agora
    const initializeAgoraClient = () => {
        if (!client.value) {
            client.value = AgoraRTC.createClient({ 
                mode: 'rtc', 
                codec: 'vp8',
                // Tambahkan config audio untuk kualitas lebih baik
                // audio: {
                //     codec: 'opus',
                //     sampleRate: 48000,
                //     channelCount: 1,
                //     bitrate: 48
                // }
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

    const resetVoiceCallState = () => {
        console.log('🔄 RESET VOICE CALL STATE - Memulai reset...');
        
        if (callTimeoutRef.value) {
            clearTimeout(callTimeoutRef.value);
            callTimeoutRef.value = null;
            console.log('⏰ Timer timeout dihapus');
        }
        stopCallTimeout();

        // Hapus incoming call timeout
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

        // Hapus event listeners lama jika ada
        client.value.removeAllListeners();

        client.value.on('user-published', async (user: any, mediaType: string) => {
            console.log('📡 User published:', user.uid, 'Media type:', mediaType);
            
            if (mediaType === 'audio') {
                try {
                    await client.value.subscribe(user, mediaType);
                    console.log(`✅ Subscribed to remote audio from UID: ${user.uid}`);
                    
                    if (user.audioTrack) {
                        remoteAudioTrack.value[user.uid] = user.audioTrack;
                        user.audioTrack.play();
                        console.log(`🔊 Playing remote audio from UID: ${user.uid}`);
                    } else {
                        console.error('❌ Remote audio track not found after subscribing.');
                    }
                    
                } catch (error) {
                    console.error(`❌ Error subscribing to remote audio from UID: ${user.uid}`, error);
                }
            }
        });
        
        client.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                console.log('🔇 Remote user audio unpublished:', user.uid);
                if (remoteAudioTrack.value[user.uid]) {
                    remoteAudioTrack.value[user.uid].stop();
                    delete remoteAudioTrack.value[user.uid];
                }
            }
        });
        
        client.value.on('connection-state-change', (curState: string, prevState: string) => {
            console.log('🔗 Connection state changed:', prevState, '→', curState);
        });
        
        client.value.on('network-quality', (quality: any) => {
            console.log('📶 Network quality:', quality);
        });

        client.value.on('user-joined', (user: any) => {
            console.log('👤 User joined channel:', user.uid);
        });

        client.value.on('user-left', (user: any, reason: string) => {
            console.log('👤 User left channel:', user.uid, 'Reason:', reason);
        });

        client.value.on('exception', (event: any) => {
            console.error('❌ Agora exception:', event);
        });

        console.log('✅ Audio listeners setup completed');
    };

    const joinChannel = async (channelName?: string) => { 
        try {
            // Inisialisasi client jika belum ada
            initializeAgoraClient();
            
            const channel = channelName || `call-${activeContact.value?.id}`;
            
            console.log('🔑 Requesting Agora token for channel:', channel);
            
            const connectionState = client.value.connectionState;
            console.log('📊 Current connection state:', connectionState);
            
            if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
                console.log('🔄 Client already connected, leaving first...');
                await client.value.leave();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const audioSetupSuccess = await setupAudio();
            if (!audioSetupSuccess) {
                throw new Error('Audio setup failed');
            }
            
            const response = await axios.post('/call/token', {
                channel: channel,
                uid: currentUserId.value.toString(),
                role: 'publisher'
            });
            
            const { token, app_id, uid } = response.data;
            
            console.log('🔄 Joining Agora channel with AppID:', app_id);
            
            await client.value.join(app_id, channel, token, uid || currentUserId.value.toString());
            console.log('✅ Successfully joined Agora channel');
            
            // ✅ SETUP LISTENERS SETELAH JOIN BERHASIL
            setupAudioListeners();
            
            if (!localAudioTrack.value) {
                console.error('❌ Local audio track is null!');
                throw new Error('No local audio track available');
            }
            
            await localAudioTrack.value.setEnabled(true);
            console.log('🎤 Local audio track enabled');
            
            try {
                await client.value.publish([localAudioTrack.value]);
                console.log('✅ Local audio published to channel');
                
                // Test audio levels
                const volume = localAudioTrack.value.getVolumeLevel();
                console.log('🔊 Audio level after publish:', volume);
                
                // Get publishing stats
                const stats = client.value.getLocalAudioStats();
                console.log('📊 Local audio publishing stats:', stats);
                
                startAudioLevelMonitoring();
                
            } catch (publishError) {
                console.error('❌ Failed to publish audio:', publishError);
                throw publishError;
            }
            
            return true;
            
        } catch (error: any) {
            console.error('❌ Join channel error:', error);
            
            if (localAudioTrack.value) {
                localAudioTrack.value.stop();
                localAudioTrack.value.close();
                localAudioTrack.value = null;
            }
            
            throw error;
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
            // HAPUS properti yang tidak didukung untuk audio track
            localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                encoderConfig: 'high_quality',
                AEC: true,     // Acoustic Echo Cancellation
                ANS: true,     // Automatic Noise Suppression
                AGC: true,     // Automatic Gain Control
                // HAPUS config berikut karena tidak didukung untuk audio:
                // codec: 'opus',
                // sampleRate: 48000,
                // channelCount: 1,
                // bitrate: 48
            });
            console.log('✅ Microphone audio track created with config');
        } catch (configError) {
            console.warn('⚠️ Standard config failed, trying basic...');
            localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
            console.log('✅ Microphone audio track created with basic config');
        }
        
        localAudioTrack.value.setVolume(100);
        
        const stream = localAudioTrack.value.getMediaStreamTrack();
        console.log('🎤 Audio track details:', {
            enabled: stream.enabled,
            readyState: stream.readyState,
            label: stream.label,
            muted: stream.muted
        });
        
        setTimeout(() => {
            if (localAudioTrack.value) {
                const volume = localAudioTrack.value.getVolumeLevel();
                console.log('📊 Initial audio level:', volume);
            }
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to setup audio:', error);
        return false;
    }
};

const checkAudioPermissions = async (): Promise<boolean> => {
    try {
        console.log('🔍 Checking audio permissions...');
        
        // Cek apakah browser support getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('❌ Browser tidak mendukung getUserMedia');
            return false;
        }
        
        // Coba akses microphone
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false 
        });
        
        console.log('✅ Microphone access granted');
        
        // Cek apakah ada audio tracks
        const audioTracks = stream.getAudioTracks();
        console.log('🎤 Audio tracks found:', audioTracks.length);
        
        if (audioTracks.length === 0) {
            console.error('❌ Tidak ada audio track yang ditemukan');
            return false;
        }
        
        // Log detail setiap audio track
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
        
        // Stop semua tracks
        audioTracks.forEach(track => track.stop());
        
        return true;
        
    } catch (error) {
        console.error('❌ Microphone access denied atau error:', error);
        return false;
    }
};

    const startVoiceCall = async (contact: Chat | null) => {
        await unlockAudioContext(); 
        
        if (!contact || contact.type !== 'user') {
            console.log('No active contact or contact is not a user');
            return;
        }

        const hasAudioPermission = await checkAudioPermissions();
          if (!hasAudioPermission) {
           alert('Tidak dapat mengakses microphone. Mohon berikan izin microphone.');
        return;
        }

        try {
            console.log('🚀 Starting voice call to:', contact.name);
            
            if (isInVoiceCall.value || outgoingCallVoice.value || incomingCallVoice.value) {
                resetVoiceCallState();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            stopCallTimeout();
            
            const response = await axios.post('/call/invite', {
                callee_id: contact.id,
                call_type: 'voice'
            });
            
            console.log('📞 Call invite response:', response.data);
            
            if (!response.data.call_id || !response.data.channel) {
                throw new Error('Invalid response from server - missing call_id or channel');
            }
            
            const callData = response.data;
            outgoingCallVoice.value = {
                callId: response.data.call_id,
                callee: contact,
                callType: 'voice',
                channel: response.data.channel,
                status: 'calling'
            };

            activeCallData.value = {
                callId: callData.call_id,
                channel: callData.channel,
                caller: { id: currentUserId.value, name: currentUserName.value },
                callee: { id: contact.id, name: contact.name },
                callType: 'voice',
                isCaller: true
            };
            
            callStartTime.value = Date.now();
            startCallTimeout(30);
            
            callTimeoutRef.value = setTimeout(() => {
                if (outgoingCallVoice.value?.status === 'calling') {
                    handleCallTimeout();
                }
            }, 30000);
            
        } catch (error: any) {
            console.error('❌ Failed to start call:', error);
            stopCallTimeout();
            alert('Gagal memulai panggilan');
        }
    };

    const answerVoiceCall = async (accepted: boolean, reason?: string) => {
        if (!incomingCallVoice.value) {
            console.error('❌ Tidak ada panggilan masuk untuk dijawab.');
            return;
        }

        const callId = incomingCallVoice.value.callId;
        const callerId = incomingCallVoice.value.caller.id;
        
        incomingCallVoice.value = null;

        try {
            await axios.post('/call/answer', {
                call_id: callId,
                caller_id: callerId,
                accepted: accepted,
                reason: accepted ? null : (reason || 'Ditolak')
            });

            console.log(`✅ Permintaan 'answerCall' (accepted: ${accepted}) berhasil dikirim.`);
            
        } catch (error: any) {
            console.error('❌ Gagal mengirim jawaban panggilan:', error);
            alert('Gagal merespons panggilan.');
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
        const userId = currentUserId.value;
        if (!userId) return;

        const privateChannel = echo.private(`user.${userId}`);
        console.log(`🎧 Menyiapkan listener PANGGILAN PERSONAL di channel: user.${userId}`);
        
        privateChannel.listen('.incoming-call', (data: any) => {
            console.log('✅ EVENT incoming-call DITERIMA oleh LAWAN:', data);
            
            if (!data.caller) {
                console.error('❌ Data caller tidak ada dalam event');
                return;
            }
            
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
            
            console.log('📞 Panggilan masuk diproses oleh lawan:', incomingCallVoice.value);
            
            incomingCallTimeout = setTimeout(() => {
                if (incomingCallVoice.value?.callId === data.call_id) {
                    console.log('⏰ Auto rejecting call due to timeout (30 seconds)');
                    handleIncomingCallTimeout(data.call_id);
                }
            }, 30000);
            
            console.log('⏰ Timeout 30 detik dimulai untuk panggilan masuk');
        });
        
        privateChannel.listen('.call-ended', (data: any) => {
            console.log('📞 CALL ENDED EVENT DITERIMA:', data);
            
            if (incomingCallTimeout && incomingCallVoice.value && data.call_id === incomingCallVoice.value.callId) {
                clearTimeout(incomingCallTimeout);
                incomingCallTimeout = null;
                console.log('⏰ Timeout incoming call dibatalkan');
            }
            
            resetVoiceCallState();
            
            if (data.ended_by && data.ended_by.id !== currentUserId.value) {
                let endedByName = '';
                
                if (data.ended_by.name) {
                    endedByName = data.ended_by.name;
                } else if (data.ended_by.id) {
                    const endedByContact = contacts.value.find(contact => contact.id === data.ended_by.id);
                    if (endedByContact) {
                        endedByName = endedByContact.name;
                    } else {
                        const endedByUser = allUsers.value.find(user => user.id === data.ended_by.id);
                        endedByName = endedByUser ? endedByUser.name : `User ${data.ended_by.id}`;
                    }
                } else {
                    endedByName = 'Someone';
                }
                
                const reason = data.reason ? ` - Alasan: ${data.reason}` : '';
                alert(`Panggilan diakhiri oleh ${endedByName}${reason}`);
            }
        });
        
        privateChannel.listen('.call-accepted', (data: any) => {
            console.log('✅ EVENT .call-accepted DITERIMA:', data);

            outgoingCallVoice.value = null;
            
            if (callTimeoutRef.value) {
                clearTimeout(callTimeoutRef.value);
                callTimeoutRef.value = null;
                console.log('⏰ Timeout dibatalkan karena panggilan diterima');
            }

            activeCallData.value = {
                callId: data.call_id,
                channel: data.channel,
                caller: data.caller,
                callee: data.callee,
                isCaller: data.caller.id === currentUserId.value
            };

            isInVoiceCall.value = true;
            
            joinChannel(data.channel).catch(error => {
                console.error('❌ Gagal bergabung ke channel setelah panggilan diterima:', error);
                alert('Gagal terhubung ke panggilan.');
                resetVoiceCallState();
            });
        });
        
        privateChannel.listen('.call-started', (data: any) => {
            console.log('✅ CALL STARTED EVENT DITERIMA oleh CALLEE:', data);
            
            isInVoiceCall.value = true;
            voiceCallType.value = data.call_type || 'voice';
            
            incomingCallVoice.value = null;
        });
        
        privateChannel.listen('.call-rejected', (data: any) => {
            console.log('❌ CALL REJECTED EVENT DITERIMA:', data);
            
            if (callTimeoutRef.value) {
                clearTimeout(callTimeoutRef.value);
                callTimeoutRef.value = null;
                console.log('⏰ Timeout dibatalkan karena panggilan ditolak');
            }
            
            stopCallTimeout();
            
            if (outgoingCallVoice.value && outgoingCallVoice.value.callId === data.call_id) {
                console.log('❌ Panggilan ditolak oleh penerima');
                outgoingCallVoice.value.status = 'rejected';
                outgoingCallVoice.value.reason = data.reason || 'Panggilan Ditolak';
                
                setTimeout(() => {
                    resetVoiceCallState();
                }, 3000);
            } else {
                console.warn('❌ Outgoing call not found for rejected call:', data.call_id);
            }
            
            if (incomingCallVoice.value && incomingCallVoice.value.callId === data.call_id) {
                incomingCallVoice.value = null;
            }
        });
        
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
        isInVoiceCall, localAudioTrack, remoteAudioTrack, incomingCallVoice,
        outgoingCallVoice, activeCallData, client,
        startVoiceCall, answerVoiceCall, endVoiceCallWithReason,
        initializePersonalCallListeners, callTimeoutCountdown
    };
}