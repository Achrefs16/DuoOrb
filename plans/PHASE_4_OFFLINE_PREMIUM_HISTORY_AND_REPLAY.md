# Phase 4 Implementation Plan: Offline Premium Fix, Unified AI/Online History & Replay/Review Orientation Fix

## 1. Phase Goal & Scope
Resolve the core functional and data-integrity bugs reported by Google Play Closed Test testers:
1. **Offline Premium Bug (3 Root Causes):** Ensure Premium subscribers remain signed in, keep their active Premium entitlement offline, and can run Game Review offline without getting stuck on `<NoConnectionSection />` or an infinite loading spinner.
2. **Unified AI + Online Match History:** Merge local AI matches (`@duoorb:history:v1`) with server-side online matches in `HistoryScreen.tsx` so AI games never disappear after playing an online match.
3. **Replay & Review Perspective (`(You)` Label & Board Flip) Bug:** Fix the orientation and player seating logic when opening Replay or Analysis from `HistoryScreen.tsx` or `PlayerProfileScreen.tsx` so:
   - If the viewer played as Red (`playerIndex === 1`, top start), the board flips so Red is at the bottom with `(You)` on Red's strip.
   - If the viewer is spectating a match between two other players from `PlayerProfileScreen.tsx` or `LeaderboardScreen.tsx`, **neither** player strip shows `(You)`.
4. **Match End Modal $\rightarrow$ Replay Missing Action Buttons:** Add **"Review Match"**, **"New Game"**, and **"Summary"** action buttons to the bottom replay bar (`styles.replayBar`) in `GameScreen.tsx`.

---

## 2. Files to Modify

| File Path | Action | Responsibility |
| :--- | :--- | :--- |
| `apps/mobile/src/network/session.tsx` | **Modify** | Preserve cached `username` / `displayName` on offline boot for Google-authenticated users and set `status = 'ready'` instead of locking on `<NoConnectionSection />`. |
| `apps/mobile/src/monetization/offers.ts` | **Modify** | Immediately call `ingestMe({ isPremium: true, premiumUntil })` on device as soon as RevenueCat entitlement is active, before waiting on server webhook polling. |
| `apps/mobile/src/monetization/premium.ts` | **Modify** | Trust `raw.premiumUntil > now` for up to 35 days when offline so monthly subscribers aren't downgraded after 7 days offline. |
| `apps/mobile/src/storage/gameStorage.ts` | **Modify** | Extend `SavedGameRecord` with `botId`, `botName`, `botRating`, `timeControlMinutes`, `incrementSeconds`, `endedReason`, `perspectivePlayerId`, and `isViewerSeated`. |
| `apps/mobile/src/screens/GameScreen.tsx` | **Modify** | Populate new `SavedGameRecord` metadata when saving AI matches; add **Review Match**, **New Game**, and **Summary** buttons to `styles.replayBar`. |
| `apps/mobile/src/screens/HistoryScreen.tsx` | **Modify** | Always merge `savedLocal` AI matches with `serverRes.games` (deduplicated & sorted by `endedAt` desc); fix `resolveRecord` to preserve player names and `myPlayerId`. |
| `apps/mobile/src/screens/PlayerProfileScreen.tsx` | **Modify** | Fix `resolveRecord` when inspecting another player's match so `isViewerSeated` is `false` when the viewer was not one of the two players, and `perspectivePlayerId` defaults to the profile owner. |
| `apps/mobile/App.tsx` | **Modify** | Compute `perspectiveIdx` dynamically in `handleSelectGameFromHistory` and `handleAnalyzeGameFromHistory` instead of hardcoding `perspectiveIdx: 0`. |
| `apps/mobile/src/screens/GameReviewScreen.tsx` | **Modify** | Fix `userPlayer` / `opponentPlayer` assignment (`bottomIdx = perspectiveIdx`), board flip condition, accuracy/classification attribution, conditional `(You)` badge rendering (`isViewerSeated`), and offline local review fallback. |
| `apps/mobile/src/screens/ReplayScreen.tsx` | **Modify** | Respect `record.perspectivePlayerId` and `record.isViewerSeated` for board flip and `(You)` label rendering. |

---

## 3. Step-by-Step Implementation Details

### Step 4.1: Fix Offline Premium Boot & Entitlement Persistence

