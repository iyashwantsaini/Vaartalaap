import type {
  ParticipantSummary,
  RoomDocuments,
  RoomSnapshot,
  RoomTab,
  RoomWhiteboardStroke,
} from "@vaartalaap/shared";
import { randomUUID } from "crypto";
import type { ObjectId } from "mongodb";
import { getCollection } from "../config/db";

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

  async createRoom(payload: CreateRoomPayload = {}): Promise<RoomSnapshot> {
    const roomId = randomUUID();
    const now = new Date().toISOString();

    const host: ParticipantSummary = {
      id: randomUUID(),
      displayName: payload.hostName ?? "Host",
      role: "participant",
      audioEnabled: false,
      videoEnabled: false,
    };

    const snapshot: RoomSnapshot = {
      roomId,
      createdAt: now,
      updatedAt: now,
      activeTab: "code",
      participants: [host],
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
      // If they exist, just return the room (or update details if needed)
      return normalizeRoom(existingRoom);
    }

    const participant: ParticipantSummary = {
      id: participantId,
      displayName: payload.participantName?.slice(0, 64) || "Guest",
      role: "participant",
      audioEnabled: false,
      videoEnabled: false,
    };

    const room = await this.#collection().findOneAndUpdate(
      { roomId: payload.roomId },
      {
        $push: { participants: participant },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: "after" }
    );
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
