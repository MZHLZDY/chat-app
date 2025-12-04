import { ref, computed } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import { echo } from '../echo.js';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { AppPageProps, Chat, User } from '@/types/index.d.ts';
import { useCallNotification } from '@/composables/useCallNotification';
import { useContacts } from './useContacts';

// State variables
const { contacts } = useContacts();
const groupVoiceCallData = ref<any>(null);
const isGroupVoiceCallActive = ref(false);
const isGroupCaller = ref(false);
const groupCallTimeoutCountdown = ref<number | null>(null);
const activeGroupChannel = ref<string | null>(null);
const groupCallTimeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);
const { sendGroupCallNotification, closeNotification } = useCallNotification();
let groupCallCountdownInterval: ReturnType<typeof setTimeout> | null = null;

// Agora RTC instances
const groupClient = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const groupLocalAudioTrack = ref<any>(null);
const groupRemoteAudioTracks = ref<{ [uid: number]: any }>({});

// ✅ TAMBAHKAN: State untuk manual subscribe management
const groupSubscribedUsers = ref<Set<number>>(new Set());

const enrichUserData = (user: any): any => {
    if (!user || !user.id) return user;
    
    // Cari data lengkap dari contacts.value (yang dijamin punya profile_photo_url)
    const contactData = contacts.value.find(c => c.id === user.id);
    
    // Gabungkan data mentah dengan data kontak lengkap
    if (contactData) {
        return {
            ...user, // Data mentah (misalnya dari event)
            ...contactData, // Timpa dengan data lengkap (name, profile_photo_url, dll.)
            profile_photo_url: contactData.profile_photo_url // Pastikan properti ini diambil
        };
    }

    return user;
};

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
    const page = usePage<AppPageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);

    // ✅ FUNGSI BARU: Fast subscribe untuk group
    const fastSubscribeToGroupUser = async (user: any): Promise<boolean> => {
        const userId = user.uid;
        
        // Skip jika sudah subscribed
        if (groupSubscribedUsers.value.has(userId)) {
            console.log(`✅ Group User ${userId} already subscribed`);
            return true;
        }

        try {
            console.log(`⚡ GROUP FAST SUBSCRIBE: Attempting subscribe to user ${userId}`);
            
            // ⚡ LANGSUNG SUBSCRIBE TANPA VALIDASI BERLEBIHAN
            await groupClient.value.subscribe(user, 'audio');
            
            if (user.audioTrack) {
                groupSubscribedUsers.value.add(userId);
                groupRemoteAudioTracks.value[userId] = user.audioTrack;
                
                // ⚡ PLAY IMMEDIATELY
                try {
                    user.audioTrack.play();
                    console.log(`🎉 GROUP FAST SUCCESS: Audio dari user ${userId} BERHASIL!`);
                    return true;
                } catch (playError) {
                    console.warn(`⚠️ Group play failed for ${userId}:`, playError);
                    return false;
                }
            } else {
                console.warn(`⚠️ No audio track for group user ${userId}`);
                return false;
            }
            
        } catch (error: any) {
            console.warn(`❌ Group fast subscribe failed for ${userId}:`, error.message);
            return false;
        }
    };

    // ✅ FUNGSI BARU: Manual trigger untuk group subscribe
    const manuallyTriggerGroupSubscribe = async (immediate = false) => {
        console.log('🔊 GROUP MANUAL SUBSCRIBE: Starting...');
        
        if (!groupClient.value || groupClient.value.connectionState !== 'CONNECTED') {
            console.warn('⚠️ Group client not ready for manual subscribe');
            return;
        }

        const remoteUsers = groupClient.value.remoteUsers;
        console.log(`👥 GROUP MANUAL SUBSCRIBE: Found ${remoteUsers.length} remote users`);
        
        if (remoteUsers.length === 0) {
            console.log('⏳ No group remote users yet, will retry in 1s...');
            // ⚡ RETRY CEPAT jika belum ada user
            setTimeout(() => manuallyTriggerGroupSubscribe(true), 1000);
            return;
        }

        // ⚡ SUBSCRIBE KE SEMUA USER SECARA PARALEL
        const subscribePromises = remoteUsers.map(user => 
            fastSubscribeToGroupUser(user)
        );
        
        const results = await Promise.allSettled(subscribePromises);
        const successCount = results.filter(result => result.status === 'fulfilled').length;
        
        console.log(`✅ GROUP MANUAL SUBSCRIBE: ${successCount}/${remoteUsers.length} users subscribed`);
        
        // ⚡ JIKA GAGAL, RETRY SEKALI LAGI
        if (successCount === 0 && remoteUsers.length > 0) {
            console.log('🔄 Group manual subscribe failed, retrying in 500ms...');
            setTimeout(() => manuallyTriggerGroupSubscribe(true), 500);
        }
    };

    // ✅ PERBAIKAN: Setup group audio listeners - HAPUS AUTO-SUBSCRIBE
    const setupGroupAudioListeners = () => {
        // Remove existing listeners first
        groupClient.value.removeAllListeners();
        
        // ❌ COMMENT OUT/REMOVE auto-subscribe listeners
        /*
        groupClient.value.on('user-published', async (user: any, mediaType: string) => {
            if (mediaType !== 'audio') return;
            
            console.log('🔊 User published audio:', user.uid);
            
            // ⚠️ JANGAN subscribe otomatis - biarkan manual yang handle
            console.log(`⚠️ SKIPPING AUTO-SUBSCRIBE for user ${user.uid}`);
        });
        */

        // ❌ COMMENT OUT user-joined auto-subscribe
        /*
        groupClient.value.on('user-joined', (user: any) => {
            console.log('👥 User joined group call:', user.uid);
            // ⚠️ JANGAN subscribe otomatis
        });
        */
        
        // ✅ PERTAHANKAN cleanup listeners
        groupClient.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                const userId = user.uid;
                console.log(`🔇 Group user unpublished audio: ${userId}`);
                groupSubscribedUsers.value.delete(userId);
                safeUnsubscribeFromUser(userId);
            }
        });
        
        groupClient.value.on('user-left', (user: any) => {
            const userId = user.uid;
            console.log('👋 User left group call:', user.uid);
            groupSubscribedUsers.value.delete(userId);
            safeUnsubscribeFromUser(userId);
        });
        
        groupClient.value.on('connection-state-change', (curState: string, prevState: string) => {
            console.log(`🔄 Group connection state changed: ${prevState} -> ${curState}`);
        });
        
        groupClient.value.on('network-quality', (quality: any) => {
            console.log('📶 Group network quality:', quality);
        });

        console.log('✅ SIMPLIFIED Group audio listeners setup - NO AUTO-SUBSCRIBE');
    };

    // Safe unsubscribe function (tetap sama)
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

    // ✅ PERBAIKAN BESAR: Join group channel dengan state management yang robust
    // ✅ PERBAIKAN BESAR: Join group channel dengan operation management yang robust
