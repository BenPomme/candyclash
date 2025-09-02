# CLAUDE.md — Ways of Working for Candy Clash Prototype

**Purpose:** This file tells Claude exactly how to build, iterate, and ship the Candy Clash web prototype (HTML5/Phaser + Node/Fastify) to a test URL within 2 weeks.

---

## 1) Operating Principles

- **Bias to action:** If info is missing, make the safest assumption and proceed.
- **Small, shippable slices:** Generate code in atomic PR-sized chunks.
- **Minimal prose:** Prefer code over commentary. Output only what’s needed to build/run/test.
- **Deterministic outputs:** Follow the file emission format below.
- **Security-first:** No real money; prototype “Gold Bars” only. Never commit secrets.
- **Skill, not chance:** Keep gameplay and payouts skill-based; avoid gambling mechanics.
- **Mobile-first:** Optimize for mobile Safari/Chrome, then desktop.
- **Performance:** Target ~1k concurrent players; prefer O(log N) leaderboard ops.
- **Observability:** Log key events; add simple health/readiness endpoints.

---

## 2) Tech Stack (fixed)

- **Frontend:** React + Vite + TypeScript + Tailwind + **Phaser 3** (HTML5 canvas).
- **Backend:** Node.js (TypeScript) + **Fastify** (REST) + **Socket.IO** (realtime).
- **Data:** Postgres (Neon/Supabase) + Redis (Upstash) for leaderboard & rate limits.
- **Auth:** Passwordless dev login (email only) issuing JWT (HS256).
- **Hosting:** Firebase Hosting (FE), Firebase Cloud Functions (BE), Neon (PG), Upstash (Redis).
- **Infra:** Firebase configuration, CI via GitHub Actions.

---

## 3) Repository Convention

/app
/frontend
/src
/game/ # Phaser scenes & mechanics
/components/ # React UI
/api/ # Typed API client
/editor/ # Level editor components
main.tsx
index.html
tailwind.css
vite.config.ts
package.json
/backend
/src
index.ts # Fastify bootstrap
auth.ts # JWT + dev login
challenge.ts # routes: config/join
attempts.ts # complete/validate
leaderboard.ts # Redis ZSET access
admin.ts # close day/payouts
levels.ts # Level CRUD operations
sockets.ts # Socket.IO namespace
db.ts # Kysely/Drizzle adapter
redis.ts
types.ts
telemetry.ts
/migrations
package.json
firebase.json
.firebaserc
.github/workflows/ci.yml
.github/workflows/deploy.yml
.env.example
README.md
CLAUDE.md
GAME_MECHANICS.md

yaml
Copy code

---

## 4) File Emission Format (mandatory)

When generating code, **only** emit blocks like:

=== path: app/backend/src/index.ts
<file contents>

=== path: app/frontend/src/game/Match3Scene.ts
<file contents>

yaml
Copy code

- One or more `=== path:` blocks per message.
- No extra commentary before/after.
- For large sets, paginate: `PART i/N` in the first line, then continue in the next reply.

---

## 5) Environment & Config

`.env.example` keys (never commit real values):

JWT_SECRET=change-me
PG_URL=postgres://...
REDIS_URL=rediss://...
FRONTEND_ORIGIN=https://staging.example.com
ADMIN_API_KEY=change-me

markdown
Copy code

Backend must read these via `process.env`, validate on boot, and fail fast if missing.

---

## 6) Data Model (Postgres)

Tables (Kysely/Drizzle):

- `users(id uuid pk, email text unique, display_name text, gold_balance int default 200, created_at timestamptz, is_admin bool default false)`
- `levels(id uuid pk, name text, config jsonb, created_by fk, created_at, updated_at, is_active bool default true)`
- `challenges(id uuid pk, name, level_id fk, entry_fee int, attempts_per_day int, starts_at timestamptz, ends_at timestamptz, rake_bps int default 0)`
- `attempts(id uuid pk, user_id fk, challenge_id fk, started_at, ended_at, time_ms int, collected jsonb, valid bool, attempt_no int, moves_made int)`
- `transactions(id uuid pk, user_id fk, challenge_id fk, type text, amount int, created_at, meta jsonb)`
  - types: `seed`, `entry_fee`, `payout`, `refund`, `admin_adjust`
- `boosters(id uuid pk, user_id fk, challenge_id fk, type text, expires_at, created_at)`

Redis keys:

- `lb:{challengeId}:{YYYYMMDD}` (ZSET) — score: `time_ms` (lower=better), member: `attemptId`
- `lbmeta:{...}` (HASH) — `pot`, `entries`, `closes_at`
- `rate:{userId}` — simple token bucket

