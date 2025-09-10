export type CallStatus =
  | "idle"
  | "ringing"
  | "calling"
  | "incoming"
  | "connected"
  | "ended"
  | "rejected"
  | "missed";
    "calling";

export type Participants = {
    id: number;
    name: string;
    status: "calling" | "rejected" | "missed" | "accepted";
};
