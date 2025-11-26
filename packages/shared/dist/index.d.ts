export type RoomTab = "code" | "notes" | "whiteboard";
export interface ParticipantSummary {
    id: string;
    displayName: string;
    role: "host" | "guest";
    audioEnabled: boolean;
    videoEnabled: boolean;
}
export interface RoomSnapshot {
    roomId: string;
    createdAt: string;
    updatedAt?: string;
    expiresAt?: string;
    activeTab: RoomTab;
    participants: ParticipantSummary[];
}