const joinGroupChannel = async (channelName: string): Promise<boolean> => {
    // ✅ GUNAKAN FLAG UNTUK MENCEGAH MULTIPLE JOIN
    let isJoining = false;
    
    try {
        // ✅ CEK JIKA SEDANG DALAM PROSES JOIN
        if (isJoining) {
            console.warn('⚠️ Join operation already in progress, skipping...');
            return false;
        }
        
        isJoining = true;
        console.log('🔑 OPTIMIZED GROUP JOIN:', channelName);
        
        // ✅ RESET GROUP SUBSCRIBED USERS
        groupSubscribedUsers.value.clear();
        
        // 1. Unlock audio context first
        await unlockAudioContext();
        
        // 2. ✅ PERBAIKAN: Better state management dengan retry mechanism
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                const connectionState = groupClient.value.connectionState;
                console.log('📊 Group current connection state:', connectionState);
                
                // Handle different connection states properly
                if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
                    console.log('🔄 Group client already in', connectionState, 'state, performing safe cleanup...');
                    
                    try {
                        await safeLeaveGroupChannel();
                        console.log('✅ Safe cleanup completed');
                        
                        // ⚠️ TUNGGU LEBIH LAMA untuk memastikan cleanup selesai
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                    } catch (cleanupError) {
                        console.error('❌ Cleanup failed:', cleanupError);
                        
                        // ✅ JIKA CLEANUP GAGAL, BUAT CLIENT BARU
                        groupClient.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                        console.log('✅ Created new Agora client instance after cleanup failure');
                    }
                }
                
                // ✅ VERIFIKASI STATE SETELAH CLEANUP
                const newState = groupClient.value.connectionState;
                if (newState !== 'DISCONNECTED') {
                    console.warn('⚠️ Client still not disconnected after cleanup, state:', newState);
                    
                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`🔄 Retry ${retryCount}/${maxRetries} due to invalid state...`);
                        continue;
                    } else {
                        throw new Error(`Failed to achieve DISCONNECTED state after ${maxRetries} retries`);
                    }
                }
                
                break; // Keluar dari loop jika berhasil
                
            } catch (stateError) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`🔄 Retry ${retryCount}/${maxRetries} due to state error...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                } else {
                    throw stateError;
                }
            }
        }
        
        // 3. Request token from server
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
        
        // 4. Setup audio listeners BEFORE join
        setupGroupAudioListeners();
        
        // 5. ✅ PERBAIKAN: Validasi state SEBELUM join dengan timeout
        const preJoinState = groupClient.value.connectionState;
        if (preJoinState !== 'DISCONNECTED') {
            console.warn('⚠️ Client not in DISCONNECTED state before join:', preJoinState);
            throw new Error(`Cannot join: Client is in ${preJoinState} state`);
        }
        
        console.log('🔄 Joining Agora group channel...');
        
        // 6. ✅ PERBAIKAN: Join channel dengan better error handling
        try {
            await groupClient.value.join(
                app_id,
                channelName,
                token || null,
                currentUserId.value
            );
            console.log('✅ Successfully joined Agora group channel');
            
        } catch (joinError: any) {
            // ✅ HANDLE OPERATION_ABORTED SECARA SPECIFIC
            if (joinError.code === 'OPERATION_ABORTED' || joinError.message.includes('cancel token canceled')) {
                console.warn('⚠️ Join operation aborted, this is usually non-fatal');
                console.log('🔄 Operation was likely canceled due to overlapping operations, continuing...');
                // Untuk OPERATION_ABORTED, kita anggap success karena biasanya operasi lain yang succeed
                return true;
            }
            throw joinError;
        }
        
        // 7. ✅ PERBAIKAN: Validasi state SETELAH join dengan timeout
        let stateWaitCount = 0;
        const maxStateWait = 10;
        
        while (groupClient.value.connectionState !== 'CONNECTED' && stateWaitCount < maxStateWait) {
            console.log(`⏳ Waiting for CONNECTED state... (${stateWaitCount + 1}/${maxStateWait})`);
            await new Promise(resolve => setTimeout(resolve, 500));
            stateWaitCount++;
        }
        
        const postJoinState = groupClient.value.connectionState;
        if (postJoinState !== 'CONNECTED') {
            console.warn('⚠️ Client not in CONNECTED state after join:', postJoinState);
            // Jangan throw error di sini, lanjutkan saja karena mungkin sudah connected
        } else {
            console.log('✅ Connection state verified as CONNECTED');
        }
        
        // 8. Setup dan publish audio track DENGAN VALIDASI
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
            
            console.log('📤 Attempting to publish audio track...');
            
            // Publish audio track ke channel
            await groupClient.value.publish([groupLocalAudioTrack.value]);
            console.log('✅ Successfully published audio to group channel');
            
        } catch (audioError: any) {
            console.error('❌ Failed to setup audio track:', audioError);
            
            if (audioError.name === 'NOT_SUPPORTED' || audioError.name === 'PERMISSION_DENIED') {
                alert('Microphone permission is required for voice calls. Please allow microphone access.');
            }
            
            // Jangan throw error untuk publish failures, biarkan process continue
            console.warn('⚠️ Audio setup failed but continuing without local audio');
        }

        // ⚡ 9. TRIGGER MANUAL SUBSCRIBE SETELAH BERHASIL PUBLISH
        console.log('🔊 STARTING GROUP FAST SUBSCRIBE PROCESS...');
        
        setTimeout(() => {
            console.log('🔊 GROUP IMMEDIATE SUBSCRIBE TRIGGER');
            manuallyTriggerGroupSubscribe(true);
        }, 500);
        
        setTimeout(() => {
            console.log('🔊 GROUP BACKUP SUBSCRIBE TRIGGER');
            manuallyTriggerGroupSubscribe(true);
        }, 1500);
        
        setTimeout(() => {
            console.log('🔊 GROUP FINAL SUBSCRIBE TRIGGER');
            manuallyTriggerGroupSubscribe(true);
        }, 3000);
        
        return true;
        
    } catch (error: unknown) {
        console.error('❌ Join group channel error:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code;
        
        // ✅ PERBAIKAN: Handle OPERATION_ABORTED sebagai non-fatal error
        if (errorCode === 'OPERATION_ABORTED' || errorMessage.includes('cancel token canceled')) {
            console.warn('⚠️ OPERATION_ABORTED detected, this is usually non-fatal');
            console.log('🔄 Operation was canceled, but this might mean another operation succeeded');
            
            // Cek apakah kita sudah connected meskipun operation di-abort
            if (groupClient.value.connectionState === 'CONNECTED') {
                console.log('✅ Client is CONNECTED despite operation abort, considering join successful');
                return true;
            }
            
            // Jika tidak connected, coba recovery
            try {
                console.log('🔄 Attempting recovery after OPERATION_ABORTED...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                if (groupClient.value.connectionState === 'CONNECTED') {
                    console.log('✅ Recovery successful - client is CONNECTED');
                    return true;
                }
                
                // Jika masih tidak connected, coba join simple
                return await joinGroupChannelSimple(channelName);
                
            } catch (recoveryError) {
                console.error('❌ Recovery after OPERATION_ABORTED failed:', recoveryError);
                // Consider this non-fatal dan lanjutkan
                return false;
            }
        }
        
        // Handle "already in connecting/connected state" error
        if (errorCode === 'INVALID_OPERATION' || errorMessage.includes('already in connecting/connected state')) {
            console.error('❌ CRITICAL: Client already in connected state');
            
            try {
                await emergencyCleanup();
                console.log('✅ Emergency cleanup completed');
                
                console.log('🔄 Retrying join after emergency cleanup...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await joinGroupChannel(channelName);
                
            } catch (retryError) {
                console.error('❌ Emergency cleanup and retry failed:', retryError);
                // Consider this non-fatal
                return false;
            }
        }
        
        // Handle UID_CONFLICT
        if (errorCode === 'UID_CONFLICT' || errorMessage.includes('UID_CONFLICT')) {
            console.log('🔄 UID conflict detected, retrying with simple approach...');
            try {
                await safeLeaveGroupChannel();
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await joinGroupChannelSimple(channelName);
            } catch (retryError) {
                console.error('❌ UID conflict retry failed:', retryError);
                // Consider this non-fatal
                return false;
            }
        }
        
        // Untuk error lainnya, consider non-fatal dan return false
        console.warn('⚠️ Non-fatal join error, continuing without audio:', errorMessage);
        return false;
        
    } finally {
        // ✅ PASTIKAN FLAG DI-RESET
        isJoining = false;
    }
};

    // SIMPLE JOIN FUNCTION untuk fallback (tetap sama)
    const joinGroupChannelSimple = async (channelName: string): Promise<boolean> => {
    try {
        console.log('🔑 [SIMPLE] Requesting Agora group token for channel:', channelName);
        
        const response = await axios.post('/group-call/token', {
            channel: channelName,
            uid: currentUserId.value.toString(), // ⚠️ PERBAIKAN: Gunakan user ID, bukan '0'
            role: 'publisher'
        });
        
        const { token, app_id } = response.data;
        
        if (!app_id) {
            throw new Error('Invalid app_id from server');
        }
        
        await groupClient.value.join(app_id, channelName, token || null);
        console.log('✅ [SIMPLE] Successfully joined channel');
        
        // ✅ PERBAIKAN: Validasi state sebelum publish
        if (groupClient.value.connectionState !== 'CONNECTED') {
            throw new Error('Not connected in simple join');
        }
        
        if (groupLocalAudioTrack.value) {
            try {
                groupLocalAudioTrack.value.stop();
                groupLocalAudioTrack.value.close();
            } catch (e) {}
            groupLocalAudioTrack.value = null;
        }
        
        groupLocalAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
        
        // ✅ PERBAIKAN: Validasi state sekali lagi
        if (groupClient.value.connectionState !== 'CONNECTED') {
            throw new Error('Connection lost before publish in simple join');
        }
        
        await groupClient.value.publish([groupLocalAudioTrack.value]);
        console.log('✅ [SIMPLE] Successfully published audio');
        
        // ⚡ TAMBAHKAN MANUAL SUBSCRIBE TRIGGER
        setTimeout(() => manuallyTriggerGroupSubscribe(true), 1000);
        
        return true;
    } catch (error: unknown) {
        console.error('❌ [SIMPLE] Join failed:', error);
        throw error;
    }
   };

    // PERBAIKAN: Safe leave function - TAMBAHKAN RESET SUBSCRIBED USERS
    const safeLeaveGroupChannel = async (): Promise<void> => {
    try {
        console.log('🚪 Safely leaving group channel...');
        
        // ✅ RESET GROUP SUBSCRIBED USERS
        groupSubscribedUsers.value.clear();
        
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
        
        // Leave channel jika connected/connecting
        if (groupClient.value && 
            (groupClient.value.connectionState === 'CONNECTED' || 
             groupClient.value.connectionState === 'CONNECTING')) {
            
            console.log('🔌 Leaving Agora channel, current state:', groupClient.value.connectionState);
            
            try {
                // Gunakan timeout untuk leave operation
                const leavePromise = groupClient.value.leave();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Leave operation timeout')), 5000)
                );
                
                await Promise.race([leavePromise, timeoutPromise]);
                console.log('✅ Successfully left group channel');
                
            } catch (leaveError) {
                console.error('❌ Leave operation failed:', leaveError);
                // Tidak throw error di sini, biarkan process continue
            }
            
            // ✅ TUNGGU SAMPAI STATE BENAR-BENAR DISCONNECTED
            let waitCount = 0;
            const maxWait = 20; // 10 detik maksimal
            
            while (groupClient.value.connectionState !== 'DISCONNECTED' && waitCount < maxWait) {
                console.log(`⏳ Waiting for DISCONNECTED state... (${waitCount + 1}/${maxWait})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                waitCount++;
            }
            
            if (groupClient.value.connectionState !== 'DISCONNECTED') {
                console.warn('⚠️ Client still not disconnected after waiting, state:', groupClient.value.connectionState);
            } else {
                console.log('✅ Client successfully disconnected');
            }
            
        } else {
            console.log('ℹ️ Group client already disconnected or not connected');
        }
        
    } catch (error) {
        console.error('❌ Error in safeLeaveGroupChannel:', error);
        // Jangan throw error, biarkan process continue
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
        
        // Mendapatkan data user saat ini (Host) dari state Inertia.js
        const currentUserData = usePage<AppPageProps>().props.auth.user;
        // 1. ✅ PERKAYA DATA CALLER (HOST)
        // Meskipun ini data diri sendiri, kita ingin memastikan profile_photo_url ada
        const enrichedCaller = enrichUserData(currentUserData); 

        const response = await axios.post('/group-call/invite', {
            group_id: group.id,
            call_type: 'voice'
        });
        
        // 2. ✅ PERKAYA DATA PARTICIPANTS yang dikirim balik oleh API
        const enrichedParticipants = response.data.participants.map(enrichUserData);


        groupVoiceCallData.value = {
            callId: response.data.call_id,
            group: response.data.group, 
            
            // ✅ FIX: Gunakan data Caller (Host) yang sudah diperkaya
            caller: { 
                id: enrichedCaller.id, 
                name: enrichedCaller.name, 
                profile_photo_url: enrichedCaller.profile_photo_url // JAMINAN FOTO HOST
            }, 
            
            callType: 'voice',
            channel: response.data.channel,
            status: 'calling',
            
            // ✅ FIX: Gunakan Participants yang sudah diperkaya
            participants: enrichedParticipants 
        };
        
        isGroupVoiceCallActive.value = true;
        isGroupCaller.value = true;
        
        // HOST AUTOMATICALLY JOINS AUDIO CHANNEL
        if (response.data.channel) {
            try {
                await joinGroupChannel(response.data.channel);
                console.log('🎉 Host successfully joined group channel');
                
                // UPDATE HOST STATUS TO 'accepted' (dan pastikan data host di participants juga lengkap)
                const hostParticipantIndex = groupVoiceCallData.value.participants?.findIndex(
                    (p: any) => p.id === currentUserId.value
                );
                
                if (hostParticipantIndex !== undefined && hostParticipantIndex !== -1 && groupVoiceCallData.value.participants) {
                    // Pastikan entri host di participants diperbarui dengan data lengkap
                    groupVoiceCallData.value.participants[hostParticipantIndex] = {
                         ...groupVoiceCallData.value.participants[hostParticipantIndex],
                         ...enrichedCaller, // Timpa dengan data lengkap host
                         status: 'accepted',
                         isLocal: true, // Tambahkan properti ini
                         isMuted: false 
                    };
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
        endGroupCall;
        leaveGroupChannel();
        leaveDynamicGroupChannel();
        isGroupVoiceCallActive.value = false;
        groupVoiceCallData.value = null;
        isGroupCaller.value = false;
        
        // ✅ RESET GROUP SUBSCRIBED USERS
        groupSubscribedUsers.value.clear();
    };

    // --- GROUP CALL TIMEOUT FUNCTIONS --- (tetap sama)
    const startGroupCallTimeout = (duration: number = 30) => {
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
                if (groupCallCountdownInterval) {
                    clearInterval(groupCallCountdownInterval);
                    groupCallCountdownInterval = null;
                }
                handleGroupCallTimeout();
            }
        }, 1000);
    };

    const handleGroupCallTimeout = () => {
        if (groupVoiceCallData.value?.status === 'calling' || groupVoiceCallData.value?.status === 'ringing') {
            console.log('⏰ Group call timeout - memeriksa kondisi setelah 30 detik');
            
            const acceptedParticipants = groupVoiceCallData.value.participants?.filter(
                (p: any) => p.status === 'accepted'
            );
            
            if (acceptedParticipants && acceptedParticipants.length > 0) {
                console.log('✅ Timeout diabaikan karena sudah ada peserta yang bergabung.');
                stopGroupCallTimeout();
                return;
            }

            console.log('❌ Tidak ada peserta yang menerima panggilan. Mengakhiri panggilan...');

            if (groupVoiceCallData.value) {
                groupVoiceCallData.value.status = 'ended';
                groupVoiceCallData.value.reason = 'Tidak ada yang bergabung';
                
                axios.post('/group-call/missed', {
                    call_id: groupVoiceCallData.value.callId,
                    reason: 'timeout'
                }).catch(error => {
                    console.error('Failed to send missed group call notification:', error);
                });
                
                stopGroupCallTimeout();
                
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

    // --- GROUP CALL ACTIONS --- (acceptGroupCall tetap sama, tapi sudah menggunakan joinGroupChannel yang baru)
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
                try {
                    // ✅ GUNAKAN joinGroupChannel YANG SUDAH DIPERBAIKI
                    const joinSuccess = await joinGroupChannel(groupVoiceCallData.value.channel);
                    
                    if (joinSuccess) {
                        console.log('🎉 Callee successfully joined group channel');
                    } else {
                        console.warn('⚠️ Join returned false, but this might be OK if operation was aborted');
                        // Cek apakah kita sudah connected meskipun join return false
                        if (groupClient.value.connectionState === 'CONNECTED') {
                            console.log('✅ Client is CONNECTED despite join returning false');
                        }
                    }
                    
                } catch (joinError: any) {
                    console.error('❌ Failed to join group channel:', joinError);
                    
                    // ✅ PERBAIKAN: Handle OPERATION_ABORTED secara specific
                    const errorMessage = joinError.message || '';
                    const errorCode = joinError.code;
                    
                    if (errorCode === 'OPERATION_ABORTED' || errorMessage.includes('cancel token canceled')) {
                        console.warn('⚠️ Join operation aborted, but this might be non-fatal');
                        
                        // Cek state current
                        if (groupClient.value.connectionState === 'CONNECTED') {
                            console.log('✅ Client is CONNECTED despite operation abort');
                            // Consider success
                            return;
                        }
                        
                        // Coba recovery
                        try {
                            await emergencyCleanup();
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            const recoverySuccess = await joinGroupChannel(groupVoiceCallData.value.channel);
                            if (recoverySuccess) {
                                console.log('🎉 Recovery successful after OPERATION_ABORTED');
                                return;
                            }
                            
                        } catch (recoveryError) {
                            console.error('❌ Recovery failed:', recoveryError);
                            // Continue without throwing
                        }
                    }
                    
                    // Untuk error lainnya, tampilkan alert tapi jangan reset state
                    if (!errorMessage.includes('OPERATION_ABORTED') && 
                        !errorMessage.includes('cancel token canceled')) {
                        alert('Failed to join call: ' + errorMessage);
                    }
                }
            }
        }
        
    } catch (error: unknown) {
        console.error('❌ Failed to accept group call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // ✅ PERBAIKAN: Jangan reset state untuk OPERATION_ABORTED
        if (!errorMessage.includes('OPERATION_ABORTED') && 
            !errorMessage.includes('cancel token canceled')) {
            alert('Failed to accept call: ' + errorMessage);
            resetGroupCallState();
        } else {
            console.warn('⚠️ OPERATION_ABORTED during accept, this might be non-fatal');
        }
    }
};

    // Fungsi lainnya tetap sama...
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
        console.error('⚠️ Tidak ada data panggilan grup');
        resetGroupCallState();
        return;
    }

    try {
        console.log('📞 Membubarkan panggilan grup:', callId);

        const response = await axios.post('/group-call/end', {
            call_id: callId,
            group_id: groupVoiceCallData.value.group.id,
            reason: 'Dibubarkan oleh host'
        });

        console.log('✅ Response dari server:', response.data);

        // ✅ HOST: Tampilkan alert dan reset state
        // if (isGroupCaller.value) {
        //     alert('Anda telah membubarkan panggilan grup');
        //     resetGroupCallState();
        // }
        
        // NOTE: Participant akan dapat alert via event listener
        
    } catch (error: any) {
        console.error('❌ Gagal membubarkan panggilan grup:', error);
        
        let errorMessage = 'Gagal membubarkan panggilan grup';
        if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
        }
        
        alert(errorMessage);
        
        // Reset state jika error
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

    // ✅ FUNGSI BARU: Monitor connection state
