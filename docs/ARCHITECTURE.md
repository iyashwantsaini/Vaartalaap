# Vaartalaap — Architecture

Diagram-first reference. Text only where a diagram can't carry the meaning.

---

## 1. System topology

```mermaid
flowchart LR
  subgraph Browsers["Clients (browsers)"]
    A[Tab A<br/>React SPA]
    B[Tab B<br/>React SPA]
    C[Tab C<br/>React SPA]
  end

  subgraph Server["Node Server (Express + Socket.IO)"]
    REST[REST<br/>/api/rooms]
    WS[Socket.IO<br/>rooms + relay]
    YS[Yjs Service<br/>in-mem Y.Doc cache]
  end

  subgraph Mongo["MongoDB Atlas"]
    R[(rooms<br/>TTL 30d)]
    Y[(yjsDocs<br/>state: Binary)]
  end

  TURN[(Open Relay<br/>STUN + TURN)]

  A -- HTTPS --> REST
  B -- HTTPS --> REST
  C -- HTTPS --> REST
  A <-- WebSocket --> WS
  B <-- WebSocket --> WS
  C <-- WebSocket --> WS

  REST --> R
  WS --> R
  WS --> YS
  YS --> Y

  A <-. WebRTC P2P (SRTP) .-> B
  A <-. WebRTC P2P (SRTP) .-> C
  B <-. WebRTC P2P (SRTP) .-> C
  A -.- TURN
  B -.- TURN
  C -.- TURN
```

Key properties:
- **Server is a relay only for signalling, presence, Yjs ops, and CRUD snapshots.** Media never traverses it.
- **MongoDB holds two collections.** `rooms` = REST snapshots + presence-friendly metadata. `yjsDocs` = binary CRDT state per `(roomId, docName)`.
- **TURN** is Open Relay (free, public). STUN-only fallback used when TURN unreachable.

---

## 2. Monorepo layout

```mermaid
graph TD
  Root[Vaartalaap/] --> Apps[apps/]
  Root --> Pkgs[packages/]
  Root --> Docs[docs/]
  Apps --> Client[client/<br/>React 18 + Vite 5]
  Apps --> Server[server/<br/>Express 4 + Socket.IO 4]
  Pkgs --> Shared["shared/<br/>RoomSnapshot, Stroke, ChatMsg…"]
  Client -. import @vaartalaap/shared .-> Shared
  Server -. import @vaartalaap/shared .-> Shared
```

---

## 3. Frontend module map

```mermaid
flowchart TB
  Main[main.tsx] --> CMP[ColorModeProvider<br/>localStorage + OS pref]
  CMP --> Router[BrowserRouter]
  Router --> Landing[/Landing.tsx/]
  Router --> Room[/Room.tsx/]

  Landing --> Hero & CreateDialog & JoinDialog

  Room --> Lobby[RoomLobby] & Workbench[CodeWorkbench] & WB[Whiteboard] & NP[Notepad] & Chat[ChatPanel] & Call[CallPanel] & Toggle[ColorModeToggle]

  Workbench --> Collab[CollabCodeEditor]
  Collab --> YJS[lib/yjs.ts<br/>acquireYDoc lease]
  Chat --> Sock[lib/socket.ts]
  Call --> Sock
  Workbench --> Sock
  WB --> Sock
  NP --> Sock

  YJS --> Sock
  Sock <-. WebSocket .-> ServerNode((Server))
```

---

## 4. Server module map

```mermaid
flowchart TB
  idx[index.ts] --> envc[config/env.ts<br/>Zod validation]
  idx --> dbc[config/db.ts<br/>MongoClient]
  idx --> sockc[config/socket.ts<br/>io + handlers]
  idx --> rt[routes/roomRoutes.ts]

  rt --> rs[services/roomService.ts]
  sockc --> rs
  sockc --> ys[services/yjsService.ts]
  rs --> Mongo[(rooms)]
  ys --> Mongo2[(yjsDocs)]
  sockc --> Logger[lib/logger.ts]
```