---

## 7) API Contract

**Auth**
- `POST /auth/dev-login { email } -> { token, user }`
- `GET /me` (Bearer) -> user

**Challenge**
- `GET /challenge/today -> { config, level, pot, closes_at, attempts_left, user_balance }`
- `POST /challenge/:id/join -> { attemptId, attemptToken, serverStartTs }` (PG tx charges entry_fee)
- `POST /attempt/:id/complete { timeMs, collected, moves, attemptToken } -> { rank, pot }` (validate + `ZADD`)
- `GET /leaderboard/:id?limit=50&around=user -> { entries, userRank, pot, closes_at }`
- `POST /booster/claim { attemptId } -> { booster }`

**Level Editor**
- `GET /levels -> { levels }` (list all active levels)
- `GET /levels/:id -> { level }` (get specific level config)
- `POST /levels { name, config } -> { level }` (admin only)
- `PUT /levels/:id { name, config } -> { level }` (admin only)
- `DELETE /levels/:id` (admin only, soft delete)
- `POST /levels/:id/test -> { attemptId, attemptToken }` (test play level)

**Realtime (Socket.IO)**
- Namespace `/attempt`
- Join with JWT + `attemptToken`; server emits `start`, 10Hz `tick`, `closeSoon`, `closed`.

**Admin**
- `POST /admin/challenge/close { id }` (API key) -> payouts 40/25/15, snapshot persisted
- `POST /admin/challenge/create { name, levelId, entryFee, attemptsPerDay, startsAt, endsAt }` -> new challenge
- `POST /admin/reset` (prototype only)
- `GET /admin/dashboard` -> stats, active challenges, recent payouts

Error shape: `{ code, message }`.

---

## 8) Game Loop (Phaser)

- Configurable grid (6×6 to 10×10), 3-6 colors based on level config
- Match types: Match-3 (basic), Match-4 (striped candy), Match-5 (color bomb), L/T-shape (wrapped candy)
- Special combinations: Striped+Striped (cross), Striped+Wrapped (3×3 lines), Wrapped+Wrapped (5×5), Color Bomb combos
- Objectives: Collect X candies of specific colors, score targets, time challenges
- HUD shows **timer** (mm:ss.ms), **objective counter**, **score**, **moves** (if limited)
- End when objective met → call `/attempt/:id/complete`
- Anti-cheat: server-authoritative start; HMAC `attemptToken`; move sequence validation; theoretical max checks

---

## 9) Prize Pool Rules

- Pot = `entries * entry_fee * (1 - rake_bps/10000)`
- Payouts at close: **1st 40%**, **2nd 25%**, **3rd 15%**
- Ties: earlier `ended_at` wins; tie-breaker: lexicographic `attemptId`

---

## 10) Telemetry (console/log for prototype)

Events: `login`, `seed_balance`, `join_attempt`, `start_attempt`, `complete_attempt`, `score_accepted`, `score_rejected`, `claim_booster`, `view_leaderboard`, `payout_complete`, `admin_close`.

---

## 11) Performance Targets & Tactics

- ~1k concurrent WS connections on a single small Node instance.
- Redis ZSET ops O(log N). Batch reads for top-50 and around-user.
- Use sticky sessions for WS, gzip off for WS, sane heartbeat timeouts.
- Reject joins if `closes_in < 60s` or `attempts_left = 0`.

---

## 12) Compliance & Safety

- No real currency; add disclaimer in UI.
- Emphasize **skill-based** competition.
- Logically isolate from Candy Crush production; brand assets are prototype-only.
- Add CORS allowlist, Helmet, input validation (zod/typebox), and rate-limits.

---

## 13) Build/Run/Deploy (expected scripts)

**Backend `package.json` scripts**
- `dev`: ts-node-dev
- `build`: tsc
- `start`: node dist/index.js
- `migrate`: run migrations
- `seed`: seed initial challenge

**Frontend `package.json` scripts**
- `dev`: vite
- `build`: vite build
- `preview`: vite preview

**Firebase:** firebase.json configuration for hosting and functions.
**Deployment:** Automated via GitHub Actions - push to main triggers build and deploy to Firebase.

---

## 14) Testing

- Unit: DTO validators, prize math, token HMAC, LB ordering.
- Integration: join→complete→rank happy path.
- Load: include `k6` script to hammer `/auth/dev-login` and `join`.

---

## 15) Acceptance Criteria (prototype)

