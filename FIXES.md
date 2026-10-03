# DuoOrb pre-launch FIX guide

Source: full audit of matchmaking, match lifecycle, disconnect/reconnect,
timing/clocks, socket layer, indicators (server + client + protocol).
Problems that share one code change are grouped under a single FIX.
Work top to bottom: F1–F6 are launch-blockers, F7–F12 fairness/honesty,
F13+ hardening.

Severity: **C**ritical (launch-blocker) / **M**ajor / m(inor).
**[RARE]** = unusual trigger (needs a narrow timing window, an uncommon user
flow, or an environment failure). Still worth fixing, but safe to schedule
after the non-rare items in the same fix.
Status box: `- [ ]` open, `- [x]` done. Check them off as you land fixes.

---

## F1 — Unify terminal game-ending path (server, 1 helper)

**File:** `apps/server/src/gateway/game.gateway.ts`

Today every terminal path hand-rolls persist → emit → cleanup, and they
drifted. The resign path emits `game:ended` (`handleResign`, :1330) but never
calls `setGamePlaying(gameId, false)` — verified in source. Consequences of
the missing call: `activeGameUserMap` keeps pointing at a dead game, presence
stays "playing", `gameRoomMap` leaks, the room stays `IN_GAME` forever and
`startRoom` rejects `"already started"` for that room from then on.

**Problems closed by this fix:**
- C4 — resign-terminal leaks mapping + room (`game.gateway.ts:1302-1334`).
- M18 — mid-table forfeit drops the board move. The non-terminal branch of
  `emitMidGameForfeit` (:1529-1531) emits `playerFinished` without the
  preceding `actionAccepted(TIMEOUT)` the terminal branch sends (:1534-1543),
  so opponents' boards miss the forfeit move until a resync.
- m3-timing — AFK terminal misreported via `onTimeout`/`emitTimeoutEnded`;
  disappears once all endings flow through one named path.

**Fix (best):** add one private helper and route ALL terminal endings
(action/timeout/resign/leave/forfeit) through it:

```ts
private async endGame(gameId: string, ended: GameEndedDto, move?: RecordedAction) {
  try { await this.gameService.persistCompleted(gameId); }
  catch (err: any) { this.logger.warn(`Completion persist failed ${gameId}: ${err?.message}`); }
  if (move) this.server.to(gameId).emit('game:actionAccepted', move);
  this.server.to(gameId).emit('game:ended', ended);
  this.setGamePlaying(gameId, false);
}
```

And in `emitMidGameForfeit`'s non-terminal branch, emit `actionAccepted`
before `playerFinished` (same ordering as the terminal branch). Then delete
the five hand-rolled copies. Verify: resign a 1v1 → room returns to lobby,
`activeGameUserMap` cleared, presence `playing=false`.

- [x] `endGame()` helper added; all terminal paths routed through it
- [x] mid-table branch emits `actionAccepted` before `playerFinished`
- [x] verified: resign → room lobby, mappings cleared
- [x] regression tests: `game.gateway.spec.ts` → terminal resign frees
  seats + room; mid-table ordering (`12 tests` green, suite `179/179`)

---

## F2 — Harden game-creation paths (server, guards + hooks)

**Files:** `apps/server/src/gateway/game.gateway.ts`,
`apps/server/src/challenge/challenge.service.ts`

Four different call sites create games (ranked sweep :1029, challenge accept
:918, room start :670, rematch :1404) with different hook wiring and
different (or no) liveness checks.

**Problems closed by this fix:**
- C2 — challenge accept makes ghost games. No sender-online check, no
  either-side in-game check (`:880-933`); absent player's `?.join/?.emit`
  silently skip, clock runs, no grace arms (grace only arms on disconnect
  events, which already happened).
- C7 — rematch `createGame` (`:1396-1402`) omits `onAfkWarning` + `onForfeit`.
  A mid-table AFK in a rematch advances state with zero broadcast — silent
  table desync. Recovery path (`reconstructGame`/`recover`) also never sets
  `onForfeit`.
- C3 — queue never left on room/challenge/rematch entry. A queued player who
  accepts a challenge gets two concurrent games; the second overwrites
  `activeGameUserMap` and orphans the first as `IN_PROGRESS` forever.
