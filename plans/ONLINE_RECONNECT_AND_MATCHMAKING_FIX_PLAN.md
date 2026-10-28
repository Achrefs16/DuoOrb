# Online Reconnect & Matchmaking Reliability — Review and Implementation Plan

> **Status:** Core phases 1–5 implemented in the uncommitted working tree; the bounded pending-handshake registry is implemented; the remaining phase 6 hardening is partial. See “Implementation status” below. The rest of this document preserves the original analysis and target design so the remaining hardening work is explicit.
>
> **Scope:** mobile socket lifecycle, server handshake/session routing, reconnect grace, matchmaking delivery, and leave/resign behavior.
>
> **Code reviewed:** `apps/mobile/src/network/socket.ts`, `useOnlineGame.ts`, `useMatchmaking.ts`, `OnlineScreen.tsx`, `OnlineJoinGate.tsx`, `GameScreen.tsx`, `apps/server/src/gateway/game.gateway.ts`, `apps/server/src/game/authoritative-game.service.ts`, `apps/server/src/matchmaking/matchmaking.service.ts`, and `packages/protocol/src/index.ts`.

---

## 0. Quick Verdict

Yes — both analyses are substantially right about the main failure modes. They are not complete, and a few details are wrong or too aggressive.

- **Reconnect analysis:** correct on the verification race, transport churn, grace resets, the 6-second offline teardown, the status flicker, the leave/resign trap, and the missing ping settings. One correction: a join rejected as `UNAUTHENTICATED` is not immediately treated as a dead login — `useOnlineGame` attempts a credential refresh and rejoin. The loop is still real because the recovery paths can race each other and a transient server-side verification failure is reported as a permanent-looking `verified:false`.
- **Matchmaking analysis:** correct that `matchmaking:matched` has no acknowledgement/retry, that `ALREADY_IN_GAME` is ignored by the client, that a reconnect can re-enter search and be rejected, and that two devices on the same account cannot both queue. One correction: a connected WebSocket does not lose application messages like UDP packets. The real loss is a **stale/closed target socket** or a **client listener that is temporarily detached**. Their proposed 6-second abort is also too aggressive; use acknowledgement/retry and active-game recovery instead.
- **What both missed:**
  1. `useMatchmaking` re-subscribes its `matchmaking:matched` listener **every second** because `searchSeconds` ticks and the inline `onMatched` callback changes identity. That creates a real window in which the one-shot match event can be missed.
  2. A search can start while the transport is disconnected or still unverified. `matchmaking:find` is not queued, so the request is silently dropped; the hook then waits forever because its reconnect path does not set `wasDown` in that case.
  3. In 3P/4P, a player who resigns or leaves is `FINISHED` but can remain in `activeGameUserMap`. `handleFindMatch` then returns `ALREADY_IN_GAME` even though `isUserInLiveGame` says the player is no longer active. That is another way to feel trapped after resign/leave.

The **game engine itself is in good shape**: server-authoritative rules, idempotent action IDs, join quorum, separate AFK and disconnect timers, persistence, startup recovery, and tests are all solid. The weak layer is the **session/transport/matchmaking orchestration around the engine**. This does not need a rewrite; it needs a smaller, stricter state machine and a few recovery paths.

### Implementation status (this pass)

| Phase | Status | Delivered |
| --- | --- | --- |
| 1 — verified-before-mutation | **Core done** | Auth-required emits wait for `session:authState {verified:true}`; queue flush only on verified; rejoin gated on verified; search intent held and sent after verification; listener churn fixed; `UNAUTHENTICATED` retry. |
| 2 — one connection owner | **Core done / unified registry partial** | Transport phases prevent `ensureConnected` from re-cranking during opening/reconnecting; offline teardown 15s; heartbeat ping settings; connection epochs reject stale disconnects; retryable auth backoff; bounded (3s) pending-handshake reservation parks the old socket's teardown until the replacement verifies, fails, or expires. Unified session registry remains. |
| 4 — matchmaking recovery | **Core done** | `matchmaking:find` ack; server auto-routes a live active game with opponents instead of `ALREADY_IN_GAME`; stale finished-seat map entries are cleared and queued; client reconciles every 12s while searching and dedupes event/ack delivery; queue re-announce preserves wait time. No server-side persistent `searchId`; reconciliation is idempotent by user/config. |
| 3 — grace continuity | **Core done** | A second disconnect before expiry preserves the original deadline instead of restarting 45s; opponent-disconnect events are debounced 1.5s and cancelled by a verified rejoin; ended games clear pending debounce timers. |
| 5 — leave/resign durability | **Core done / UI partial** | `game:leave` and `game:resign` are acknowledged; queued leave is replayed for its own game and dropped when scoped elsewhere; finished/forfeited seats clear `activeGameUserMap`; offline resign exits the board instead of trapping. Persistent outbox and full “Resigning…” modal state remain. |
| 6 — hardening | **Partial** | `.connected` checks for matchmaking liveness; auth failure reason/retryable split; stale socket epochs; pending-handshake TTL lifecycle tests (verify success, auth failure, expiry); tests for auto-route, leave replay, retryable auth, and debounced opponent events. Metrics, load/race suite, feature flags, and the unified registry remain. |


---

## 1. Symptom → Root Cause Map