#### A. `apps/mobile/src/network/session.tsx` (Lines 161–189)
Currently, because guests cannot purchase subscriptions (`offers.ts:162`), every Premium user is signed in via Google (`supabaseSession.user`). When launching the app offline:
1. Line 164 overwrites `@duoorb:identity:v2` with `username: ''`.
2. Line 175 calls `fetchProfile()`, which throws `OFFLINE`.
3. Line 183 checks `if (!serverNames && isRetryable(profileError))` and **returns early at line 185 without calling `setStatus('ready')`**, trapping offline Premium users on `<NoConnectionSection />` (`App.tsx:1259`).

Replace lines 161–189 in `apps/mobile/src/network/session.tsx` with:
```ts
        if (supabaseSession?.user) {
          const cachedIdentity = await loadIdentity();
          const sameUser = cachedIdentity?.userId === supabaseSession.user.id;
          const baseIdentity: StoredIdentity = {
            userId: supabaseSession.user.id,
            token: supabaseSession.access_token,
            username: sameUser ? cachedIdentity.username : '',
            displayName:
              (sameUser ? cachedIdentity.displayName : null) ??
              supabaseSession.user.user_metadata?.full_name ??
              supabaseSession.user.email?.split('@')[0] ??
              'Player',
            isGuest: false,
            email: supabaseSession.user.email,
          };
          await saveIdentity(baseIdentity);
          setIdentity(baseIdentity);

          let serverNames: { username: string; displayName: string } | null = null;
          let profileError: unknown = null;
          try {
            serverNames = await fetchProfile();
          } catch (err) {
            profileError = err;
          }

          if (!serverNames && isRetryable(profileError)) {
            // Offline tolerance: if we already have a cached username for this user,
            // allow the app to boot into ready state with cached identity + cached premium.
            if (baseIdentity.username) {
              setStatus('ready');
              return;
            }
            scheduleRetry(init);
            return;
          }
```

#### B. `apps/mobile/src/monetization/offers.ts` (Lines 184 & 221)
In `purchaseSelectedPackage` and `restorePurchases`, persist the local entitlement immediately before waiting for `pollServerPremium()`:
```ts
if (hasActivePremiumEntitlement(info)) {
  const entitlement = info.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  await ingestMe({
    isPremium: true,
    premiumUntil: entitlement?.expirationDate ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
}
```

#### C. `apps/mobile/src/monetization/premium.ts` (Lines 39–59)
Update `deriveSnapshot` so an explicit future `premiumUntil` timestamp is trusted for up to 35 days offline:
```ts
const MAX_OFFLINE_EXPIRY_TRUST_MS = 35 * 24 * 60 * 60 * 1000;

function deriveSnapshot(raw: PersistedPremiumState | null, now = Date.now()): PremiumSnapshot {
  if (!raw || !raw.isPremium) {
    return { isPremium: false, premiumUntil: null, source: raw ? 'cache' : 'default', isStale: false };
  }
  const untilMs = raw.premiumUntil ? Date.parse(raw.premiumUntil) : null;
  if (untilMs !== null && !Number.isNaN(untilMs)) {
    if (untilMs <= now) {
      return { isPremium: false, premiumUntil: raw.premiumUntil, source: 'cache', isStale: false };
    }
    const age = now - (raw.verifiedAt || 0);
    if (age <= MAX_OFFLINE_EXPIRY_TRUST_MS) {
      return {
        isPremium: true,
        premiumUntil: raw.premiumUntil,
        source: age <= OFFLINE_GRACE_MS ? 'server' : 'cache',
        isStale: age > OFFLINE_GRACE_MS,
      };
    }
  }
  // Fallback for lifetime/no-expiry within 7-day grace window
  const age = now - (raw.verifiedAt || 0);
  if (age <= OFFLINE_GRACE_MS) {
    return { isPremium: true, premiumUntil: raw.premiumUntil, source: 'cache', isStale: false };
  }
  return { isPremium: false, premiumUntil: raw.premiumUntil, source: 'cache', isStale: true };
}
```

---

### Step 4.2: Unified AI + Online Match History (`gameStorage.ts`, `GameScreen.tsx`, `HistoryScreen.tsx`)