- C8 — guest→account migration during grace grants infinite grace.
  **[RARE: requires signing in inside the 45s grace window.]**
  `migrateUser` moves `disconnectedUsers[old]→[new]`
  (`authoritative-game.service.ts:840-851`) but deletes the generation token
  without re-arming, so the pending forfeit timer can never fire (forfeit
  dodge via sign-in).
- M8-timing — `migrateUser` also orphans `disconnectGraceEndsAt` (keyed by
  old id), `latencyMs`, and the generation token: post-sign-in
  `cancelDisconnectGrace(newId)` misses and grace broadcasts go stale.
  **[RARE: same trigger as C8 — sign-in inside the grace window.]**
- M10 — adopt leaves stale `userSocketMap[prevId]` + presence
  (`game.gateway.ts:266-286`); M11 — reconnect sign-in orphans seats (queue
  migrated, game seats not); M17 — challenge seat names mixed vintage
  (sender frozen at send, recipient live at accept).
  **[RARE: M11 needs a reconnect-sign-in with a live seat; M17 needs a
  rename between challenge send and accept.]**

**Fix (best):** one `createGameChecked()` wrapper used by all four call
sites that (a) asserts all four hooks (`onClockTick/onTimeout/onAfkWarning/
onForfeit`) are provided, (b) re-checks every seat: socket live in
`userSocketMap`, not already in `IN_PROGRESS` game, (c) calls
`removeFromQueue` for every seat, (d) re-reads both display names live at
creation. On any check failing: abort like a decline + notify both sides.
For migration: unified `migrateIdentity()` (adopt + `previousUserId`
reconnect, with live-seat-steal refusal) + service `migrateUser` re-arms
grace under the new id with the remaining window (C8).

- [x] `createGameChecked()` wrapper; all 4 call sites use it
- [x] rematch + recovery wire all 4 hooks
- [x] unified `migrateIdentity()` (adopt + reconnect); grace/generation migrated + re-armed
- [x] `isUserInLiveGame` seat lookup via `userPlayerIds` (M1); self included in busy checks (M16)
- [x] sweep emits `matchmaking:matched` to live sockets; live losers re-queued on failure (C1)
- [x] verified: suite `185/185` (grace migration, offline-seat refusal,
  challenge ghost refusal, M1 seats, migration + steal-refusal)
- [ ] client follow-up (small): send `previousUserId` in the handshake query
  on reconnect-sign-in so the server can migrate the orphaned guest seat

---

## F3 — Matchmaking liveness + fairness (server)

**Files:** `apps/server/src/gateway/game.gateway.ts` (`:970-1027`),
`apps/server/src/matchmaking/matchmaking.service.ts`

**Problems closed by this fix:**
- C1 — sweep drops live players. `findMatches` dequeues the whole table,
  then the dead-socket branch only re-removes the dead ones and `continue`s —
  live mates are never re-queued, never notified (`game.gateway.ts:977-984`).
- C6 — async gap (block-check + rating reads) between dequeue and `createGame`
  lets cancel/disconnect slip through; game born with a dead seat.
- M7 — window is anchor-only, grouping first-N not closest-rating.
- M8 — matching uses stale connect-time rating (`game.gateway.ts:759`).
- M9 — blocked-pair requeue pushes a stale socket/name snapshot, feeding C1.
  **[RARE: needs a block-check fail followed by a socket/name change before
  the next sweep.]**

**Fix (best):** (1) validate socket liveness *before* `findMatches` removes
entries (sweep a liveness pass over the queue each tick); (2) re-validate
membership + liveness immediately before `createGame`, restoring survivors
(with original `joinedAt`) on failure + emit `matchmaking:failed` so nobody
spins silently; (3) refresh rating + socketId + name at find time
(cheap, do now — stale data feeds the liveness bug M9).