| Symptom | Most likely cause | Evidence |
| --- | --- | --- |
| Reconnect loops: connect → disconnect → connect → disconnected | Client rebuilds the transport on transient conditions; every new transport is a new server socket; server arms a fresh 45s grace on every disconnect; transient verification failure is reported as `verified:false` | `socket.ts:498-509`, `711-747`, `649-693`; `game.gateway.ts:148-302`, `464-537`; `authoritative-game.service.ts:1523-1584` |
| 45s countdown keeps restarting | `handleDisconnect` replaces the old timer with a brand-new 45s window; repeated/stale disconnects re-arm it | `authoritative-game.service.ts:1542-1554` |
| Red "reconnecting" indicator blinks | `ensureConnected()` writes `connecting` on every `getSocket()` while socket.io is already reconnecting; UI only renders `reconnecting`/`disconnected`, not `connecting` | `socket.ts:776-803`; `GameScreen.tsx:2157-2167` |
| Cannot resign or leave while connection is flapping | Resign is fire-and-forget; leave is deliberately dropped from the offline queue; no ack, no pending state, no retry UI | `useOnlineGame.ts:1280-1283`; `socket.ts:41-46`, `410-413`; `GameScreen.tsx:3040-3046` |
| One device enters the match, the other stays on "Searching" | One-shot `matchmaking:matched` + no ack/retry; listener can be detached; stale socket can be selected as the target; the other client may have sent its search before verification | `game.gateway.ts:1186-1196`; `useMatchmaking.ts:55-57`, `86-119`; `OnlineScreen.tsx:223-229`, `310-323` |
| Reconnect during search leaves permanent spinner | Server removes the queued entry on disconnect; client re-fires `matchmaking:find` on `connected` before `verified`; server returns `UNAUTHENTICATED` or `ALREADY_IN_GAME`; `useMatchmaking` listens to neither | `game.gateway.ts:485`, `866-875`; `useMatchmaking.ts:101-116`; `socket.ts:532-537` |
| Stuck in an active match after resign/leave in 3P/4P | Finished seat remains in `activeGameUserMap`; `handleFindMatch` blocks on game status alone | `game.gateway.ts:871-875`, `1210-1238`, `1451-1480`; `authoritative-game.service.ts:1426-1443` |

---

## 2. Verified Findings

### 2.1 Reconnect path

#### R1. Auth-required events are sent before the server has verified the socket

The server registers the socket synchronously, but verification is asynchronous:

- `handleConnection` starts unverified at `game.gateway.ts:148-162`.
- Token verification, `getOrCreateUser`, rating lookup, and premium lookup happen at `game.gateway.ts:177-249`.
- The real user route and `verified` flag are only published at `game.gateway.ts:256-281`.

Meanwhile the client sends gameplay events as soon as the transport reports `connect`:

- `socket.ts:532-537` calls `flushQueue()` on `connect`.
- `useOnlineGame.ts:682-689` calls `joinGame(false)` on `connStatus === 'connected'`.
- `useOnlineGame.ts:901-905` calls `joinGame()` on mount.

A `game:join` that arrives before the server finishes verification is rejected with `UNAUTHENTICATED` at `game.gateway.ts:1250-1257`. The same applies to `matchmaking:find` at `game.gateway.ts:866-870`.

**Correction to the other analysis:** this is not instantly treated as a dead login. `useOnlineGame.ts:786-807` tries `refreshSessionOnce()` and rejoins. But that recovery is independent of `socketManager.reauthAndReconnect()` (`socket.ts:711-747`), so the two paths can race: one refreshes the credential, the other rebuilds the transport, and both can emit joins. That is churn, not a clean recovery.

**Confidence:** high on the race; medium on which exact failure dominates in the field. Logs will settle it.

#### R2. A transient server-side verification failure looks like a permanent session failure

`handleConnection` catches failures from `verifyToken` and simply leaves the socket unverified:

```ts
} catch {
  this.logger.warn(`No Supabase identity on ${client.id}; staying unverified.`);
}
```

`game.gateway.ts:192-215`

`getOrCreateUser` is not the source of unverification: it catches database errors and returns a fallback profile. The failures that leave `verified:false` are `verifyToken` failures — invalid/expired credentials, missing JWKS configuration, or a transient JWKS/network failure.

Then it emits:

```ts
client.emit('session:authState', { verified, userId: effectiveId });
```

`game.gateway.ts:273`

If **JWKS/network verification** is temporarily unavailable, an account user with a perfectly valid token is reported as `verified:false`. The client treats that as an auth failure:

- `socket.ts:547-555` sets `verified=false` and calls `reauthAndReconnect()`.
- `socket.ts:711-747` refreshes; if the token is already “fresh”, it rebuilds with the same token; if rejected again, it sets `authDead` and parks.

This explains “most of the time reconnect fails” on a flaky link: a temporary verification dependency failure is being converted into a client-side dead session. The fix distinguishes `reason=unavailable, retryable=true` and retries with bounded backoff; database outages alone do not produce this state.

#### R3. Every transport reconnect is a new server socket; every disconnect starts a fresh 45s

Even without `disposeRaw`, a Socket.IO reconnect creates a new server-side socket. The old socket’s `handleDisconnect` runs and arms grace:

- `game.gateway.ts:464-537`
- `authoritative-game.service.ts:1523-1584`

`handleDisconnect` always computes:

```ts
const graceSeconds = 45;
const armedAt = Date.now();
const graceEndsAt = armedAt + graceSeconds * 1000;
```

`authoritative-game.service.ts:1542-1544`

It cancels the old timer and replaces it with a new deadline (`1553-1554`). It does not preserve the original absence deadline. A flapping connection can therefore keep resetting the opponent’s countdown.

The stale-socket guard only works **after** the new socket has finished verification and updated `userSocketMap`:

```ts
const live = this.userSocketMap.get(userId);
if (live && live !== client.id) {
  // stale; ignore
}
```

`game.gateway.ts:476-483`

If the old socket disconnects while the new socket is still in the async handshake, `userSocketMap` still points at the old socket. The guard does not apply, and grace is armed even though the player’s replacement transport is already connecting.

#### R4. The offline watcher can destroy a working transport

`OFFLINE_TEARDOWN_MS` is 6 seconds:

`socket.ts:54`

The NetInfo listener treats either `isConnected === false` or `isInternetReachable === false` as offline, then arms a timer that unconditionally calls `disposeRaw()`:

`socket.ts:649-693`

It does not check `this.raw?.connected` before disposing. A false or lagging NetInfo verdict can therefore tear down a socket that is still connected. That guarantees a server disconnect/connect cycle and a grace reset.

#### R5. The status indicator is built to blink

`ensureConnected()` runs on every `getSocket()` call:

```ts
if (!this.raw.connected && this.status !== 'connecting') {
  this.setStatus('connecting');
  this.raw.connect();
}
```

`socket.ts:776-803`

`getSocket()` is called by the 2.5s join retry, latency probes, foreground handling, and every emit. While Socket.IO is already in `reconnecting`, the manager overwrites the status with `connecting`. Then `connect_error` or `reconnect_attempt` sets it back to `reconnecting` (`socket.ts:573-599`, `601-621`).

The match screen only renders the red card for `reconnecting` or `disconnected`, not `connecting`:

`GameScreen.tsx:2157-2167`

So the card disappears and reappears each time the two states alternate. That is the blink.

