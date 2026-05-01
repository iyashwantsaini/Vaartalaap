# Vaartalaap — Deployment

Diagram-first. Free-tier compatible.

---

## 1. Production topology

```mermaid
flowchart LR
  User[User browser] -- HTTPS --> CDN[Vercel Edge<br/>static SPA]
  CDN --> Bundle[index.html + JS/CSS]
  User -- HTTPS + WSS --> API[Render Web Service<br/>Node 18]
  API --> Atlas[(MongoDB Atlas M0<br/>rooms + yjsDocs)]
  User <-. STUN/TURN .-> TURN[(Open Relay TURN<br/>stun.l.google.com)]
  User <-. SRTP P2P .-> Peer[Other browser]
```

| Layer | Provider | Plan | Notes |
|---|---|---|---|
| Static SPA | Vercel | Hobby (free) | Auto SSL + global CDN |
| API + WebSocket | Render | Free Web Service | Cold-start ~30 s; upgrade to Starter to avoid |
| Database | MongoDB Atlas | M0 free | 512 MB storage, shared CPU |
| TURN | openrelay.metered.ca | Free public | Adds latency vs paid (Twilio/Xirsys) |

Alternatives: Fly.io / Railway for API; Netlify / Cloudflare Pages for SPA; self-hosted coturn for TURN.

---

## 2. Build pipeline

```mermaid
flowchart LR
  Dev[Developer push] --> GH[GitHub main]
  GH --> V[Vercel webhook]
  GH --> R[Render webhook]
  V --> Vbuild[npm i + vite build<br/>apps/client]
  R --> Rbuild[npm i + tsc<br/>apps/server]
  Vbuild --> Vdeploy[Edge CDN]
  Rbuild --> Rdeploy[Container restart]
```

---

## 3. Required environment

```mermaid
flowchart TB
  subgraph Server[apps/server/.env]
    s1[PORT=4000]
    s2[NODE_ENV=production]
    s3[MONGODB_URI=mongodb+srv://…]
    s4[CLIENT_ORIGIN=https://app.example.com]
  end
  subgraph Client[apps/client/.env]
    c1[VITE_API_BASE=https://api.example.com]
  end
```

`config/env.ts` validates with Zod — server fails fast on bad input.

---

## 4. Network ports & flows

```mermaid
flowchart LR
  B[Browser]
  B -- 443 HTTPS --> CDN
  B -- 443 WSS --> API
  B -- 3478 UDP/TCP --> TURN
  B -- 49152-65535 UDP --> Peer
  API -- 27017 TLS --> Mongo
```

CORS allow-list (server `index.ts`):
- `CLIENT_ORIGIN` (production)
- `http://localhost:5173` (dev)

---

## 5. MongoDB Atlas setup

```mermaid
sequenceDiagram
  autonumber
  participant Dev as You
  participant At as Atlas
  Dev->>At: Create M0 cluster
  Dev->>At: Add IP 0.0.0.0/0 (or Render egress)
  Dev->>At: Create user (rw on vaartalaap)
  Dev->>At: Copy SRV connection string
  Dev->>Server: Set MONGODB_URI env
  Server->>At: connect
  Server->>At: ensure indexes:<br/>rooms.id unique<br/>rooms.expiresAt TTL<br/>yjsDocs (roomId,docName) unique<br/>yjsDocs.updatedAt TTL
```

---

## 6. Render (API) deploy steps

```mermaid
flowchart TB
  s1[New + → Web Service] --> s2[Connect GitHub repo]
  s2 --> s3[Root dir: blank<br/>Runtime: Node<br/>Plan: Free]
  s3 --> s4[Build & Start commands<br/>see below]
  s4 --> s5[Set env vars + NODE_VERSION]
  s5 --> s6[Health check path: /health]
  s6 --> s7[Deploy]
```

**Build command** (must include `--include=dev` because Render sets `NODE_ENV=production`, which strips devDeps where `@types/*` and `typescript` live):

```bash
npm install --legacy-peer-deps --include=dev \
  && npm --workspace @vaartalaap/shared run build \
  && npm --workspace @vaartalaap/server run build
```

**Start command:**

```bash
node apps/server/dist/index.js
```

**Env vars (all required):**

| Key | Value | Notes |
|---|---|---|
| `NODE_VERSION` | `20.18.0` | Pin Node 20 — Render's default Node 24 has issues with our TS deprecations |
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | |
| `MONGODB_URI` | `mongodb+srv://...` | Must include database name (e.g. `/vaartalaap` before `?`) |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` | **No trailing slash** — CORS does exact match |

Free tier card requirement: Render now requires a card on file even for the Free plan (anti-abuse). They never auto-charge — only an explicit upgrade triggers billing.

---

## 6a. Render gotchas (real failures we hit)

```mermaid
flowchart TB
  E1[TS5101/5107: baseUrl deprecated] --> F1[Add ignoreDeprecations: '5.0' in tsconfig.base.json]
  E2[TS7016: Cannot find @types/express] --> F2[Build cmd must include --include=dev<br/>NODE_ENV=production strips devDeps]
  E3[ERR_MODULE_NOT_FOUND on ./config/env] --> F3[Add .js extensions to all relative imports<br/>Node ESM strict resolver requires them]
  E4[ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR Mongo] --> F4[Atlas Network Access → 0.0.0.0/0<br/>Render free has no static egress IP]
  E5[Build OK but No open ports detected] --> F5[Check Application Logs for thrown errors before listen]
  E6[CORS rejected from prod SPA] --> F6[CLIENT_ORIGIN must NOT have trailing slash]