> **LAUNCH POLICY — fairness deferred.** With a small launch player base,
> matches must start FAST, not fair. The pairing-quality tightening below
> stays as-is until ~1 month post-launch when player count justifies it:
> keep the wide fast-expanding window (`±(50 + 20 × waitSec)`, anchor-only,
> first-N grouping). Do NOT narrow windows or prefer closest-rating now —
> that trades empty lobbies for fairness nobody can feel yet. Revisit when
> queue depth regularly exceeds one full table per config.
> Deferred items: M7 (min-window + closest-rating sort), 3P/4P partial-fill
> vs timeout policy, max-wait cap.

- [x] liveness purge before dequeue (dead entries never seat a ghost table);
  re-validate before create via `createGameChecked` (F2); failures requeue
  live survivors with fresh routing + preserved wait, server-logged (no
  failure toast on transient churn — survivors keep searching)
- [x] live rating/socket refresh at find time (`requeuePlayer`: socketId +
  name + rating re-read from live maps; offline players not requeued)
- [ ] (POST-LAUNCH) closest-rating pairing + window tuning + 3P/4P fill/timeout policy
- [x] verified: suite `188/188` (purge, joinedAt-preserving requeue, sweep
  seats live pair on live sockets, ghost purged)

---

## F4 — Clock hardening: deadline, expiry timer, grace debit, start gate (server)

**File:** `apps/server/src/game/authoritative-game.service.ts`

The ledger model (`clocksMs` + `turnStartTimestamp`, derived remaining) is
sound; all four bugs are at its edges.

**Problems closed by this fix:**
- C1-timing — no on-move flag check. Any move arriving after the deadline but
  before the next 1s tick is accepted, possibly with increment, resetting the
  turn. Lost-on-time positions are winnable inside the tick gap.
- C2-timing — flag detection is tick-only (`startClockLoop`, :196-242). A
  blocked event loop lets a flagged player keep playing.
- C5-timing — grace time is free. Expiry resets `turnStartTimestamp` without
  debiting the 45s the clock visibly ran: off-turn disconnect gifts the
  thinker up to 45s uncharged; on-turn leaver's clock freezes at disconnect.
- M1-timing — clock starts at creation, before both seats joined (`:335` +
  AFK armed `:364`). The opener pays pairing/join latency; P2-connected-but-
  never-joined lets P1 AFK-forfeit while the absent seat is never punished.
- M4-timing — untimed games (`timeControlMinutes<=0`) seed phantom 3:00
  (`:161`), skip the tick loop, but `armAfkTimer` still kills in 45s and
  snapshots count down.
- m1-timing — `Date.now()` non-monotonic; NTP back-step grants a free turn
  via `Math.max(0,…)` (:1000). **[RARE: needs a clock step mid-turn.]**
  m5-timing — `clockStarted` is vestigial (always
  true); m2-timing — stale resign-billing comment contradicts code.

**Fix (best):**
1. Deadline check at the top of `processAction`: if
   `clocksMs[holder] − elapsed ≤ 0`, convert to `TIMEOUT` loss instead of
   accepting.
2. Per-turn one-shot `setTimeout(remaining)` for expiry; keep the 1Hz loop
   for broadcast only.
3. At grace expiry, debit `clocksMs[holder] −= (expiry − turnStart − refund)`
   before resetting `turnStartTimestamp`.
4. Start clock + AFK on all-seats-joined quorum (first `game:join` from every
   seat), not at creation; exempt or delay the opening turn otherwise.
5. Untimed mode: bypass clock math in `clockSnapshot`/sync, and make
   AFK-for-untimed an explicit policy (on/off), not an accident.
6. Monotonic elapsed (`performance.now()`-based) or clamp + log; delete or
   repurpose `clockStarted` (e.g. = all-joined); rewrite the resign-billing
   comment to match code (holder charged, off-turn resign = 0).

- [ ] on-move deadline check; one-shot expiry timer; grace debit; join-quorum start
- [ ] untimed policy implemented
- [ ] verified by tests: late move → TIMEOUT; disconnect gifts no time; opener not billed pre-join

---

## F5 — AFK + latency-refund fairness (server)

**File:** `apps/server/src/game/authoritative-game.service.ts`,
`apps/server/src/gateway/game.gateway.ts` (`game:ping`, :1574-1588)

