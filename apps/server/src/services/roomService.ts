import type {
  ParticipantSummary,
  RoomDocuments,
  RoomSnapshot,
  RoomTab,
  RoomWhiteboardStroke,
} from "@vaartalaap/shared";
import { randomUUID } from "crypto";
import type { ObjectId } from "mongodb";
import { getCollection } from "../config/db.js";

interface CreateRoomPayload {
  hostName?: string;
}

interface UpdateTabPayload {
  roomId: string;
  tab: RoomTab;
}

interface JoinRoomPayload {
  roomId: string;
  participantName?: string;
  participantId?: string;
}

interface UpdateDocumentsPayload {
  roomId: string;
  patch: Partial<Pick<RoomDocuments, "code" | "language" | "notes" | "whiteboard" | "codes" | "input" | "output">>;
}

// Hard cap on concurrent participants per room. Mesh WebRTC scales O(N²) so
// a small cap protects everyone's browser from melting and prevents a single
// attacker (with a leaked room link) from flooding 200 sockets to DoS peers.
const MAX_PARTICIPANTS_PER_ROOM = 5;

export class RoomFullError extends Error {
  statusCode = 409;
  constructor() {
    super(`Room is full (max ${MAX_PARTICIPANTS_PER_ROOM} participants).`);
  }
}

const DEFAULT_CODE = `#include <iostream>

int main() {
    std::cout << "Hello World" << std::endl;
    return 0;
}`;

const DEFAULT_DOCUMENTS: RoomDocuments = {
  code: DEFAULT_CODE,
  language: "cpp",
  codes: {
    cpp: DEFAULT_CODE,
  },
  notes: "Capture interview notes, rubrics, and follow-ups here.",
  whiteboard: [],
  input: "",
  output: "",
};

const ensureDocuments = (documents?: RoomDocuments): RoomDocuments => ({
  code: documents?.code ?? DEFAULT_DOCUMENTS.code,
  language: documents?.language ?? DEFAULT_DOCUMENTS.language,
  codes: documents?.codes ?? DEFAULT_DOCUMENTS.codes,
  notes: documents?.notes ?? DEFAULT_DOCUMENTS.notes,
  whiteboard: documents?.whiteboard ? [...documents.whiteboard] : [],
  input: documents?.input ?? DEFAULT_DOCUMENTS.input,
  output: documents?.output ?? DEFAULT_DOCUMENTS.output,
});

type RoomDocument = RoomSnapshot & { _id?: ObjectId; updatedAt: string };

const normalizeRoom = (doc: RoomDocument | null): RoomSnapshot | null => {
  if (!doc) return null;
  const { _id, documents, ...rest } = doc;
  return { ...rest, documents: ensureDocuments(documents) };
};

class RoomService {
  #collection = () => getCollection<RoomDocument>("rooms");

  async createRoom(_payload: CreateRoomPayload = {}): Promise<RoomSnapshot> {
    const roomId = randomUUID();
    const now = new Date().toISOString();

    const snapshot: RoomSnapshot = {
      roomId,
      createdAt: now,
      updatedAt: now,
      activeTab: "code",
      participants: [],
      documents: ensureDocuments(),
    };

    await this.#collection().insertOne(snapshot as RoomDocument);
    return snapshot;
  }

  async getRoom(roomId: string): Promise<RoomSnapshot | null> {
    const room = await this.#collection().findOne({ roomId });
    return normalizeRoom(room);
  }