There is a second, deeper problem: `raw.connect()` during Socket.IO’s backoff may short-circuit or compete with its own retry schedule. Even if it does not, writing status from a “getter” is the wrong ownership model.

#### R6. Resign and leave have no reliable completion path

`resign()` is a bare emit with no ack:

`useOnlineGame.ts:1280-1283`

The facade only queues while the socket is down:

- `socket.ts:290-307`
- `socket.ts:41-46` whitelists `game:resign` and `game:leave`

But on flush:

```ts
if (q.event === 'game:leave') {
  console.warn('[socket] dropped stale queued game:leave');
  continue;
}
```

`socket.ts:410-413`

So a leave pressed during a blip is intentionally discarded. A resign is replayed only if it is younger than 30s (`socket.ts:385-392`) and only if the socket ever gets to flush. If `authDead` is set or the 45s give-up cooldown is active, `ensureConnected` returns early (`socket.ts:788-793`) and the queue never flushes.

The resign confirmation modal closes immediately after calling `handleResign()`:

`GameScreen.tsx:3040-3046`

There is no “Resigning…”, no error, and no retry. If the emit is lost, the player sees nothing while the server still treats the seat as live. In 3P/4P, the same screen also emits `game:leave` on unmount (`GameScreen.tsx:657-671`), which can be dropped for the same reason.

#### R7. The server’s dead-connection detection is slow, and the stale-socket race is real

`@WebSocketGateway` sets only CORS:

`game.gateway.ts:52-56`

Socket.IO 4.8 defaults are approximately 25s ping interval + 20s ping timeout. A dead client can look connected for roughly 45s. Combined with a 45s grace window, the opponent can wait a long time for an outcome.

The stale-socket race from R3 is real and is not covered by the current guard.

---

### 2.2 Matchmaking path

#### M1. A search can be silently dropped before it ever reaches the server

`useMatchmaking.startSearch()` emits immediately:

`useMatchmaking.ts:44-67`

`matchmaking:find` is **not** in `QUEUEABLE_EVENTS` (`socket.ts:41-46`). If the transport is not connected, `facade.emit` drops it (`socket.ts:290-307`).

This is especially likely because `OnlineScreen` auto-starts quick search as soon as the screen opens:

`OnlineScreen.tsx:310-323`

The hook then sets `state='searching'` and starts its timer. Its status listener only sets `wasDown` when it sees `disconnected` or `reconnecting` **while already searching**:

`useMatchmaking.ts:101-110`

But:

- `startSearch` resets `wasDown.current = false` (`useMatchmaking.ts:48`).
- `getSocket()` may set the status to `connecting`, not `disconnected`.
- The first emit is already gone.

When the socket later becomes `connected`, `wasDown` is still false, so the hook does not re-fire. The user watches an endless radar.

If the transport is connected but the socket is still unverified, the same emit reaches the server and is rejected with `UNAUTHENTICATED` (`game.gateway.ts:866-870`). `useMatchmaking` does not listen to `game:error`, so this is also invisible and permanent.

This is a **major, direct cause of “the other device stays searching”** and is missing from both other analyses.

#### M2. The matchmaking listener is torn down and re-added every second

`useMatchmaking` updates `searchSeconds` once per second:

`useMatchmaking.ts:55-57`

That re-renders the owning component. `OnlineScreen` passes an inline `onMatched` callback:

`OnlineScreen.tsx:223-229`

The subscription effect depends on `onMatched`:

```ts
}, [onMatched, stopTimer, startSearch]);
```

`useMatchmaking.ts:86-119`

So every second the effect runs its cleanup (`socket.off('matchmaking:matched', ...)`) and then re-subscribes. If the one-shot `matchmaking:matched` event arrives during that window, no handler is attached and the event is gone.

The server never retries the event. The other player enters the game; this player keeps searching.

**Confidence:** high that the defect exists; medium that it is the exact event you observed without logs. It is a real, self-inflicted loss window and should be fixed regardless.

#### M3. `matchmaking:matched` has no acknowledgement or recovery

The server emits once, to the user’s current mapped socket:

`game.gateway.ts:1186-1196`

There is no ack, no retry, and no “did both clients receive it?” gate. The game is already created and both users are already marked active (`createGameChecked`, `game.gateway.ts:1702-1793`).

The other analysis calls this “fire-and-forget packet loss.” That wording is not quite right for a connected WebSocket: messages are ordered and reliable while the socket is connected. The event is lost when:

- the mapped socket is stale/closed,
- the socket disconnects before delivery,
- the client’s listener is detached (M2), or
- the client is on a socket that never finished verification.

The design flaw is still the same: **there is no application-level acknowledgement or recovery.**

#### M4. A stale socket can be considered “live” for matchmaking

`purgeDisconnected` checks only whether the socket ID exists in the server’s map:

`matchmaking.service.ts:44-50`

`createGameChecked` also checks only existence, not `.connected`:

`game.gateway.ts:1721-1735`

A socket object can still be present briefly while it is disconnecting. More importantly, `userSocketMap` is not updated to the replacement socket until the async handshake completes (`game.gateway.ts:256-281`). During that window, the old socket can be treated as live, the game can be created, and the one-shot `matchmaking:matched` can be sent to the old/dead socket.

**Nuance on the other analysis’s exact scenario:** if the user mapping is entirely missing, `createGameChecked` fails and requeues rather than creating a ghost game. The “created game, B silently skipped” outcome requires a stale mapping (or a mapping change between creation and emit), which is a narrower but real race. The client-side M1/M2 paths are more common.

#### M5. `ALREADY_IN_GAME` is emitted and ignored

The server rejects a search when the user is in an `IN_PROGRESS` game:

`game.gateway.ts:871-875`

The client has no `game:error` listener in `useMatchmaking`:

`useMatchmaking.ts:101-116`

So a reconnect during search can:

1. lose the queue entry on disconnect (`game.gateway.ts:485`),
2. re-send `matchmaking:find` on `connected` before verification,
3. be rejected as `UNAUTHENTICATED` or `ALREADY_IN_GAME`,
4. ignore the error and keep spinning.

This is exactly the “stuck on searching while the server already has me in a game” behavior.

#### M6. The 90s join quorum + 45s grace can strand the waiting player

`JOIN_QUORUM_MS = 90_000` (`authoritative-game.service.ts:59`). If one seat never joins, the quorum expires and that seat is put on the standard 45s grace (`authoritative-game.service.ts:592-618`). The player who did join can wait about 135 seconds before the match resolves. That is a long time to stare at “Waiting for opponent” when the other device is actually just sitting on the search screen.

