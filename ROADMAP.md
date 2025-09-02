Candy Clash — “Claude-ready” build plan (2-week prototype)
0) Goal (TL;DR)

Playable web prototype (mobile + desktop) with: email login, seeded 200 Gold Bars, daily challenge (collect 100 yellow candies), timered match-3 loop, two attempts/day, entry fee → prize pool, realtime leaderboard, manual “close day” payout (40/25/15%), mock booster reward. Scales to ~1k concurrent players.

1) Tech stack (simple, fast, cheap)

Frontend: React + Vite + Phaser 3 (HTML5 canvas), TypeScript, Tailwind.

Backend: Node.js (TypeScript) + Fastify (REST) + Socket.IO (realtime).

Data:

Postgres (Neon or Supabase) for users, balances, attempts, transactions.

Redis (Upstash) for leaderboards using sorted sets (ZADD) + rate limits.

Auth: Passwordless dev login (email only) for prototype (toggle real magic links later).

Hosting: Firebase Hosting (frontend) + Firebase Cloud Functions (Node) + Neon (PG) + Upstash (Redis).

Infra basics: HTTPS, CORS locked to frontend domain, JWT sessions (HS256), dotenv.

2) System architecture (high level)

Browser (Phaser) ↔ Socket.IO channel per attempt (server-side timer).

REST for auth, challenge config, join, attempts, claim booster, payout.

Redis ZSET per daily challenge for rank; mirror top-N into PG on close.

Pot = sum(entry_fee) minus optional house rake (config).

Admin route to “close day” → compute payouts → PG transactions → notify winners.

3) Data model (Postgres)
users(id uuid pk, email text unique, display_name text, gold_balance int default 200, created_at, is_admin bool default false)
levels(id uuid pk, name text, config jsonb, created_by fk, created_at, updated_at, is_active bool default true)
challenges(id uuid pk, name, level_id fk, entry_fee int, attempts_per_day int, starts_at, ends_at, rake_bps int default 0)
attempts(id uuid pk, user_id fk, challenge_id fk, started_at, ended_at, time_ms int, collected jsonb, valid bool, attempt_no int, moves_made int)
transactions(id uuid pk, user_id fk, challenge_id fk, type text, amount int, created_at, meta jsonb)  -- types: seed, entry_fee, payout, refund, admin_adjust
boosters(id uuid pk, user_id fk, challenge_id fk, type text, expires_at, created_at)


Redis keys

lb:{challengeId}:{YYYYMMDD} → ZSET score = time_ms (lower is better), member = attemptId

lbmeta:{...} → hash (pot, entries, closes_at)

rate:{userId} → per-minute action token bucket

4) Core game spec (what to ship)

Board: Configurable grid (6×6 to 10×10), 3-6 colors based on level, swap-to-match (≥3), gravity + cascades.

Special Candies:
- Match-4: Creates striped candy (clears row/column)
- Match-5: Creates color bomb (clears all of one color)
- L/T-shape: Creates wrapped candy (3×3 explosion)
- Combinations: Striped+Striped (cross), Striped+Wrapped (giant candy), Color Bomb combos

Objectives: Configurable per level - collect X candies of specific colors, score targets, time/move limits.

End: when objective met → show final time/score → POST results.

Attempts: max 2/day; re-entry charges Gold Bars; "Play again" loops back to paywall.

Leaderboard: live rank + closes in Xh Ym (countdown).

Rewards: everyone gets mock booster; on close simulate confetti + payouts 40/25/15.

Level Editor: Admin tool to create/edit levels with grid config, objectives, candy distribution, special rules.

Anti-cheat (lightweight): server-authoritative timer (start stamp + monotonic), signed attempt_token, move validation, theoretical max checks, one active attempt per user.

5) API (TypeScript DTOs)

Auth

POST /auth/dev-login { email } → { token, user }

GET /me (Bearer) → user

Challenge

GET /challenge/today → config, level, pot, closes_at, attempts_left

POST /challenge/:id/join → charges entry_fee (PG tx) + create attempt; returns { attemptId, attemptToken, serverStartTs }

WS /attempt/:id → join room; server emits start, ticks, and closeSoon

