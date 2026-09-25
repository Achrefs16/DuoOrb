# DuoOrb

A two-player tactical orb board game. Mobile client built with Expo, an
authoritative NestJS game server with real-time Socket.IO transport, shared
game logic in a workspace package, and Glicko-2 rating with matchmaking.

## Architecture

npm workspaces monorepo:

| Package            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `packages/game-core` | Pure game rules: movement, pathfinding, walls, AI, analysis, replays |
| `packages/protocol`  | Shared types and wire protocol for client/server                    |
| `apps/server`        | NestJS + Prisma + PostgreSQL game server (REST + WebSocket gateway) |
| `apps/mobile`        | Expo / React Native client                                         |

The server is authoritative: clients submit moves, the server validates them
against `game-core` and broadcasts the resulting state.

## Requirements

- Node.js 22
- npm 10+
- PostgreSQL 16 (or Docker)
- Supabase project (auth only)

## Setup

```bash
npm install
```

### 1. Environment

```bash
cp .env.example .env                              # for docker compose
cp apps/server/.env.example apps/server/.env      # for local server
cp apps/mobile/.env.example apps/mobile/.env      # for the app
```

Fill in the Supabase values in each. `SUPABASE_SECRET_KEY` must never be
committed or exposed to the client. `EXPO_PUBLIC_*` values are embedded in the
mobile bundle and must only ever hold publishable/anon keys.

### 2. Database

Start PostgreSQL and push the schema:

```bash
npm run db:push --workspace=@duoorb/server
```

Or bring up Postgres plus the server together:

```bash
docker compose up
```

### 3. Run

```bash
npm run server   # NestJS on :4000
npm run mobile   # Expo dev server
npm test         # game-core unit tests
```

## Testing

```bash
npm test                                              # game-core
npm run test --workspace=@duoorb/server                # server (vitest)
npm run lint --workspace=mobile                       # mobile
npx tsc --noEmit --workspace=@duoorb/server
```

## Project layout

```
apps/
  mobile/       Expo client
  server/       NestJS game server + Prisma schema
packages/
  game-core/    Shared rules engine
  protocol/     Shared types
```

Design system notes live in `DESIGN_SYSTEM.md`. Additional per-area guidance is
in `apps/mobile/AGENTS.md`.
