import { ref } from 'vue';

// Definisikan interface baru untuk NotificationOptions dengan properti 'actions'
interface NotificationOptionsWithActions extends NotificationOptions {
    actions?: {
        action: string;
        title: string;
        icon?: string;
    }[];
}

export class CallNotificationManager {
    private isSupported: boolean;
    private permission: NotificationPermission;
    private registration: ServiceWorkerRegistration | null;
    private notificationQueue: Array<{type: string, data: any, timestamp: number}>;
    private isProcessing: boolean;
    private closeTimeout: ReturnType<typeof setTimeout> | null;

    constructor() {
        this.isSupported = 'Notification' in window;
        this.permission = this.isSupported ? Notification.permission : 'default';
        this.registration = null; // Inisialisasi sebagai null
        this.notificationQueue = [];
        this.isProcessing = false;
        this.closeTimeout = null;
        
        this.initializeServiceWorker();
    }

    private async initializeServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Logika registrasi service worker ada di sini, bukan di constructor
                this.registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered successfully');
            } catch (error) {
                console.warn('⚠️ Service Worker registration failed:', error);
            }
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!this.isSupported) {
            console.warn('❌ Browser tidak mendukung notifikasi');
            return false;
        }
        
        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }
        
        return this.permission === 'granted';
    }

    async sendPersonalCallNotification(callData: any): Promise<void> {
        if (!await this.requestPermission()) return;
        this.notificationQueue.push({ type: 'personal', data: callData, timestamp: Date.now() });
        this.processQueue();
    }

    async sendGroupCallNotification(callData: any): Promise<void> {
        if (!await this.requestPermission()) return;
        this.notificationQueue.push({ type: 'group', data: callData, timestamp: Date.now() });
        this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.notificationQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            if (!notification || Date.now() - notification.timestamp > 10000) continue;
            
            try {
                await this.sendNotification(notification);
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('❌ Error sending notification:', error);
            }
        }
        
        this.isProcessing = false;
    }

    private async sendNotification(notification: any): Promise<void> {
        const { type, data } = notification;
        
        const title = type === 'personal' ? 'Panggilan Suara Masuk' : 'Panggilan Grup Masuk';
        const body = type === 'personal' 
            ? `${data.caller.name} sedang menelpon Anda`
            : `${data.caller.name} mengundang Anda ke panggilan grup: ${data.group?.name || 'Grup'}`;

        const tag = type === 'personal' ? `call-${data.call_id}` : `group-call-${data.call_id}`;

        // Gunakan interface baru di sini
        const options: NotificationOptionsWithActions = {
            body: body,
            icon: '/images/phone-icon.png',
            badge: '/images/badge-72x72.png',
            tag: tag,
            requireInteraction: true,
            actions: [
                { action: 'accept', title: type === 'personal' ? ' Terima' : ' Gabung' },
                { action: 'reject', title: ' Tolak' }
            ],
            data: {
                callId: data.call_id,
                callType: type,
                channel: data.channel,
                url: window.location.origin + '/chat'
            }
        };

        if (this.registration && this.registration.active) {
            try {
                await this.registration.showNotification(title, options);
                console.log('✅ Notification sent via Service Worker');
                return;
            } catch (error) {
                console.warn('⚠️ Service Worker notification failed, falling back...', error);
            }
        }

        if (this.isSupported && this.permission === 'granted') {
            const classicNotification = new Notification(title, options);
            classicNotification.onclick = () => {
                window.focus();
                classicNotification.close();
                window.dispatchEvent(new CustomEvent('call-notification-click', {
                    detail: { callId: data.call_id, action: 'accept', callType: type }
                }));
            };
            console.log('✅ Notification sent via Web Notifications API (fallback)');
        }
    }

    closeNotification(callId: string, callType: string = 'personal'): void {
        if (this.closeTimeout) clearTimeout(this.closeTimeout);
        this.closeTimeout = setTimeout(() => this._closeNotification(callId, callType), 300);
    }

    private _closeNotification(callId: string, callType: string): void {
        const tag = callType === 'group' ? `group-call-${callId}` : `call-${callId}`;
        
        if (this.registration) {
            this.registration.getNotifications({ tag }).then(notifications => {
                notifications.forEach(notification => notification.close());
                console.log(`✅ Closed notifications for ${tag}`);
            });
        }
    }

    setupNotificationListeners(): void {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                    this.handleNotificationAction(event.data);
                }
            });
        }
        window.addEventListener('call-notification-click', (event: any) => {
            this.handleNotificationAction(event.detail);
        });
    }

    private handleNotificationAction(data: any): void {
        console.log('🎯 Notification action received:', data);
        window.dispatchEvent(new CustomEvent('call-notification-action', {
            detail: {
                callId: data.callId,
                action: data.action,
                callType: data.callType || 'personal'
            }
        }));
    }

    isNotificationSupported(): boolean {
        return this.isSupported;
    }

    getPermissionStatus(): NotificationPermission {
        return this.permission;
    }
}

const callNotificationManager = new CallNotificationManager();

export function useCallNotification() {
    const isSupported = ref(callNotificationManager.isNotificationSupported());
    const permission = ref(callNotificationManager.getPermissionStatus());

    const setupListeners = () => callNotificationManager.setupNotificationListeners();
    const requestPermission = async () => {
        const result = await callNotificationManager.requestPermission();
        permission.value = callNotificationManager.getPermissionStatus();
        return result;
    };
    const sendPersonalCallNotification = (callData: any) => callNotificationManager.sendPersonalCallNotification(callData);
    const sendGroupCallNotification = (callData: any) => callNotificationManager.sendGroupCallNotification(callData);
    const closeNotification = (callId: string, callType: string = 'personal') => callNotificationManager.closeNotification(callId, callType);

    return {
        isSupported,
        permission,
        setupListeners,
        requestPermission,
        sendPersonalCallNotification,
        sendGroupCallNotification,
        closeNotification
    };
}