---

## 5. Room lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as React SPA
  participant API as REST /api/rooms
  participant WS as Socket.IO
  participant DB as MongoDB

  U->>FE: Click "Create"
  FE->>API: POST /rooms {name?}
  API->>DB: insert {id, expiresAt=+30d}
  API-->>FE: {roomId}
  FE->>U: navigate /room/:id

  U->>FE: Enter username
  FE->>WS: connect + room:join {roomId, name, pid}
  WS->>DB: $addToSet participants
  WS-->>FE: room:state (snapshot + participants)
  WS-->>FE: peers:update

  loop while in room
    FE-->>WS: doc:change / wb:stroke / chat:send / yjs:update
    WS-->>FE: broadcast to room
    WS->>DB: debounced snapshot persist
  end

  U->>FE: refresh / close
  FE->>WS: room:leave (or disconnect)
  Note over WS: 3s grace window
  WS->>DB: $pull participant (if no re-acquire)
```

---

## 6. Per-socket session model

The server tracks two separate maps — per-socket memberships and a cross-socket refcount with a grace timer. This lets a tab refresh **not** flicker the participant list.

```mermaid
stateDiagram-v2
  [*] --> Connected: socket connects
  Connected --> InRoom: room:join
  InRoom --> InRoom: room:join (different room)
  InRoom --> Pending: socket disconnects
  Pending --> InRoom: same pid re-acquires<br/>within 3s
  Pending --> Removed: 3s elapsed
  Removed --> [*]: broadcast peers:update
```

```mermaid
flowchart LR
  subgraph Server
    M["per-socket<br/>memberships<br/>Map&lt;sid,Map&lt;roomId,pid&gt;&gt;"]
    R["cross-socket<br/>refcount<br/>Map&lt;roomId+pid,n&gt;"]
    P["pending removal<br/>timers<br/>Map&lt;roomId+pid,Timer&gt;"]
  end
  ev1[acquireRef] --> R
  ev1 --> P
  ev2[releaseRef] --> R
  ev2 -. schedule remove .-> P
  P -. fires after 3s .-> DB[(rooms)]
```

---

## 7. Real-time event matrix

```mermaid
flowchart LR
  subgraph Client
    direction TB
    c1[doc:change]
    c2[wb:stroke]
    c3[wb:clear]
    c4[chat:send]
    c5[yjs:sync-request]
    c6[yjs:update]
    c7[yjs:awareness]
    c8[rtc:signal]
    c9[reaction:send]
    c10[yjs:seed-if-empty]
  end
  subgraph Server
    direction TB
    s1[doc:state]
    s2[wb:state]
    s3[chat:new]
    s4[yjs:sync-response]
    s5[yjs:update]
    s6[yjs:awareness]
    s7[rtc:signal]
    s8[peers:update]
    s9[reaction:new]
  end

  c1 -- broadcast --> s1
  c2 --> s2
  c3 --> s2
  c4 --> s3
  c5 -- reply only --> s4
  c6 -- relay + persist --> s5
  c7 -- relay --> s6
  c8 -- targeted --> s7
  c9 --> s9
