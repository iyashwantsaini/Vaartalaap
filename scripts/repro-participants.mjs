// Repro: two "windows" join the same room with different names + different
// participantIds. Mimics what the React Room.tsx does:
//   1) POST /api/rooms                         (create)
//   2) Window-A: POST /api/rooms/:id/join      (with pid1 + "karan_dev")
//      Window-A: socket.emit("room:join", {roomId, participantId: pid1})
//   3) Window-B: POST /api/rooms/:id/join      (with pid2 + "yash_dev")
//      Window-B: socket.emit("room:join", {roomId, participantId: pid2})
//   4) Both wait for room:participants-update broadcasts and dump them.
//   5) Print final GET /api/rooms/:id          (DB truth)

import { io } from "socket.io-client";

const API = "http://localhost:4000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const randomId = () => {
  // tiny nanoid-ish
  let s = "";
  for (let i = 0; i < 21; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)];
  return s;
};

const post = async (path, body) => {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
};

const get = async (path) => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

const openWindow = (label, roomId, pid, displayName) => {
  const sock = io(API, { transports: ["websocket"], autoConnect: false });
  sock.on("connect", () => {
    console.log(`[${label}] socket connect → emit room:join`);
    sock.emit("room:join", { roomId, participantId: pid, displayName });
  });
  sock.on("room:participants-update", (participants) => {
    console.log(`[${label}] participants-update: ${JSON.stringify(participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`))}`);
  });
  sock.on("room:error", (e) => console.log(`[${label}] room:error ${JSON.stringify(e)}`));
  return sock;
};

const main = async () => {
  console.log("--- create room ---");
  const room = await post("/api/rooms", {});
  const roomId = room.roomId;
  console.log("roomId =", roomId);

  // Window A
  const pidA = randomId();
  console.log("\n--- Window A joins as karan_dev ---");
  const snapA = await post(`/api/rooms/${roomId}/join`, { displayName: "karan_dev", participantId: pidA });
  console.log("A POST /join ->", snapA.participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`));

  const sockA = openWindow("A", roomId, pidA, "karan_dev");
  sockA.connect();
  await sleep(500);

  // Window B
  const pidB = randomId();
  console.log("\n--- Window B joins as yash_dev ---");
  const snapB = await post(`/api/rooms/${roomId}/join`, { displayName: "yash_dev", participantId: pidB });
  console.log("B POST /join ->", snapB.participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`));

  const sockB = openWindow("B", roomId, pidB, "yash_dev");
  sockB.connect();
  await sleep(500);

  console.log("\n--- final GET /api/rooms/:id ---");
  const finalSnap = await get(`/api/rooms/${roomId}`);
  console.log("DB participants:", finalSnap.participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`));

  // Now repro the "Window A reconnects" path: disconnect A, wait grace+, reconnect.
  console.log("\n--- Window A briefly disconnects then reconnects (simulates network blip / HMR) ---");
  sockA.disconnect();
  await sleep(3500); // > REMOVAL_GRACE_MS
  console.log("After grace:", (await get(`/api/rooms/${roomId}`)).participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`));

  console.log("--- A reconnects (handler already attached) ---");
  sockA.connect();
  await sleep(2000);
  console.log("After reconnect DB:", (await get(`/api/rooms/${roomId}`)).participants.map((p) => `${p.displayName}#${p.id.slice(0, 6)}`));

  sockA.disconnect();
  sockB.disconnect();
  process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
