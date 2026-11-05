# Matchmaking Cold-Start: Server-Side Bot Backfill â€” Implementation Plan

Status: **PROPOSAL, no code changed.** Needs approval before implementation.

## 0. Decisions (confirmed by owner)

- **Hidden**: bots are not labeled. **No UI changes at all** (no tag, no new screens, no new strings).
- **Rated**: bot games count for the human's rating as normal Glicko-2 games.
- Quick 1v1 pool (3 min, 10 walls) first, behind a feature flag.
- Out of scope because they would need UI/data changes or would misstate data: fake online counter, fake leaderboard rows, bot-initiated friend requests. The home screen keeps showing the real `presence/online` value.
- Recommendation (not blocking): update ToS/privacy policy text to mention that matches may be filled by computer opponents when few players are online. App stores and some jurisdictions expect this for hidden bots.
## 1. What exists today (read from code)

- [matchmaking.service.ts](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/matchmaking/matchmaking.service.ts): in-memory queue. It pairs on the same mode, time control, increment and walls, with a rating window of `50 + 20Â·waitSec`. There is no timeout or fallback, so a lone player waits forever. This is the cold-start bug.
- [game.gateway.ts](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/gateway/game.gateway.ts): a 2-second `runMatchmakingSweep`, presence tracking and `broadcastPresenceCount`. The server creates games in `authoritative-game.service.ts`.
- The server already depends on `@duoorb/game-core`, so it can run the engine. It does not currently run bot turns (bots run on the client today).
- Prisma has `User`, `Profile`, `Rating`, `Game`, `GamePlayer`, `GameMove`, `FriendRequest`, `Friendship`. There is no `isBot` flag.
- Endpoints: `GET /leaderboard`, `GET /presence/online`, `GET /profiles/:userId`, `GET /users/search`.
- Bot strength: the Rust analyzer (native `.node` on the server, already built) with `select_bot_action(state, profile, seed)`, including the blunder fixes from this week.

## 2. Architecture

```mermaid
flowchart LR
  Q[Matchmaking queue] -->|"wait â‰¥ T (random 8â€“20s)"| B[BotBackfillService]
  B --> P[Pick bot persona + opening]
  P --> G[createGame: human vs bot seat]
  G --> R[ServerBotRunner]
  R -->|"think delay, then move"| G
```

New server module `apps/server/src/bots/`:

1. **`BotRoster`**: ~150 persistent bot users in the DB (`User.isBot = true`) with a profile, rating and avatar.
2. **`BotBackfillService`**: runs inside the existing 2s sweep. If a 2P entry is unmatched after a randomised wait, it picks a bot and seats it. Real humans always take priority: a human appearing in the window wins the slot.
3. **`ServerBotRunner`**: plays the bot seat on the server. It runs a per-game timer and calls the native engine with a per-game seed. It applies human-like think time, clock handling, and resign/abandon edge cases.
4. **`OpeningBook`**: see Â§4.

### Wait time
- Random 8â€“20s, weighted by the player's recent bot-vs-human ratio.
- Only for the quick 1v1 pool (3 min, 10 walls) at first. Other modes keep pure human matching. Roll out behind a feature flag (`BOT_BACKFILL_ENABLED`) with a percentage ramp.

## 3. Bot personas

- Reuse `BOT_ROSTER` strengths (Elo bands 450â€“2400, never Milo/ONNX path changes). Pick a bot with rating within Â±150 of the player, with a mild upward bias so wins feel earned.
- Persona fields: `displayName`, `country`, `avatarKey`, `rating`, `style` (opening/wall preference), `thinkTimeProfile`.
- **Names**: curated lists (not generated at runtime) of German, American, Hindi/Indian and Brazilian first names, with a few handles and initials, for example `Lukas_M`, `Jessica R.`, `Aarav`, `Thiago92`. About 40 per region, then combined to ~150 unique bots. Use plain ASCII-friendly spellings.
- Avatars: reuse existing avatar/cosmetic keys.

## 4. Openings: variety without 100 scripts

100 hand-written openings is a lot of work and will still repeat. Use a **seeded opening book** instead:

1. Generate openings offline: run the engine in self-play for the first 6â€“10 plies across rating bands, with temperature, and keep the sequences that stay roughly balanced (eval within a threshold). Store them in `packages/game-core` or `apps/server/data/openings.json` (target 100â€“300 lines, tagged by style and strength).
2. At game start, choose an opening with `hash(userId, botId, gameCount)` and **exclude the openings that user has already faced recently** (last N games, keep a small per-user ring buffer). That gives each user a different opening every time.
3. Follow the book while the human's replies stay on or near the book. At the first deviation, or when the book runs out, hand over to the engine. A book move is never played if it is illegal in the live position (validate every move).
4. The engine stays seeded per game (`seed = hash(gameId)`), so two games never share the same pattern after the book ends.

This avoids the repeated-pattern problem and needs far less hand work than 100 bespoke openings.

## 5. Bot profile and history

- Bots are normal `User` rows (`isBot = true`, server-internal, never serialized to clients) with `Profile` and `Rating`. `GET /profiles/:userId` returns them like any user, with no new fields.
- **History** is real: every bot game is stored in `Game`/`GamePlayer`/`GameMove`, so the human's history shows real moves. A bot profile shows only its latest 2-10 games.
- **Rated**: the human's rating updates normally. The bot has a rating that moves with results, with a floor and ceiling around its target band so it stays believable.
- Server-side exclusions (no UI change): bots are left out of `leaderboard` and the friend-request flow. Reports against a bot are auto-dismissed. Bots are not counted in `presence/online`.

## 6. Presence

No change. The home screen keeps showing the real online count.
## 7. Implementation phases

| Phase | Work | Files |
| :--- | :--- | :--- |
| 1 | Prisma: `User.isBot`, `Profile.country`, migration; seed ~150 bots | `prisma/schema.prisma`, `prisma/seed-bots.ts` |
| 2 | `ServerBotRunner` + engine call + think time, clock and abandon handling | `apps/server/src/bots/*` |
| 3 | `BotBackfillService` hooked into the sweep, with feature flag and metrics | `game.gateway.ts`, `matchmaking.service.ts` |
| 4 | Opening book generator script + `OpeningBook` + recent-opening exclusion | `scripts/gen-openings.ts`, `apps/server/data/` |
| 5 | Server-side exclusions (leaderboard, friends, reports, presence); no UI work | `ratings.service.ts`, `friends.service.ts`, `users.service.ts` |
| 6 | Tests and rollout | below |

## 8. Tests and rollout

- Unit: backfill triggers only after the wait, never when a human is available, and never twice for the same entry. Opening book moves are always legal. The user never receives a recently-seen opening. The bot's final move is always legal.
- Integration: a full human-vs-bot game over sockets, including clock expiry, disconnect/reconnect, rematch, and resign.
- Load: 200 simultaneous bot games on the production instance size (the Rust analyzer and the server share CPU, so cap concurrent bot thinking and set a per-move budget).
- Rollout: flag off, then 10%, 50%, 100%. Track median wait, % of searches ending in a bot game, abandon rate, and day-1 retention versus control.

## 9. Remaining open questions

1. Server capacity: is the Rust native binding available on the production host, or should bots use the TypeScript engine there?
2. Bot rating range: keep bots within +/-150 of the player (recommended) or allow a wider spread?