#### A. Extend `SavedGameRecord` in `apps/mobile/src/storage/gameStorage.ts`
Add rich metadata fields so local AI matches render with the exact same fidelity as server matches and preserve seating perspective:
```ts
export interface SavedGameRecord {
  id: string;
  createdAt: string;
  updatedAt?: string;
  mode: GameMode;
  type: MatchType;
  difficulty?: AIDifficulty;
  botId?: string;
  botName?: string;
  botRating?: number;
  timeControlMinutes?: number;
  incrementSeconds?: number;
  endedReason?: string;
  initialState: GameState;
  finalState: GameState;
  winnerId: number | null;
  moveCount: number;
  /** The seat ID (1 or 2) controlled by the local user, or null if spectating two other players */
  myPlayerId?: PlayerId | null;
  /** The seat ID (1 or 2) that should be rendered at the bottom of the board in Replay/Review */
  perspectivePlayerId?: PlayerId;
  /** True when the current app user actually played in this match (controls "(You)" badge) */
  isViewerSeated?: boolean;
}
```

#### B. Populate Metadata When Saving AI Matches in `apps/mobile/src/screens/GameScreen.tsx` (Lines 913–944)
In the `useEffect` that calls `saveGameToHistory`:
```ts
const record: SavedGameRecord = {
  id: matchRecordIdRef.current,
  createdAt: new Date(state.startedAt ?? Date.now()).toISOString(),
  updatedAt: new Date().toISOString(),
  mode: config.mode,
  type: config.type,
  difficulty: config.difficulty,
  botId: config.botPersona?.id,
  botName: config.botPersona?.name,
  botRating: config.botPersona?.rating,
  timeControlMinutes: config.timerMinutes ? Math.round(config.timerMinutes) : undefined,
  incrementSeconds: config.incrementSeconds ?? 0,
  endedReason: state.endedReason ?? 'GOAL',
  initialState: initialStateRef.current,
  finalState: state,
  winnerId: state.winner,
  moveCount: state.moveHistory.length,
  myPlayerId: humanSeatId,
  perspectivePlayerId: humanSeatId,
  isViewerSeated: true,
};
```

#### C. Merge Local AI Matches + Server Online Matches in `apps/mobile/src/screens/HistoryScreen.tsx`
In `HistoryScreen.tsx` (lines 104–193), `savedLocal` is currently only used inside `else if (savedLocal.length > 0)` when `serverRes.games.length === 0`.
1. Create a helper `mapLocalRecordToHistoryItem(g: SavedGameRecord, t: TFunction): GameHistoryItemDto`:
   ```ts
   function mapLocalRecordToHistoryItem(g: SavedGameRecord, t: (k: string) => string): GameHistoryItemDto {
     const mySeat = g.myPlayerId ?? 1;
     const result: 'W' | 'L' | 'D' =
       g.winnerId == null ? 'D' : g.winnerId === mySeat ? 'W' : 'L';
     const opponentName =
       g.type === 'ai'
         ? g.botName
           ? `${g.botName} (AI)`
           : `${t(`setup.${g.difficulty ?? 'medium'}`)} AI`
         : t('setup.localPassPlay');
     return {
       gameId: g.id,
       mode: g.mode,
       matchType: g.type,
       botId: g.botId ?? null,
       result,
       endedReason: g.endedReason ?? 'GOAL',
       moveCount: g.moveCount,
       timeControlMinutes: g.timeControlMinutes ?? 0,
       incrementSeconds: g.incrementSeconds ?? 0,
       ratingDelta: null,
       StartedAt: g.createdAt,
       endedAt: g.updatedAt ?? g.createdAt,
       opponent: {
         id: g.botId ? `bot:${g.botId}` : 'local',
         username: opponentName,
         displayName: opponentName,
         avatarUrl: null,
         rating: g.botRating ?? null,
         isPremium: false,
       },
     };
   }
   ```
2. In `fetchHistory` (lines 107–145):
   - Always map `savedLocal.filter((g) => g.type !== 'online')` via `mapLocalRecordToHistoryItem`.
   - Combine `[...(serverRes?.games ?? []), ...localItems]`.
   - Deduplicate by `gameId` using a `Map<string, GameHistoryItemDto>()`.
   - Sort combined items by `new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()`.
3. In `loadMore` (lines 166–193):
   - Merge newly fetched `res.games` with existing state, deduplicate by `gameId`, and maintain descending `endedAt` sort order.

---

### Step 4.3: Fix Replay & Review Perspective, Board Flip & `(You)` Label Bug

#### A. Fix `resolveRecord` in `HistoryScreen.tsx` (Lines 225–255) & `PlayerProfileScreen.tsx` (Lines 331–369)
When reconstructing a `SavedGameRecord` from `api.getGameReplay(item.gameId)`:
1. Determine the seats from `replay.players`:
   - Each entry in `replay.players` has `{ userId, username, displayName, playerIndex, isPremium }` where `playerIndex` is `0` (seat 1 / Blue / UP) or `1` (seat 2 / Red / DOWN).
