import type { RoomSnapshot } from "@vaartalaap/shared";

const DEFAULT_BASE_URL = "http://localhost:4000";

const resolveBaseUrl = () => import.meta.env.VITE_API_BASE ?? DEFAULT_BASE_URL;

const jsonHeaders = {
  "Content-Type": "application/json",
};

const parseResponse = async <T>(response: Response) => {
  if (!response.ok) {
    const message = (await response.json().catch(() => null))?.message ?? "Unexpected server error";
    throw new Error(message);
  }
  return (await response.json()) as T;
};

export const api = {
  async createRoom(hostName?: string) {
    const response = await fetch(`${resolveBaseUrl()}/api/rooms`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ hostName }),
    });
    return parseResponse<RoomSnapshot>(response);
  },
  async fetchRoom(roomId: string) {
    const response = await fetch(`${resolveBaseUrl()}/api/rooms/${roomId}`);
    return parseResponse<RoomSnapshot>(response);
  },
  async joinRoom(roomId: string, displayName?: string, participantId?: string) {
    const response = await fetch(`${resolveBaseUrl()}/api/rooms/${roomId}/join`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ displayName, participantId }),
    });
    return parseResponse<RoomSnapshot>(response);
  },
};
