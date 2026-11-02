# Deployment and operations

## The shipped architecture

The original plan proposed React + Fastify + Socket.IO + PostgreSQL. The first playable version deliberately uses **React/Vinext on Cloudflare Workers, D1 storage, and same-origin HTTPS polling every 1.8 seconds** so the complete game can be deployed through Sites without asking the owner to provision a server or a Supabase project. No Supabase project has been created or changed.

This is a recorded architecture change, not an unimplemented PostgreSQL integration. D1 is SQLite, not PostgreSQL. Native compare-and-swap updates replace the planned PostgreSQL row-lock transaction; the complete room state, command receipts, and phase transition are written atomically in one version-checked statement. Concurrent writers retry from the latest stored version. Poll responses contain the current authorized projection and a monotonically increasing revision; older responses cannot replace newer state in the UI. There is no volatile message queue to replay.

There is one durable aggregate per room, separate hashed guest sessions, presence rows, and entry/command rate-limit buckets. The whole aggregate is internal to the backend. Browsers receive only explicitly allowed fields, never the serialized room or other players' private choices. The D1 binding is server-only. No database keys or credentials appear in the client bundle.

Phase deadlines are server timestamps, progressed by incoming room requests. The game does not depend on a long-running process or an in-memory timer. If phones disappear, the next request detects missing players and pauses or cancels; it never races through several missed game stages. The room is frozen after a living player's heartbeat is more than 12 seconds old. It resumes on return, with at least 3 seconds to prepare. A 120-second unresolved interruption cancels without awarding a team victory. This is intentionally more tolerant than the original five-second proposal for mobile networks.

## Hosting

The tracked `.openai/hosting.json` identifies this Site and declares the `DB` D1 binding. `vite.config.ts`, `worker/index.ts`, and the maintained `sites()` integration are required for hosting. Use the Sites source/build/publish workflow to publish exactly the checked source commit. The provider applies the committed Drizzle migration before deploying the Worker.

The app does not call the optional ChatGPT authentication helper. It uses its own anonymous guest cookie. **The Site access policy must allow the intended players to visit**; an owner-private deployment will still require the platform's sign-in even though the game itself does not require an account. Sharing is controlled outside the game by the Site owner.

**GitHub Pages alone cannot host this app.** Pages serves static files and cannot run `/api/room` or hold authoritative private game state. Do not export just the frontend and expect multiplayer to work. Keep the working full-stack Site deployment, or migrate both the backend and storage to another supported host.

## Local development

Use Node 24 and the exact pnpm version in `package.json`. Run `corepack pnpm install --frozen-lockfile`, then `npm run build`. Apply the committed migration once to the local preview database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_curly_warbird.sql
npm run dev
```

Use the URL printed by the framework. If using the managed Work preview, use `sites-preview start <absolute-checkout>` instead of a second dev server. The migration command targets only local D1. Do not replay already applied SQL. For a schema change, edit `db/schema.ts`, run `npm run db:generate`, inspect the new migration and metadata, and append it without rewriting applied history.

## Verification

```sh
npm test
npm run typecheck
npm run build
node scripts/smoke-test.mjs https://YOUR_DEPLOYED_ORIGIN/
```

The smoke test creates a disposable room and eight independent guest sessions, checks admission, readiness, per-player role privacy, night actions, duplicate command handling, and cancellation, then leaves the room. Run only against a deployment you own and permit tests on. It does not print cookies or role assignments. Unit/integration tests use real in-memory SQLite with the same migration SQL; they are not a substitute for the HTTP smoke test against D1.

## Operational boundaries

- This is an initial playable release for real group testing, not a demonstrated production-scale service. No load target or uptime guarantee is claimed.
- Sessions and rooms expire logically after 24 hours. Expired rooms and their associated data are deleted in bounded batches on subsequent room creation. **There is no guaranteed scheduled purge or automatic nightly export implemented in this release.** Provider backup/restore policy must be verified by the owner before broader production use.
- There are no user accounts, payments, analytics trackers, uploads, or remote voice chat. Only names and selected avatars are retained with game state. Names/avatars may be remembered locally as non-secret preferences; authentication stays in an HttpOnly cookie.
- Each browser profile has one active room session. A new tab claims control and older tabs cannot command or sign out the newer one. Losing browser cookies cannot be repaired by guessing a name or room code; cancel/restart the affected game.
- Do not log room objects, actions, request bodies, cookies, or investigate results. Error logs intentionally contain only an error class.
- Narration is optional browser speech synthesis from the host's phone, only for public events; Arabic voice availability depends on the browser/device. Written instructions always work. It is not a prerecorded audio pack.
- Screen Wake Lock is requested when available during active stages. Browser support and battery policy may prevent it; keep the game visible on each phone.
- Device privacy cannot stop physical screen peeking or a photograph of the phone. Hold-to-reveal hides role details on release, blur, or tab hiding. It is a shoulder-surfing aid, not screenshot prevention.
- To move to Supabase later, add a PostgreSQL storage adapter with tested transactions/row locks or secure RPCs, then migrate and verify data. Do not place the internal aggregate in an exposed table or use a service-role key in the browser.
