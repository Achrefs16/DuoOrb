# @duoorb/server

Authoritative real-time game server for DuoOrb, built with NestJS, Socket.IO, Prisma ORM, and PostgreSQL.

---

## 1. Responsibilities

- **Real-Time Game Gateway:** Manages WebSocket connections via Socket.IO, player authentication, reconnect grace periods, and heartbeats.
- **Authoritative Move Validation:** All in-game moves (Classic 1v1, Center Rush, Race) are validated using `@duoorb/game-core` before broadcasting state updates to clients.
- **Matchmaking & Ratings:** Glicko-2 rating engine with expanding rating bands, queue management, and fair matchmaking.
- **Private Rooms:** Creation and management of 6-letter room codes with customizable mode and clock presets.
- **Billing & Monetization:** RevenueCat webhook endpoint for verifying Google Play subscriptions and synchronizing premium status.
- **User Progression & Social:** Tracks user profiles, friend lists, match histories, and 3-star bot victory records.

---

## 2. Directory Structure

```
apps/server/
├── prisma/                  # Database schema & migrations
│   └── schema.prisma
├── src/
│   ├── aiwins/              # Bot 3-star victory synchronization
│   ├── analysis/            # Server analysis fallback/delegation
│   ├── auth/                # Supabase & JWT guest authentication
│   ├── billing/             # RevenueCat webhooks & subscriber entitlements
│   ├── challenge/           # Direct friend challenge matchmaking
│   ├── common/              # Guards, filters, interceptors, and decorators
│   ├── config/              # Environment variables & runtime settings
│   ├── database/            # Prisma client service
│   ├── friends/             # Friend list, presence, and requests
│   ├── game/                # Authoritative game state service
│   ├── gateway/             # Socket.IO WebSocket gateway & connection events
│   ├── guest/               # Anonymous guest player management
│   ├── history/             # Online match history persistence
│   ├── legal/               # Terms of service and privacy endpoints
│   ├── matchmaking/         # Glicko-2 matchmaking queue
│   ├── moderation/          # Username policy and report handling
│   ├── rating/              # Glicko-2 mathematical calculations
│   ├── reports/             # Player reporting and conduct monitoring
│   ├── rooms/               # Private lobby and custom match settings
│   ├── users/               # User account profiles, avatars, and crowns
│   ├── app.module.ts        # Root NestJS application module
│   └── main.ts              # Entry point bootstrap (CORS, Helmet, Port)
└── package.json
```

---

## 3. Environment Variables

The server requires a `.env` file containing:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/duoorb?schema=public
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
REVENUECAT_WEBHOOK_AUTH_HEADER=<secret-token>
CORS_ORIGIN=*
```

---

## 4. Development & Running

```bash
# Run database migrations
npm run db:push --workspace=@duoorb/server

# Start server in development mode (with hot reload)
npm run start:dev --workspace=@duoorb/server

# Build production TypeScript output
npm run build --workspace=@duoorb/server

# Start production server
npm run start --workspace=@duoorb/server

# Run server unit tests
npm run test --workspace=@duoorb/server
```