This is a symptom of M1-M4, not a reason to shorten the quorum to 6 seconds. The existing 90s is deliberate for slow devices; the fix is to make the missing player recoverable, not to punish slow joiners.

#### M7. Two devices on the same account cannot both queue

`addToQueue` removes any existing entry with the same `userId`:

`matchmaking.service.ts:32-36`

`userSocketMap` is latest-wins, and the previous socket is told `session:superseded`:

`game.gateway.ts:263-267`

This is correct single-session behavior, but it is an important test confound. If both test devices use the same account (or share a guest identity), one device can be ejected while the other is in a match, and the ejected device can look like it is “still searching.” Verify distinct accounts/guest identities before treating the matchmaking result as a code bug.

---

### 2.3 Additional confirmed issue: finished seats remain “active”

In 3P/4P, resigning or leaving can finish the player’s seat while the match continues. The gateway emits `game:playerFinished` but does not clear `activeGameUserMap` in that branch:

- `handleResign`: `game.gateway.ts:1451-1480`
- `handleLeaveGame`: `game.gateway.ts:1210-1238`
- `leaveGame` marks the seat finished / forfeited: `authoritative-game.service.ts:1426-1443`

`handleFindMatch` then checks only the game status:

```ts
if (busyGame && busyGame.state.status === 'IN_PROGRESS') {
  client.emit('game:error', { code: 'ALREADY_IN_GAME', ... });
  return;
}
```

`game.gateway.ts:871-875`

But `isUserInLiveGame` already knows a `FINISHED` seat is not actively playing:

`game.gateway.ts:743-756`

So the two checks disagree. A player who forfeits while active in a multiplayer match can be told “Finish your current game first” even though their seat is already `FINISHED`. This is another way to feel trapped after resign/leave. (A player who was already finished and then calls `game:leave` does clear the mapping in `handleLeaveGame`; the gap is the active-player forfeit branch.)

**Fix direction:** use one predicate for both matchmaking and game creation, and clear `activeGameUserMap` as soon as a seat becomes FINISHED or a player has left.

---

## 3. Claim-by-Claim Verdict

| Claim from the other analyses | Verdict | Correction / nuance |
| --- | --- | --- |
| Join arrives before verification and is rejected | **Right** | Server verification is async; client sends join on transport `connect`. |
| That rejection is treated as a dead login | **Partly** | `useOnlineGame` refreshes and rejoins; the problem is the recovery races and transient `verified:false`. |
| Every rebuild is a real disconnect and restarts 45s | **Right** | Every transport reconnect is a new server socket; `handleDisconnect` always creates a fresh 45s window. |
| Network watcher can kill a working connection | **Right** | 6s `disposeRaw()` does not check `raw.connected`; NetInfo can be wrong/lagging. |
| Status flaps because `ensureConnected` writes `connecting` | **Right** | UI only shows `reconnecting`/`disconnected`, not `connecting`. |
| Resign/leave do nothing while flapping | **Right** | Fire-and-forget; `game:leave` is deliberately dropped; no ack/feedback. |
| Server is slow to notice dead connections; stale-socket race | **Right** | No ping settings; stale guard only after new mapping is published. |
| `matchmaking:matched` is fire-and-forget | **Right** | No ack/retry; but “packet drop” is the wrong mechanism for a connected WebSocket. |
| Async handshake can create a ghost match and skip one player | **Partly** | If the map is missing, creation fails/requeues. A stale mapping or a map change between create and emit can produce the described outcome. |
| Reconnect during search returns `ALREADY_IN_GAME`, which the client ignores | **Right** | `useMatchmaking` has no `game:error` listener. |
| Same account/guest on both devices breaks the test | **Right** | Queue dedupes by `userId`; latest socket wins; old socket is superseded. Verify distinct identities. |
| 90s join quorum + 45s grace strands the waiting player | **Right** | Up to ~135s. Fix recoverability, not by cutting the quorum to 6s. |
| Use `liveSockets.get(...)` instead of a second map lookup | **Right, with a caveat** | Also check `.connected`; a live reference to a dead socket is still dead. |
| Abort the match after 6s if the opponent has not joined | **Too aggressive** | Existing 90s quorum is deliberate. Use ack/retry and auto-route first; only cancel when zero seats have joined, with a longer configurable window. |
| Add a session check / active-game resume on launch and reconnect | **Right** | This is the best safety net for missed match events. |
| Auto-route `matchmaking:find` to the active game instead of `ALREADY_IN_GAME` | **Right** | Highest-value matchmaking fix. |
| Listen to `game:error` in `useMatchmaking` | **Right** | Also handle `UNAUTHENTICATED` by waiting for verification, not by spinning. |

---

## 4. Target Model

The core problem is that “transport connected”, “server verified”, “queued”, “matched”, “joined”, and “in grace” are currently inferred from several independent booleans and maps. The target is one explicit state machine per user/session.

### 4.1 Server session state

```text
transport_open (unverified)
  -> authenticated (token verified, user route published)
  -> queued(searchId)
  -> matched(matchId, gameId, awaiting join/ack)
  -> seated(gameId)
  -> grace(graceEndsAt)       // absence
  -> finished
```

Rules:

- A socket cannot mutate game/matchmaking state until `authenticated`.
- The newest transport for a user owns the route; older transports are stale by `connectionEpoch`.
- A pending replacement transport suppresses “real disconnect” grace until the replacement fails or times out.
- A match is not considered delivered until the client acknowledges receipt or sends `game:join`.
- A grace window belongs to an absence, not to an individual socket disconnect.

### 4.2 Client state

```text
offline -> connecting -> authenticating -> online
online -> searching -> matched -> joining -> in_game
in_game -> reconnecting -> in_game | grace | ended
```

Rules:

- `matchmaking:find`, `game:join`, `game:action`, `game:resign`, and `game:leave` are only sent when `authenticated`, or are held in an authenticated outbox.
- `getSocket()` must not mutate connection status or start a connection. Connection ownership belongs to lifecycle events and explicit retry.
- A single derived health value feeds every indicator; screens should not combine raw transport booleans themselves.

---

## 5. Implementation Plan

### Phase 0 — Instrument first (small, no behavior change)

**Goal:** make the next failure diagnosable instead of guessing.