```

| Direction | Event | Payload (essentials) | Persisted |
|---|---|---|---|
| C → S | `room:join` | `{roomId, name, participantId}` | yes (rooms) |
| C → S | `doc:change` | `{kind, value}` (kind = code/notes/lang) | yes, debounced 300ms |
| C → S | `wb:stroke` | `Stroke` | yes |
| C → S | `chat:send` | `{text}` | yes (capped 200) |
| C → S | `yjs:update` | `Uint8Array` | yes, debounced 1.5s |
| C → S | `yjs:awareness` | `Uint8Array` | no (transient) |
| C → S | `yjs:seed-if-empty` | `{docName, textKey, text}` → ack `{seeded}` | yes (if winner) |
| C → S | `rtc:signal` | `{to, sdp\|candidate}` | no |
| S → C | `peers:update` | `Participant[]` | — |
| S → C | `room:state` | `RoomSnapshot` | — |

---

## 8. Yjs collaboration pipeline

```mermaid
sequenceDiagram
  autonumber
  participant L as Local CodeMirror
  participant YT as Y.Text (client)
  participant CS as client/lib/yjs
  participant WS as Socket.IO
  participant SY as services/yjsService
  participant SD as Server Y.Doc cache
  participant DB as MongoDB yjsDocs

  L->>YT: keystroke (CodeMirror binding)
  YT->>CS: update (Uint8Array)
  CS->>WS: yjs:update {roomId, docName, update}
  WS->>SY: applyUpdate(roomId, docName, update)
  SY->>SD: Y.applyUpdate(doc, update)
  SY-->>DB: debounced 1.5s — write encodeStateAsUpdate()
  WS-->>WS: io.to(room).emit yjs:update (excl sender)

  Note over CS,SY: First mount<br/>handshake
  CS->>WS: yjs:sync-request (state vector)
  WS->>SY: encodeStateAsUpdate(doc, sv)
  SY-->>CS: yjs:sync-response (diff)
  CS->>YT: Y.applyUpdate(diff)
```

Key invariants:
- Server is **stateless from a CRDT standpoint** — it just relays + persists. All conflict resolution lives in `yjs` itself.
- Awareness (cursors) is never persisted.
- Doc cache is `Map<roomId+docName, Y.Doc>`; lazy-hydrated from Mongo on first reference.
- Per-doc cap: `MAX_DOC_BYTES = 1 MB`.
- **Initial template seeding is server-authoritative.** When a fresh room is opened, the client emits `yjs:seed-if-empty` instead of inserting locally. The server checks the in-memory `Y.Text` length atomically (Node is single-threaded), inserts the template iff empty, and broadcasts the resulting update to every peer in the room. This prevents two simultaneous fresh opens from each seeding the template and producing a duplicated buffer after CRDT merge.
- **`socket.join(roomId)` runs synchronously before any `await` in `room:join`.** socket.io does not pause event delivery while a handler is suspended on `await`, so deferring the join until after a Mongo round-trip would cause the client's immediately-following `yjs:sync-request` to be dropped (`socket.rooms.has(roomId) === false`).

---

## 9. WebRTC mesh

```mermaid
sequenceDiagram
  autonumber
  participant A
  participant S as Server (signaling)
  participant B

  Note over A,B: Joiner (A) vs existing peer (B).<br/>Server has no media path.
  A->>S: rtc:join
  S-->>B: peers:update (A appeared)
  A->>S: rtc:signal {to:B, sdp:offer}
  S-->>B: rtc:signal {from:A, sdp:offer}
  B->>S: rtc:signal {to:A, sdp:answer}
  S-->>A: rtc:signal {from:B, sdp:answer}
  loop ICE candidates
    A-->>S: rtc:signal candidate
    S-->>B: rtc:signal candidate
    B-->>S: rtc:signal candidate
    S-->>A: rtc:signal candidate
  end
  Note over A,B: SRTP media flows direct (or via TURN if symmetric NAT)
```

Mesh scaling:

```mermaid
graph LR
  A((A))---B((B))
  A---C((C))
  A---D((D))
  B---C
  B---D
  C---D
```

`O(n²)` peer connections. Hard cap at ~6 participants for usable mesh; beyond that an SFU is required (out of scope).

---

## 10. Whiteboard pipeline

```mermaid
flowchart LR
  Pointer[Mouse / touch] --> CV[Canvas 2D]
  CV --> Local[strokes state]
  Local -- wb:stroke --> WS[(Socket.IO)]
  WS -- broadcast --> Peers[other clients]
  WS -. debounced .-> Mongo[(rooms.documents.whiteboard)]
  Local --> Render[drawAllStrokes<br/>+ resolveStrokeColor<br/>auto-contrast vs theme]
  Render --> CV
