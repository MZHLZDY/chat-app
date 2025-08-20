import type { LucideIcon, MessageCircleMore } from 'lucide-vue-next';
import type { Config } from 'ziggy-js';

// src/agora-rtc.d.ts
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

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

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

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export type BreadcrumbItemType = BreadcrumbItem;