**Problems closed by this fix:**
- C4-timing — three maths: tick flag + snapshots use raw elapsed, charge uses
  elapsed-minus-refund (up to 1200ms). The tick can kill a player whose refund
  would have saved them. Worse, `game:ping` records `now − clientSentAt` with
  no turn/state/rate gate, so any seat can bank the 1200ms cap with backdated
  stamps, farmed off-turn, persisting via EWMA(0.3).
- M2-timing — AFK fully suspended while anyone is away (`:1327`) and re-arms
  a fresh 45s on every return; connected holder thinking through a grace is
  unwatched; flapping extends idling indefinitely.
- M6-timing — timer cleanup partial on terminal paths (AFK/grace closures
  leak up to 45s; 15-min `games.delete` never `unref`d). M15 — same for the
  2s sweep interval.
- m4-timing — `game:ping` unthrottled, any seat, any time, even `COMPLETED`.

**Fix (best):** (1) single `refundedRemainingMs()` helper used identically by
tick flag, `clockSnapshot`, and charge (done — display, flag, and ledger
can no longer disagree by the refund); (2) gate `game:ping` to
`IN_PROGRESS` + mover-or-holder + ~1/sec throttle (done in the gateway;
ack stays ungated so probes remain useful for clock sync); nonce-based
two-way RTT deferred — the 1200ms cap now bounds the residual self-report
bias; (3) per-seat AFK carry across grace (done: `afkCarryMs` banks the
running watch on disconnect, returnees resume the remainder; new turns and
forfeit-continues reset to full); (4) `finalizeGame` retires grace timers +
records (done) and unrefs all housekeeping timers incl. 15-min TTL; gateway
sweep unref'd + `onModuleDestroy` (done).

- [x] unified refunded-deadline math; gated honest pings
- [x] AFK during grace policy; `teardownGame()` on all terminal paths
- [x] verified: refund-window move accepted + snapshot agrees (`clock-fairness.spec`);
  ping holder-only + throttled (gateway spec); AFK carry resumes remainder;
  terminal clears grace; suite `198/198`

---

## F6 — Client reconnect core: foreground, auth, backoff, one pump

**Files:** `apps/mobile/src/network/socket.ts`,
`apps/mobile/src/network/useOnlineGame.ts` (`:521-590`),
`apps/mobile/src/screens/GameScreen.tsx` (`:1461-1472`)

The transport design (WS→polling fallback, 6s offline debounce, 20-intent
queue, join pumps) is sound; the bugs are missing lifecycle edges.

**Problems closed by this fix:**
- R2 (C) — zero `AppState` usage in `apps/mobile/src`. After OS freeze,
  recovery depends on heartbeat timeout or NetInfo flap; short background
  with half-open TCP leaves a stale "live" board while server grace/AFK bill.
- R1 (C, verified) — `authDead=true` (401) cleared only on full rebuild
  (`socket.ts:287`); same-account rotation (`:269-281`, i.e. every guest
  refresh) keeps the socket dead until app restart despite a fresh credential.
- R5 (M) — `reconnect_failed` isn't terminal: the 2.5s join tick re-calls
  `raw.connect()` forever on a dead server (battery + load); the 8-attempt
  cap stops only the UI.
- R6/R8 (M) — three join pumps (retry tick + reconnect effect + GameScreen 5s
  seat-miss interval) with the attempt counter reset on every reconnect, so
  the error backstop never fires under flap; `NOT_SEATED` joins emit forever.
- M1-client — display-name change rejoins the match (effect dep on
  `displayName`, `useOnlineGame.ts:979`). **[RARE: needs a profile rename
  mid-match.]** M2-client — `joinOutstanding` set
  even on cooldown early-return (`:529`), inflating terminal errors.
  **[RARE: needs an error inside the 2s cooldown window.]**
- M4-client — join pumps fire for `COMPLETED` boards until the limit.
  **[RARE: needs sync/error to never land on a finished board.]**
- M7-client — captive portals treated online (`isInternetReachable` ignored).
  **[RARE: needs a captive-portal network (hotel/airport WiFi).]**

**Fix (best):**
1. `AppState → active` foreground pass in the hook (done): `probeLatency()`,
   `syncWithIdentity()`, `getSocket()`, `joinGame(false)` — rejoin-path, no
   attempt reset. Collapses the half-open-TCP blind window to one cooldown.
