// resources/js/composables/useAgora.ts

import { ref } from 'vue';
import AgoraRTC from 'agora-rtc-sdk-ng';

// State Agora dibuat di sini agar menjadi global dan hanya ada satu
const client = ref<any>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
const localAudioTrack = ref<any>(null);
const remoteAudioTracks = ref<{ [uid: number]: any }>({});

export function useAgora() {

    // FUNGSI SETUP AUDIO (DIPINDAHKAN DARI CHAT.VUE)
    const setupAudio = async (): Promise<boolean> => {
        try {
            if (localAudioTrack.value) {
                localAudioTrack.value.stop();
                localAudioTrack.value.close();
            }
            localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
            console.log('✅ Microphone audio track created');
            return true;
        } catch (error) {
            console.error('❌ Failed to setup audio:', error);
            return false;
        }
    };

    // FUNGSI SETUP AUDIO LISTENERS (DIPINDAHKAN DARI CHAT.VUE)
    const setupAudioListeners = () => {
        client.value.on('user-published', async (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                await client.value.subscribe(user, mediaType);
                if (user.audioTrack) {
                    remoteAudioTracks.value[user.uid] = user.audioTrack;
                    user.audioTrack.play();
                    console.log(`🔊 Playing remote audio from UID: ${user.uid}`);
                }
            }
        });

        client.value.on('user-unpublished', (user: any, mediaType: string) => {
            if (mediaType === 'audio') {
                console.log('🔇 Remote user audio unpublished:', user.uid);
                delete remoteAudioTracks.value[user.uid];
            }
        });
    };
    
    // Panggil setupAudioListeners sekali saja
    setupAudioListeners();

    return {
        client,
        localAudioTrack,
        remoteAudioTracks,
        setupAudio
    };
}