POST /attempt/:id/complete { timeMs, collected, moves, attemptToken } → validate + ZADD Redis; returns { rank, pot }

GET /leaderboard/:id?limit=50&around=user → top N + user rank

POST /booster/claim { attemptId } → grant mock booster

Level Editor

GET /levels → list all active levels

GET /levels/:id → get specific level config

POST /levels { name, config } → create new level (admin only)

PUT /levels/:id { name, config } → update level (admin only)

DELETE /levels/:id → soft delete level (admin only)

POST /levels/:id/test → test play level

Admin

POST /admin/challenge/close { id } → compute payouts; persist top-N snapshot; send notifications

POST /admin/challenge/create { name, levelId, entryFee, attemptsPerDay, startsAt, endsAt } → new challenge

POST /admin/reset → wipe LB and pots (prototype only)

GET /admin/dashboard → stats, active challenges, recent payouts

Errors: 4xx JSON { code, message }.

6) Prize pool math

Pot(t) = entries * entry_fee * (1 - rake_bps/10000)

Payouts at close: 1st 40%, 2nd 25%, 3rd 15%.

Ties: earlier ended_at wins; if identical, earlier attempt_id wins (deterministic).

7) Security & compliance (prototype level)

JWT (12h), rotate secret, CORS allowlist, Helmet, rate-limit joins/completes.

Server-side timer + signed attemptToken (HMAC of userId, challengeId, attemptId, startTs).

No real money. “Gold Bars are prototype tokens.” Add disclaimer and logs.

Legal review before any public test (gambling/luck perception).

8) Telemetry & KPIs

Events: login, seed_balance, join_attempt, start_attempt, complete_attempt, score_accepted, score_rejected, claim_booster, view_leaderboard, payout_complete.
KPIs: join→complete %, avg time, unique players/day, attempts/player, ARPPU proxy (entry fees), pot size, VIP return proxy.

9) Scaling to ~1k players

1 Node S-M instance handles 1k Socket.IO conns (low CPU; mostly timers).

Redis ZSET ops O(logN); ~1k writes/day trivial.

Use sticky sessions (WS), disable Nagle, gzip off for WS.

k6 smoke & soak tests (script below).

Backpressure: reject joins if closes_in < 1m or attempts_left=0.

k6 (load)

// save as load.js
import http from 'k6/http'; import { sleep, check } from 'k6';
export const options = { vus: 1000, duration: '2m' };
export default function () {
  const r = http.post(__ENV.API+'/auth/dev-login', JSON.stringify({email:`u${__VU}@t.com`}), {headers:{'Content-Type':'application/json'}});
  check(r, { '200': (res)=>res.status===200 });
  sleep(1);
}

10) Acceptance criteria (prototype)

Login works, user sees 200 Gold Bars.

Join deducts fee; attempts limited to 2/day; timer starts on server cue.

Game ends on 100 yellow; final time recorded; live rank updates within 1s.

Manual close computes payouts & shows celebration; balances credited; everyone got booster.

Works on Chrome/Safari mobile & desktop; hosted on a test URL.

11) Repo scaffolding
/app
  /frontend
    /src
      /game/ (phaser scenes, board, candy sprites, special candy logic)
      /components/ (UI: Login, HUD, Leaderboard, CloseDialog)
      /editor/ (Level editor: grid builder, objective setter, test play)
      /api/ (typed client)
      main.tsx, index.html, tailwind.css
  /backend
    /src
      index.ts (Fastify bootstrap)
      auth.ts
      challenge.ts
      attempts.ts
      leaderboard.ts
      levels.ts (CRUD for level configs)
      admin.ts
      sockets.ts
      db.ts (pg via kysely or drizzle)
      redis.ts
      types.ts
  firebase.json
  .firebaserc
  .github/workflows/deploy.yml
  .env.example
  GAME_MECHANICS.md


Env

JWT_SECRET=
PG_URL=
REDIS_URL=
ADMIN_API_KEY=
FRONTEND_ORIGIN=
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT=

12) Claude code prompts (copy-paste to generate code)

A. Project init (monorepo)