2. `authDead` cleared on every token replacement (done: rotation path +
   rebuild + connect), not only rebuild.
3. Post-`reconnect_failed` 45s transport cooldown in `ensureConnected`
   (done): the join tick can no longer restart burst loops on a dead server.
   Re-armed by NetInfo-online, `retryNow()`, credential rebuild, new scoped
   game, or a connect — never by the tick.
4. Single hook-owned join pump (done): seat-miss interval moved out of
   GameScreen into the hook (same cooldown + budget); retry tick +
   reconnect effect take `resetAttempts=false`; pumps stop when
   `gameEndedResult`/COMPLETED; `NOT_SEATED` can no longer interval-join
   forever from three places.
5. `joinOutstanding` set only on attempted emits (done); subscription effect
   deps narrowed to `userId` (done — renames no longer rejoin);
   `isInternetReachable === false` treated offline, `null` trusted (done).

- [x] AppState foreground rejoin; `authDead` cleared on rotation; post-give-up backoff
- [x] single join pump with attempt accounting; pumps stop on end
- [x] verified: `tsc` clean, suite `69/69` (R1 rotation-retry + R5
  cooldown/`retryNow` regression tests); lint adds zero new violations
  (3 remaining hits are pre-existing lines, attributed by blame)

---

## F7 — Queue + pending + clock-anchor integrity (client)

**Files:** `apps/mobile/src/network/socket.ts` (`:103-141, :206-242`),
`apps/mobile/src/network/useOnlineGame.ts` (`:331-399, :993-1084`),
`apps/mobile/src/screens/GameScreen.tsx` (`:381-391`)

**Problems closed by this fix:**
- R3 (M) — queue cap (20) / TTL (30s) drops are silent while the optimistic
  tail keeps rendering the dropped move.
  **[RARE: needs 20+ queued intents or 30s+ offline with pending moves.]**
- R4 (M) — every in-flight move submits twice after reconnect (queue flush +
  `game:join.pendingActions`); safety fully outsourced to server dedupe.
- R11 — local increment credited on send (`GameScreen.tsx:381-391`) with no
  rollback on rejection; phantom time until next server tick.
- R10 — skew moves grace/AFK instantly but not the frozen game-clock anchor;
  `initialSync` seed and `OnlineJoinGate`'s fabricated `serverTimestamp`
  ignore skew/one-way entirely. M3-client — RTT sample never expires.
- M5-client — gate + screen double-mount overlap can flap sync last-writer-
  wins for a frame.

**Fix (best):**
1. Drop rollback + toast (done): socket reports cap/TTL losses with gameId
   + clientActionId (`subscribeDrops`; deliberate routing drops stay silent);
   the hook rolls matching pending entries back and raises `dropNotice`,
   toasted WITHOUT the illegal-move sound.
2. Join-owns-tail dedupe (done): flush skips a keyed `game:action` when a
   `game:join` for the same game is in the batch. Keyless/legacy emits flush
   exactly as before.
3. Increment-on-accept: VERIFIED NOT-A-BUG — online sends never credit
   locally (only AI/local do, where application is authoritative); online
   clocks come purely from server truth. No change.
4. Anchor discipline (done): mount seed routes through `anchorClock()`; RTT
   samples expire after 30s (stale → zero-correct + fresh probe).
   Corrections to the audit: NO skew rebase on jumps (the anchor is a LOCAL
   receive instant — rebasing would introduce error); the AFK mount seed
   needs no skew either (always 0 on first render; ticker self-corrects).
5. Handoff overlap (M5): VERIFIED BENIGN — navigator swaps gate/screen in
   one commit, the gate's retry self-stops on sync, handlers are idempotent.
   Documented, no change.

- [x] drop-rollback/toast; join-owns-tail dedupe; anchor discipline
- [x] verified: suite `75/75` (tail-skip, keyless passthrough, cap + TTL
  drop reports); `tsc` clean; lint adds zero new violations

---

## F8 — Render the reason + the deadlines (client UI)

