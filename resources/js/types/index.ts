export type User = {
    id: number;
    name: string;
};

export type Group = {
    id: number;
    name: string;
    members_count: number;
    owner_id: number;
    members: User[];
    latest_message: LatestMessage | null;
};

export type Contact = User & {
    last_seen: string | null;
    phone_number: string | null;
    latest_message: { message: string, sender_id: number } | null;
};

export interface BreadcrumbItem {
    text: string;
    title?: string;
    href?: string;
    active?: boolean;
}

interface LatestMessage {
  message: string;
  sender_id: number;
  sender: {
    id: number;
    name: string;
  };
}

export type Chat = (Contact & { type: 'user' }) | (Group & { type: 'group' });