- Email dev login → user sees **200** Gold Bars.
- Two attempts/day enforced; joining deducts entry fee; pot increases.
- Match-3 scene playable; timer & yellow counter visible.
- Completion posts score; rank visible on leaderboard within 1s.
- Manual close triggers payouts and balance updates; top-3 celebration.
- Works on mobile Safari/Chrome and desktop Chrome.

---

## 16) Work Plan for Claude (2-week cadence)

**Day 1–2**
1. Scaffold monorepo (pnpm), eslint/prettier, CI workflow.  
2. Backend: DB schema (Kysely/Drizzle), migrations, seed script.

**Day 3–4**
3. Auth: `dev-login`, JWT middleware, `/me`.  
4. Challenge routes: `GET /challenge/today`, `POST /:id/join` (PG tx).

**Day 5–6**
5. Redis client + leaderboard module; `POST /attempt/:id/complete`.  
6. Socket.IO namespace `/attempt` with server-timer ticks.

**Day 7–8**
7. Frontend shell (React/Tailwind): Login → Entry → Brief → Game → Summary → Leaderboard.  
8. Typed API client + JWT storage + error states.

**Day 9–10**
9. Phaser 3 match-3 scene with special candies + HUD + integration with attempts.  
10. Level editor UI + admin panel + level testing mode.

**Day 11**
11. Admin close route + celebration animation + payouts logic + Firebase deployment setup.

**Day 12–14**
12. Branding pass (assets), QA, k6 load test, polish, automated Firebase deployment, runbook.

---

## 17) Prompt Library (copy/paste to generate code)

**A) Monorepo scaffolding**
> Create a pnpm workspace `app/frontend` (Vite+React+TS+Tailwind) and `app/backend` (Fastify+TS). Configure eslint/prettier, tsconfig, Firebase configuration, GitHub Actions CI. Emit files using the `=== path:` format.

**B) Database & seed**
> Implement Kysely (or Drizzle) models and migrations for the schema in CLAUDE.md §6. Add a seed script to create “Daily Clash” (target: yellow 100, entry_fee=20, attempts=2, rake_bps=0) and to seed balances to 200 for any new user.

**C) Auth**
> Add `/auth/dev-login` issuing HS256 JWT with user id+email, and a Fastify `preHandler` that validates Bearer JWT, attaching `request.user`. Include zod/typebox validators and tests.

**D) Challenge & Attempts**
> Implement `GET /challenge/today`, `POST /challenge/:id/join` (PG tx: deduct entry, create attempt, return attemptToken), `POST /attempt/:id/complete` (validate + `ZADD` Redis). Include HMAC signer/verifier for attemptToken.

**E) Leaderboard**
> Add `GET /leaderboard/:id` (top-50 & around-user). Serialize ranks with pot and closes_at. Include deterministic tie-breaking as per §9.

**F) Sockets**
> Add Socket.IO `/attempt`. On join (JWT+attemptToken), emit `start` with server monotonic start and send 10Hz `tick`. Emit `closeSoon` and `closed` when admin closes.

**G) Admin**
> Implement `POST /admin/challenge/close` (API key header). Compute payouts 40/25/15, persist transactions, update balances in a PG transaction, and emit `closed`.

**H) Frontend shell**
> Build pages: Login, Entry (balance, entry fee, “Play Now”), Brief, Game (canvas), Summary, Leaderboard, and optional Admin panel if `?admin=1`. Typed API client with fetch wrappers and JWT.

**I) Phaser scene**
> Implement configurable match-3 scene: dynamic grid size, match detection (3/4/5/L/T shapes), special candies (striped/wrapped/color bomb), combinations, gravity, cascades, objective tracking, HUD with timer/score/moves, level config loading. See GAME_MECHANICS.md for details.

**J) Tests & load**
> Add Vitest for prize math & token HMAC, and a `k6` script for login/join smoke. Provide npm scripts.

**K) Deploy**
> Set up Firebase project, configure firebase.json for hosting (FE) and Cloud Functions (BE), GitHub Actions workflow for automated deployment on push to main. Include firebase init, deploy commands, and environment variable setup.

---

## 18) Guardrails & Do/Don’t

**Do**
- Validate all inputs; return typed errors.
- Keep gameplay simple and stable; prioritize smooth swaps & timings.
- Use placeholders if brand assets are not yet provided.

**Don’t**
- Don’t add luck-based rewards.
- Don’t store PII beyond email for dev login.
- Don’t block on clarifications—make informed assumptions.

---

## 19) Definition of Done (handover)

- Staging URLs for FE/BE shared.
- `.env.example` complete; migrations + seed documented.
- “Close day” runbook and rollback steps.
- README with start commands and admin endpoints.

---