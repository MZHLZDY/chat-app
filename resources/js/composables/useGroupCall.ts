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

let globalListenersInitialized = false;
let currentGroupListeners: string | null = null;

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
                console.log('🔊 User published audio:', user.uid);
                
                // Add delay to avoid race condition
                await new Promise(resolve => setTimeout(resolve, 300));
                
                try {
                    await safeSubscribeToUser(user, mediaType);
                } catch (error) {
                    console.error('Error in user-published handler:', error);
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
    const safeSubscribeToUser = async (user: any, mediaType: string, retryCount = 0) => {
        try {
            // Check if user is still valid
            if (!user || !user.uid) {
                console.warn('⚠️ Invalid user object, skipping subscribe');
                return;
            }
            
            await groupClient.value.subscribe(user, mediaType);
            
            if (user.audioTrack) {
                groupRemoteAudioTracks.value[user.uid] = user.audioTrack;
                
                // Play audio with delay and error handling
                setTimeout(() => {
                    try {
                        user.audioTrack.play();
                        console.log(`🔊 Successfully playing audio from user: ${user.uid}`);
                    } catch (playError) {
                        console.warn(`⚠️ Failed to play audio from ${user.uid}:`, playError);
                    }
                }, 500);
            }
            
        } catch (error: any) {
            if (error.code === 'INVALID_REMOTE_USER') {
                console.warn(`⚠️ User ${user.uid} not in channel, skipping subscribe`);
                return;
            }
            
            // Retry for other errors (max 2 retries)
            if (retryCount < 2) {
                console.log(`🔄 Retrying subscribe to ${user.uid} (attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return safeSubscribeToUser(user, mediaType, retryCount + 1);
            }
            
            console.error(`❌ Failed to subscribe to user ${user.uid} after ${retryCount} retries:`, error);
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

// --- IMPROVED JOIN GROUP CHANNEL FUNCTION WITH UID CONFLICT HANDLING ---
// --- PERBAIKAN JOIN GROUP CHANNEL FUNCTION DENGAN TYPE SAFETY ---
const joinGroupChannel = async (channelName: string): Promise<boolean> => {
    try {
        console.log('🔑 Requesting Agora group token for channel:', channelName);
        
        // 1. Unlock audio context first
        await unlockAudioContext();
        
        // 2. Check client state and cleanup if needed
        const connectionState = groupClient.value.connectionState;
        console.log('📊 Current connection state:', connectionState);
        
        // PERBAIKAN: Handle state lebih hati-hati
        if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
            console.log('🔄 Client already connected, leaving first...');
            await safeLeaveGroupChannel();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 3. Request token from server
        const response = await axios.post('/group-call/token', {
            channel: channelName,
            uid: '0', // SELALU gunakan 0 untuk auto-generate UID
            role: 'publisher'
        });
        
        console.log('✅ Group token response:', response.data);
        
        const { token, app_id } = response.data;
        
        if (!app_id) {
            throw new Error('Invalid app_id from server');
        }
        
        // 4. Setup audio listeners BEFORE join
        setupGroupAudioListeners();
        
        // 5. Join channel - biarkan Agora generate UID otomatis
        console.log('🔄 Joining Agora group channel with AppID:', app_id);
        
        await groupClient.value.join(
            app_id,
            channelName,
            token || null
            // Biarkan UID kosong untuk auto-generate oleh Agora
        );
        
        console.log('✅ Successfully joined Agora group channel');
        
        // 6. Wait sebelum publishing audio
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 7. Setup dan publish audio track
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
            
            // Wait sebelum publish
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Publish audio track ke channel
            await groupClient.value.publish([groupLocalAudioTrack.value]);
            console.log('✅ Successfully published audio to group channel');
            
        } catch (audioError: any) {
            console.error('❌ Failed to setup audio track:', audioError);
            
            if (audioError.name === 'NOT_SUPPORTED' || audioError.name === 'PERMISSION_DENIED') {
                alert('Microphone permission is required for voice calls. Please allow microphone access.');
            }
            
            // Leave channel jika audio setup fails
            await safeLeaveGroupChannel();
            throw audioError;
        }
        
        return true;
        
    } catch (error: unknown) {
        console.error('❌ Join group channel error:', error);
        
        // PERBAIKAN: Type-safe error handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code;
        
        // Handle UID_CONFLICT secara spesifik
        if (errorCode === 'UID_CONFLICT' || errorMessage.includes('UID_CONFLICT')) {
            console.log('🔄 UID conflict detected, retrying with simple approach...');
            try {
                await safeLeaveGroupChannel();
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                return await joinGroupChannelSimple(channelName);
            } catch (retryError: unknown) {
                // PERBAIKAN: Type-safe retry error handling
                const retryErrorMessage = retryError instanceof Error ? retryError.message : 'Unknown retry error';
                const retryErrorCode = (retryError as any)?.code;
                
                console.error('❌ UID conflict retry failed:', retryErrorMessage);
                
                if (retryErrorCode === 'UID_CONFLICT') {
                    console.log('🔄 Trying fallback UID strategy...');
                    await safeLeaveGroupChannel();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    return await joinGroupChannelSimple(channelName);
                }
                
                throw retryError;
            }
        }
        
        // Handle WS_ABORT error
        if (errorCode === 'WS_ABORT' || errorMessage.includes('WS_ABORT') || errorMessage.includes('LEAVE')) {
            console.log('🔄 WS_ABORT detected, retrying with delay...');
            try {
                await safeLeaveGroupChannel();
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                return await joinGroupChannelSimple(channelName);
            } catch (retryError: unknown) {
                console.error('❌ WS_ABORT retry failed:', retryError);
                // WS_ABORT sering tidak fatal, bisa continue
                return true;
            }
        }
        
        // Handle error lainnya
        if (errorMessage.includes('already in connecting/connected state') || 
            errorMessage.includes('OPERATION_ABORTED') ||
            errorCode === 'OPERATION_ABORTED') {
            
            console.log('🔄 Operation aborted, cleaning up and retrying...');
            try {
                await safeLeaveGroupChannel();
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await joinGroupChannel(channelName);
            } catch (retryError: unknown) {
                console.error('❌ Group retry failed:', retryError);
                throw retryError;
            }
        }
        
        // Handle Agora specific errors
        if (errorCode) {
            switch (errorCode) {
                case 'CANNOT_JOIN_CHANNEL':
                    alert('Cannot join channel. Please try again.');
                    break;
                case 'INVALID_CHANNEL_NAME':
                    alert('Invalid channel name.');
                    break;
                case 'INVALID_TOKEN':
                    alert('Invalid token. Please refresh the page.');
                    break;
                case 'OPERATION_ABORTED':
                    alert('Join operation was cancelled. Please try again.');
                    break;
                case 'UID_CONFLICT':
                    alert('User already in call. Please try again.');
                    break;
                case 'WS_ABORT':
                    alert('Connection was interrupted. Please try again.');
                    break;
                default:
                    alert('Error joining call: ' + errorMessage);
            }
        }
        
        throw error;
    }
};

// SIMPLE JOIN FUNCTION untuk fallback (type-safe)
const joinGroupChannelSimple = async (channelName: string): Promise<boolean> => {
    try {
        console.log('🔑 [SIMPLE] Requesting Agora group token for channel:', channelName);
        
        // Request token
        const response = await axios.post('/group-call/token', {
            channel: channelName,
            uid: '0',
            role: 'publisher'
        });
        
        const { token, app_id } = response.data;
        
        if (!app_id) {
            throw new Error('Invalid app_id from server');
        }
        
        // Join dengan approach paling simple
        await groupClient.value.join(app_id, channelName, token || null);
        console.log('✅ [SIMPLE] Successfully joined channel');
        
        // Setup audio track
        if (groupLocalAudioTrack.value) {
            try {
                groupLocalAudioTrack.value.stop();
                groupLocalAudioTrack.value.close();
            } catch (e) {
                // Ignore errors
            }
            groupLocalAudioTrack.value = null;
        }
        
        groupLocalAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
        await groupClient.value.publish([groupLocalAudioTrack.value]);
        console.log('✅ [SIMPLE] Successfully published audio');
        
        return true;
    } catch (error: unknown) {
        console.error('❌ [SIMPLE] Join failed:', error);
        throw error;
    }
};

// PERBAIKAN: Safe leave function
const safeLeaveGroupChannel = async () => {
    try {
        console.log('🚪 Safely leaving group channel...');
        
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
        
        // Leave channel jika connected
        if (groupClient.value && groupClient.value.connectionState !== 'DISCONNECTED') {
            await groupClient.value.leave();
            // PERBAIKAN: Tambahkan delay setelah leave
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('✅ Successfully left group channel');
    } catch (error) {
        console.error('❌ Error leaving group channel:', error);
    }
};

    // Ganti semua pemanggilan leaveGroupChannel dengan safeLeaveGroupChannel
    const leaveGroupChannel = safeLeaveGroupChannel;

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
        leaveDynamicGroupChannel(); // TAMBAHKAN INI
        isGroupVoiceCallActive.value = false;
        groupVoiceCallData.value = null;
        isGroupCaller.value = false;
    };
    // --- GROUP CALL TIMEOUT FUNCTIONS ---
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
                stopGroupCallTimeout();
                return;
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
                
                // 4. Tutup UI panggilan setelah jeda singkat
                setTimeout(() => {
                    isGroupVoiceCallActive.value = false;
                    groupVoiceCallData.value = null;
                }, 1500);
            }
        }
    };

    const stopGroupCallTimeout = () => {
        if (groupCallCountdownInterval) {
            clearInterval(groupCallCountdownInterval);
            groupCallCountdownInterval = null;
        }
        groupCallTimeoutCountdown.value = null;
        
        if (groupCallTimeoutRef.value) {
            clearTimeout(groupCallTimeoutRef.value);
            groupCallTimeoutRef.value = null;
        }
    };

    // --- GROUP CALL ACTIONS ---
    const acceptGroupCall = async (callId: string): Promise<void> => {
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
                // PERBAIKAN: Approach yang lebih robust untuk join
                let retryCount = 0;
                const maxRetries = 2;
                
                while (retryCount <= maxRetries) {
                    try {
                        // Pastikan state clean sebelum join
                        if (groupClient.value.connectionState !== 'DISCONNECTED') {
                            console.log('🔄 Cleaning up previous connection...');
                            await safeLeaveGroupChannel();
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        
                        await joinGroupChannel(groupVoiceCallData.value.channel);
                        console.log('🎉 Callee successfully joined group channel');
                        break;
                        
                    } catch (error: unknown) {
                        retryCount++;
                        
                        // PERBAIKAN: Type-safe error handling
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        const errorCode = (error as any)?.code;
                        
                        // Handle WS_ABORT secara spesifik
                        if (errorCode === 'WS_ABORT' || errorMessage.includes('WS_ABORT')) {
                            console.log(`🔄 WS_ABORT detected, retry ${retryCount}/${maxRetries}`);
                            
                            if (retryCount > maxRetries) {
                                console.error('❌ Max retries exceeded for WS_ABORT');
                                // WS_ABORT biasanya tidak fatal, continue saja
                                break;
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
                            continue;
                        }
                        
                        // Handle UID_CONFLICT
                        if (errorCode === 'UID_CONFLICT') {
                            console.log(`🔄 UID conflict detected, retry ${retryCount}/${maxRetries}`);
                            
                            if (retryCount > maxRetries) {
                                console.error('❌ Max retries exceeded for UID conflict');
                                alert('Unable to join call due to user conflict. Please try again later.');
                                throw error;
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                            continue;
                        }
                        
                        // Untuk error lainnya
                        if (retryCount > maxRetries) {
                            throw error;
                        }
                        
                        console.log(`🔄 Retry ${retryCount}/${maxRetries} for joining channel...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }
        }
        
    } catch (error: unknown) {
        console.error('❌ Failed to accept group call:', error);
        
        // PERBAIKAN: Type-safe error handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code;
        
        if (errorCode === 'WS_ABORT' || errorMessage.includes('WS_ABORT')) {
            console.warn('⚠️ WS_ABORT error, but call might still be connected');
            // WS_ABORT seringkali tidak fatal, bisa continue
        } else if (errorCode === 'UID_CONFLICT') {
            alert('You appear to be already in this call. Please wait or refresh the page.');
        } else if (errorMessage.includes('OPERATION_ABORTED')) {
            alert('Join operation was cancelled. Please try answering the call again.');
        } else {
            alert('Failed to accept call: ' + errorMessage);
        }
        
        // Reset state hanya jika error fatal
        if (errorCode !== 'WS_ABORT') {
            resetGroupCallState();
        }
    }
};

    const rejectGroupCall = async (callId: string, reason: string = 'Ditolak oleh penerima') => {
        try {
            console.log('❌ Menolak panggilan grup:', callId, 'Alasan:', reason);
            
            const response = await axios.post('/group-call/answer', {
                call_id: callId,
                group_id: groupVoiceCallData.value?.group?.id,
                accepted: false,
                reason: reason
            });
            
            console.log('✅ Group call reject response:', response.data);
            
            if (groupVoiceCallData.value) {
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === currentUserId.value
                );
                
                if (participantIndex !== undefined && participantIndex !== -1 && groupVoiceCallData.value.participants) {
                    groupVoiceCallData.value.participants[participantIndex].status = 'rejected';
                    groupVoiceCallData.value.participants[participantIndex].reason = reason;
                }
            }
            
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
        if (!groupVoiceCallData.value || !groupVoiceCallData.value.group) {
            console.error('Tidak ada data panggilan grup untuk diakhiri, mereset secara lokal.');
            resetGroupCallState();
            return;
        }

        try {
            console.log('📞 Membubarkan panggilan grup:', callId);

            await axios.post('/group-call/end', {
                call_id: callId,
                group_id: groupVoiceCallData.value.group.id,
                reason: 'Dibubarkan oleh host'
            });

            console.log('✅ Perintah bubarkan berhasil dikirim.');

        } catch (error: any) {
            console.error('❌ Gagal membubarkan panggilan grup:', error);
            alert('Gagal membubarkan panggilan.');
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

            const participantIds = groupVoiceCallData.value.participants.map((p: any) => p.id);

            await axios.post('/group-call/cancel', {
                call_id: callId,
                participant_ids: participantIds
            });

            resetGroupCallState();

        } catch (error: any) {
            console.error('❌ Gagal membatalkan panggilan grup:', error);
            alert('Gagal membatalkan panggilan.');
            resetGroupCallState();
        }
    };

    const handleLeaveGroupCall = async () => {
        console.log('🚶 Meninggalkan panggilan grup...');
        
        if (!groupVoiceCallData.value) {
            return resetGroupCallState();
        }

        try {
            await axios.post('/group-call/leave', { 
                call_id: groupVoiceCallData.value.callId,
                group_id: groupVoiceCallData.value.group?.id
            });
            console.log('✅ Notifikasi keluar berhasil dikirim ke server.');
        } catch (error) {
            console.error("Gagal memberitahu server saat leave call:", error);
        } finally {
            resetGroupCallState();
        }
    };

    const handleRecallParticipant = async (participantId: number) => {
        if (!groupVoiceCallData.value || !groupVoiceCallData.value.participants) return;

        console.log(`📞 Memanggil kembali peserta dengan ID: ${participantId}`);
        try {
            await axios.post('/group-call/recall', {
                call_id: groupVoiceCallData.value.callId,
                group_id: groupVoiceCallData.value.group?.id,
                user_id_to_recall: participantId,
                current_participants: groupVoiceCallData.value.participants
            });

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

    // --- EVENT LISTENERS ---
    const initializeGlobalListeners = () => {
        if (globalListenersInitialized) {
            console.log('⚠️ Global listeners sudah terpasang, skip...');
            return;
        }

        const userId = currentUserId.value;
        if (!userId) return;

        const privateChannel = echo.private(`user.${userId}`);
        console.log(`🎧 Setting up GLOBAL listeners on channel: user.${userId}`);

        // Group incoming call event
        privateChannel.listen('.group-incoming-call', (data: any) => {
            console.log('📞 EVENT .group-incoming-call RECEIVED:', data);
            
            // Hentikan panggilan aktif jika ada
            if (isGroupVoiceCallActive.value) {
                console.log('⚠️ Ada panggilan aktif, reset dulu...');
                resetGroupCallState();
            }

            const isHost = data.caller.id === currentUserId.value;
            
            groupVoiceCallData.value = {
                callId: data.callId,
                group: data.group,
                caller: data.caller,
                callType: data.callType,
                channel: data.channel,
                status: isHost ? 'calling' : 'ringing',
                participants: data.participants
            };
            
            isGroupVoiceCallActive.value = true;
            isGroupCaller.value = isHost;
            
            // Setup dynamic listeners untuk group ini
            setupDynamicGroupListeners(data.group.id);
            
            if (isHost) {
            console.log('📞 Event panggilan grup diterima (diabaikan karena saya adalah Host)');
            return;
        }

        // Jika bukan host, berarti dia adalah PESERTA yang diundang.
        console.log('📞 Panggilan grup masuk (diterima sebagai Peserta):', data);
        
        if (isGroupVoiceCallActive.value) {
            console.log('⚠️ Sedang dalam panggilan lain, panggilan grup baru diabaikan.');
            return;
        }
        
        // Atur state untuk menampilkan UI panggilan masuk di sisi Peserta
        groupVoiceCallData.value = { ...data, status: 'ringing' };
        isGroupVoiceCallActive.value = true;
        isGroupCaller.value = false;

        // Mulai timer timeout untuk Peserta
        startGroupCallTimeout(30);
    });
        
        privateChannel.listen('.group-call-cancelled', (data: any) => {
            console.log('🚫 EVENT .group-call-cancelled RECEIVED:', data);
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.callId) {
                alert(`Group call cancelled by ${data.caller.name}`);
                resetGroupCallState();
            }
        });

        // HAPUS listener .group-call-answered dan .group-call-ended dari sini
        // karena akan ditangani oleh dynamic group listeners

        globalListenersInitialized = true;
    };

    const setupDynamicGroupListeners = (groupId: number) => {
        const newChannelName = `group.${groupId}`;
        
        // Jika sudah listening ke channel yang sama, skip
        if (currentGroupListeners === newChannelName) {
            console.log(`⚠️ Sudah mendengarkan channel ${newChannelName}, skip...`);
            return;
        }
        
        // Hentikan listener sebelumnya jika ada
        leaveDynamicGroupChannel();
        
        currentGroupListeners = newChannelName;
        console.log(`🎧 Mulai mendengarkan channel grup: ${newChannelName}`);
        
        const groupChannel = echo.private(newChannelName);

        // Listener untuk participant menjawab panggilan
        groupChannel.listen('.group-call-answered', (data: any) => {
            console.log('✅ EVENT .group-call-answered RECEIVED:', data);

            if (!groupVoiceCallData.value || groupVoiceCallData.value.callId !== data.call_id) {
                return;
            }

            // Update participant status
            const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                (p: any) => p.id === data.user.id
            );
            
            if (participantIndex !== undefined && participantIndex > -1 && groupVoiceCallData.value.participants) {
                groupVoiceCallData.value.participants[participantIndex].status = data.accepted ? 'accepted' : 'rejected';
                groupVoiceCallData.value.participants[participantIndex].reason = data.reason || null;
            }

            // Jika participant menerima panggilan
            if (data.accepted) {
                // Untuk HOST: stop timeout jika ada participant yang join
                if (isGroupCaller.value && groupVoiceCallData.value.status === 'calling') {
                    console.log('🎉 Participant joined! Changing host status to "accepted"');
                    stopGroupCallTimeout();
                    groupVoiceCallData.value.status = 'accepted';
                }
                
                // Untuk PARTICIPANT: join channel jika menerima panggilan
                if (!isGroupCaller.value && data.user.id === currentUserId.value) {
                    console.log('🎉 Participant accepting call, joining channel...');
                    stopGroupCallTimeout();
                    
                    if (groupVoiceCallData.value.channel) {
                        joinGroupChannel(groupVoiceCallData.value.channel).then(() => {
                            console.log('✅ Participant successfully joined group channel');
                            groupVoiceCallData.value.status = 'accepted';
                        }).catch(error => {
                            console.error('❌ Participant failed to join channel:', error);
                        });
                    }
                }
            }

            // Cek jika ada participant yang accepted, stop timeout
            const acceptedParticipants = groupVoiceCallData.value.participants?.filter(
                (p: any) => p.status === 'accepted'
            );
            
            if (acceptedParticipants && acceptedParticipants.length > 0) {
                stopGroupCallTimeout();
            }
        });

        // Listener untuk panggilan berakhir
        groupChannel.listen('.group-call-ended', (data: any) => {
            console.log('🚫 EVENT .group-call-ended RECEIVED:', data);
            
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                if (data.ended_by.id !== currentUserId.value) {
                    alert(`Panggilan dibubarkan oleh ${data.ended_by.name}`);
                }
                resetGroupCallState();
            }
        });

        // Listener untuk participant meninggalkan panggilan
        groupChannel.listen('.group-participant-left', (data: any) => {
            console.log('🚶 EVENT .group-participant-left RECEIVED:', data);
            
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === data.user.id
                );
                
                if (participantIndex !== undefined && participantIndex > -1 && groupVoiceCallData.value.participants) {
                    groupVoiceCallData.value.participants[participantIndex].status = 'left';
                    console.log(`Status partisipan ${data.user.name} diubah menjadi 'left'`);
                }
            }
        });

        // Listener untuk participant dipanggil ulang
        groupChannel.listen('.group-participant-recalled', (data: any) => {
            console.log('📞 EVENT .group-participant-recalled RECEIVED:', data);
            
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
                const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === data.user.id
                );
                
                if (participantIndex > -1) {
                    groupVoiceCallData.value.participants[participantIndex].status = 'calling';
                    console.log(`Peserta ${data.user.name} dipanggil ulang`);
                }
            }
        });
    };

    const leaveDynamicGroupChannel = () => {
        if (currentGroupListeners) {
            echo.leave(currentGroupListeners);
            console.log(`🔌 Berhenti mendengarkan channel grup: ${currentGroupListeners}`);
            currentGroupListeners = null;
        }
    };

    // Initialize audio listeners when composable is created
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