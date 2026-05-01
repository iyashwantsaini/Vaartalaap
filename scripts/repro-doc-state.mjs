// Repro: two clients open the same room near-simultaneously. Each Y.Doc
// is empty after sync, so each client seeds the template. CRDT then merges
// → duplicate template content. Mirrors the React seed logic in
// CollabCodeEditor.tsx.

import { io } from "socket.io-client";
import * as Y from "yjs";

const API = "http://127.0.0.1:4000";
const SEED = `#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const post = async (path, body) => {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
};

const toBytes = (v) => {
  if (!v) return null;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return new Uint8Array(v);
  if (v.type === "Buffer" && Array.isArray(v.data)) return new Uint8Array(v.data);
  return null;
};

const openClient = (label, roomId, pid, docName) => {
  const sock = io(API, { transports: ["websocket"], autoConnect: false });
  const doc = new Y.Doc();
  const ytext = doc.getText("content");

  doc.on("update", (update, origin) => {
    if (origin === "remote") return;
    sock.emit("yjs:update", { roomId, docName, update });
  });

  sock.on("yjs:update", (payload) => {
    if (!payload || payload.docName !== docName) return;
    const bytes = toBytes(payload.update);
    if (!bytes) return;
    Y.applyUpdate(doc, bytes, "remote");
  });

  let resolveSynced;
  const synced = new Promise((r) => (resolveSynced = r));

  sock.on("connect", async () => {
    console.log(`[${label}] socket connect`);
    sock.emit("room:join", { roomId, participantId: pid, displayName: label });
    await new Promise((r) => setTimeout(r, 300));
    const sv = Y.encodeStateVector(doc);
    console.log(`[${label}] emitting sync-request`);
    sock.emit("yjs:sync-request", { roomId, docName, sv }, (response) => {
      console.log(`[${label}] sync-request ack:`, !!response, response?.docName);
      if (response) {
        const update = toBytes(response.update);
        if (update && update.byteLength > 0) Y.applyUpdate(doc, update, "remote");
        const serverSv = toBytes(response.sv);
        if (serverSv) {
          const diff = Y.encodeStateAsUpdate(doc, serverSv);
          if (diff.byteLength > 2) sock.emit("yjs:update", { roomId, docName, update: diff });
        }
      }
      resolveSynced();
    });
  });

  return { sock, doc, ytext, synced, label, roomId, docName };
};

const seedIfEmpty = (client) => {
  const { ytext, doc, sock, label, roomId, docName } = client;
  if (ytext.length !== 0) {
    console.log(`[${label}] skip seed — already has ${ytext.length} chars`);
    return;
  }
  const meta = doc.getMap("__meta__");
  if (meta.get("seedRequested")) {
    console.log(`[${label}] skip seed — already requested`);
    return;
  }
  meta.set("seedRequested", true);
  console.log(`[${label}] requesting server seed`);
  sock.emit(
    "yjs:seed-if-empty",
    { roomId, docName, textKey: "content", text: SEED },
    (resp) => console.log(`[${label}] seed ack:`, resp)
  );
};

const main = async () => {
  console.log("--- create room ---");
  const room = await post("/api/rooms", {});
  const roomId = room.roomId;
  console.log("roomId =", roomId);
  const docName = "code:cpp";

  // Both clients open the room at the same time
  const A = openClient("A", roomId, "pidA", docName);
  const B = openClient("B", roomId, "pidB", docName);
  A.sock.connect();
  B.sock.connect();

  // Wait for both to finish initial sync
  await Promise.all([A.synced, B.synced]);
  console.log("both synced");

  // Both seed near-simultaneously (mimics two browsers loading at the same time)
  seedIfEmpty(A);
  seedIfEmpty(B);

  // Let updates propagate
  await sleep(800);

  console.log("\n--- final A text length:", A.ytext.length, "---");
  console.log(A.ytext.toString());
  console.log("\n--- final B text length:", B.ytext.length, "---");
  console.log(B.ytext.toString());
  console.log("\nMATCH?", A.ytext.toString() === B.ytext.toString());

  A.sock.disconnect();
  B.sock.disconnect();
  process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
