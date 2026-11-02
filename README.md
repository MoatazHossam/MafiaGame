# مافيا — MafiaGame

A complete Arabic, mobile-first Mafia party game for **4–12 friends sitting together**. Each player uses their own phone over the internet. The app is the narrator; no player has to sit out to run the game, and no closing eyes is needed.

## Play

1. Create a room, pick a name/avatar, and share the invitation link or QR.
2. Invitation links open a dedicated join screen with a fixed room code; friends choose a name and an available avatar, then the host admits them. Both /join/CODE links and older ?room=CODE links are supported.
3. Everyone marks ready. The host starts and also plays with an ordinary secret role.
4. Hold the private card to see your role; release to hide it. Mafia teammates are visible only to their team.
5. At night everyone uses the same timed selection screen. Mafia choose a victim, the doctor protects, and the detective investigates. Citizens make a personal suspicion choice that is never stored as a target.
6. At dawn the victim's role is revealed. Discuss face-to-face, then vote secretly.
7. Resolve ties, announce the winning team, reveal all roles, and start a rematch.

The host cannot see other people's roles or private actions. Eliminated players observe public information only. A lost connection pauses fairly for everyone, and the same browser can restore its player session.

## Rules implemented

- 4–5 players: 1 mafia and the remaining players are citizens. Short, experimental games without special roles.
- 6–7 players: 1 mafia, 1 doctor, 1 detective, remaining citizens. Six or more is recommended.
- 8–10 players: 2 mafia, 1 doctor, 1 detective, remaining citizens.
- 11–12 players: 3 mafia, 1 doctor, 1 detective, remaining citizens.
- Fixed 45-second night, 8-second private result stage, public dawn announcement, 60/120/180-second discussion, 30-second vote, and one 20-second runoff when needed.
- Doctor may protect themselves but not the same person on consecutive nights.
- Tied mafia choices produce no attack. A protected victim survives without a public explanation.
- Investigation returns mafia/not-mafia to the detective alone, even if the detective dies that night.
- Abstention wins over an equal vote count. A second tied vote eliminates nobody.
- Town wins when no mafia remain; mafia win at parity with other living players.
- Three complete cycles with no elimination end in a draw.

These are explicit game variants, not a claim of universally standard Mafia rules. Balance and timing should be tuned after real group play.

## Stack

React + TypeScript + Vinext, a Cloudflare Worker backend, and durable Cloudflare D1 storage. No external database account or Supabase key is required for the hosted version. The original Node/PostgreSQL proposal and the reasons for the deployment change are documented in `docs/`.

## Develop and verify

Requires Node 24 and pnpm 11.25.0 (pinned in package.json).

```sh
corepack pnpm install --frozen-lockfile
npm test
npm run typecheck
npm run build
```

See [deployment and local database setup](docs/DEPLOYMENT.md) before starting the local server. This app requires its backend; **GitHub Pages by itself is insufficient**.

```sh
node scripts/smoke-test.mjs https://YOUR_DEPLOYED_ORIGIN/
```

The smoke test uses eight disposable guest sessions against an owned environment and cleans up afterwards. No cookies or secret role assignments are printed.

## Source map

- `lib/game.ts`: authoritative rules and explicit private/public projections.
- `lib/server.ts`: guest sessions, admission, D1 compare-and-swap persistence, presence, idempotency, and request authorization.
- `app/api/room/route.ts`: same-origin backend endpoint.
- `app/game-client.tsx`, `components/mafia/`: Arabic responsive game screens.
- `db/schema.ts`, `drizzle/`: persistent schema and immutable migrations.
- `tests/`: rules, privacy, lifecycle, and actual-SQL API tests.
- `docs/ORIGINAL_ARCHITECTURE_AR.md`: original architecture proposal; planning claims are not completed work.
- `docs/DEPLOYMENT.md`: actual implementation, operations, and known limits.

## Current limits

This first release is for group testing. It has no remote play, voice chat, accounts, monetization, or proven large-scale capacity. Speech narration depends on an Arabic voice being available on the host's browser. Expired data cleanup is activity-driven; scheduled purging, backup exports, and load-tested production targets are not implemented. Read `docs/DEPLOYMENT.md` before a wider launch.
