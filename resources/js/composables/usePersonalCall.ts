// resources/js/composables/usePersonalCall.ts

import { ref, computed, onUnmounted } from 'vue';
import { usePage } from '@inertiajs/vue3';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { Chat, User, Contact } from '@/types/index';
import { echo } from '../echo.js';
import { useCallNotification } from '@/composables/useCallNotification';

declare global {
  interface Window {
    agoraListenersSetup?: boolean;
  }
}


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
const callTimeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);
const callStartTime = ref<number | null>(null);
const callTimeoutCountdown = ref<number | null>(null); 
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let incomingCallTimeout: ReturnType<typeof setTimeout> | null = null;
let personalCallListenersInitialized = false;
const isMuted = ref(false);
const audioContextUnlocked = ref(false);
let notificationDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

// ✅ PERBAIKAN: Simplified subscribed users management
const subscribedUsers = ref<Set<number>>(new Set());
const subscribingUsers = ref<Set<number>>(new Set());
let manualSubscribeInProgress = false;

export function usePersonalCall() {
    const page = usePage<PageProps>();
    const currentUserId = computed(() => page.props.auth.user.id);
    const currentUserName = computed(() => page.props.auth.user.name);
    const { sendPersonalCallNotification, closeNotification } = useCallNotification();
    const isPersonalCallActive = computed(() => isInVoiceCall.value || !!outgoingCallVoice.value || !!incomingCallVoice.value);

    // ✅ PERBAIKAN: Simple Agora client initialization
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

    // ✅ PERBAIKAN: Simple audio context unlock
    const unlockAudioContext = async () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const audioContext = new AudioContext();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            // Create and play a silent sound to unlock audio
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            source.stop(audioContext.currentTime + 0.1);
            
            console.log('✅ Audio context unlocked');
        } catch (error) {
            console.warn('⚠️ Audio context unlock warning:', error);
        }
    };

    // ✅ PERBAIKAN: Simple toggle mute
    const toggleMuteEnhanced = async () => {
        if (!localAudioTrack.value) {
            console.warn('❌ Tidak ada audio track');
            return;
        }

        try {
            const desiredMuteState = !isMuted.value;
            
            if (desiredMuteState === false) {
                // Unmute: ensure audio context is unlocked
                await unlockAudioContext();
            }
            
            await localAudioTrack.value.setEnabled(!desiredMuteState);
            isMuted.value = desiredMuteState;
            
            console.log(`✅ Audio ${isMuted.value ? 'dimatikan' : 'dinyalakan'}`);
            
        } catch (error) {
            console.error('❌ Gagal mengubah status mute:', error);
        }
    };

    // ✅ PERBAIKAN: Simple audio setup
    const setupAudio = async (): Promise<boolean> => {
        try {
            console.log('🎵 Setting up audio...');
            
            // Clean up existing track
            if (localAudioTrack.value) {
                try {
                    localAudioTrack.value.stop();
                    localAudioTrack.value.close();
                } catch (e) {
                    // Ignore errors
                }
                localAudioTrack.value = null;
            }
            
            // Create new track with simple configuration
            localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({
                encoderConfig: 'speech_standard',
                AEC: true,
                ANS: true,
                AGC: true
            });
            
            console.log('✅ Microphone audio track created');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to setup audio:', error);
            return false;
        }
    };

    // ✅ PERBAIKAN BESAR: Simple and reliable subscribe function
    const subscribeToUser = async (user: any): Promise<boolean> => {
    const userId = user.uid;
    
    try {
        // Skip jika sudah subscribed atau sedang proses subscribe
        if (subscribedUsers.value.has(userId)) {
            console.log(`✅ User ${userId} already subscribed`);
            return true;
        }
        
        if (subscribingUsers.value.has(userId)) {
            console.log(`⏳ User ${userId} subscription in progress, skipping...`);
            return false;
        }

        // Mark as subscribing
        subscribingUsers.value.add(userId);

        // Validate client state
        if (!client.value || client.value.connectionState !== 'CONNECTED') {
            console.warn(`⚠️ Client not ready for subscribe to user ${userId}`);
            subscribingUsers.value.delete(userId);
            return false;
        }

        // Perform subscribe dengan timeout
        await Promise.race([
            client.value.subscribe(user, 'audio'),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Subscribe timeout')), 5000)
            )
        ]);
        
        // Check if audio track is available
        if (user.audioTrack) {
            subscribedUsers.value.add(userId);
            remoteAudioTrack.value[userId] = user.audioTrack;
            
            // Play the audio track dengan error handling
            try {
                await user.audioTrack.play();
                console.log(`🎉 BERHASIL! Audio dari user ${userId} sedang diputar`);
                return true;
            } catch (playError) {
                console.warn(`⚠️ Gagal memutar audio dari ${userId}:`, playError);
                // Tetap return true karena subscribe berhasil, hanya play yang gagal
                return true;
            }
        } else {
            console.warn(`⚠️ No audio track available for user ${userId}`);
            return false;
        }
        
    } catch (error: any) {
        console.warn(`❌ Subscribe failed for user ${userId}:`, error.message);
        return false;
    } finally {
        subscribingUsers.value.delete(userId);
    }
};

    // ✅ PERBAIKAN: Simple manual subscribe trigger
    const manuallyTriggerSubscribe = async () => {
    if (manualSubscribeInProgress) {
        console.log('⏳ Manual subscribe already in progress, skipping...');
        return;
    }

    console.log('🔊 MANUAL SUBSCRIBE: Starting...');
    manualSubscribeInProgress = true;
    
    try {
        if (!client.value || client.value.connectionState !== 'CONNECTED') {
            console.warn('⚠️ Client not ready for manual subscribe');
            return;
        }

        const remoteUsers = client.value.remoteUsers;
        console.log(`👥 Found ${remoteUsers.length} remote users`);
        
        if (remoteUsers.length === 0) {
            console.log('⏳ No remote users found');
            return;
        }

        // Subscribe to all remote users dengan sequential processing
        let successCount = 0;
        for (const user of remoteUsers) {
            const success = await subscribeToUser(user);
            if (success) successCount++;
            
            // Small delay antara setiap subscribe untuk avoid overload
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Manual subscribe completed: ${successCount}/${remoteUsers.length} users subscribed`);
        
    } finally {
        manualSubscribeInProgress = false;
    }
};

    // ✅ PERBAIKAN: Simple connection monitoring
    const monitorConnectionStatus = () => {
        if (!client.value) return;
        
        console.log('🔍 Connection Status:', {
            connectionState: client.value.connectionState,
            remoteUsers: client.value.remoteUsers.length,
            subscribedUsers: Array.from(subscribedUsers.value)
        });
    };


// ✅ PERBAIKAN: Modified reset function untuk better state management
// ✅ PERBAIKAN: Enhanced reset function untuk better state management
const resetVoiceCallState = (preserveCallData: boolean = false) => {
    console.log('🔄 RESET VOICE CALL STATE - Memulai reset...', { 
        preserveCallData,
        outgoingCall: !!outgoingCallVoice.value,
        incomingCall: !!incomingCallVoice.value,
        activeCall: !!activeCallData.value
    });

    manualSubscribeInProgress = false;
    
    if (typeof window !== 'undefined') {
        window.agoraListenersSetup = false;
    }
    
    // Reset state flags
    isInVoiceCall.value = false;
    voiceCallType.value = null;
    
    // ✅ FIX: Selalu reset semua call state kecuali jika explicitly diminta preserve
    if (!preserveCallData) {
        incomingCallVoice.value = null;
        outgoingCallVoice.value = null;
        activeCallData.value = null;
        callStartTime.value = null;
    } else {
        console.log('⚠️ Call data dipreserve meskipun ada rejected event');
        // Untuk rejected call, jangan preserve data
        incomingCallVoice.value = null;
        outgoingCallVoice.value = null;
        activeCallData.value = null;
        callStartTime.value = null;
    }
    
    callTimeoutCountdown.value = null;
    isMuted.value = false;

    // Stop all timers
    stopCallTimeout();
    if (incomingCallTimeout) {
        clearTimeout(incomingCallTimeout);
        incomingCallTimeout = null;
    }
    if (notificationDebounceTimeout) {
        clearTimeout(notificationDebounceTimeout);
        notificationDebounceTimeout = null;
    }

    // Cleanup Agora resources
    cleanupAgoraResources().catch(error => {
        console.error('❌ Error during Agora cleanup:', error);
    });

    console.log('✅ Voice call state reset completed', { 
        outgoingCall: !!outgoingCallVoice.value,
        incomingCall: !!incomingCallVoice.value,
        activeCall: !!activeCallData.value
    });
};

    // ✅ PERBAIKAN: Enhanced audio listeners dengan type safety
const setupAudioListeners = () => {
    if (!client.value) {
        console.error('❌ Client not initialized for audio listeners');
        return;
    }

    console.log('🎧 Setting up ENHANCED audio listeners');

    // ✅ FIX: Gunakan type-safe check untuk prevent multiple setup
    if (window.agoraListenersSetup) {
        console.log('⚠️ Audio listeners already setup, skipping...');
        return;
    }

    // ✅ FIX 2: Remove existing listeners dengan safety check
    try {
        client.value.removeAllListeners();
        console.log('🧹 Existing listeners cleared');
    } catch (error) {
        console.warn('⚠️ Error clearing listeners:', error);
    }

    // ✅ FIX 3: Debounce mechanism untuk prevent rapid multiple subscriptions
    const subscribeDebounceTimeouts: { [key: number]: ReturnType<typeof setTimeout> } = {};
    const SUBSCRIBE_DEBOUNCE_MS = 500; // 500ms debounce

    // User joined event - trigger subscribe dengan debounce
    client.value.on('user-joined', (user: any) => {
        const userId = user.uid;
        console.log(`🎉 User ${userId} joined the channel`);
        
        // Clear existing timeout untuk user ini
        if (subscribeDebounceTimeouts[userId]) {
            clearTimeout(subscribeDebounceTimeouts[userId]);
        }
        
        // Debounce subscribe untuk avoid rapid consecutive joins
        subscribeDebounceTimeouts[userId] = setTimeout(() => {
            console.log(`🔍 Processing subscribe for joined user ${userId}`);
            subscribeToUser(user).then(success => {
                if (success) {
                    console.log(`✅ Successfully subscribed to joined user ${userId}`);
                } else {
                    console.warn(`⚠️ Failed to subscribe to joined user ${userId}, will retry...`);
                    // Retry after delay
                    setTimeout(() => subscribeToUser(user), 1000);
                }
            });
            delete subscribeDebounceTimeouts[userId];
        }, SUBSCRIBE_DEBOUNCE_MS);
    });

    // User published event - immediate subscribe dengan queue mechanism
    let publishQueue: any[] = [];
    let isProcessingQueue = false;

    const processPublishQueue = async () => {
        if (isProcessingQueue || publishQueue.length === 0) return;
        
        isProcessingQueue = true;
        console.log(`🔄 Processing publish queue, ${publishQueue.length} users waiting`);
        
        while (publishQueue.length > 0) {
            const user = publishQueue.shift();
            if (user && !subscribedUsers.value.has(user.uid)) {
                try {
                    await subscribeToUser(user);
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay antara subscriptions
                } catch (error) {
                    console.warn(`⚠️ Queue subscribe failed for user ${user.uid}:`, error);
                }
            }
        }
        
        isProcessingQueue = false;
        console.log('✅ Publish queue processing completed');
    };

    client.value.on('user-published', async (user: any, mediaType: string) => {
        if (mediaType !== 'audio') return;
        
        const userId = user.uid;
        console.log(`🔊 User ${userId} published audio`);
        
        // Skip jika sudah subscribed
        if (subscribedUsers.value.has(userId)) {
            console.log(`✅ User ${userId} already subscribed, skipping...`);
            return;
        }

        // Clear existing debounce timeout untuk user ini
        if (subscribeDebounceTimeouts[userId]) {
            clearTimeout(subscribeDebounceTimeouts[userId]);
        }

        // Gunakan debounce untuk published event juga
        subscribeDebounceTimeouts[userId] = setTimeout(async () => {
            try {
                console.log(`🎯 Attempting subscribe to published user ${userId}`);
                const success = await subscribeToUser(user);
                
                if (!success) {
                    console.warn(`⏳ Subscribe failed for ${userId}, adding to queue`);
                    // Tambah ke queue untuk retry
                    if (!publishQueue.some(u => u.uid === userId)) {
                        publishQueue.push(user);
                    }
                    processPublishQueue();
                }
            } catch (error) {
                console.error(`❌ Error in published handler for ${userId}:`, error);
            } finally {
                delete subscribeDebounceTimeouts[userId];
            }
        }, 300);
    });
    
    // User unpublished event - cleanup dengan better error handling
    client.value.on('user-unpublished', (user: any, mediaType: string) => {
        if (mediaType === 'audio') {
            const userId = user.uid;
            console.log(`🔇 User ${userId} unpublished audio`);
            
            // Clear any pending subscribe timeouts
            if (subscribeDebounceTimeouts[userId]) {
                clearTimeout(subscribeDebounceTimeouts[userId]);
                delete subscribeDebounceTimeouts[userId];
            }
            
            // Remove from queue jika ada
            publishQueue = publishQueue.filter(u => u.uid !== userId);
            
            // Cleanup subscription
            subscribedUsers.value.delete(userId);
            if (remoteAudioTrack.value[userId]) {
                try {
                    remoteAudioTrack.value[userId].stop();
                    remoteAudioTrack.value[userId].close();
                } catch (e) {
                    // Ignore cleanup errors
                }
                delete remoteAudioTrack.value[userId];
            }
            
            console.log(`🧹 Cleanup completed for user ${userId}`);
        }
    });
    
    // User left event - comprehensive cleanup
    client.value.on('user-left', (user: any) => {
        const userId = user.uid;
        console.log(`👋 User ${userId} left channel`);
        
        // Clear any pending subscribe timeouts
        if (subscribeDebounceTimeouts[userId]) {
            clearTimeout(subscribeDebounceTimeouts[userId]);
            delete subscribeDebounceTimeouts[userId];
        }
        
        // Remove from queue
        publishQueue = publishQueue.filter(u => u.uid !== userId);
        
        // Cleanup subscription
        subscribedUsers.value.delete(userId);
        if (remoteAudioTrack.value[userId]) {
            try {
                remoteAudioTrack.value[userId].stop();
                remoteAudioTrack.value[userId].close();
            } catch (e) {
                // Ignore cleanup errors
            }
            delete remoteAudioTrack.value[userId];
        }
        
        console.log(`🧹 User ${userId} completely removed from state`);
    });

    // ✅ FIX 4: Enhanced connection state monitoring dengan auto-recovery
    client.value.on('connection-state-change', (curState: string, prevState: string) => {
        console.log('🔗 Connection state changed:', prevState, '→', curState);
        
        // Clear all pending timeouts pada state changes
        if (curState !== 'CONNECTED') {
            Object.values(subscribeDebounceTimeouts).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
            // Clear object
            Object.keys(subscribeDebounceTimeouts).forEach(key => {
                delete subscribeDebounceTimeouts[Number(key)];
            });
            publishQueue = [];
        }
        
        if (curState === 'CONNECTED') {
            console.log('✅ Connected to channel - starting optimized subscribe process');
            
            // Trigger manual subscribe dengan progressive delays
            setTimeout(() => {
                if (client.value?.connectionState === 'CONNECTED') {
                    manuallyTriggerSubscribe();
                }
            }, 1000);
            
            // Backup subscribe setelah 3 detik
            setTimeout(() => {
                if (client.value?.connectionState === 'CONNECTED') {
                    const remoteUsers = client.value.remoteUsers;
                    if (remoteUsers.length > 0 && subscribedUsers.value.size === 0) {
                        console.log('🔄 Backup subscribe triggered');
                        manuallyTriggerSubscribe();
                    }
                }
            }, 3000);
        } else if (curState === 'DISCONNECTED' || curState === 'FAILED') {
            console.warn('🚨 Connection lost or failed, cleaning up...');
            // Reset subscription state
            subscribedUsers.value.clear();
            publishQueue = [];
        }
    });

    // ✅ FIX 5: Additional event listeners untuk better debugging
    client.value.on('user-info-updated', (uid: number, msg: string) => {
        console.log(`ℹ️ User ${uid} info updated:`, msg);
    });

    client.value.on('token-privilege-will-expire', () => {
        console.warn('⚠️ Token privilege will expire soon');
    });

    client.value.on('token-privilege-did-expire', () => {
        console.error('❌ Token privilege expired');
    });

    // ✅ FIX 6: Track listener setup dengan type safety
    window.agoraListenersSetup = true;
    
    console.log('✅ Enhanced audio listeners setup completed with:', {
        debounceTime: `${SUBSCRIBE_DEBOUNCE_MS}ms`,
        queueSystem: 'enabled',
        autoRecovery: 'enabled'
    });
};

// ✅ FIX: Tambahkan cleanup function untuk listeners dengan type safety
const cleanupAudioListeners = () => {
    if (client.value) {
        try {
            client.value.removeAllListeners();
            console.log('🧹 Audio listeners cleaned up');
        } catch (error) {
            console.warn('⚠️ Error cleaning up audio listeners:', error);
        }
    }
    // ✅ FIX: Type-safe cleanup
    if (typeof window !== 'undefined') {
        window.agoraListenersSetup = false;
    }
};

    // ✅ PERBAIKAN: Improved join channel dengan state preservation
const joinChannel = async (channelName: string): Promise<boolean> => {
    let retryCount = 0;
    const maxRetries = 2;
    
    // ✅ FIX: Preserve call state sebelum memulai join process
    const originalCallData = { ...activeCallData.value };
    
    while (retryCount <= maxRetries) {
        try {
            console.log(`🚀 Joining channel attempt ${retryCount + 1}/${maxRetries + 1}...`);

            // ✅ FIX: Jangan reset state sepenuhnya, hanya cleanup Agora resources
            await cleanupAgoraResources();
            await new Promise(resolve => setTimeout(resolve, 500));

            // Buat instance klien baru
            client.value = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            console.log('✨ Fresh Agora client instance created.');
            
            // Setup audio listeners
            setupAudioListeners();

            // Dapatkan token
            const response = await axios.post('/call/token', {
                channel: channelName,
                uid: 0,
            });
            const { app_id, token } = response.data;

            console.log('📡 Joining channel...');
            await client.value.join(app_id, channelName, token || null, 0); 
            
            console.log(`✅✅✅ SUCCESSFULLY JOINED channel: ${channelName} as user ${client.value.uid}`);

            // Setup dan publish audio
            if (!localAudioTrack.value) {
                const audioReady = await setupAudio();
                if (!audioReady) {
                    throw new Error('Failed to setup audio');
                }
            }
            
            if (localAudioTrack.value) {
                await client.value.publish([localAudioTrack.value]);
                console.log('✅ AUDIO published successfully');
            }

            isInVoiceCall.value = true;

            // Single, delayed manual subscribe sebagai backup
            console.log('🔊 Scheduling single manual subscribe...');
            setTimeout(() => {
                if (isInVoiceCall.value) {
                    manuallyTriggerSubscribe();
                }
            }, 2000);

            return true;

        } catch (error: any) {
            retryCount++;
            console.error(`❌ JOIN ATTEMPT ${retryCount} FAILED:`, error);
            
            // ✅ FIX: Hanya cleanup Agora resources, jangan reset call state
            await cleanupAgoraResources();
            
            if (retryCount > maxRetries) {
                // Final attempt failed
                console.error('❌ ALL JOIN ATTEMPTS FAILED');
                return false;
            }
            
            // Wait sebelum retry
            console.log(`⏳ Retrying in 1 second... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return false;
};

// ✅ FIX: Tambahkan fungsi cleanup Agora resources tanpa reset call state
const cleanupAgoraResources = async (): Promise<void> => {
    try {
        // Reset audio tracks saja
        if (localAudioTrack.value) {
            localAudioTrack.value.stop();
            localAudioTrack.value.close();
            localAudioTrack.value = null;
        }
        
        Object.values(remoteAudioTrack.value).forEach((track) => {
            try {
                track.stop();
                track.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        });
        remoteAudioTrack.value = {};
        
        // Leave channel
        if (client.value && client.value.connectionState !== 'DISCONNECTED') {
            await client.value.leave();
        }
        
        // Clear subscribed users
        subscribedUsers.value.clear();
        subscribingUsers.value.clear();
        
        console.log('🧹 Agora resources cleaned up');
    } catch (error) {
        console.warn('⚠️ Error during Agora cleanup:', error);
    }
};

    // ✅ PERBAIKAN: Simple start voice call
    const startVoiceCall = async (contact: Chat | null) => {
        if (!contact || contact.type !== 'user') {
            console.log('No active contact or contact is not a user');
            return;
        }

        try {
            console.log('🚀 Starting voice call to:', contact.name);

            // Setup audio permissions
            const audioReady = await setupAudio();
            if (!audioReady) {
                alert('Tidak bisa mengakses mikrofon. Mohon periksa izin browser Anda.');
                return;
            }
            
            // Ensure listeners are initialized
            if (!personalCallListenersInitialized) {
                initializePersonalCallListeners();
            }
            
            // Stop any existing timeout
            stopCallTimeout();
            
            // Send invite request
            const response = await axios.post('/call/invite', {
                callee_id: contact.id,
                call_type: 'voice'
            }, {
                timeout: 10000,
            });

            console.log('📞 Call invite response:', response.data);

            const responseData = response.data;
            
            if (!responseData.call_id || !responseData.channel) {
                throw new Error('Invalid response from server - missing call_id or channel');
            }
            
            const { call_id, channel } = responseData;
            
            // Setup outgoing call data
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
            
            let errorMessage = 'Gagal memulai panggilan: ';
            if (error.code === 'NETWORK_ERROR') {
                errorMessage += 'Tidak dapat terhubung ke server.';
            } else if (error.response?.status === 422) {
                errorMessage += 'Data tidak valid.';
            } else {
                errorMessage += error.message || 'Unknown error occurred';
            }
            
            alert(errorMessage);
            resetVoiceCallState();
        }
    };

    // ✅ PERBAIKAN: Enhanced answer voice call dengan better state management
// ✅ PERBAIKAN: Enhanced answer voice call dengan better state management dan error handling
const answerVoiceCall = async (accepted: boolean, reason?: string) => {
    const callData = incomingCallVoice.value;
    if (!callData) {
        console.error('❌ Tidak ada panggilan masuk untuk dijawab.');
        return;
    }

    console.log(`📞 Menjawab panggilan: ${accepted ? 'DITERIMA' : 'DITOLAK'}`);

    // Clear incoming call state
    incomingCallVoice.value = null;
    closeNotification(callData.callId, 'personal');

    // Stop timeout
    if (incomingCallTimeout) {
        clearTimeout(incomingCallTimeout);
        incomingCallTimeout = null;
    }

    try {
        // Send answer to server
        await axios.post('/call/answer', {
            call_id: callData.callId,
            caller_id: callData.caller.id,
            accepted: accepted,
            reason: accepted ? null : (reason || 'Ditolak')
        });

        console.log(`✅ Jawaban panggilan dikirim: ${accepted ? 'diterima' : 'ditolak'}`);

        if (accepted) {
            // ✅ FIX: Setup UI state secara synchronous
            isInVoiceCall.value = true;
            activeCallData.value = {
                callId: callData.callId,
                channel: callData.channel,
                caller: callData.caller,
                callee: { id: currentUserId.value, name: currentUserName.value },
                callType: 'voice',
                isCaller: false,
                status: 'connecting'
            };

            console.log('🎯 Callee UI state diupdate:', activeCallData.value);

            // ✅ FIX: Join channel dengan proper error handling dan retry mechanism
            try {
                console.log('🚀 Callee attempting to join channel:', callData.channel);
                
                const joinSuccess = await joinChannel(callData.channel);
                
                if (joinSuccess) {
                    // ✅ FIX: Update status setelah berhasil join
                    if (activeCallData.value) {
                        activeCallData.value.status = 'connected';
                    }
                    console.log('✅ Callee berhasil join dan terhubung.');
                    
                    // ✅ FIX: Force UI update dengan delay untuk memastikan state terupdate
                    setTimeout(() => {
                        if (activeCallData.value) {
                            activeCallData.value = { ...activeCallData.value };
                        }
                    }, 200);
                } else {
                    throw new Error('Join channel returned false');
                }
                
            } catch (error: any) {
                console.error('❌ Callee gagal join channel:', error);
                
                // ✅ FIX: Reset state dan beri feedback ke user
                if (activeCallData.value) {
                    activeCallData.value.status = 'failed';
                }

                if (!accepted) {
                 // ✅ FIX: Untuk rejected call, reset state sepenuhnya
                 console.log('🔄 Reset state untuk rejected call');
                 resetVoiceCallState();
                }
                
                // ✅ FIX: Tampilkan alert yang lebih informatif
                const errorMessage = error.message || 'Unknown error';
                alert(`Gagal terhubung ke panggilan: ${errorMessage}`);
                
                // ✅ FIX: Reset state setelah alert
                setTimeout(() => {
                    resetVoiceCallState();
                }, 100);
                
                return; // Stop execution here
            }
        }

    } catch (error: any) {
        console.error('❌ Gagal merespons panggilan:', error);
        
        // ✅ FIX: Reset state dengan error handling
        resetVoiceCallState();
        
        alert(`Gagal merespons panggilan: ${error.message || 'Unknown error'}`);
    }
};

    // ✅ PERBAIKAN: Enhanced caller join dengan better null safety dan state management
const joinCallAsCaller = async (): Promise<boolean> => {
    // ✅ FIX: Simpan reference ke activeCallData sebelum async operations
    const currentCallData = activeCallData.value;
    const currentOutgoingCall = outgoingCallVoice.value;
    
    if (!currentCallData) {
        console.error('❌ Tidak ada data panggilan untuk caller');
        return false;
    }

    try {
        console.log('🎯 Caller joining channel setelah panggilan diterima...');
        
        if (!currentCallData.channel) {
            throw new Error('Channel tidak tersedia');
        }

        // ✅ FIX: Update status dengan null checking
        if (activeCallData.value) {
            activeCallData.value.status = 'connecting';
        }
        if (currentOutgoingCall) {
            currentOutgoingCall.status = 'connecting';
        }

        console.log('📞 Joining channel:', currentCallData.channel);
        const joinSuccess = await joinChannel(currentCallData.channel);
        
        if (joinSuccess) {
            // ✅ FIX: Update status dengan null checking setelah join berhasil
            if (activeCallData.value) {
                activeCallData.value.status = 'connected';
            }
            if (currentOutgoingCall && outgoingCallVoice.value) {
                outgoingCallVoice.value.status = 'connected';
            }
            
            console.log('✅ Caller berhasil join channel');
            
            // ✅ FIX: Force UI re-render dengan safety check
            setTimeout(() => {
                if (activeCallData.value) {
                    activeCallData.value = { ...activeCallData.value };
                }
            }, 100);
            
            return true;
        } else {
            throw new Error('Join channel gagal');
        }
        
    } catch (error: any) {
        console.error('❌ Caller gagal join channel:', error);
        
        // ✅ FIX: Update state to failed dengan null checking
        if (activeCallData.value) {
            activeCallData.value.status = 'failed';
        }
        if (currentOutgoingCall && outgoingCallVoice.value) {
            outgoingCallVoice.value.status = 'failed';
        }
        
        console.error('Gagal terhubung ke panggilan:', error.message);
        return false;
    }
};

    // ✅ PERBAIKAN: Simple end call
    const endVoiceCallWithReason = async (reason?: string) => {
        console.log('📞 Mengakhiri panggilan:', reason);

        // Get call data before reset
        const callData = activeCallData.value;
        const callId = callData?.callId || outgoingCallVoice.value?.callId || incomingCallVoice.value?.callId;
        
        // Reset local state first for responsive UI
        resetVoiceCallState();

        // Notify server if we have call data
        if (callId && callData) {
            try {
                const participant_ids = [callData.caller.id, callData.callee.id];

                await axios.post('/call/end', {
                    call_id: callId,
                    participant_ids: participant_ids,
                    reason: reason || 'Panggilan diakhiri',
                    call_type: 'voice',
                    duration: 0
                });

                console.log('✅ End call request berhasil dikirim ke server');

            } catch (error) {
                console.error('❌ Gagal mengirim end call request:', error);
            }
        }
    };

    // ✅ Event listeners (keep existing implementation)
    const initializePersonalCallListeners = () => {
    if (personalCallListenersInitialized) {
        console.log('⚠️ Personal call listeners sudah terpasang, skip...');
        return;
    }

    const userId = currentUserId.value;
    if (!userId) return;

    const privateChannel = echo.private(`user.${userId}`);
    console.log(`🎧 Menyiapkan listener PANGGILAN PERSONAL di channel: user.${userId}`);
    
    // Remove old listeners
    privateChannel.stopListening('.incoming-call');
    privateChannel.stopListening('.call-ended');
    privateChannel.stopListening('.call-accepted');
    privateChannel.stopListening('.call-rejected');
    privateChannel.stopListening('.call-timeout');
    privateChannel.stopListening('.call-started');
    privateChannel.stopListening('.MessageSent');

    // Incoming call listener - UNTUK CALLEE
    privateChannel.listen('.incoming-call', (data: any) => {
        console.log('📞 EVENT incoming-call DITERIMA oleh CALLEE:', data);
        
        if (data.call_type === 'video') {
            console.log('📹 Panggilan video diabaikan');
            return;
        }

        // ✅ FIX: Jangan abaikan jika sedang dalam panggilan lain
        if (isInVoiceCall.value) {
            console.log('⚠️ Sedang dalam panggilan, kirim busy signal');
            // Kirim busy signal ke caller
            axios.post('/call/busy', {
                call_id: data.call_id,
                caller_id: data.caller.id,
                reason: 'User sedang dalam panggilan lain'
            }).catch(console.error);
            return;
        }
        
        if (!data.caller) {
            console.error('❌ Data caller tidak ada dalam event');
            return;
        }
        
        // Find caller name
        let callerName = data.caller.name;
        if (!callerName && data.caller.id) {
            const callerUser = contacts.value.find(c => c.id === data.caller.id);
            callerName = callerUser ? callerUser.name : `User ${data.caller.id}`;
        }
        
        // ✅ FIX: Update state dengan data yang lengkap
        incomingCallVoice.value = {
            callId: data.call_id,
            caller: {
                id: data.caller.id,
                name: callerName
            },
            callType: data.call_type || 'voice',
            channel: data.channel,
            timestamp: Date.now()
        };
        
        console.log('📞 Panggilan masuk diproses oleh callee:', incomingCallVoice.value);

        handleIncomingCallNotification(data);
        
        // Setup timeout
        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
        }
        
        incomingCallTimeout = setTimeout(() => {
            if (incomingCallVoice.value?.callId === data.call_id) {
                console.log('⏰ Auto rejecting call due to timeout');
                handleIncomingCallTimeout(data.call_id);
            }
        }, 30000);
    });
    
    // Dalam fungsi initializePersonalCallListeners(), perbaiki bagian call-accepted:
privateChannel.listen('.call-accepted', async (data: any) => {
    console.log('✅ EVENT .call-accepted DITERIMA oleh CALLER:', data);
    
    if (!data.call_id || !data.channel) {
        console.error('❌ Data event tidak valid');
        return;
    }

    stopCallTimeout();
    
    // ✅ FIX: Simpan reference ke outgoing call sebelum reset
    const currentOutgoingCall = outgoingCallVoice.value;
    
    if (currentOutgoingCall && currentOutgoingCall.callId === data.call_id) {
        console.log('🚀 Optimistic UI Update: Menampilkan UI panggilan...');

        // ✅ FIX: Buat object baru untuk activeCallData
        const newActiveCallData = {
            callId: data.call_id,
            channel: data.channel,
            caller: { id: currentUserId.value, name: currentUserName.value },
            callee: data.callee || currentOutgoingCall.callee,
            callType: 'voice',
            isCaller: true,
            status: 'connecting' as const
        };
        
        // ✅ FIX: Update state secara atomic
        activeCallData.value = newActiveCallData;
        outgoingCallVoice.value = null;
        isInVoiceCall.value = true;

        console.log('🎯 Caller UI state diupdate:', newActiveCallData);

        // ✅ FIX: Gunakan try-catch untuk handle join errors dengan state preservation
        try {
            const joinSuccess = await joinCallAsCaller();
            if (joinSuccess && activeCallData.value) {
                activeCallData.value.status = 'connected';
                console.log('✅ Caller berhasil join dan terhubung.');
                
                // ✅ FIX: Force UI update
                setTimeout(() => {
                    if (activeCallData.value) {
                        activeCallData.value = { ...activeCallData.value };
                    }
                }, 200);
            } else {
                throw new Error('Join process returned false');
            }
        } catch (error: any) {
            console.error('❌ Caller gagal join:', error);
            
            // ✅ FIX: Preserve error state untuk UI feedback
            if (activeCallData.value) {
                activeCallData.value.status = 'failed';
                
                // Beri waktu untuk UI update sebelum reset
                setTimeout(() => {
                    resetVoiceCallState();
                    alert('Gagal terhubung ke panggilan: ' + (error.message || 'Unknown error'));
                }, 500);
            } else {
                resetVoiceCallState();
                alert('Gagal terhubung ke panggilan.');
            }
        }
    } else {
        console.warn('⚠️ Outgoing call tidak ditemukan untuk call-accepted event');
    }
});
        
        // Call ended listener
        privateChannel.listen('.voice-call-ended', (data: any) => {
            console.log('📞 CALL ENDED EVENT DITERIMA:', data);

            closeNotification(data.call_id, 'personal');
            stopCallTimeout();
            
            if (incomingCallTimeout) {
                clearTimeout(incomingCallTimeout);
                incomingCallTimeout = null;
            }

            console.log('🔄 Reset state karena call-ended event');
            resetVoiceCallState();

            if (data.ended_by && data.ended_by.id !== currentUserId.value) {
                const endedByName = data.ended_by.name || `User ${data.ended_by.id}`;
                alert(`Panggilan diakhiri oleh ${endedByName}`);
            }
        });
        
        // Call rejected listener
        privateChannel.listen('.call-rejected', (data: any) => {
    console.log('❌ EVENT .call-rejected DITERIMA oleh CALLER:', data);

    // ✅ FIX: Cek apakah ini panggilan keluar yang sedang aktif
    const currentOutgoingCall = outgoingCallVoice.value;
    const currentActiveCall = activeCallData.value;
    
    if ((currentOutgoingCall && currentOutgoingCall.callId === data.call_id) || 
        (currentActiveCall && currentActiveCall.callId === data.call_id)) {
        
        const rejectReason = data.reason || 'Panggilan ditolak';
        const rejectedByName = data.rejected_by?.name || 'Penerima';
        
        console.log('🔄 Reset state karena call rejected event');
        
        // ✅ FIX: Reset state secara synchronous untuk responsive UI
        resetVoiceCallState();
        
        // ✅ FIX: Force UI update sebelum alert
        setTimeout(() => {
            // Beri feedback ke penelepon
            alert(`${rejectedByName} menolak panggilan: ${rejectReason}`);
        }, 100);
        
    } else {
        console.warn('⚠️ Call rejected event tidak sesuai dengan panggilan aktif:', {
            eventCallId: data.call_id,
            outgoingCallId: currentOutgoingCall?.callId,
            activeCallId: currentActiveCall?.callId
        });
    }
});

        privateChannel.listen('.MessageSent', (eventData: any) => {
            const messageData = eventData.message || eventData;
            
            // Handle call event messages
            if (messageData.type === 'call_event') {
                console.log('📞 CALL EVENT MESSAGE DITERIMA:', messageData);
                
                // Emit event untuk parent component (Chat.vue)
                window.dispatchEvent(new CustomEvent('call-event-message', {
                    detail: messageData
                }));
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

        privateChannel.listen('.call-started', (data: any) => {
            console.log('🎬 EVENT call-started DITERIMA:', data);
            
            // Pesan call event sudah dikirim oleh backend melalui MessageSent
            if (data.message) {
                console.log('📝 Call event message created:', data.message);
            }
        });

        personalCallListenersInitialized = true;
    };


    // Timeout functions (keep existing implementation)
    const startCallTimeout = (duration: number = 30) => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        callTimeoutCountdown.value = duration;

        countdownInterval = setInterval(() => {
            if (callTimeoutCountdown.value !== null && callTimeoutCountdown.value > 0) {
                callTimeoutCountdown.value--;
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
            console.log('⏰ Call timeout - no response from callee');
            
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

    // Debug function
    // ✅ FIX: Enhanced debug function
const debugCallState = () => {
    console.log('🔍 CALL STATE DEBUG:', {
        outgoingCallVoice: outgoingCallVoice.value,
        incomingCallVoice: incomingCallVoice.value,
        activeCallData: activeCallData.value,
        isInVoiceCall: isInVoiceCall.value,
        clientState: client.value?.connectionState,
        remoteUsers: client.value?.remoteUsers?.length || 0,
        subscribedUsers: Array.from(subscribedUsers.value),
        currentUserId: currentUserId.value,
        currentUserName: currentUserName.value
    });
};

// ✅ FIX: Tambahkan function untuk force UI update
const forceUIUpdate = () => {
    if (activeCallData.value) {
        activeCallData.value = { ...activeCallData.value };
    }
    if (outgoingCallVoice.value) {
        outgoingCallVoice.value = { ...outgoingCallVoice.value };
    }
    if (incomingCallVoice.value) {
        incomingCallVoice.value = { ...incomingCallVoice.value };
    }
};

    // Cleanup
    onUnmounted(() => {
        if (countdownInterval) clearInterval(countdownInterval);
        if (incomingCallTimeout) clearTimeout(incomingCallTimeout);
        if (callTimeoutRef.value) clearTimeout(callTimeoutRef.value);
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
        manuallyTriggerSubscribe,
        debugCallState
    };
}