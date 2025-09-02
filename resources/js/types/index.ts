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
    
};

export type Contact = User & {
    last_seen: string | null;
    phone_number: string | null;
    latest_message: { message: string, sender_id: number } | null;
};

// Iki "KTP" gabungan sing isok nampa Contact utowo Group
export type Chat = (Contact & { type: 'user' }) | (Group & { type: 'group' });