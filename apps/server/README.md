# apps/server

Express 4 + Socket.IO 4 + MongoDB. TypeScript, Node 18+.

---

## Module map

```mermaid
flowchart TB
  idx[index.ts<br/>http + io + middleware] --> env[config/env.ts<br/>Zod]
  idx --> db[config/db.ts<br/>MongoClient]
  idx --> sock[config/socket.ts<br/>handlers]
  idx --> rt[routes/roomRoutes.ts]

  rt --> rs[services/roomService.ts]
  sock --> rs
  sock --> ys[services/yjsService.ts]
  rs --> M1[(rooms)]
  ys --> M2[(yjsDocs)]
  sock --> log[lib/logger.ts]
  rt --> log
```

---

## REST endpoints

```mermaid
flowchart LR
  POST[POST /api/rooms] --> create[roomService.create]
  GET[GET /api/rooms/:id] --> get[roomService.get]
  GET2[GET /health] --> ok[200 ok]
```

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/rooms` | `{name?}` | `{id}` |
| `GET`  | `/api/rooms/:id` | — | `RoomSnapshot` |
| `GET`  | `/health` | — | `{status:"ok"}` |

---

## Socket.IO events

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant S as Server
  participant DB as MongoDB

  C->>S: connect
  C->>S: room:join {roomId,name,pid}
  S->>DB: addToSet participants
  S-->>C: room:state (snapshot)
  S-->>C: peers:update

  rect rgba(80,120,255,0.08)
    Note over C,S: Code (Yjs)
    C->>S: yjs:sync-request (sv)
    S-->>C: yjs:sync-response (diff)
    C->>S: yjs:seed-if-empty (template)
    S-->>C: yjs:update (broadcast to all peers)
    C->>S: yjs:update (Uint8Array)
    S-->>C: yjs:update (relay to others)
    S->>DB: debounce 1.5s — encodeStateAsUpdate
  end

  rect rgba(80,200,120,0.08)
    Note over C,S: Whiteboard / Notes / Chat
    C->>S: wb:stroke / doc:change / chat:send
    S-->>C: wb:state / doc:state / chat:new
    S->>DB: debounce 300ms (snapshots)
  end

  rect rgba(255,160,80,0.08)
    Note over C,S: WebRTC signalling
    C->>S: rtc:signal {to, sdp|candidate}
    S-->>C: rtc:signal forwarded
  end

  C->>S: disconnect / room:leave
  S->>S: schedule removal in 3s
  Note over S: cancelled if same pid re-acquires
  S->>DB: $pull participant
  S-->>C: peers:update
```

---

## Session model

```mermaid
flowchart LR
  subgraph Maps
    SM["socketMemberships<br/>Map&lt;sid,Map&lt;roomId,pid&gt;&gt;"]
    RC["participantRefs<br/>Map&lt;roomId+pid,n&gt;"]
    PR["pendingRemovals<br/>Map&lt;roomId+pid,Timer&gt;"]
  end
  acq[acquireRef] --> RC
  acq --> PR
  rel[releaseRef] --> RC
  rel -. when n=0 .-> Sched[schedule 3s timer]
  Sched --> PR
  PR -- on fire --> Persist[remove participant in DB]
```

Why: a fast refresh disconnects the old socket then reconnects within ~200 ms. Without the grace timer the participant would flicker out and in (and other rooms could lose state if pid maps weren't per-socket).

---

## Yjs service

```mermaid
flowchart LR
  In[yjs:update] --> Cache[Y.Doc cache<br/>Map roomId+docName → Y.Doc]
  Cache -- lazy load --> DB[(yjsDocs)]
  In --> Apply[Y.applyUpdate]
  Apply --> Bcast[broadcast to room (excl sender)]
  Apply -. debounce 1.5s .-> Persist[encodeStateAsUpdate → Mongo]
  Sync[yjs:sync-request sv] --> Diff[encodeStateAsUpdate(doc, sv)]
  Diff --> Out[yjs:sync-response]
  Seed[yjs:seed-if-empty] --> Check{ytext.length == 0?}
  Check -- yes --> Insert[Y.transact insert template] --> BcastAll[io.to(room) yjs:update]
  Check -- no --> Nack[ack seeded:false]
```

Caps:
- `MAX_DOC_BYTES = 1 MB` per `(roomId,docName)` — drops further updates when exceeded.
- Awareness packets are **never** persisted.
- `yjs:seed-if-empty` is the **single source of truth for first-write template seeding**. The server's atomic empty-check + insert prevents duplicate seeds when two clients open the same fresh room simultaneously; only the first request wins, the rest get `{seeded:false}` and pick up the canonical seed via the broadcast `yjs:update`.

---

## Storage

```mermaid
erDiagram
  ROOMS ||--o{ YJSDOCS : has
  ROOMS {
    string id PK
    string name
    date createdAt
    date expiresAt "TTL"
    object documents
    array participants
  }
  YJSDOCS {
    string roomId
    string docName
    binary state
    date updatedAt "TTL"
  }
```

Indexes:
- `rooms`: `{id}` unique, `{expiresAt}` TTL `0`.
- `yjsDocs`: `{roomId,docName}` unique, `{updatedAt}` TTL `2592000`.

---

## Middleware

```mermaid
flowchart LR
  req[req] --> H[helmet]
  H --> C[cors allow-list]
  C --> J[express.json 1mb]
  J --> RL[rate-limit 200/15min]
  RL --> R[router]
```

---

## Env (Zod-validated)

```
PORT=4000
NODE_ENV=development|production
MONGODB_URI=mongodb+srv://…
CLIENT_ORIGIN=http://localhost:5173
```

Bad / missing env → process exits with descriptive error.

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` (root) | tsx watch :4000 |
| `npm run build` | `tsc -p tsconfig.json` → `dist/` |
| `npm start` | `node dist/index.js` |
