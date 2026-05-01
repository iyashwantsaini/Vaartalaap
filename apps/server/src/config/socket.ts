import type { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { RoomDocuments, RoomTab } from "@vaartalaap/shared";
import { env } from "./env.js";
import { roomService } from "../services/roomService.js";
import { yjsService } from "../services/yjsService.js";
import { logger } from "../lib/logger.js";

interface JoinRoomPayload {
  roomId: string;
  participantId?: string;
  // Sent on (re)join so the server can re-add the participant after a
  // grace-period removal (network blip, dev HMR, mobile sleep). Without it
  // the participant becomes a “ghost” — socket joined the broadcast group
  // but never re-added to the room document.
  displayName?: string;
}

interface DocumentChangePayload {
  roomId: string;
  patch: Partial<Pick<RoomDocuments, "code" | "language" | "notes" | "whiteboard">>;
}

const MAX_CODE_BYTES = 100_000;   // 100 KB
const MAX_NOTES_BYTES = 50_000;   // 50 KB
const MAX_OUTPUT_BYTES = 50_000;  // 50 KB
const MAX_WHITEBOARD_STROKES = 500;

// Mesh WebRTC + collab caps. Mirrors MAX_PARTICIPANTS_PER_ROOM in roomService
// — enforced here too because socket clients can bypass the HTTP /join route
// and fire `room:join` directly.
const MAX_PARTICIPANTS_PER_ROOM = 5;
// Anti-DoS for Yjs collab: per-socket rolling window on yjs:update.
const YJS_UPDATES_PER_SEC = 50;
const YJS_WINDOW_MS = 1000;
// Cap distinct (roomId, docName) pairs the server will spin up per room.
// Without this an attacker could allocate thousands of in-memory Y.Docs.
const MAX_DOCS_PER_ROOM = 20;

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

  // Cross-socket reference count of (roomId, participantId) pairs.
  //
  // Why this exists: when the user opens the same room in two windows via
  // "Open in new window" / "Duplicate tab" / window.open, the browser COPIES
  // sessionStorage to the new window. Both windows then have the same
  // participantId. Each window has its own socket, but the database has only
  // ONE participant entry (joinRoom dedupes by id). If we remove the DB
  // participant the moment either socket disconnects, we orphan the surviving
  // window — its UI shows itself as "left" and peers stop seeing it.
  //
  // We only actually remove the DB entry when the refcount for the pair drops
  // to zero AND a grace period elapses. The grace period absorbs the natural
  // gap between a tab refresh's "disconnect" and the new socket's "join" so
  // peers never see the participant flicker out and back in.
  const participantRefs = new Map<string, number>();
  // Pending removals scheduled while refcount==0. If a new join arrives for
  // the same (room, pid) before the timer fires, we cancel the removal.
  const pendingRemovals = new Map<string, ReturnType<typeof setTimeout>>();
  const REMOVAL_GRACE_MS = 3000;
  // Per-room set of doc names the server has already created Y.Docs for. Used
  // to refuse new docNames once the per-room cap is hit (anti-DoS for #3).
  const roomDocs = new Map<string, Set<string>>();
  const refKey = (roomId: string, pid: string) => `${roomId}::${pid}`;
  const acquireRef = (roomId: string, pid: string) => {
    const k = refKey(roomId, pid);
    // Cancel any scheduled removal — the participant is back before grace expired.
    const pending = pendingRemovals.get(k);
    if (pending) {
      clearTimeout(pending);
      pendingRemovals.delete(k);
      logger.info(`acquireRef: cancelled pending removal for ${k}`);
    }
    participantRefs.set(k, (participantRefs.get(k) ?? 0) + 1);
  };
  /**
   * Release a reference. If this drops the count to zero, schedule the DB
   * removal after a grace period and call `onActuallyRemove` then. The
   * caller passes a callback rather than us doing the DB work here so the
   * cleanup also runs only after the grace period elapses (e.g. broadcast
   * is also delayed, avoiding the flicker).
   */
  const releaseRef = (
    roomId: string,
    pid: string,
    onActuallyRemove: () => Promise<void> | void
  ) => {
    const k = refKey(roomId, pid);
    const next = (participantRefs.get(k) ?? 0) - 1;
    if (next > 0) {
      participantRefs.set(k, next);
      return;
    }
    participantRefs.delete(k);
    // Already a pending removal? Don't double-schedule (shouldn't happen
    // since refcount went to 0, but be defensive).
    if (pendingRemovals.has(k)) return;
    const timer = setTimeout(() => {
      pendingRemovals.delete(k);
      // Last guard: if someone re-acquired in the microsecond before this
      // tick, abort.
      if ((participantRefs.get(k) ?? 0) > 0) return;
      void Promise.resolve(onActuallyRemove()).catch((err) =>
        logger.error(`grace-period removal failed for ${k}`, err)
      );
    }, REMOVAL_GRACE_MS);
    pendingRemovals.set(k, timer);
  };

  io.on("connection", (socket) => {
    logger.info(`socket connected ${socket.id}`);
    // Track every room this socket is an active participant in.
    // A single tab can navigate between rooms (SPA) without reconnecting,
    // and a single browser can have multiple tabs in different rooms — but
    // the underlying Socket.IO connection is per-tab, so memberships are
    // per-tab too. We need this map (roomId -> participantId) so we can
    // clean up correctly on disconnect / explicit leave, instead of only
    // removing the most-recently-joined room.
    const memberships = new Map<string, string>();
    socket.data.memberships = memberships;
    // Rolling-window counter for yjs:update events from this socket.
    let yjsWindowStart = 0;
    let yjsWindowCount = 0;

    socket.on("room:join", async ({ roomId, participantId, displayName }: JoinRoomPayload) => {
      logger.info(`room:join from ${socket.id} for room ${roomId} participant ${participantId}`);
      if (!roomId) return;
      // CRITICAL: socket.join must happen BEFORE any await. The client fires
      // yjs:sync-request immediately after room:join (same tick), and
      // socket.io does NOT pause event delivery while an async handler is
      // suspended on await. If we joined the io room only after the Mongo
      // round-trip below, sync-request would arrive with
      // socket.rooms.has(roomId)===false and be silently dropped — leading
      // to a 4s client fallback timeout, double-seed of the template, and
      // diverged CRDT state across tabs.
      socket.join(roomId);
      if (!participantId) {
        // Read-only viewer: receives broadcasts but can't be tracked for
        // cleanup, so don't proceed with participant registration.
        return;
      }
      // Verify the room actually exists in Mongo. Without this check, anyone
      // could `socket.emit("room:join", { roomId: "<guess>" })` and then send
      // chat / RTC / yjs traffic into rooms they were never invited to.
      const dbRoom = await roomService.getRoom(roomId);
      if (!dbRoom) {
        logger.warn(`room:join refused — unknown room ${roomId} from ${socket.id}`);
        socket.leave(roomId);
        socket.emit("room:error", { code: "room_not_found", roomId });
        return;
      }
      const alreadyIn = dbRoom.participants?.some((p) => p.id === participantId) ?? false;
      if (!alreadyIn && (dbRoom.participants?.length ?? 0) >= MAX_PARTICIPANTS_PER_ROOM) {
        logger.warn(`room:join refused — room ${roomId} full from ${socket.id}`);
        socket.leave(roomId);
        socket.emit("room:error", { code: "room_full", roomId });
        return;
      }
      // If the participant isn't in the DB any more (grace-period removal
      // after a brief disconnect), re-add them now. Without this, a network
      // blip / dev-HMR / mobile sleep silently turns the user into a ghost
      // — their socket is in the io room but they don't show in the roster.
      if (!alreadyIn) {
        try {
          await roomService.joinRoom({
            roomId,
            participantId,
            participantName: displayName,
          });
          logger.info(`room:join re-added missing participant ${participantId} (${displayName ?? "Guest"}) to ${roomId}`);
        } catch (err) {
          logger.error(`room:join could not re-add ${participantId} to ${roomId}`, err);
          // Continue — worst case the user shows as missing in roster but
          // the socket still receives broadcasts.
        }
      }
      // Idempotent: if this socket is already tracked for the room (e.g.
      // duplicate room:join from a reconnect), skip the ref bump.
      if (memberships.get(roomId) !== participantId) {
        // If the socket previously claimed a different pid for this room,
        // release the old ref first (with grace-period removal).
        const prev = memberships.get(roomId);
        if (prev) {
          releaseRef(roomId, prev, async () => {
            const room = await roomService.removeParticipant(roomId, prev);
            if (room) {
              io.to(roomId).emit("room:participants-update", room.participants);
            }
          });
        }
        memberships.set(roomId, participantId);
        acquireRef(roomId, participantId);
      }
      // Keep singular fields populated for legacy handlers (chat, screen-share,
      // reactions, doc-change auth checks). They reflect the *most recent*
      // active room, which is what the user is currently looking at.
      socket.data.participantId = participantId;
      socket.data.roomId = roomId;

      // Broadcast the fresh participant list so everyone in the room sees the
      // new joiner immediately.
      const room = await roomService.getRoom(roomId);
      if (room) {
        io.to(roomId).emit("room:participants-update", room.participants);
      }
    });

    // Explicit leave — fired by the client when navigating away from a room
    // (SPA route change) or when the Room component unmounts. This removes
    // the participant from that one room only, leaving any other rooms this
    // socket is in untouched.
    socket.on("room:leave", async ({ roomId }: { roomId: string }) => {
      const participantId = memberships.get(roomId);
      if (!participantId) {
        socket.leave(roomId);
        return;
      }
      logger.info(`room:leave from ${socket.id} for room ${roomId} participant ${participantId}`);
      memberships.delete(roomId);
      // Notify peers the call participant is gone (if they were in the call)
      socket.to(roomId).emit("room:call-user-left", { socketId: socket.id });
      socket.leave(roomId);
      // Schedule removal after grace period — if the same pid re-joins
      // (e.g. tab refresh) within REMOVAL_GRACE_MS, this is cancelled and
      // peers never see a flicker.
      releaseRef(roomId, participantId, async () => {
        const room = await roomService.removeParticipant(roomId, participantId);
        if (room) {
          io.to(roomId).emit("room:participants-update", room.participants);
        }
      });
      // If the room being left was the active one, promote any other
      // remaining membership so legacy handlers keep working.
      if (socket.data.roomId === roomId) {
        const next = memberships.entries().next();
        if (!next.done) {
          socket.data.roomId = next.value[0];
          socket.data.participantId = next.value[1];
        } else {
          delete socket.data.roomId;
          delete socket.data.participantId;
        }
      }
    });

    socket.on("room:join-call", ({ roomId }: { roomId: string }) => {
      if (!socket.data.participantId) {
        logger.warn(`Unauthorized join-call attempt from ${socket.id}`);
        return;
      }
      logger.info(`room:join-call from ${socket.id} for room ${roomId}`);
      socket.data.inCall = true;
      socket.to(roomId).emit("room:call-user-joined", {
        socketId: socket.id,
        participantId: socket.data.participantId,
      });

      // Send the new joiner the roster of peers already in the call so it can label them
      const roster: { socketId: string; participantId: string }[] = [];
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        for (const sid of room) {
          if (sid === socket.id) continue;
          const s = io.sockets.sockets.get(sid);
          if (s?.data?.inCall && s.data.participantId) {
            roster.push({ socketId: sid, participantId: s.data.participantId });
          }
        }
      }
      socket.emit("room:call-roster", roster);
    });

    socket.on("room:leave-call", ({ roomId }: { roomId: string }) => {
      logger.info(`room:leave-call from ${socket.id} for room ${roomId}`);
      socket.data.inCall = false;
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
      // Payload size guards
      if (patch.code !== undefined && patch.code.length > MAX_CODE_BYTES) {
        logger.warn(`Oversized code payload (${patch.code.length} bytes) from ${socket.id}`);
        return;
      }
      if (patch.notes !== undefined && patch.notes.length > MAX_NOTES_BYTES) {
        logger.warn(`Oversized notes payload (${patch.notes.length} bytes) from ${socket.id}`);
        return;
      }
      if ((patch as { output?: string }).output !== undefined && ((patch as { output?: string }).output?.length ?? 0) > MAX_OUTPUT_BYTES) {
        logger.warn(`Oversized output payload from ${socket.id}`);
        return;
      }
      if (patch.whiteboard !== undefined && patch.whiteboard.length > MAX_WHITEBOARD_STROKES) {
        logger.warn(`Oversized whiteboard payload (${patch.whiteboard.length} strokes) from ${socket.id}`);
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

    // Targeted signaling — always route to specific peer only
    socket.on("room:rtc-offer", ({ roomId, to, sdp }: RtcSignalPayload) => {
      logger.info(`room:rtc-offer in ${roomId} from ${socket.id} to ${to ?? "broadcast"}`);
      const payload: RtcSignalPayload = { roomId, from: socket.id, to, sdp };
      if (to) {
        socket.to(to).emit("room:rtc-offer", payload);
      } else {
        socket.to(roomId).emit("room:rtc-offer", payload);
      }
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

    // Live chat — broadcast to room (no persistence; ephemeral)
    socket.on(
      "room:chat-message",
      ({ roomId, text }: { roomId: string; text: string }) => {
        if (!socket.data.participantId) {
          logger.warn(`Unauthorized chat-message attempt from ${socket.id}`);
          return;
        }
        const trimmed = (text ?? "").toString().trim();
        if (!trimmed || trimmed.length > 2000) return;
        const payload = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: socket.data.participantId,
          text: trimmed,
          at: Date.now(),
        };
        io.to(roomId).emit("room:chat-message", payload);
      }
    );

    // Screen-share state — broadcast so peers can auto-pin the sharer's tile
    socket.on("room:screen-share", ({ roomId, sharing }: { roomId: string; sharing: boolean }) => {
      if (!socket.data.participantId) return;
      socket.to(roomId).emit("room:screen-share", {
        socketId: socket.id,
        participantId: socket.data.participantId,
        sharing: !!sharing,
      });
    });

    // Floating reactions — ephemeral, broadcast to room
    socket.on("room:reaction", ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      if (!socket.data.participantId) return;
      const allowed = new Set(["👍", "❤️", "🎉", "👏", "😂", "🔥", "🤔"]);
      if (typeof emoji !== "string" || !allowed.has(emoji)) return;
      io.to(roomId).emit("room:reaction", {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        socketId: socket.id,
        participantId: socket.data.participantId,
        emoji,
        at: Date.now(),
      });
    });

    // ---------------------------------------------------------------------
    // Yjs collaboration relay
    // ---------------------------------------------------------------------
    // Transport-agnostic protocol: clients exchange binary updates, the
    // server keeps an in-memory Y.Doc per (roomId, docName), applies updates,
    // broadcasts them to other peers, and persists snapshots to Mongo.
    //
    // Events:
    //   yjs:sync-request  { roomId, docName, sv? }   — client asks for missing ops
    //   yjs:sync-response { docName, update }        — server returns missing ops
    //   yjs:update        { roomId, docName, update } — bidirectional doc update
    //   yjs:awareness     { roomId, docName, update } — bidirectional cursor/presence
    //
    // `update` and `sv` are Uint8Array (Buffer over the wire). Socket.IO
    // handles binary natively.

    const docNameValid = (s: unknown): s is string =>
      typeof s === "string" && s.length > 0 && s.length <= 64 && /^[a-zA-Z0-9:_-]+$/.test(s);

    socket.on("yjs:sync-request", async (
      payload: { roomId: string; docName: string; sv?: Uint8Array | ArrayBuffer | null },
      ack?: (response: { docName: string; update: Uint8Array; sv: Uint8Array }) => void
    ) => {
      try {
        const { roomId, docName } = payload || {};
        if (!roomId || !docNameValid(docName)) return;
        if (!socket.rooms.has(roomId)) return; // must be in the room
        // Coerce sv to Uint8Array if present (Socket.IO may give us Buffer/ArrayBuffer)
        let sv: Uint8Array | undefined;
        if (payload.sv) {
          sv = payload.sv instanceof Uint8Array
            ? payload.sv
            : new Uint8Array(payload.sv as ArrayBuffer);
        }
        const update = await yjsService.encodeStateAsUpdate(roomId, docName, sv);
        const serverSv = await yjsService.encodeStateVector(roomId, docName);
        // ack lets the client correlate the response. We also emit so non-ack
        // capable clients still receive it.
        if (ack) {
          ack({ docName, update, sv: serverSv });
        } else {
          socket.emit("yjs:sync-response", { docName, update, sv: serverSv });
        }
      } catch (err) {
        logger.error("yjs:sync-request failed", err);
      }
    });

    // Server-side atomic template seed. The first user who joins an empty
    // room would otherwise insert the language template locally, but in a
    // truly simultaneous open two clients can BOTH find ytext empty after
    // their initial sync (server has nothing to give them) and BOTH insert
    // the template — Yjs then merges into a duplicated buffer. We fix this
    // by routing the seed through the server: the in-memory Y.Doc check +
    // insert is race-free (single-threaded), and we broadcast the resulting
    // update to every peer in the room (including the requester so they
    // pick up their own seed from the canonical doc).
    socket.on("yjs:seed-if-empty", async (
      payload: { roomId: string; docName: string; textKey: string; text: string },
      ack?: (response: { seeded: boolean }) => void
    ) => {
      try {
        const { roomId, docName, textKey, text } = payload || {};
        if (!roomId || !docNameValid(docName) || !docNameValid(textKey)) {
          ack?.({ seeded: false });
          return;
        }
        if (!socket.rooms.has(roomId)) { ack?.({ seeded: false }); return; }
        if (!socket.data.participantId) { ack?.({ seeded: false }); return; }
        if (typeof text !== "string" || text.length === 0 || text.length > 100_000) {
          ack?.({ seeded: false });
          return;
        }
        // Track this docName against the room cap so a malicious client
        // can't bypass MAX_DOCS_PER_ROOM by going through the seed path.
        let docsForRoom = roomDocs.get(roomId);
        if (!docsForRoom) {
          docsForRoom = new Set<string>();
          roomDocs.set(roomId, docsForRoom);
        }
        if (!docsForRoom.has(docName)) {
          if (docsForRoom.size >= MAX_DOCS_PER_ROOM) {
            ack?.({ seeded: false });
            return;
          }
          docsForRoom.add(docName);
        }
        const update = await yjsService.seedIfEmpty(roomId, docName, textKey, text);
        if (!update) {
          ack?.({ seeded: false });
          return;
        }
        // Broadcast to EVERY peer (io.to, not socket.to) so the requester
        // also receives the canonical seed update via its yjs:update listener.
        io.to(roomId).emit("yjs:update", { docName, update });
        ack?.({ seeded: true });
      } catch (err) {
        logger.error("yjs:seed-if-empty failed", err);
        ack?.({ seeded: false });
      }
    });

    socket.on("yjs:update", async (
      payload: { roomId: string; docName: string; update: Uint8Array | ArrayBuffer }
    ) => {
      try {
        const { roomId, docName, update } = payload || {};
        if (!roomId || !docNameValid(docName) || !update) return;
        if (!socket.rooms.has(roomId)) return;
        if (!socket.data.participantId) return; // must have joined first
        // Per-socket rate limit — prevents one client from pinning CPU /
        // OOM'ing the 512 MB Render free dyno with a tight update loop.
        const now = Date.now();
        if (now - yjsWindowStart > YJS_WINDOW_MS) {
          yjsWindowStart = now;
          yjsWindowCount = 0;
        }
        if (++yjsWindowCount > YJS_UPDATES_PER_SEC) {
          if (yjsWindowCount === YJS_UPDATES_PER_SEC + 1) {
            logger.warn(`yjs:update rate-limit hit on ${socket.id} (${YJS_UPDATES_PER_SEC}/s)`);
          }
          return;
        }
        // Cap distinct docNames the server will allocate per room.
        let docsForRoom = roomDocs.get(roomId);
        if (!docsForRoom) {
          docsForRoom = new Set<string>();
          roomDocs.set(roomId, docsForRoom);
        }
        if (!docsForRoom.has(docName)) {
          if (docsForRoom.size >= MAX_DOCS_PER_ROOM) {
            logger.warn(`yjs:update refused — room ${roomId} hit MAX_DOCS_PER_ROOM`);
            return;
          }
          docsForRoom.add(docName);
        }
        const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
        await yjsService.applyUpdate(roomId, docName, bytes);
        // Relay to every other peer in the room. Sender already has the
        // update locally, so we use socket.to (excludes sender).
        socket.to(roomId).emit("yjs:update", { docName, update: bytes });
      } catch (err) {
        logger.error("yjs:update failed", err);
      }
    });

    socket.on("yjs:awareness", (
      payload: { roomId: string; docName: string; update: Uint8Array | ArrayBuffer }
    ) => {
      try {
        const { roomId, docName, update } = payload || {};
        if (!roomId || !docNameValid(docName) || !update) return;
        if (!socket.rooms.has(roomId)) return;
        if (!socket.data.participantId) return;
        const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
        // Awareness is ephemeral — never persisted, just relayed.
        socket.to(roomId).emit("yjs:awareness", { docName, update: bytes });
      } catch (err) {
        logger.error("yjs:awareness failed", err);
      }
    });

    socket.on("disconnecting", () => {
      logger.info(`socket disconnecting ${socket.id}`);
      // Notify call peers in every room this socket was part of
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          socket.to(roomId).emit("room:call-user-left", { socketId: socket.id });
        }
      }
    });

    socket.on("disconnect", async () => {
      logger.info(`socket disconnected ${socket.id}`);
      // Clean up every room this socket was a tracked participant in — not
      // just the last one. Without this, navigating A -> B in the same tab
      // and then disconnecting would leave a ghost participant in A forever.
      const entries = Array.from(memberships.entries());
      memberships.clear();
      for (const [roomId, participantId] of entries) {
        // Schedule removal after grace period. If the same (room, pid) is
        // re-acquired within REMOVAL_GRACE_MS (e.g. tab refresh, network
        // reconnect), the removal is cancelled and peers never see the
        // participant disappear.
        releaseRef(roomId, participantId, async () => {
          logger.info(`removing participant ${participantId} from room ${roomId} (grace expired)`);
          const room = await roomService.removeParticipant(roomId, participantId);
          if (room) {
            io.to(roomId).emit("room:participants-update", room.participants);
          }
        });
      }
    });
  });

  return io;
};