1. Add a server-side connection log with:
   - `socketId`, `userId`, `connectionEpoch`, `verified`, `authReason`
   - `event`, `gameId`, `searchId`
   - `graceEndsAt`, `previousGraceEndsAt`, `activeGameId`
   - whether the emit target was connected.
2. Add a client debug counter for:
   - transport rebuilds and why (`identity`, `auth`, `offline`, `retry`, `superseded`)
   - `matchmaking:find` emits, acks, and retries
   - `game:join` emits and `game:sync` receives
   - verified/authState transitions
3. Add a two-client integration test harness that can:
   - connect/disconnect one transport at will,
   - toggle NetInfo reports,
   - drop a match event by detaching the listener,
   - simulate a stale old socket during a new handshake.
4. Confirm the test devices use distinct accounts/guest identities. If they share an account, that is M7, not a matchmaking delivery bug.

**Files:** `game.gateway.ts`, `socket.ts`, test helpers. No production behavior change.

---

### Phase 1 — Verified-before-mutation (P0, highest value)

**Goal:** no gameplay/matchmaking event can be rejected simply because it raced the handshake.

#### Server

1. **Publish the user route as soon as identity is verified**, before the slower profile/rating/premium enrichment.
   - After `verifyToken` returns a valid identity, set `socketUserMap`/`userSocketMap` with `verified: true` and the canonical id.
   - Continue `getOrCreateUser`, rating, and premium lookups afterward; update name/rating when they land.
   - If `getOrCreateUser` fails because the database is unavailable, do **not** downgrade a cryptographically valid identity to `verified:false`. Emit `verified:true` with `profilePending:true`, or close the socket with a retryable error. The token is the auth proof; the database is enrichment.
2. **Add a reason to `session:authState`:**
   ```ts
   { verified: true, userId, connectionEpoch, activeGameId?: string }
   | { verified: false, userId, reason: 'expired' | 'invalid' | 'unavailable', retryable: boolean, retryAfterMs?: number }
   ```
   Update `packages/protocol/src/index.ts` and the client handler.
3. **Queue early gameplay events for a short window** instead of rejecting them immediately.
   - `game:join`, `matchmaking:find`, `game:action`, `game:resign`, `game:leave` can be held for up to ~2s while verification completes.
   - If verification succeeds, process them in order.
   - If verification fails permanently, answer with `UNAUTHENTICATED` and the reason.
   - This is a safety net for older clients and slow handshakes; the client should still wait for verified.

#### Client

4. **Do not flush the offline queue on `connect`.** Flush on `session:authState verified:true`.
   - Move `flushQueue()` from `socket.ts:532-537` / `627-633` to the verified branch.
   - Keep the queue until verified; do not age it out while auth is pending.
5. **Gate `useOnlineGame` joins on verified.**
   - Replace the `connStatus === 'connected'` join trigger with `authenticated && connected`.
   - On `session:authState verified:true`, if a join intent exists, send it immediately.
   - Do not call `refreshSessionOnce()` and `joinGame()` from the game-error handler as a second, independent auth loop. Route all auth recovery through `socketManager`.
6. **Gate `matchmaking:find` on verified.**
   - `startSearch` records the desired search (`searchId`, mode, clock, walls) and shows “Connecting…” until authenticated.
   - On verified, send `matchmaking:find` with the `searchId`.
   - Keep the intent until the server acknowledges `queued` or `matched`.
7. **Backoff, don’t park, on retryable auth failure.**
   - `reauthAndReconnect` should retry with jitter/backoff when `reason === 'unavailable'` or `retryable === true`.
   - Park only on `expired`/`invalid` after a real refresh failure or a definitive 401.
   - Surface “Reconnecting…” and a manual retry; do not show “Session expired” for a backend blip.

**Tests:**
- Valid token + server delays verification 500ms: no join is rejected.
- Entire DB down: account still verifies from token, or gets retryable state; no `authDead`.
- Reconnect during join: exactly one successful join, no `UNAUTHENTICATED` storm.
- `game:join` queued while offline: not flushed until verified.

**Acceptance:** no `UNAUTHENTICATED` on a valid-token reconnect; no permanent auth park from a transient dependency failure.

---

### Phase 2 — One connection owner, no destructive flapping (P0)

**Goal:** `getSocket()` stops acting like a reconnect button.

1. **Introduce a connection epoch and a pending-socket record.**
   - `userId -> { socketId, epoch, verified, pendingSocketId?, activeGameId }`.
   - Increment `epoch` on each accepted connection.
   - `handleDisconnect` ignores an epoch older than the current one.
   - If a replacement socket is pending for the same user, suppress grace until it verifies or fails; do not announce a disconnect immediately.
2. **Make `ensureConnected()` non-mutating when Socket.IO is already reconnecting.**
   - Track a `transportPhase` owned by the manager: `idle | opening | open | reconnecting | cooldown`.
   - Only call `raw.connect()` from explicit lifecycle points: identity start, NetInfo online after a real outage, foreground revalidation, `retryNow()`, or a new scoped game.
   - Do not set status from `getSocket()`.
   - Do not call `raw.connect()` while `transportPhase === 'reconnecting'` or `'opening'`.
3. **Fix the offline watcher.**
   - Never dispose a raw socket that reports `connected`.
   - Arm teardown only when both the OS link is offline **and** the socket is not connected/reconnecting.
   - Lengthen `OFFLINE_TEARDOWN_MS` from 6s to a more conservative 15–20s; clear the timer on any `connect`/`reconnect`.
   - Treat `isInternetReachable === null` as unknown, not offline.
4. **Derive one client health state.**
   - Combine transport, verified, and link into `online | connecting | reconnecting | offline | auth_expired`.
   - Debounce transitions by ~500ms so the UI never flickers between `connecting` and `reconnecting`.
   - Update `GameScreen`’s own card to render `connecting` as “Reconnecting…” when the player was previously online, or switch it to the derived health value.
5. **Set explicit Socket.IO ping values on the server.**
   - Example starting point: `pingInterval: 20_000`, `pingTimeout: 20_000` in `@WebSocketGateway`.
   - Tune with metrics; the goal is to detect dead links sooner than the default ~45s without punishing slow mobile radios.
6. **Do not dispose the transport for a transient NetInfo false.** `disposeRaw()` should be reserved for identity/credential changes, explicit retry, or a sustained outage.