  async updateActiveTab(payload: UpdateTabPayload): Promise<RoomSnapshot | null> {
    const room = await this.#collection().findOneAndUpdate(
      { roomId: payload.roomId },
      {
        $set: { activeTab: payload.tab, updatedAt: new Date().toISOString() },
      },
      { returnDocument: "after" }
    );
    return normalizeRoom((room as RoomDocument | null) ?? null);
  }

  async joinRoom(payload: JoinRoomPayload): Promise<RoomSnapshot | null> {
    const participantId = payload.participantId ?? randomUUID();
    
    // Check if participant already exists to avoid duplicates
    const existingRoom = await this.#collection().findOne({ 
      roomId: payload.roomId, 
      "participants.id": participantId 
    });

    if (existingRoom) {
      // Existing participant: update their displayName if a new (non-empty)
      // one was provided. Without this, a user who rejoins under a different
      // handle ("karan_dev" → "yash_dev") would still appear under the old
      // name to everyone else in the room.
      const trimmed = payload.participantName?.trim();
      if (trimmed) {
        const updated = await this.#collection().findOneAndUpdate(
          { roomId: payload.roomId, "participants.id": participantId },
          {
            $set: {
              "participants.$.displayName": trimmed.slice(0, 64),
              updatedAt: new Date().toISOString(),
            },
          },
          { returnDocument: "after" }
        );
        return normalizeRoom((updated as RoomDocument | null) ?? existingRoom);
      }
      return normalizeRoom(existingRoom);
    }

    // Capacity check — read current room first to refuse new joiners once full.
    // Cheap: rooms collection is tiny and we already need the doc for the
    // existence check below anyway.
    const currentRoom = await this.#collection().findOne({ roomId: payload.roomId });
    if (!currentRoom) return null;
    if ((currentRoom.participants?.length ?? 0) >= MAX_PARTICIPANTS_PER_ROOM) {
      throw new RoomFullError();
    }

    const participant: ParticipantSummary = {
      id: participantId,
      displayName: payload.participantName?.slice(0, 64) || "Guest",
      role: "participant",
      audioEnabled: false,
      videoEnabled: false,
    };

    // Atomic conditional push: only insert when participantId is NOT already
    // in the array. Without `"participants.id": { $ne: ... }`, two parallel
    // joins for the same pid (e.g. socket auto-reconnect racing the explicit
    // re-emit) both pass the existence check and both $push, producing a
    // duplicate entry.
    const room = await this.#collection().findOneAndUpdate(
      { roomId: payload.roomId, "participants.id": { $ne: participantId } },
      {
        $push: { participants: participant },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: "after" }
    );
    if (!room) {
      // Race: someone else inserted the same pid between our findOne and our
      // updateOne. Re-fetch and return so the caller sees the latest state.
      return this.getRoom(payload.roomId);
    }
    return normalizeRoom((room as RoomDocument | null) ?? null);
  }

  async updateDocuments(payload: UpdateDocumentsPayload): Promise<RoomSnapshot | null> {
    const setOps: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.patch.code !== undefined) {
      setOps["documents.code"] = payload.patch.code;
    }
    if (payload.patch.language !== undefined) {
      setOps["documents.language"] = payload.patch.language;
    }
    if (payload.patch.notes !== undefined) {
      setOps["documents.notes"] = payload.patch.notes;
    }
    if (payload.patch.whiteboard !== undefined) {
      setOps["documents.whiteboard"] = payload.patch.whiteboard as RoomWhiteboardStroke[];
    }
    if (payload.patch.codes !== undefined) {
      for (const [lang, code] of Object.entries(payload.patch.codes)) {
        setOps[`documents.codes.${lang}`] = code;
      }
    }
    if (payload.patch.input !== undefined) {
      setOps["documents.input"] = payload.patch.input;
    }
    if (payload.patch.output !== undefined) {
      setOps["documents.output"] = payload.patch.output;
    }

    if (Object.keys(setOps).length === 1) {
      return this.getRoom(payload.roomId);
    }

    const room = await this.#collection().findOneAndUpdate(
      { roomId: payload.roomId },
      { $set: setOps },
      { returnDocument: "after" }
    );
    return normalizeRoom((room as RoomDocument | null) ?? null);
  }

  async removeParticipant(roomId: string, participantId: string): Promise<RoomSnapshot | null> {
    const room = await this.#collection().findOneAndUpdate(
      { roomId },
      {
        $pull: { participants: { id: participantId } as any },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: "after" }
    );
    return normalizeRoom((room as RoomDocument | null) ?? null);
  }
}

export const roomService = new RoomService();