```

---

## 7. Vercel (SPA) deploy steps

```mermaid
flowchart TB
  v1[Add new project] --> v2[Connect GitHub repo]
  v2 --> v3[Framework Preset: Other<br/>Root Directory: ./<br/>vercel.json drives everything]
  v3 --> v4[Env: VITE_API_BASE]
  v4 --> v5[Deploy]
```

[vercel.json](../vercel.json) sets:
- `installCommand`: `npm install --legacy-peer-deps`
- `buildCommand`: builds shared workspace then client
- `outputDirectory`: `apps/client/dist`
- SPA rewrites for client-side routing

**Critical**: Framework Preset must be **Other**, not Vite. The Vite preset hardcodes `outputDirectory=dist` and ignores [vercel.json](../vercel.json), causing "No Output Directory named 'dist' found".

**Env var:**

| Key | Value | Notes |
|---|---|---|
| `VITE_API_BASE` | `https://your-api.onrender.com` | No trailing slash. Baked at build time — must redeploy after change |

---

## 7a. Vercel gotchas

```mermaid
flowchart TB
  V1[Rollup: cannot resolve @codemirror/lang-cpp] --> W1[Move client-only deps from root package.json<br/>into apps/client/package.json]
  V2[No Output Directory dist found] --> W2[Framework Preset: Other<br/>or override Output Directory to apps/client/dist]
  V3[Client uses old VITE_API_BASE] --> W3[Env vars are baked at build<br/>must redeploy after env change]
```

---

## 8. Health & observability

```mermaid
flowchart LR
  Probe[Render health probe] -- GET /health --> API
  API --> Resp[200 ok]
  API -. structured logs .-> Render[Render Logs]
  Browser -. console / network .-> Devtools
```

The server exposes `/health` (returns `{status:"ok"}`) used by Render's auto-restart loop.

---

## 9. Cost ceiling at zero spend

| Resource | Free quota | Practical limit |
|---|---|---|
| Vercel bandwidth | 100 GB/mo | ~50k room loads |
| Render hours | 750 h/mo | 1 always-on service |
| Atlas storage | 512 MB | ~5–10k active rooms (with TTL) |
| Open Relay TURN | unlimited | rate-limited; flaky for many concurrent calls |

Beyond this: $7/mo Render Starter (no cold start), $9/mo Atlas M2, paid TURN (~$5/mo Twilio).

---

## 10. Failure modes & fallbacks

```mermaid
flowchart TB
  F1[TURN unreachable] --> M1[STUN-only — works on most home NATs]
  F2[Mongo down] --> M2[Sockets broadcast still work,<br/>persistence skipped, errors logged]
  F3[Render cold start] --> M3[First request waits ~30s,<br/>subsequent are warm]
  F4[CodeX / Wandbox down] --> M4[3-tier fallback<br/>Wandbox → CodeX → Agent]
  F5[WebSocket blocked by proxy] --> M5[Socket.IO auto-falls-back to long-poll]
```

---

## 11. Update / rollback

```mermaid
flowchart LR
  Push[git push main] --> GH[GitHub webhook]
  GH --> V[Vercel build & deploy]
  GH --> R[Render build & deploy]
  V --> Live
  R --> Live
  Bad[Regression] --> Rollback{Rollback}
  Rollback -- Vercel --> Vroll[Promote previous deployment]
  Rollback -- Render --> Rroll[Re-deploy previous commit]
```

Both providers listen to GitHub webhooks themselves — no GitHub Actions tokens or secrets needed. CI workflow ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs `tsc + vite build` on every push as a regression guard before the providers build.

Rollback: each provider retains the last ~10 deployments; one-click promote.

---

## 11a. Live URLs (reference deployment)

| Service | URL |
|---|---|
| SPA | https://vaartalaapclient.vercel.app |
| API | https://vaartalaap-api-edao.onrender.com |
| Health | https://vaartalaap-api-edao.onrender.com/health |

---

## 12. Local dev parity

```mermaid
flowchart LR
  D[npm run dev] --> Conc[concurrently]
  Conc --> A[apps/server<br/>tsx watch :4000]
  Conc --> B[apps/client<br/>vite :5173]
  A --> Mongo[(local mongo OR Atlas)]
  B -. proxy /api .-> A
  B -. WS direct .-> A
```

Required local env: Node 18+, optional local MongoDB (or Atlas M0 string).