**Tests:**
- 20 rapid NetInfo false/true cycles while `raw.connected === true`: zero `disposeRaw` calls, zero server disconnects.
- `getSocket()` during `reconnecting`: status remains `reconnecting`, no `connect()` call.
- Status listener sees no `connecting`/`reconnecting` ping-pong within a 2s window.
- Old socket disconnect while new socket is handshaking: no grace, no opponent event.

**Acceptance:** one outage produces at most one server disconnect; no UI blink; no transport rebuild from a NetInfo false positive.

---

### Phase 3 — Grace continuity and stable opponent events (P0/P1)

**Goal:** a flapping connection does not extend the absence window or reset the opponent’s countdown.

1. **Track absence, not socket disconnects.**
   - On the first disconnect, record `absenceStartedAt` and `graceEndsAt = now + 45s`.
   - On a reconnect that succeeds (`game:join`), clear the absence and start a short stability window (e.g., 5s).
   - If the player drops again inside that stability window, restore the **original** `graceEndsAt`; do not add a fresh 45s.
   - If the player stays connected through the stability window, a later drop starts a new absence.
   - This preserves fairness for a genuinely bad link while preventing indefinite resets.
2. **Do not announce a disconnect while a replacement socket is pending.** Coalesce opponent events:
   - Wait a short debounce (e.g., 1–2s) before emitting `game:opponentDisconnected`.
   - If the replacement joins within the debounce, emit nothing, or emit a single `game:connectionState` update.
3. **Make `game:join` the authoritative “I am back” signal.**
   - Keep the synchronous `cancelDisconnectGrace` in `handleJoinGame`, but only after the seat is verified.
   - Ensure `processJoin` / `handleReconnect` sends `game:opponentReconnected` only to other seats.
4. **Optionally replace the two-event pair with a state event**, e.g. `game:connectionState { userId, playerId, state: 'connected' | 'grace', graceEndsAt? }`. The UI can then render one source of truth instead of reacting to disconnected/reconnected churn. Keep the old events for backward compatibility for one release.

**Tests:**
- Drop, reconnect, drop within 5s: grace deadline does not move.
- Drop, stay away 30s, reconnect: grace clears; opponent sees one reconnected event.
- Old socket disconnects during new handshake: no disconnected event.
- 3P/4P: one away seat does not reset another’s countdown.

**Acceptance:** total absence time cannot exceed the configured budget by repeated flapping; the opponent sees one stable countdown.

---

### Phase 4 — Matchmaking delivery, acknowledgement, and recovery (P0)

**Goal:** a created match always has a path to both clients, even if one event is missed.

#### 4.1 Server

1. **Add a `searchId` and an ack to `matchmaking:find`.**
   ```ts
   socket.emit('matchmaking:find', { searchId, ...config }, (res) => {
     // { status: 'queued' | 'matched' | 'already_in_game', gameId?, opponents? }
   });
   ```
   The server records the search by `searchId`, so retries are idempotent.
2. **Add `matchmaking:queued` / `matchmaking:cancelled` events** (or use the ack for queued; a separate event is useful for reconnect snapshots).
3. **Auto-route an active game instead of returning `ALREADY_IN_GAME`.**
   - If `matchmaking:find` arrives and the user has an `IN_PROGRESS` game where they are still an active seat and have not left:
     - emit `matchmaking:matched` for that game with `resumed: true`, or
     - emit a dedicated `session:activeGame` and let the client resume.
   - Only use `ALREADY_IN_GAME` when the user is genuinely in a live game that cannot be resumed (and include `gameId` in the error payload).
4. **Send a resume hint on verified connect.**
   - In `session:authState verified:true`, include `activeGameId` when the user has a resumable game, or emit `session:activeGame`.
   - The client can auto-open the join gate or show a “Resume match” card. This is the safety net for a missed `matchmaking:matched`.
5. **Use live sockets with `.connected` checks everywhere.**
   - `purgeDisconnected` should use `socket.connected`, not just `server.sockets.sockets.has`.
   - `createGameChecked` should reject/requeue when a seat’s socket is not connected.
   - `runMatchmakingSweep` should emit to the validated live socket reference, not a second map lookup.
6. **Add a matched-delivery state.**
   - `pendingMatches: gameId -> { seats, matchedAt, ackedBy, retryCount }`.
   - Client ack on receipt (or use `game:join` as the ack; both is fine).
   - If a seat has not acked within ~10–15s, re-emit once to that user’s current verified socket.
   - If **zero** seats have joined after the retry window, cancel the game and requeue both.
   - If one seat has joined, keep the existing no-show grace but show the waiting player “Opponent is connecting…” with a cancel/requeue option. Do not silently wait 135s.
   - A 6s hard abort is too aggressive for cold starts; make the window configurable and start at 10–15s.
7. **Keep queue entries fresh after verification.**
   - On verified connect, call `matchmakingService.updateSocket(userId, socket.id)` before any sweep can use the old ID.
   - If the old socket disconnect removed the queue entry, the client’s verified search retry should recreate it.

#### 4.2 Client

8. **Fix listener churn.**
   - Store `onMatched` in a ref (`onMatchedRef.current = onMatched`) and remove it from the effect dependencies.
   - Subscribe to `matchmaking:matched` once per mount.
   - Alternatively, memoize the parent callback, but the ref is the robust fix because it survives parent re-renders.
9. **Start search only when authenticated, and retry until acked.**
   - Keep a `desiredSearch` ref with `searchId`, config, and `state`.
   - On `session:authState verified:true`, send `matchmaking:find` if `desiredSearch` is still active.
   - On ack `queued`, show “Searching…”.
   - On ack `matched` / `matchmaking:matched`, navigate to the join gate.
   - On `already_in_game`, route to the game (or show “Resume”).
   - On `UNAUTHENTICATED`, keep the search intent and wait for verified; do not spin silently.
10. **Listen to `game:error` in `useMatchmaking`.**
    - Stop the spinner for terminal errors.
    - Show honest copy: “Your session is reconnecting…”, “You are already in a match — resuming…”, or “Could not join the queue. Retry.”
11. **Keep the search alive across a reconnect.**
    - Do not reset `wasDown` at the start of every search. Instead, derive `needsReannounce = desiredSearch && (!wasVerified || transportDropped)`.
    - On verified reconnect, re-announce with the same `searchId`; the server dedupes.
