import type { LucideIcon } from 'lucide-vue-next';
import type { Config } from 'ziggy-js';

declare module 'agora-rtc-sdk-ng' {
    export interface IAgoraRTCClient {
        join(appId: string, channel: string, token: string, uid: number): Promise<void>;
        leave(): Promise<void>;
        publish(tracks: any[]): Promise<void>;
        on(event: string, callback: Function): void;
    }
    export interface IMicrophoneAudioTrack {
        play(): void;
        stop(): void;
        close(): void;
    }
    export interface ICameraVideoTrack {
        play(element: string | HTMLElement): void;
        stop(): void;
        close(): void;
    }
    export function createClient(config: { mode: string, codec: string }): IAgoraRTCClient;
    export function createMicrophoneAudioTrack(): Promise<IMicrophoneAudioTrack>;
    export function createCameraVideoTrack(): Promise<ICameraVideoTrack>;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    last_seen?: string | null;
    phone_number?: string | null;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    profile_photo_url: string;
    background_image_url: string;
    background_image_path: string | null;
    latest_message: LatestMessage | null;
}

export interface LatestMessage {
    message: string;
    sender_id: number;
    sender: {
        id: number;
        name: string;
    };
}

export interface Group {
    id: number;
    name: string;
    members_count: number;
    owner_id: number;
    members: User[];
    latest_message: LatestMessage | null;
}

export type Contact = User & {
    latest_message: { message: string, sender_id: number } | null;
};

export type Chat = (Contact & { type: 'user' }) | (Group & { type: 'group' });

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}
export type BreadcrumbItemType = BreadcrumbItem;

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon;
    isActive?: boolean;
}

export type AppPageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
};