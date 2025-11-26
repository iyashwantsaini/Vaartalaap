import type { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { RoomDocuments, RoomTab } from "@vaartalaap/shared";
import { env } from "./env";
import { roomService } from "../services/roomService";
import { logger } from "../lib/logger";

interface JoinRoomPayload {
  roomId: string;
  participantId?: string;
}

interface DocumentChangePayload {
  roomId: string;
  patch: Partial<Pick<RoomDocuments, "code" | "language" | "notes" | "whiteboard">>;
}

interface RtcSignalPayload {
  roomId: string;
  from: string;
  to?: string;
  sdp?: unknown;
  candidate?: unknown;
}

export const bootstrapSocket = (httpServer: HTTPServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`socket connected ${socket.id}`);

    socket.on("room:join", async ({ roomId, participantId }: JoinRoomPayload) => {
      logger.info(`room:join from ${socket.id} for room ${roomId} participant ${participantId}`);
      socket.join(roomId);
      
      if (participantId) {
        socket.data.participantId = participantId;
        socket.data.roomId = roomId;
        
        // Fetch latest room state to broadcast updated participant list
        // This ensures everyone sees the new joiner immediately
        const room = await roomService.getRoom(roomId);
        if (room) {
          io.to(roomId).emit("room:participants-update", room.participants);
        }
      }
    });

    socket.on("room:join-call", ({ roomId }: { roomId: string }) => {
      if (!socket.data.participantId) {
        logger.warn(`Unauthorized join-call attempt from ${socket.id}`);
        return;
      }
      logger.info(`room:join-call from ${socket.id} for room ${roomId}`);
      socket.to(roomId).emit("room:call-user-joined", { socketId: socket.id });
    });

    socket.on("room:leave-call", ({ roomId }: { roomId: string }) => {
      logger.info(`room:leave-call from ${socket.id} for room ${roomId}`);
      socket.to(roomId).emit("room:call-user-left", { socketId: socket.id });
    });

    socket.on("room:tab-change", async ({ roomId, tab }: { roomId: string; tab: RoomTab }) => {
      if (!socket.data.participantId) {
        logger.warn(`Unauthorized tab-change attempt from ${socket.id}`);
        return;
      }
      try {
        logger.info(`room:tab-change ${roomId} -> ${tab} from ${socket.id}`);
        const snapshot = await roomService.updateActiveTab({ roomId, tab });
        if (snapshot) {
          logger.info(`room:tab-changed broadcasting ${snapshot.activeTab} for ${roomId}`);
          io.to(roomId).emit("room:tab-changed", snapshot.activeTab);
        }
      } catch (error) {
        logger.error("Failed to update tab", error);
      }
    });

    socket.on("room:doc-change", async ({ roomId, patch }: DocumentChangePayload) => {
      if (!socket.data.participantId) {
        logger.warn(`Unauthorized doc-change attempt from ${socket.id}`);
        return;
      }
      try {
        logger.info(`room:doc-change for ${roomId} from ${socket.id}`, { keys: Object.keys(patch) });
        const snapshot = await roomService.updateDocuments({ roomId, patch });
        if (snapshot) {
          logger.info(`room:documents-updated broadcasting for ${roomId}`);
          io.to(roomId).emit("room:documents-updated", {
            roomId,
            documents: snapshot.documents,
          });
        }
      } catch (error) {
        logger.error("Failed to update documents", error);
      }
    });

    // Simple room-scoped signaling; clients filter what they care about
    socket.on("room:rtc-offer", ({ roomId, to, sdp }: RtcSignalPayload) => {
      logger.info(`room:rtc-offer in ${roomId} from ${socket.id} to ${to ?? "broadcast"}`);
      const payload: RtcSignalPayload = { roomId, from: socket.id, to, sdp };
      socket.to(roomId).emit("room:rtc-offer", payload);
    });

    socket.on("room:rtc-answer", ({ roomId, to, sdp }: RtcSignalPayload) => {
      logger.info(`room:rtc-answer in ${roomId} from ${socket.id} to ${to ?? "broadcast"}`);
      const payload: RtcSignalPayload = { roomId, from: socket.id, to, sdp };
      if (to) {
        socket.to(to).emit("room:rtc-answer", payload);
      } else {
        socket.to(roomId).emit("room:rtc-answer", payload);
      }
    });

    socket.on("room:rtc-ice", ({ roomId, to, candidate }: RtcSignalPayload) => {
      const payload: RtcSignalPayload = { roomId, from: socket.id, to, candidate };
      if (to) {
        socket.to(to).emit("room:rtc-ice", payload);
      } else {
        socket.to(roomId).emit("room:rtc-ice", payload);
      }
    });

    socket.on("disconnecting", () => {
      logger.info(`socket disconnecting ${socket.id}`);
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          socket.to(roomId).emit("room:call-user-left", { socketId: socket.id });
        }
      }
    });

    socket.on("disconnect", async () => {
      logger.info(`socket disconnected ${socket.id}`);
      const { roomId, participantId } = socket.data;
      if (roomId && participantId) {
        logger.info(`removing participant ${participantId} from room ${roomId}`);
        const room = await roomService.removeParticipant(roomId, participantId);
        if (room) {
          io.to(roomId).emit("room:participants-update", room.participants);
        }
      }
    });
  });

  return io;
};
