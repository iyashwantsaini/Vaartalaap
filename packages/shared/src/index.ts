export type RoomTab = "code" | "notes" | "whiteboard";

export interface ParticipantSummary {
  id: string;
  displayName: string;
  role: "host" | "guest" | "participant";
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface RoomWhiteboardPoint {
  x: number;
  y: number;
}

export interface RoomWhiteboardStroke {
  id: string;
  color: string;
  width: number;
  points: RoomWhiteboardPoint[];
}

export interface RoomDocuments {
  code: string;
  language: "cpp" | "c" | "javascript" | "python" | "java";
  codes: Record<string, string>;
  notes: string;
  whiteboard: RoomWhiteboardStroke[];
  input: string;
  output: string;
}

export interface RoomSnapshot {
  roomId: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  activeTab: RoomTab;
  participants: ParticipantSummary[];
  documents: RoomDocuments;
}