12. **Do not drop a search just because the user opened the screen before the socket was ready.** Show a clear “Connecting…” state instead of the radar until the search is queued.

**Tests:**
- Start quick search while offline/connecting: no infinite spinner; it queues after verified.
- Detach/re-attach the match listener every second while emitting a match: the ref-based subscription never misses.
- Both clients match; one client’s listener is detached at emit time; server retry / auto-route recovers it.
- One client is in an active game and sends `matchmaking:find`: it is routed back, not rejected.
- One seat never joins: the other sees a bounded wait, then clear recovery.
- Same account on two devices: one is superseded with a clear message, not left searching.

**Acceptance:** 100 simulated matches with random client disconnects: every match either starts with both seats or is cancelled/requeued; zero clients remain on “Searching” while seated in a server game.

---

### Phase 5 — Resign/leave durability and honest UX (P1)

**Goal:** the player can always get out of a match, even when the link is flapping.

1. **Add acknowledgements to `game:resign` and `game:leave`.**
   - Protocol: `(payload, ack?: (res: { ok: boolean; code?: string; message?: string }) => void)`.
   - Server answers after the action is applied, the seat is released, or the game is already gone.
2. **Make the client await and show state.**
   - `resign()` returns a promise or exposes `resignState: 'idle' | 'sending' | 'sent' | 'failed'`.
   - The modal shows “Resigning…” and an error with Retry on failure.
   - Do not close the modal until the ack or a terminal error.
3. **Use a durable, game-scoped outbox.**
   - Persist `{ gameId, action: 'resign' | 'leave', requestId, createdAt }`.
   - On verified reconnect, send only if that game is still `IN_PROGRESS` and the user is seated; otherwise discard.
   - Server dedupes by `requestId` and validates the game ID/seat.
   - This fixes the current “leave is always dropped” trap without risking a forfeit in a different game.
4. **Clear `activeGameUserMap` for finished/left seats.**
   - In `handleResign` and `handleLeaveGame`, when `result.finished` is returned but the match continues, delete the user’s active-game mapping and set presence `isPlaying:false`.
   - In `handleFindMatch`, use `isUserInLiveGame` (seat status aware) instead of only `busyGame.state.status`.
   - This fixes the 3P/4P “finished but blocked” bug.
5. **Give the Home/Online screen a resume/forfeit path.**
   - If `activeGameId` exists on launch, show “Resume match” and “Forfeit” actions.
   - Never leave the user with a server-side active seat and no visible way to resolve it.

**Tests:**
- Resign while offline, reconnect: ack arrives; UI shows completed; no duplicate resign.
- Leave while offline, reconnect to a different game: old leave is not replayed into the new game; the old game resolves via grace/forfeit.
- 3P/4P resign/leave: finished player can immediately search again; old match continues for the rest.
- Resign failure: user sees a retryable error, not silence.

**Acceptance:** no path leaves a user permanently “in a game” without a visible action.

---

### Phase 6 — Session registry and “perfect” hardening (P1/P2)

**Goal:** remove scattered map lookups that can disagree with each other.

1. **Consolidate session routing.**
   - Create one `SessionRegistry` owning `userId -> socketId`, `socketId -> user`, `connectionEpoch`, `verified`, `activeGameId`, `queueEntry`, `pendingSocketId`.
   - Migrate the gateway’s `socketUserMap`, `userSocketMap`, `activeGameUserMap`, and matchmaking queue lookups behind it.
   - All liveness checks use one `isLive(socketId)` helper (`.connected` plus epoch).
2. **Match state machine.**
   - `idle -> queued -> matched -> joining -> seated -> grace -> ended`.
   - Each transition has an owner, timestamp, and idempotency key.
   - A match cannot be created for a user who is not `verified` and `queued`.
3. **Observability.**
   - Metrics: queue wait, match rate, match-to-join latency, join failures, reconnect success, grace resets, auth failures by reason, leave/resign completion.
   - Alert on “active game with no seat joined > 30s” and “same user with two live sockets.”
4. **Load/race tests.**
   - Two devices, rapid network toggles.
   - Kill socket during the matchmaking sweep.
   - Old socket disconnect during new handshake.
   - 3P/4P one-seat no-show.
   - App background/foreground mid-search.
   - Token expiry during a match.
5. **Protocol/versioning.**
   - Add the new fields as optional for one release; old clients keep working.
   - Feature-flag the auto-route/ack paths if the server deploys before the mobile build.

---

## 6. Recommended Order

| Order | Work | Why |
| --- | --- | --- |
| 1 | Phase 1: verified-before-mutation | Removes the most common reconnect/auth churn and the join race. |
| 2 | Phase 2: one connection owner + offline watcher | Stops the transport from destroying itself during a blip. |
| 3 | Phase 4: matchmaking ack/recovery + listener fix | Directly fixes “one device enters, the other searches forever.” |
| 4 | Phase 3: grace continuity | Stops the 45s countdown from resetting and the opponent UI from flapping. |
| 5 | Phase 5: leave/resign durability | Fixes the “cannot get out of the match” trap, including 3P/4P. |
| 6 | Phase 6: session registry/hardening | Makes the fixes durable and prevents regressions. |

Do **not** start by shortening the 90s join quorum or adding more retries around the existing design. Those would mask the race and make slow devices worse. Fix the ownership and delivery path first.

---

## 7. Acceptance Test Matrix

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Valid token, network off 2s then on, repeated 20× | Reconnect succeeds; no auth park; no repeated grace resets; status stable. |
| 2 | Token expires while offline | One refresh; if refresh fails, clear “Session expired” + retry; no infinite rebuild. |
| 3 | JWKS/network temporarily unavailable during handshake | Retryable state, not permanent `authDead`; recovers when dependency returns. |
| 4 | Start quick search while transport is connecting | Search intent is held; sent after verification; no infinite radar. |
| 5 | Both clients match; one listener is detached at emit time | Server retry/auto-route recovers; both enter, or match is cancelled/requeued. |
| 6 | Reconnect during search | Queue entry is restored; re-announcement preserves wait; no `ALREADY_IN_GAME` spinner. |
| 7 | Same account on two devices | One device is clearly superseded; the other is not left searching. |
| 8 | Resign while offline | “Resigning…” then ack on reconnect; no silent loss. |
| 9 | Leave + close app while offline | Durable intent resolves; no permanent active seat. |
| 10 | 3P/4P player resigns/leaves, match continues | Finished player can search again; remaining players see correct placement/grace. |
| 11 | Old socket disconnects during new handshake | No false disconnect event; no grace reset; new seat joins cleanly. |
| 12 | Dead client (no heartbeat) | Server detects within the configured ping window; grace starts once. |
| 13 | 100 simulated matches with random disconnects | Zero ghost matches; zero permanently searching clients. |