const monitorConnectionState = async (operation: string, timeout = 10000): Promise<boolean> => {
    console.log(`🔍 Monitoring connection state for: ${operation}`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const state = groupClient.value.connectionState;
        
        if (state === 'CONNECTED') {
            console.log(`✅ Connection state is CONNECTED for ${operation}`);
            return true;
        }
        
        if (state === 'DISCONNECTED' || state === 'FAILED') {
            console.error(`❌ Connection state is ${state} for ${operation}`);
            return false;
        }
        
        console.log(`⏳ Waiting for CONNECTED state... Current: ${state}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.error(`❌ Timeout waiting for CONNECTED state for ${operation}`);
    return false;
};

// ✅ FUNGSI BARU: Emergency cleanup untuk state yang stuck
const emergencyCleanup = async (): Promise<void> => {
    console.log('🚨 PERFORMING EMERGENCY CLEANUP...');
    
    try {
        // 1. Reset semua state
        groupSubscribedUsers.value.clear();
        groupRemoteAudioTracks.value = {};
        
        // 2. Stop dan close local track
        if (groupLocalAudioTrack.value) {
            try {
                groupLocalAudioTrack.value.stop();
                groupLocalAudioTrack.value.close();
            } catch (e) {
                console.warn('Error during emergency track cleanup:', e);
            }
            groupLocalAudioTrack.value = null;
        }
        
        // 3. Force leave channel jika masih connected
        if (groupClient.value) {
            try {
                // Coba leave dengan timeout pendek
                const leavePromise = groupClient.value.leave();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Leave timeout')), 3000)
                );
                
                await Promise.race([leavePromise, timeoutPromise]);
                console.log('✅ Emergency leave successful');
            } catch (leaveError) {
                console.warn('⚠️ Emergency leave failed, creating new client:', leaveError);
                // Force create new client instance
                groupClient.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            }
        }
        
        // 4. Setup listeners baru
        setupGroupAudioListeners();
        
        console.log('✅ Emergency cleanup completed');
        
    } catch (error) {
        console.error('❌ Emergency cleanup failed:', error);
        // Last resort: create completely new client
        groupClient.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        setupGroupAudioListeners();
        throw error;
    }
};  

    // ✅ FUNGSI BARU: Utility untuk manage connection state
const getConnectionState = (): string => {
    return groupClient.value?.connectionState || 'NO_CLIENT';
};

const waitForState = async (targetState: string, timeout = 10000): Promise<boolean> => {
    console.log(`⏳ Waiting for state: ${targetState}`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const currentState = getConnectionState();
        
        if (currentState === targetState) {
            console.log(`✅ Reached target state: ${targetState}`);
            return true;
        }
        
        if (currentState === 'FAILED' || currentState === 'DISCONNECTED') {
            console.error(`❌ Reached terminal state: ${currentState}`);
            return false;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.error(`❌ Timeout waiting for state: ${targetState}`);
    return false;
};

const ensureDisconnectedState = async (): Promise<boolean> => {
    const currentState = getConnectionState();
    
    if (currentState === 'DISCONNECTED') {
        return true;
    }
    
    console.log(`🔄 Current state is ${currentState}, ensuring disconnected state...`);
    await safeLeaveGroupChannel();
    return await waitForState('DISCONNECTED', 8000);
};

    // --- EVENT LISTENERS --- (tetap sama)
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
            
            setupDynamicGroupListeners(data.group.id);
            
            if (isHost) {
                console.log('📞 Event panggilan grup diterima (diabaikan karena saya adalah Host)');
                return;
            }

            console.log('📞 Panggilan grup masuk (diterima sebagai Peserta):', data);
            
            if (isGroupVoiceCallActive.value) {
                console.log('⚠️ Sedang dalam panggilan lain, panggilan grup baru diabaikan.');
                return;
            }
            
            groupVoiceCallData.value = { ...data, status: 'ringing' };
            isGroupVoiceCallActive.value = true;
            isGroupCaller.value = false;

            startGroupCallTimeout(30);
        });
        
        privateChannel.listen('.group-call-cancelled', (data: any) => {
            console.log('🚫 EVENT .group-call-cancelled RECEIVED:', data);
            if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.callId) {
                alert(`Group call cancelled by ${data.caller.name}`);
                resetGroupCallState();
            }
        });

        globalListenersInitialized = true;
    };

    const setupDynamicGroupListeners = (groupId: number) => {
    const newChannelName = `group.${groupId}`;
    
    if (currentGroupListeners === newChannelName) {
        console.log(`⚠️ Sudah mendengarkan channel ${newChannelName}, skip...`);
        return;
    }
    
    leaveDynamicGroupChannel();
    
    currentGroupListeners = newChannelName;
    console.log(`🎧 Mulai mendengarkan channel grup: ${newChannelName}`);
    
    const groupChannel = echo.private(newChannelName);

    // 1. LISTENER: group-call-answered (Memperkaya data saat status berubah)
    groupChannel.listen('.group-call-answered', (data: any) => {
        console.log('✅ EVENT .group-call-answered RECEIVED:', data);

        if (!groupVoiceCallData.value || groupVoiceCallData.value.callId !== data.call_id) {
            return;
        }
        
        // ✅ PERKAYA DATA USER DARI EVENT
        const enrichedUser = enrichUserData(data.user);

        const participantIndex = groupVoiceCallData.value.participants?.findIndex(
            (p: any) => p.id === data.user.id
        );
        
        if (participantIndex !== undefined && participantIndex > -1 && groupVoiceCallData.value.participants) {
            // Gabungkan data yang sudah ada dengan data yang diperkaya
            groupVoiceCallData.value.participants[participantIndex] = {
                ...groupVoiceCallData.value.participants[participantIndex],
                ...enrichedUser, // ✅ Timpa dengan data lengkap (profile_photo_url)
                status: data.accepted ? 'accepted' : 'rejected', // Update status
                reason: data.reason || null,
            };
        }

        if (data.accepted) {
            if (isGroupCaller.value && groupVoiceCallData.value.status === 'calling') {
                console.log('🎉 Participant joined! Changing host status to "accepted"');
                stopGroupCallTimeout();
                groupVoiceCallData.value.status = 'accepted';
            }
            
            if (!isGroupCaller.value && data.user.id === currentUserId.value) {
                console.log('🎉 Participant accepting call, joining channel...');
                stopGroupCallTimeout();
                
                if (groupVoiceCallData.value.channel) {
                    // ... (logika joinGroupChannel tetap sama)
                    joinGroupChannel(groupVoiceCallData.value.channel)
                        .then((success) => {
                            if (success) {
                                console.log('✅ Participant successfully joined group channel');
                                groupVoiceCallData.value.status = 'accepted';
                            } else {
                                console.warn('⚠️ Join returned false, but participant might still be connected');
                                if (groupClient.value.connectionState === 'CONNECTED') {
                                    groupVoiceCallData.value.status = 'accepted';
                                    console.log('✅ Participant connected despite join returning false');
                                }
                            }
                        })
                        .catch(error => {
                            console.error('❌ Participant failed to join channel:', error);
                            if (!error.message?.includes('OPERATION_ABORTED') && 
                                !error.message?.includes('cancel token canceled')) {
                                resetGroupCallState();
                            }
                        });
                }
            }
        }

        const acceptedParticipants = groupVoiceCallData.value.participants?.filter(
            (p: any) => p.status === 'accepted'
        );
        
        if (acceptedParticipants && acceptedParticipants.length > 0) {
            stopGroupCallTimeout();
        }
    });
    
    // 2. LISTENER: group-participant-joined (Jika ada yang bergabung, data harus lengkap)
    groupChannel.listen('.group-participant-joined', (data: any) => {
        console.log('👤 EVENT .group-participant-joined RECEIVED:', data);

        if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
            
            // ✅ PERKAYA DATA USER DARI EVENT
            const enrichedUser = enrichUserData(data.user); 
            
            const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                (p: any) => p.id === data.user.id
            );

            if (participantIndex === undefined || participantIndex === -1) {
                // Tambahkan sebagai peserta baru jika belum ada
                groupVoiceCallData.value.participants.push({
                    ...enrichedUser, // ✅ Gunakan data yang sudah diperkaya
                    status: 'accepted', // Asumsi: bergabung berarti accepted
                    isMuted: false,
                    isLocal: data.user.id === currentUserId.value
                });
                console.log(`Peserta baru ${enrichedUser.name} bergabung.`);
            } else {
                // Update data dengan versi lengkap jika sudah ada
                groupVoiceCallData.value.participants[participantIndex] = {
                    ...groupVoiceCallData.value.participants[participantIndex],
                    ...enrichedUser, // ✅ Timpa dengan data lengkap (termasuk profile_photo_url)
                    status: 'accepted', // Update status ke accepted
                };
            }
        }
    });

    // 3. LISTENER: group-call-ended (Tidak perlu enrichment)
    groupChannel.listen('.group-call-ended', (data: any) => {
        console.log('🚫 Group call ended event:', data);
        
        // Cek apakah ini panggilan yang sedang aktif
        if (groupVoiceCallData.value?.callId !== data?.call_id) {
            return;
        }
        
        // const endedByName = data.ended_by?.name || 'Host';
        // const isHost = isGroupCaller.value;
        
        // ✅ OPSI 1: ALERT SEDERHANA
        if (data.ended_by.id !== currentUserId.value) {
            alert(`Panggilan dibubarkan oleh ${data.ended_by.name}`);
        } else {
            // Ini adalah Host
            alert('Anda telah membubarkan panggilan grup');
        }
        // Reset state untuk semua user (termasuk host jika belum reset)
        resetGroupCallState();
    });

    // 4. LISTENER: group-participant-left (Tidak perlu enrichment)
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

    // 5. LISTENER: group-participant-recalled (Tidak perlu enrichment)
    groupChannel.listen('.group-participant-recalled', (data: any) => {
        console.log('📞 EVENT .group-participant-recalled RECEIVED:', data);
        
        if (groupVoiceCallData.value && groupVoiceCallData.value.callId === data.call_id) {
            // Perkaya data user yang dipanggil ulang, meskipun hanya status yang diupdate
            const enrichedUser = enrichUserData(data.user);
            
            const participantIndex = groupVoiceCallData.value.participants?.findIndex(
                (p: any) => p.id === data.user.id
            );
            
            if (participantIndex > -1) {
                 // Update dengan data yang sudah diperkaya jika ada
                groupVoiceCallData.value.participants[participantIndex] = {
                    ...groupVoiceCallData.value.participants[participantIndex],
                    ...enrichedUser,
                    status: 'calling',
                };
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
        leaveGroupChannel,
        manuallyTriggerGroupSubscribe // ✅ Export untuk debugging
    };
}