You are a senior TS engineer. Create a pnpm workspace with frontend (Vite+React+TS+Tailwind) and backend (Fastify+TS). Configure build scripts, Dockerfiles, and eslint/prettier. Output the full file tree and all files’ contents.

B. Backend: DB + types

Implement Kysely models for users, challenges, attempts, transactions, boosters (as spec above). Add migrations and seed script for one daily challenge (entry_fee=20, attempts=2, rake_bps=0). Provide db.ts and migrations/*.

C. Backend: auth

Add /auth/dev-login issuing JWT (email only). Create auth.ts Fastify plugin with preHandler to validate Bearer JWT and decorates request.user. Provide code.

D. Backend: challenge & attempts

Implement routes: GET /challenge/today, POST /challenge/:id/join, POST /attempt/:id/complete, GET /leaderboard/:id. Include PG transaction to charge entry, create attempt, and Redis ZSET for scores. Implement HMAC attemptToken signing/verification.

E. Backend: sockets

Add Socket.IO server. Namespace /attempt. Room per attemptId. On connection validate JWT + attemptToken, emit start with server monotonic start, then 10Hz tick. Provide code.

F. Backend: admin close

Implement POST /admin/challenge/close (API key protected). Read Redis ZSET, compute top 3 payouts (40/25/15), write PG transactions, persist snapshot, emit closed event to room. Provide code.

G. Frontend: UI shell

Build screens: Welcome/Login, Entry (shows balance, entry fee, "Play Now"), Challenge Brief, Game, Score Summary, Leaderboard, Admin panel (if ?admin=1), Level Editor (admin only). Use Tailwind components, responsive, and a playful palette.

H. Frontend: Phaser logic

Implement configurable match-3 scene: dynamic grid size from level config, detect matches (3/4/5/L/T shapes), create special candies (striped/wrapped/color bomb), handle combinations, gravity, cascades, track objectives, HUD shows timer/score/moves/objectives, on complete call /attempt/:id/complete. Load level config dynamically. See GAME_MECHANICS.md for detailed specs.

H2. Frontend: Level Editor

Build level editor UI: grid size selector, candy color picker, objective configurator, blocker placement, test play mode, save/load levels. Admin-only access. Visual grid builder with drag-drop for special tiles.

I. Frontend: realtime leaderboard

Connect to Socket.IO, show countdown to close, refresh rank after score submit and every 2s. Provide component code.

J. Tests + k6

Add minimal Vitest for server routes and utility functions; add k6 script for dev-login. Provide commands in package.json.

K. Deployment

Set up Firebase project, configure firebase.json for hosting and Cloud Functions, create GitHub Actions workflow for automated deployment on push to main. Include:
- Firebase project initialization with firebase init
- Service account setup for CI/CD
- Environment secrets in GitHub repository settings
- Automated build and deploy scripts using firebase deploy
- Rollback procedures using firebase hosting:rollback

13) Ticket backlog (2-week plan)

Day 1–2

Scaffold monorepo, CI, envs, DB schema + seed, auth dev-login.

Day 3–5

Challenge routes, attempts join/complete, Redis LB, Socket.IO.

Day 6–7

Phaser core gameplay with special candies + combinations + HUD, API client, integration loop.

Day 8

Level editor UI, admin panel, level CRUD APIs.

Day 9

Leaderboard UI, attempts limit, booster grant, admin close flow.

Day 10

Firebase deployment setup, GitHub Actions CI/CD, environment configuration.

Day 11

Load test, perf tweaks, edge cases, security pass.

Day 12–14

Branding pass (provided assets), Firebase staging deployment, playtest, bug bash, production deployment to Firebase, handover.

14) Risks & mitigations

Cheating → server timer + tokens + sanity checks; flag outliers.

Cannibalization → 2 attempts/day cap, short sessions.

Perception of gambling → clear skill framing, no RNG payouts, legal review.

Scale spikes → Redis LB, WS autoscale, pre-warming.

15) Handover checklist

Staging/prod URLs + admin key in 1Password.

.env filled; seed ran; one live daily challenge.

Docs: runbook, “close day” steps, rollback (reset leaderboard), data dictionary.