**Files:** `apps/mobile/src/screens/GameScreen.tsx`,
`apps/mobile/src/components/GameHud.tsx`,
`apps/mobile/src/network/useOnlineGame.ts`, `apps/mobile/src/components/GameOverModal.tsx`

The 4-kind `SeatStatus` model (`GameHud.tsx:33-37`) is fine; what is
missing is information the server already sends.

**Problems closed by this fix:**
- I2 (C) — `gameEndedResult.reason` never read (zero mobile references):
  timeout wins, disconnect walkovers, AFK forfeits all render identical
  `YOU WIN`/`DEFEAT`.
- I3 (C) — own grace deadline hidden from the person racing it (opponent
  sees `Disconnected · 37s`; own card shows indeterminate `Reconnecting…`;
  client drops the deadline via the own-seat filter).
- I1 (C) — pre-seat join failure renders nothing over a fabricated local
  board; `joinError` strings have no card to appear on.
- I4 (C, verified) — `warned30Ref` set once, never reset; rematches (same
  mount) never warn. No visual low-time state anywhere.
- I5 (M) — 0s expiry flicker: pill deletes itself before the forfeit lands
  (rating/walls pop back = false recovery, then sudden end).
- I6 (M) — AFK/disconnect arming is soundless with no consequence copy, to
  players who by definition aren't looking.
- I8 (M) — rejections sound-only (`actionError` → `playIllegalMoveSound`);
  with sound off, nothing at all. (Keep "no card for rejections", but the
  toast bus already exists.)
- I9 (M) — rating row vanishes instead of `Calculating…`/`Unrated`.
- I10 (M) — rematch offer invisible after 4s (server offer lives 30s);
  Decline is local-only, offeror waits full 30s.
- I11 (M) — seat-miss infinite silent 5s resync, possible wrong-seat
  perspective via `humanIdx` fallback.
  **[RARE: needs a genuinely unseated client (wrong account, orphaned seat).]**
- I12 (M) — rematch-sync limbo on a stale finished board, no `Joining…`.
  **[RARE: needs the new-game sync to stall.]**
- I7/I13/I14/I16/I19/I20 (m) — `N pending` jargon + undimmed frozen board;
  `No move`/`Disconnected` copy states no consequence; no <30s/<10s timer
  urgency; offline labeled `Reconnecting…`; turn dot + away pill unexplained.

**Fix (best):**
1. Reason line in `GameOverModal` from `reason` (done) + ranked label:
   actor-aware copy from the last history move ("You ran out of time" /
   "Opponent disconnected" / "Forfeited for inactivity" / "You resigned" /
   "Decided on the board"), `Ranked · …` / `Unrated · …` meta, draws show
   no reason.
2. Own-grace countdown on the own card (done): server `GameSyncDto.grace`
   carries ALL away seats (new protocol field, emitted by `getSyncState`);
   sync reconciles the whole map including your own seat; own pills name the
   consequence ("You forfeit in Ns" / "Move or forfeit · Ns"); entries hold
   the last "0s" frame until ended/sync/reconnect clears them (no
   recovery-then-robbery flicker).
3. Blocking overlays (done): joinError-with-no-board, "Finding your seat…"
   (seat-less live board), "Joining match…" (rematch-sync limbo) — full
   input-eating surfaces instead of phantom boards.
4. Warning reset on `onlineGameId` change (done); timer-chip urgency ≤30/≤10
   on all three layouts, audio-independent (done); notify chime on each
   fresh grace/AFK arm (done).
5. `actionError.message` rides the toast bus as well as the click (done);
   rating row is three-state: delta / "Calculating…" (ranked, result in
   flight) / "Unrated" (done).
6. Persistent rematch chip until accept/decline/expiry (done; sent side
   expires on the 30s server TTL); explicit `game:rematchDecline` → server
   notifies the waiter via `game:rematchDeclined` (done, protocol + service
   + gateway + hook nonce); offline reads "You're offline · retrying" via
   OS link verdict (done); board dims only while locked AND transport-down,
   never a per-move flicker (done).

