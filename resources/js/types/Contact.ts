export type Contact = {
    id: number;
    name: string;
    last_seen: string | null;
    phone_number: string | null;
    type: "user" | "group";
    members_count?: number;
};