```

Render guarantees stroke visibility across themes:
- Pure white on light bg → re-rendered as dark ink.
- Pure black on dark bg → re-rendered as light ink.
- Strokes within ±0.15 luminance of bg → treated as eraser (drawn as bg).
- Default new ink = `#2979ff` (blue) — high contrast in both modes.

---

## 11. Code execution flow

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as CodeWorkbench
  participant EX as lib/codeExecutor.ts
  participant W as Wandbox
  participant CX as Codex
  participant AG as Agent fallback

  U->>FE: Run (Ctrl+Enter)
  FE->>EX: executeCode(lang, src, stdin)
  EX->>W: POST /compile.json
  alt Wandbox 200 OK
    W-->>EX: {output}
  else
    EX->>CX: POST /exec
    alt CodeX 200 OK
      CX-->>EX: {output}
    else
      EX->>AG: POST /agent
      AG-->>EX: {output}
    end
  end
  EX-->>FE: combined stdout+stderr
  FE->>FE: append history (max 8)
```

---

## 12. Data model

```mermaid
erDiagram
  ROOMS ||--o{ YJSDOCS : "1 room → many docs"
  ROOMS {
    string id PK
    string name
    date createdAt
    date expiresAt "TTL 30d"
    object documents "code, notes, language, whiteboard, chat[]"
    array participants "[{id,name,joinedAt}]"
  }
  YJSDOCS {
    string roomId PK
    string docName PK
    binary state "Y.encodeStateAsUpdate"
    date updatedAt
  }
```

`rooms` indexes: `{id:1}` unique, `{expiresAt:1}` TTL.
`yjsDocs` indexes: `{roomId:1, docName:1}` unique, `{updatedAt:1}` TTL 30d.

---

## 13. Theming

```mermaid
flowchart LR
  OS[OS prefers-color-scheme] -. fallback .-> CMP
  LS[localStorage<br/>vaartalaap:color-mode] -. preferred .-> CMP[ColorModeProvider]
  CMP --> MUI[MUI ThemeProvider<br/>buildMuiTheme(mode)]
  CMP --> Doc[document.documentElement<br/>data-color-mode + colorScheme]
  MUI --> Comps[All MUI components]
  Doc --> Native[native scrollbars,<br/>form controls]
  CMP --> CMHook[useColorMode hook]
  CMHook --> CW[CodeWorkbench]
  CW --> CM[CodeMirror<br/>oneDark | defaultHighlightStyle]
  CMHook --> WB[Whiteboard]
  WB --> Canvas[canvas bg + auto-contrast]
```

---

## 14. Security boundary

```mermaid
flowchart TB
  subgraph Edge[Edge controls]
    H[Helmet headers]
    C[CORS allow-list]
    R[express-rate-limit]
  end
  subgraph App[Application]
    Z[Zod validation<br/>env + req body + socket payload]
    Cap[Caps:<br/>chat 200 msgs<br/>yjsDoc 1MB<br/>strokes capped]
  end
  subgraph DB[Storage]
    TTL[TTL indexes purge after 30d]
  end
  Internet --> Edge --> App --> DB
```

What's **not** in scope: authn/z, end-to-end encryption (WebRTC media is SRTP but server can read REST + WS payloads), abuse prevention beyond rate limits.

---

## 15. Performance budget

| Hot path | Target | Mechanism |
|---|---|---|
| Code keystroke → peer keystroke | <150 ms | Yjs update batched on next tick, WS broadcast |
| Whiteboard stroke ack | <50 ms local, <200 ms peer | Optimistic local draw + WS broadcast |
| Code → DB snapshot | 300 ms debounce | `roomService.persistDocuments` |
| Yjs → DB | 1500 ms debounce | `yjsService` per-doc timer |
| Reconnect after refresh | 3 s grace before kick | server `pendingRemovals` |