2. Populate player names onto `initialState.players` and `currentState.players`:
   ```ts
   for (const p of replay.players ?? []) {
     const idx = p.playerIndex === 1 ? 1 : 0;
     if (initialState.players[idx]) {
       initialState.players[idx] = {
         ...initialState.players[idx],
         name: p.displayName || p.username || initialState.players[idx].name,
       };
     }
     if (currentState.players[idx]) {
       currentState.players[idx] = {
         ...currentState.players[idx],
         name: p.displayName || p.username || currentState.players[idx].name,
       };
     }
   }
   ```
3. Compute `viewerEntry` and `perspectiveIdx`:
   - Look up `const viewerEntry = replay.players?.find((p) => p.userId === identity?.userId);`
   - In `HistoryScreen.tsx` (viewing own history):
     - `const isViewerSeated = Boolean(viewerEntry);`
     - `const mySeatId: PlayerId = viewerEntry ? (viewerEntry.playerIndex === 1 ? 2 : 1) : 1;`
     - Set `myPlayerId: isViewerSeated ? mySeatId : null`, `perspectivePlayerId: mySeatId`, `isViewerSeated`.
   - In `PlayerProfileScreen.tsx` (viewing `userId`'s profile):
     - `const profileOwnerEntry = replay.players?.find((p) => p.userId === userId);`
     - `const isViewerSeated = Boolean(viewerEntry);`
     - If the logged-in user played in that match (`viewerEntry` exists), orient from the logged-in user's seat (`viewerSeatId = viewerEntry.playerIndex === 1 ? 2 : 1`).
     - Otherwise (`viewerEntry` is undefined — user is spectating a match between `userId` and someone else!), set `myPlayerId: null`, `isViewerSeated: false`, and `perspectivePlayerId: profileOwnerEntry ? (profileOwnerEntry.playerIndex === 1 ? 2 : 1) : 1`.

#### B. Fix Hardcoded `perspectiveIdx: 0` in `apps/mobile/App.tsx` (Lines 763 & 800)
In `App.tsx`:
```ts
const computePerspectiveIdx = (record: SavedGameRecord): 0 | 1 => {
  const seatId = record.perspectivePlayerId ?? record.myPlayerId ?? 1;
  const idx = record.initialState.players.findIndex((p) => p.id === seatId);
  return idx === 1 ? 1 : 0;
};
```
Update `handleSelectGameFromHistory` (`line 763`) and `handleAnalyzeGameFromHistory` (`line 800`) to use:
```ts
perspectiveIdx: computePerspectiveIdx(record),
```

#### C. Fix `GameReviewScreen.tsx` Orientation, Accuracy & `(You)` Label (Lines 291–312, 349, 586–636, 753, 1054)
1. **Determine Bottom vs Top Player (`lines 635–636`):**
   Replace:
   ```ts
   const opponentPlayer = currentState.players[1];
   const userPlayer = currentState.players[0];
   ```
   With:
   ```ts
   const bottomIdx: 0 | 1 = perspectiveIdx === 1 ? 1 : 0;
   const topIdx: 0 | 1 = bottomIdx === 0 ? 1 : 0;
   const userPlayer = currentState.players[bottomIdx];
   const opponentPlayer = currentState.players[topIdx];
   const isViewerSeated = record.isViewerSeated ?? (record.myPlayerId != null);
   ```
2. **Board Flip (`line 939` & `1005`):**
   ```ts
   const shouldFlipBoard = userPlayer?.goalDirection === 'DOWN' || bottomIdx === 1;
   ```
   Pass `flipped={shouldFlipBoard}` to `<GameBoard />`.
3. **Accuracy & Classification Counts (`lines 369, 381, 586–626`):**
   - Replace hardcoded `review.accuracy.player1` / `review.accuracy.player2` with:
     ```ts
     const bottomAccuracy = bottomIdx === 0 ? review?.accuracy.player1 : review?.accuracy.player2;
     const topAccuracy = topIdx === 0 ? review?.accuracy.player1 : review?.accuracy.player2;
     ```
   - In `userCounts` / `oppCounts`, attribute moves where `move.player === bottomIdx + 1` to `userCounts` (bottom column) and `move.player === topIdx + 1` to `oppCounts` (top column).
4. **Conditional `(You)` Label (`lines 753 & 1054`):**
   - Replace `{userPlayer?.name || 'Player 1'} ({t('gameover.you')})` with:
     ```tsx
     {userPlayer?.name || `Player ${bottomIdx + 1}`}{isViewerSeated ? ` (${t('gameover.you')})` : ''}
     ```
5. **Offline Review Fallback (`lines 291–312`):**
   - In `GameReviewScreen.tsx`, when `api.requestGameReview` throws (e.g., user is offline), instead of leaving `review` as `null` forever, catch the error and run local on-device MCTS analysis (`analyzeMatchLocal(record.initialState, record.finalState.moveHistory)`) so offline users and offline Premium subscribers always get a working Game Review!

#### D. Fix `ReplayScreen.tsx` Orientation & `(You)` Label
In `apps/mobile/src/screens/ReplayScreen.tsx`:
- Derive `bottomIdx` from `record.perspectivePlayerId ?? record.myPlayerId ?? 1`.
- Flip `<GameBoard flipped={bottomPlayer.goalDirection === 'DOWN' || bottomIdx === 1} />`.
- Only append `({t('gameover.you')})` on the bottom player strip when `record.isViewerSeated !== false && record.myPlayerId != null`.

---

### Step 4.4: Match End Modal $\rightarrow$ "Replay" Missing Action Buttons (`GameScreen.tsx:2048-2121`)
When the user clicks **"Replay"** in `GameOverModal`, `enterReplay()` (`line 1440`) hides `GameOverModal` and shows `styles.replayBar` (`lines 2048–2121`), which currently only has transport step buttons (`|<`, `<`, `Play/Pause`, `>`, `>|`).
Update `styles.replayBar` in `apps/mobile/src/screens/GameScreen.tsx` to include a dedicated action row right below the transport controls:
```tsx
<View style={styles.replayActionsRow}>
  {onAnalyze && (
    <TouchableOpacity
      style={[styles.replayActionBtn, styles.replayActionPrimary]}
      onPress={handleAnalyzePress}
      activeOpacity={0.85}
    >
      <Feather name="bar-chart-2" size={15} color="#0A0E1A" />
      <Text style={styles.replayActionPrimaryText}>{t('gameover.analyzeMatch')}</Text>
    </TouchableOpacity>
  )}
  <TouchableOpacity
    style={styles.replayActionBtn}
    onPress={() => {
      exitReplay();
      if (onNewGame) onNewGame();
      else handleRematch();
    }}
    activeOpacity={0.85}
  >
    <Feather name="plus-circle" size={15} color="#F8FAFC" />
    <Text style={styles.replayActionText}>{t('gameover.newGame')}</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.replayActionBtn}
    onPress={() => setShowGameOver(true)}
    activeOpacity={0.85}
  >
    <Feather name="award" size={15} color="#94A3B8" />
    <Text style={styles.replayActionText}>{t('gameover.summary', 'Summary')}</Text>
  </TouchableOpacity>
</View>
```

---

## 4. Verification & Testing Checklist
- [ ] **Offline Premium Boot Test:** Sign in with a Premium Google account, enable Airplane Mode, force-close and relaunch the app:
  - App boots directly into `HomeScreen` (`status === 'ready'`) instead of `<NoConnectionSection />`.
  - `<PremiumBadge />` is visible on the user's profile and ads remain suppressed.
  - Playing an offline AI match and clicking **Analyze Match** falls back cleanly to local review without hanging.
- [ ] **Unified History Test:** Play 2 offline AI matches and 1 online match $\rightarrow$ open `HistoryScreen` $\rightarrow$ all 3 matches appear in chronological order with working **Replay** and **Analyze** buttons.
- [ ] **Red Seat Perspective Test:** Play a match as Red (`seat 2`, starting at the top) $\rightarrow$ open `HistoryScreen` $\rightarrow$ click **Replay** or **Analyze** $\rightarrow$ Red is rendered at the bottom of the screen, the board is flipped properly, and `(You)` is next to Red's username (not Blue's).
- [ ] **Spectator Profile Replay Test:** Open `LeaderboardScreen` $\rightarrow$ tap another user's profile (`PlayerProfileScreen`) $\rightarrow$ tap **Replay** or **Analyze** on one of their matches against a third user $\rightarrow$ the profile owner is at the bottom and **neither** player has `(You)` next to their name.
- [ ] **In-Match Replay Bar Buttons:** Finish any match $\rightarrow$ click **Replay** in `GameOverModal` $\rightarrow$ verify **Review Match**, **New Game**, and **Summary** buttons are visible and functional in the bottom bar.