---

## 8. Files Changed in This Pass

### Mobile

- `apps/mobile/src/network/socket.ts` — verified gating, flush ownership, transport phases, auth retry/backoff, liveness teardown, durable leave replay.
- `apps/mobile/src/network/useOnlineGame.ts` — verified-aware rejoin, resign acknowledgement/error surfacing.
- `apps/mobile/src/network/useMatchmaking.ts` — ref-stable listener, verified search intent, find ack/12s reconciliation, match dedupe.
- `apps/mobile/src/screens/GameScreen.tsx` — offline/unverified resign exits the dead board (no other UI changed).
- `apps/mobile/src/network/socket.spec.ts` — verified reconnect, queue replay, retryable auth, and stale-status tests.

### Server

- `apps/server/src/gateway/game.gateway.ts` — auth reasons/retryability, connection epochs, pending-handshake reservation/deferred teardown, debounced opponent disconnect, matchmaking auto-route/ack, leave/resign acks, finished-seat cleanup, ping settings.
- `apps/server/src/gateway/game.gateway.spec.ts` — pending-handshake success/failure/TTL, matchmaking auto-route, debounce, stale disconnect, and recovery tests.
- `apps/server/src/game/authoritative-game.service.ts` — grace-deadline continuity.
- `apps/server/src/game/disconnect-grace.spec.ts` — updated to lock deadline continuity.
- `apps/server/src/matchmaking/matchmaking.service.ts` — queue identity/`joinedAt` preservation.
- `apps/server/src/auth/auth.service.ts` — auth failure reason/retryability classification.

### Protocol

- `packages/protocol/src/index.ts` — `session:authState` reason/epoch/activeGameId, matchmaking ack/events, leave/resign acks.

---

## 9. Guardrails

- **Do not rewrite the game engine.** The rules, action idempotency, clock, AFK, and placement logic are not the problem.
- **Do not auto-forfeit on ambiguous network state.** Use the server’s grace window; the client should not guess that a dropped packet means the player left.
- **Do not reuse the other analysis’s 6s abort verbatim.** It will hurt cold starts and slow devices. Use acknowledgement/retry and a longer, configurable no-join window.
- **Do not replay `game:leave` blindly.** Make it game-scoped and server-validated; a stale leave must never forfeit a new match.
- **Preserve the current HUD/review/GameOverModal/safe-area work.** This plan touches online state and lifecycle only.
- **Keep the single-session policy.** Two devices on the same account should produce a clear “signed in elsewhere” state, not two queue entries.

---

## 10. Open Decisions

1. **Resume behavior:** auto-enter an active game on verified connect, or show a “Resume match” card? Auto-enter is smoother for a reconnect; a card is safer after an intentional exit. Recommended: auto-enter only when the disconnect was unintentional (no leave intent), otherwise show the card.
2. **Grace policy:** one 45s budget per absence, or a fresh 45s after a stable reconnect? Recommended: preserve the original deadline during a flapping burst; start a new budget only after a stable connection window.
3. **Ping values:** 20s/20s is a starting point. Tune against real mobile networks; too aggressive causes false disconnects, too lax leaves opponents waiting.
4. **Match cancellation:** cancel only when zero seats have joined. If one seat has joined, keep the existing no-show grace but surface a clear waiting state and a cancel option.
5. **Outbox persistence:** should a leave/resign intent survive an app kill? Recommended: yes for intentional leave/resign, scoped to `gameId`; no for transient moves.
6. **Backward compatibility:** old clients will not send `searchId`/acks. Keep the old event shape working for one release, with the server treating no-ack as legacy.

---

## 11. Verification and Residual Risks

**Verified in this pass**

- Mobile and server `tsc --noEmit` pass; protocol build passes.
- Server suite: 237/237 tests pass, including the pending-handshake success,
  auth-failure, and TTL-expiry paths.
- Mobile suite: 202/203 tests pass. The one failure is the pre-existing
  `src/storage/matchSetup.spec.ts` expectation about dropping `side`; it is
  outside the reconnect/matchmaking change set and was not modified.
- Changed network/mobile files have no new ESLint findings. Repo-wide
  `expo lint` still reports pre-existing React purity/ref and unused-symbol
  errors in other UI files (including `GameScreen.tsx` and
  `useOnlineGame.ts` lines not touched here).

**Known residuals**

- The pending-handshake reservation TTL is 3s. A verifier slower than that
  still finalizes the old disconnect and can produce one visible grace notice
  after the normal 1.5s debounce; the verified rejoin then cancels it. The
  reservation is deliberately bounded and cannot be extended by a repeated
  claim, so a forged handshake cannot suppress a real disconnect indefinitely.
- The leave/resign outbox is in-memory and bounded to the socket lifetime,
  not durable across an app kill. The existing 45s grace remains the backstop.
- The resign modal still does not show a dedicated “Resigning…” state. It
  does surface server failure through `actionError`, and offline resign now
  exits the board instead of trapping the player.
- No server-side `searchId`; reconciliation is idempotent by user/config and
  preserves queue position. This closes the lost-event case without changing
  the wire payload shape.
- Metrics, feature flags, and the 100-match simulated race suite remain.

---

## 12. Bottom Line

The other agents found the right broad failure modes, but the system needs a stricter separation between:

1. **transport connected**,  
2. **server authenticated**,  
3. **matchmaking queued/matched**, and  
4. **seated in a game**.

Most of the reported chaos comes from mixing those states. The highest-value fixes are:

1. Verify before mutating, and stop flushing gameplay events on raw `connect`.
2. Stop rebuilding the transport on transient network reports; give connection ownership to one place.
3. Fix the matchmaking listener churn and the “search before verified” path.
4. Add match acknowledgement/retry plus active-game auto-routing.
5. Make leave/resign durable and clear finished seats.

Implementing those five in that order should remove the reconnect loop, the blinking indicator, the stuck searching screen, and the “one device in, one device out” split without changing the game engine or the finished UI work.
