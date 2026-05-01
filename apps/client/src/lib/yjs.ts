import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { Socket } from "socket.io-client";
import { getSocket } from "./socket";

// One Y.Doc per (roomId, docName), shared across the whole client process.
// Multiple components can subscribe to the same doc and share the awareness
// instance so cursors are presented coherently.
//
// We piggy-back on the existing Socket.IO connection rather than spinning up
// y-websocket — the server-side relay handles sync + update + awareness over
// the same socket. This keeps a single auth/membership story.

interface DocBundle {
  doc: Y.Doc;
  awareness: Awareness;
  refCount: number;
  // Resolves the first time the server's sync-response is applied (or
  // immediately if the socket is already past first-sync). Components must
  // await this before deciding whether to seed an empty doc, otherwise they
  // race the network and end up duplicating content on every remount.
  synced: Promise<void>;
  // Cleanup hooks to detach socket listeners + Y.Doc observers on dispose.
  dispose: () => void;
}

const bundles = new Map<string, DocBundle>();

const key = (roomId: string, docName: string) => `${roomId}::${docName}`;

const isUint8Array = (v: unknown): v is Uint8Array => v instanceof Uint8Array;

// Socket.IO can deliver binary payloads as Buffer / ArrayBuffer / Uint8Array
// depending on transport + browser. Normalise.
const toBytes = (input: unknown): Uint8Array | null => {
  if (!input) return null;
  if (isUint8Array(input)) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  // Node Buffer (in tests/SSR) duck-types as Uint8Array, handled above.
  // Some socket.io versions wrap binary in { _placeholder: true } objects
  // that have already been swapped; if we see anything else, give up.
  return null;
};

const createBundle = (roomId: string, docName: string): DocBundle => {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const socket = getSocket();

  // ---- INBOUND ----
  const onUpdate = (payload: { docName: string; update: unknown }) => {
    if (!payload || payload.docName !== docName) return;
    const bytes = toBytes(payload.update);
    if (!bytes) return;
    // Mark origin so our outbound observer ignores echoes from the network.
    Y.applyUpdate(doc, bytes, "remote");
  };
  const onAwareness = (payload: { docName: string; update: unknown }) => {
    if (!payload || payload.docName !== docName) return;
    const bytes = toBytes(payload.update);
    if (!bytes) return;
    // y-protocols awareness uses applyAwarenessUpdate; import lazily so we
    // don't pay the bundle cost upfront. (Already loaded via Awareness import.)
    void import("y-protocols/awareness").then((mod) => {
      mod.applyAwarenessUpdate(awareness, bytes, "remote");
    });
  };
  socket.on("yjs:update", onUpdate);
  socket.on("yjs:awareness", onAwareness);

  // ---- OUTBOUND: doc updates ----
  const docObserver = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return; // don't echo
    socket.emit("yjs:update", { roomId, docName, update });
  };
  doc.on("update", docObserver);

  // ---- OUTBOUND: awareness changes (local presence) ----
  const awarenessObserver = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === "remote") return;
    const changedClients = added.concat(updated, removed);
    if (changedClients.length === 0) return;
    void import("y-protocols/awareness").then((mod) => {
      const update = mod.encodeAwarenessUpdate(awareness, changedClients);
      socket.emit("yjs:awareness", { roomId, docName, update });
    });
  };
  awareness.on("update", awarenessObserver);

  // ---- INITIAL SYNC ----
  // On connection (and reconnection), exchange state vectors so we converge.
  // We expose `synced` as a Promise that resolves the first time we see a
  // sync-response come back, so consumers can wait before seeding empty docs.
  let resolveSynced: () => void = () => {};
  const synced = new Promise<void>((resolve) => {
    resolveSynced = resolve;
  });
  let didResolveSync = false;
  const markSynced = () => {
    if (didResolveSync) return;
    didResolveSync = true;
    resolveSynced();
  };

  const sync = () => {
    const sv = Y.encodeStateVector(doc);
    socket.emit(
      "yjs:sync-request",
      { roomId, docName, sv },
      (response: { docName: string; update: unknown; sv: unknown } | undefined) => {
        if (!response || response.docName !== docName) {
          // Even on a malformed/missing response, unblock seeding so a brand
          // new room (or a server without yjs persistence) still works.
          markSynced();
          return;
        }
        const update = toBytes(response.update);
        if (update && update.byteLength > 0) {
          Y.applyUpdate(doc, update, "remote");
        }
        // Also send the server whatever it's missing from us.
        const serverSv = toBytes(response.sv);
        if (serverSv) {
          const diff = Y.encodeStateAsUpdate(doc, serverSv);
          if (diff.byteLength > 2) {
            // > 2 because empty updates are tiny header bytes; skip no-op.
            socket.emit("yjs:update", { roomId, docName, update: diff });
          }
        }
        markSynced();
      }
    );
  };
  const onConnect = () => sync();
  socket.on("connect", onConnect);
  if (socket.connected) {
    sync();
  } else {
    // Don't block forever if we never connect — give consumers a way out
    // after a reasonable wait so a degraded mode (offline-only edit) works.
    setTimeout(markSynced, 4000);
  }

  const dispose = () => {
    socket.off("yjs:update", onUpdate);
    socket.off("yjs:awareness", onAwareness);
    socket.off("connect", onConnect);
    doc.off("update", docObserver);
    awareness.off("update", awarenessObserver);
    awareness.destroy();
    doc.destroy();
  };

  return { doc, awareness, refCount: 0, synced, dispose };
};

/**
 * Acquire a shared Y.Doc + Awareness for a (roomId, docName) pair. Reference
 * counted — call the returned `release` when the consumer unmounts so the
 * underlying socket listeners and observers can be torn down once nothing is
 * using the doc anymore.
 */
export const acquireYDoc = (
  roomId: string,
  docName: string
): { doc: Y.Doc; awareness: Awareness; socket: Socket; synced: Promise<void>; release: () => void } => {
  const k = key(roomId, docName);
  let bundle = bundles.get(k);
  if (!bundle) {
    bundle = createBundle(roomId, docName);
    bundles.set(k, bundle);
  }
  bundle.refCount += 1;

  const release = () => {
    if (!bundle) return;
    bundle.refCount -= 1;
    if (bundle.refCount <= 0) {
      bundle.dispose();
      bundles.delete(k);
    }
  };

  return {
    doc: bundle.doc,
    awareness: bundle.awareness,
    socket: getSocket(),
    synced: bundle.synced,
    release,
  };
};