- [x] reason line; own-grace countdown; join/seat/joining overlays; warning reset + urgency
- [x] arm sounds + consequence copy; rejection toasts; rating 3-state; rematch chip + decline emit
- [x] verified: `tsc` clean both sides (protocol rebuilt), suites
  `199/199` server + `71/71` mobile (label copy, ping gate, decline
  broadcast); lint adds zero new violations (remaining hits attributed by
  blame to September commits)

---

## F9 — Auth-error routing + guest copy (client)

**Files:** `apps/mobile/src/network/socket.ts` (`:333-352`),
`apps/mobile/src/network/useOnlineGame.ts` (`:651-684`),
`apps/mobile/src/screens/GameScreen.tsx` (`:1474-1482`)

- R7 (M) — `UNAUTHENTICATED` on a settled board becomes a transient
  `actionError` = illegal-move click; no toast (the `sessionExpired` toast
  fires only on `connect_error`), no re-auth, clock runs out on a "broken"
  board.
- `COPY.sessionExpired = 'Session expired, sign in again.'`
  (`errors.ts:117`) is wrong for guests (no sign-in); M8-client —
  `adoptSession` result ignored (`session.tsx:288`).

**Fix (best):** route `UNAUTHENTICATED`/`NOT_SEATED` game-errors to auth
recovery (silent refresh-once → rejoin) with a persistent banner, never to
`actionError`; guest-aware copy ("Session expired. Restart the app to play
again." vs Google "Sign in again."); await `adoptSession` with
`syncWithIdentity()` fallback on `false`. (Done: `refreshSessionOnce()`
export sharing the HTTP 401 in-flight rotation; hook branch keeps the tail
for the rejoin and only clears + terminal-errors when recovery fails;
socket toast + hook copy guest-aware; adopt fallback wired.)

- [x] auth errors → recovery + banner; guest-aware copy; adopt fallback

---

## F10 — Rooms/invites/challenge hygiene (server)

**Files:** `apps/server/src/rooms/room.service.ts`,
`apps/server/src/challenge/challenge.service.ts`,
`apps/server/src/gateway/game.gateway.ts`

- C5 — disconnect never leaves rooms/purges invites; abandoned `WAITING`
  rooms + host crowns persist (only cleanup path is explicit `leaveRoom`).
- M4 — challenge logical TTL 30s but callback at 30.5s (accept-window
  ambiguity + toast lag). **[RARE: needs an accept inside the 500ms skew
  window.]** M14 — lobby ratings fall back `1500` for offline/stale members.
  **[RARE: needs DB outage or fully offline lobby.]** M16 — room-start busy check excludes self, host
  double-books own game. M1 — `isUserInLiveGame` always true (see F2 guard —
  fix the lookup via `userPlayerIds` regardless).
- m: `room:ready` silent-return on unverified; `isBlockedBetween` fail-open on
  DB outage **[RARE: needs a DB outage during a challenge]**;
  `reactionLastAt` wholesale-clear at 5000 entries **[RARE: needs a
  reaction flood]**; invites store blank `fromDisplayName`;
  `restoreCreatorHost` crown-steal without notice **[RARE: needs the room
  creator to rejoin].**

**Fix (best):** auto-`leaveRoom` on disconnect — WAITING lobbies only
(IN_GAME seats keep their room; grace covers them), host hands over,
disband cascades to invites (done in `leaveAllWaitingRooms` + gateway
broadcast); invite TTL 5min with per-invite timer + `expiresAt` enforced on
respond (done); fire challenge expiry at exactly `TTL` (done); lobby
ratings from a connect-time cache with explicit offline marking via the
existing socket presence (done — cache, then 1500 only for never-seen);
include self in the busy check (done in F2 `createGameChecked`); fail-closed
challenges on DB outage, matchmaking stays fail-open by design (done);
per-user reaction throttle with oldest-eviction cap (done).

- [x] disconnect room leave / sweeper + invite TTL + cascade
- [x] exact challenge TTL; honest lobby ratings; self busy-check; fail-closed challenges
- [x] verified: suite `209/209` (invite expiry + cascade, waiting-leave vs
  live-untouched, crown handover, fail-closed send, ready auth)

---

## F11 — Multi-socket + join-pump server edges

**File:** `apps/server/src/gateway/game.gateway.ts`

- M2 — single `userId→socketId`: second tab overwrites; first tab misses
  matched/challenge/rematch/room-state while both can submit actions.
  **[RARE on phones: needs two tabs/devices on the same account at once.]**
- M5 — join pump emits to possibly-dead sockets; two tabs collapse to
  latest, loser never gets `sync`; `opponentReconnected` fires even if the
  joiner is gone. **[RARE: needs two concurrent joins for the same seat.]**
- M6 — pending tail silently truncated at 20, no error.
  **[RARE: needs 20+ unconfirmed actions.]**
- M12 — completed-game join inconsistent (`sync` with terminal state vs
  `GAME_NOT_IN_PROGRESS` error by branch). **[RARE: needs a join to an
  already-finished game.]** M13 — `activeGameUserMap` set
  before pump completes. **[RARE: needs the game to complete mid-replay.]**
  M19 — low-clock disconnect misattributes reason
  (1s tick finalizes `TIMEOUT` before 45s grace → `DISCONNECT` never
  recorded). **[RARE: needs a disconnect with nearly no clock left.]**

**Fix (best):** single controlling session (latest wins) + explicit
`session:superseded` stand-down for the loser tab (done — protocol event,
server emit on superseding connect, client toast + disconnect; full
socket-Set fan-out judged disproportionate: turn gate + idempotency keys
already make double-submit safe); validate `client.connected` at pump
start/end (done); paginate tails to 100 with a warn log instead of silent
truncate-at-20 (done); completed-game join keeps sync-with-terminal-state on
both branches — verified identical, no code change (M12 not-an-issue);
live-games-only mapping at join (done, M13); absence owns flagging — tick
and one-shot timers skip while anyone is away, flag re-arms on grace return
(done, M19 — low-clock disconnects now record DISCONNECT); monotonic
generation tokens (done, M3 — existing test updated to the new counting).

- [x] socket-set fan-out → supersede-notify (documented trade); pump validation; tail policy; completed-join contract; mapping timing
- [x] verified: suite `209/209` (25-tail paginated, M19 reason precedence);
  mobile `76/76` (superseded stand-down)

---

## F12 — Toast/modals/results coherence (client, small)

**Files:** `apps/mobile/src/components/AppToast.tsx`,
`apps/mobile/src/screens/GameScreen.tsx`, `GameOverModal.tsx`

- I15 (m) — toast queue depth one; only `newAchievements[0]` shown, extras
  dropped; `sessionExpired` can clobber an achievement toast.
  **[RARE: needs two achievements (or achievement + session toast) at once.]**
- I10-rated — mid-game finish modal is the only rating-timing explainer and
  appears only for finished watchers.
- M6-client — `warned30Ref` covered in F8; same-effect siblings
  (`CLOCK_ENABLED` test path, premove tint vs queued intent) folded into
  F7/F8 board-lock dimming.

**Fix (best):** minimal FIFO toast queue (depth 4, overflow drops oldest
queued never on-screen; action-tap advances immediately) (done); rating-timing
line reused under the GameOverModal calculating state (done).

- [x] toast FIFO; rating-timing line in GameOverModal
- [x] verified: `76/76` mobile; `tsc` clean; lint adds zero new violations

---

## Order of work (checklist)

- [x] F1 terminal-path unification
- [x] F2 creation guards + migration unity (server; client `previousUserId` follow-up open)
- [x] F3 matchmaking liveness (launch scope; fairness tuning post-launch)
- [x] F4 clock hardening (+ tests: late move, grace debit, pre-join billing)
- [x] F6 reconnect core (AppState, authDead, backoff, one pump)
- [x] F5 refund/AFK fairness + teardown
- [x] F8 reasons + deadlines UI
- [x] F7 queue/pending/anchor integrity (R11 not-a-bug, handoff benign — see section)
- [x] F9 auth routing; F10 room hygiene; F11 socket edges; F12 toasts
- [ ] Product calls: 3P/4P fill-or-timeout (POST-LAUNCH with fairness pass),
      max queue wait, untimed AFK policy,
      timeout-vs-disconnect precedence, rematch offer duration
