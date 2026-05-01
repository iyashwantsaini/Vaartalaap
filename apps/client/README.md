# apps/client

React 18 + Vite 5 SPA.

---

## Component graph

```mermaid
flowchart TB
  Main[main.tsx] --> CMP[ColorModeProvider]
  CMP --> Router[BrowserRouter]
  Router --> L[/Landing/]
  Router --> R[/Room/]

  L --> Hero & CreateDialog & JoinDialog & ColorModeToggle

  R --> Lobby[RoomLobby]
  R --> CW[CodeWorkbench]
  R --> WB[Whiteboard]
  R --> NP[Notepad]
  R --> CH[ChatPanel]
  R --> CL[CallPanel]
  R --> CMT[ColorModeToggle]
  R --> EQ[ExecQuotaChip]

  CW --> CCE[CollabCodeEditor]
  CCE --> YJS[lib/yjs.ts]
  YJS --> Sock[lib/socket.ts]
  CH --> Sock
  CL --> Sock
  WB --> Sock
  NP --> Sock
  CW --> Exec[lib/codeExecutor.ts]
```

---

## Data flow per surface

```mermaid
flowchart LR
  subgraph Code
    K1[Keystroke] --> Y[Y.Text]
    Y --> WS1[ws yjs:update]
    WS1 -. broadcast .-> Y2[peer Y.Text]
    Y -. debounce .-> Snap[doc:change snapshot]
  end
  subgraph Whiteboard
    K2[Pointer] --> S[stroke ref]
    S --> WS2[ws wb:stroke]
    S --> CV[canvas redraw +<br/>resolveStrokeColor]
  end
  subgraph Notes
    K3[Tiptap edit] -. 300ms .-> WS3[ws doc:change kind=notes]
  end
  subgraph Chat
    K4[Send] --> WS4[ws chat:send]
  end
```

---

## Theming

```mermaid
flowchart LR
  Init{Init} --> LS[localStorage<br/>vaartalaap:color-mode]
  Init --> OS[matchMedia<br/>prefers-color-scheme]
  LS --> Mode((mode))
  OS --> Mode
  Mode --> Theme[buildMuiTheme(mode)]
  Mode --> Doc[document.documentElement<br/>.dataset.colorMode]
  Theme --> MUI[MUI components]
  Doc --> Native[native chrome]

  Hook[useColorMode] --> CW[CodeWorkbench]
  CW --> CM[CodeMirror<br/>oneDark | defaultHighlightStyle]
  Hook --> WB[Whiteboard<br/>canvasBg + auto-contrast]
```

`useColorMode().toggle()` flips and persists.

---

## Key local state

| File | State | Purpose |
|---|---|---|
| `routes/Room.tsx` | `hasJoined`, `localParticipantId`, `userColor` | gates room UI; HSL-hash colour for cursors |
| `lib/yjs.ts` | `Map<roomId+docName, Lease>` | refcounted Y.Doc + Awareness + socket pipe |
| `lib/socket.ts` | singleton `io()` | shared across components |
| `styles/ColorModeProvider.tsx` | `mode` | persisted theme |
| `components/Whiteboard.tsx` | `strokes`, `scale`, `offset`, `activeColor` | local-first draw |

---

## Per-window identity

```mermaid
flowchart LR
  Open[Open tab] --> Win{window.name set?}
  Win -- no --> Gen[window.name = vaa-XXXXXX]
  Win -- yes --> Use[reuse]
  Gen --> Key[storageKey:<br/>vaartalaap:pid:roomId:window.name]
  Use --> Key
  Key --> PID[stable participantId<br/>per tab+room]
```

So two tabs of the same room never collide on participant id, and a refresh keeps the same id.

---

## Build / scripts

| Command | What |
|---|---|
| `npm run dev` (root) | Vite dev :5173 + server :4000 |
| `npm run build` | `vite build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## Env

```
VITE_API_BASE=http://localhost:4000
```

Resolved by `lib/api.ts` and `lib/socket.ts` for REST + WS endpoints.
