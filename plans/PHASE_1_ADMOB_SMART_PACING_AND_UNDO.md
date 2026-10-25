# Phase 1 Implementation Plan: AdMob Video Fix, App-Wide Smart Ad Pacing Engine & Offline +3 Undos via Video Ad

> **Phase:** 1 of 6  
> **Packages Affected:** `@duoorb/mobile` (`apps/mobile`)  
> **Dependencies:** None (can be executed first)  
> **Goal:** Fix all 5 root causes preventing AdMob video ads (Interstitial & Rewarded) from showing, build an intelligent **App-Wide Retention-Safe Ad Pacing Engine**, wire video ads to Match End / **"New Match"** (never **"Rematch"**) and Room navigation, and add the **Offline +3 Undos via Rewarded Video Ad** mechanic.

---

## 1. Root-Cause Summary (Why Video Ads Were Failing)

1. **`GameOverModal.tsx:422` rendered a static `<BannerAd>` instead of a Video Ad:**
   - `<AdBanner placement="modal" />` in [`GameOverModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx#L422) requested `adUnitId('banner')` (`INLINE_ADAPTIVE_BANNER`), never an interstitial video unit.
2. **`MaxAdContentRating.G` in [`adsNative.ts:61`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts#L61) blocked >80% of gaming video ads:**
   - Most mobile gaming video creatives (strategy, puzzle, RPG) are rated `PG` or `T` (Teen 13+). Because DuoOrb's Terms of Service require users to be **13+**, setting `G` caused `ERROR_CODE_NO_FILL` on video units while banners still filled.
3. **Zero Interstitial Preloading in [`adsNative.ts:226-305`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts#L226-L305):**
   - `showInterstitial()` created a fresh `InterstitialAd` and called `ad.load()` cold at the exact moment the user tapped exit. Video VAST creatives take 2–6s to buffer, causing timeouts or late popups after navigation.
4. **`showInterstitialIfDue` was only wired to `"Close Match"` (`onHome`) in [`GameScreen.tsx:2343`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L2343):**
   - Tapping **"New Match"** (`onNewGame` at line `2315`) or exiting via Back button (`line 1382`) bypassed both `recordGameFinished()` and `showInterstitialIfDue()`.
5. **Failed Rewarded Ads Stamped the 3-Minute Cooldown in [`ads.ts:97`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/ads.ts#L97):**
   - `lastRewardedAtMs = Date.now()` ran *before* checking if the rewarded ad actually loaded/earned, blocking all interstitials for 180 seconds even when the rewarded ad failed to load.

---

## 2. Step-by-Step File Modifications

### Step 1.1 — Fix `MaxAdContentRating.T` & Add Preloaded Interstitial Cache
**File:** [`apps/mobile/src/monetization/adsNative.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts)

1. **Change Content Rating (`lines 59-63`):**
   ```ts
   await mobileAds.setRequestConfiguration({
     maxAdContentRating: MaxAdContentRating.T,
     tagForChildDirectedTreatment: false,
     tagForUnderAgeOfConsent: false,
   });
   ```
2. **Add Preloaded Interstitial State & `preloadInterstitial()` (`lines 226-305`):**
   - Maintain a module-level preloaded instance:
     ```ts
     let preloadedInterstitial: any | null = null;
     let preloadingInterstitialPromise: Promise<boolean> | null = null;
     ```
   - Implement `preloadInterstitial(): Promise<boolean>`:
     - If `Platform.OS !== 'android'` or SDK unavailable, return `false`.
     - If `preloadedInterstitial?.loaded` is true, return `true`.
     - If `preloadingInterstitialPromise` is in-flight, return it.
     - Otherwise, create `InterstitialAd.createForAdRequest(adUnitId('interstitial'))`, listen for `AdEventType.LOADED` and `AdEventType.ERROR` (with `LOAD_TIMEOUT_MS = 12_000`), and store the loaded ad in `preloadedInterstitial`.
   - Update `showInterstitial(): Promise<InterstitialResult>`:
     - If `preloadedInterstitial` is already loaded:
       - Consume `const ad = preloadedInterstitial; preloadedInterstitial = null;`
       - Attach `AdEventType.CLOSED` and `AdEventType.ERROR` listeners.
       - Call `ad.show()` immediately (`< 50ms`!).
       - When `CLOSED` fires, trigger `void preloadInterstitial()` in the background so the next match already has a video ready, and resolve `{ shown: true }`.
     - If not yet loaded, await `preloadInterstitial()` with a short **2,000ms** grace cap (so we never stall UI navigation or pop an ad late on another screen).

---

### Step 1.2 — Fix Rewarded Cooldown Stamp & Expose `'undo'` Placement
**File:** [`apps/mobile/src/monetization/ads.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/ads.ts)

1. **Update `RewardedPlacement` (`line 16`):**
   ```ts
   export type RewardedPlacement = 'analysis' | 'undo';
   ```
2. **Fix `showRewarded` (`lines 96-99`):**
   ```ts
   export async function showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
     const res = await provider.showRewarded(placement);
     if (res.earned) {
       lastRewardedAtMs = Date.now();
     }
     return res;
   }
   ```
3. **Export `preloadInterstitial`:**
   - Add `preloadInterstitial?: () => void;` to `InterstitialProvider` or export `preloadInterstitial()` from `ads.ts` / `realAds.ts` so `GameScreen.tsx` can call it on mount.

---

### Step 1.3 — Upgrade `interstitial.ts` into the App-Wide Smart Ad Pacing Engine
**File:** [`apps/mobile/src/monetization/interstitial.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/interstitial.ts)

Design a retention-safe decision engine that operates across **Online, AI, Local, and Room transitions** without ever touching gameplay:

1. **Update `ADS_CONFIG` (`lines 26-34`):**
   ```ts
   export const ADS_CONFIG = {
     interstitialEnabled: true,
     interstitialMinGames: 1,          // Eligible on 1st completed win
     interstitialMinGamesAfterLoss: 2, // Wait until 2nd game if user lost
     interstitialMaxPerDay: 8,         // Up from 3 for multi-match sessions
     interstitialWinGapSec: 75,        // 75s cooldown when user is in high-dopamine Win state
     interstitialNeutralGapSec: 150,   // 150s cooldown on neutral transitions
     interstitialRewardedShieldSec: 180, // 3-min immunity after watching a Rewarded Video (Undo/Analysis)
     interstitialMinGameSec: 20,       // Skip instant <20s resigns/aborts (down from 60s so fast matches count)
     maxConsecutiveLossesForAd: 1,     // Tilt protection: NEVER show interstitial on 2+ loss streak
     skipFirstSession: false,          // Allow ads in 1st session once at least 1 full match is won
   } as const;
   ```
2. **Extend `InterstitialContext` & State Tracking:**
   ```ts
   export type AdTransitionTrigger = 'new_match' | 'close_match' | 'room_exit';

   export interface InterstitialCheckInput {
     userWon: boolean;
     gameSec: number;
     trigger?: AdTransitionTrigger;
   }
   ```
   - Track `consecutiveLosses` in memory + persisted `@duoorb:interstitial:v1`:
     - In `recordGameFinished(outcome?: { userWon: boolean; gameSec: number })`:
       - Only increment `gamesFinished` if `gameSec >= ADS_CONFIG.interstitialMinGameSec`.
       - If `userWon === true`, reset `consecutiveLosses = 0`.
       - If `userWon === false`, increment `consecutiveLosses += 1`.
3. **Decision Logic in `isInterstitialEligible(ctx)`:**
   - **Rule 1 (Premium):** `if (ctx.isPremium) return false;`
   - **Rule 2 (Short / Aborted Match Protection):** `if (ctx.gameSec < ADS_CONFIG.interstitialMinGameSec) return false;`
   - **Rule 3 (Tilt / Frustration Protection — Prevents App Closes):**
     - If `!ctx.userWon && ctx.consecutiveLosses >= 2`, return `false`! (When a player has lost 2+ games in a row, never hit them with an interstitial so they stay in the app and play another match.)
     - If `!ctx.userWon && ctx.trigger === 'close_match'`, return `false`! (Only show post-loss interstitials when the user is actively starting a `'new_match'` after a single long match $\ge 45\text{s}$ and `gamesFinished >= 2`.)
   - **Rule 4 (Rewarded Video Karma Shield):**
     - If `ctx.lastRewardedAtMs > 0 && ctx.now - ctx.lastRewardedAtMs < ADS_CONFIG.interstitialRewardedShieldSec * 1000`, return `false`.
   - **Rule 5 (Adaptive Cooldown):**
     - Determine required gap: `const minGapMs = (ctx.userWon ? ADS_CONFIG.interstitialWinGapSec : ADS_CONFIG.interstitialNeutralGapSec) * 1000;`
     - Check `if (ctx.lastShownAtMs > 0 && ctx.now - ctx.lastShownAtMs < minGapMs) return false;`
     - Check daily cap `ctx.shownToday < ADS_CONFIG.interstitialMaxPerDay`.

---

### Step 1.4 — Replace Ending Modal Banner with Video Ad & Wire "New Match" (Never "Rematch")
**Files:**
- [`apps/mobile/src/components/GameOverModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx)
- [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx)

1. **In `GameOverModal.tsx` (`line 422`):**
   - Remove `<AdBanner placement="modal" />` (and remove `import { AdBanner } from './AdBanner';` at line `20`).
2. **In `GameScreen.tsx`:**
   - **On Match Mount:** Call `preloadInterstitial()` so the video creative buffers in the background while the match is being played.
   - **On Match Completion (`lines 897-925`):**
     - Compute `const gameSec = Math.max(0, Math.round((Date.now() - matchStartedAtRef.current) / 1000));`
     - Call `void recordGameFinished({ userWon: type === 'local' ? true : Boolean(userWon), gameSec });` immediately when `state.status === 'COMPLETED'` (not inside `onHome`!).
     - Call `preloadInterstitial()` and `preloadRewarded('analysis')`.
   - **Create helper `maybeShowPostMatchVideoAd(trigger: 'new_match' | 'close_match')` in `GameScreen.tsx`:**
     ```ts
     const maybeShowPostMatchVideoAd = async (trigger: 'new_match' | 'close_match') => {
       if (!isEndOfMatch || interstitialFiredRef.current) return;
       interstitialFiredRef.current = true;
       const gameSec = Math.max(0, Math.round((Date.now() - matchStartedAtRef.current) / 1000));
       const effectiveWon = type === 'local' ? true : Boolean(userWon);
       await showInterstitialIfDue({ userWon: effectiveWon, gameSec, trigger });
     };
     ```
   - **Wire to `"New Match"` (`onNewGame` at line `2315` AND Replay Bar New Game button):**
     ```ts
     onNewGame={
       onNewGame
         ? async () => {
             setShowGameOver(false);
             await maybeShowPostMatchVideoAd('new_match');
             onNewGame();
           }
         : undefined
     }
     ```
   - **Wire to `"Close Match"` (`onHome` at line `2333`) and Post-Match Back Button (`handleBackPress` at line `1382`):**
     ```ts
     onHome={async () => {
       setShowGameOver(false);
       await maybeShowPostMatchVideoAd('close_match');
       onQuit();
     }}
     ```
   - **Keep `"Rematch"` (`onRematch` at line `1205`) 100% Ad-Free:** Do NOT call `maybeShowPostMatchVideoAd` inside `handleRematch`!

---

### Step 1.5 — Add Smart Ad Slots in Local Setup & Online Private Rooms
**Files:**
- [`apps/mobile/src/components/AdBanner.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/AdBanner.tsx#L24)
- [`apps/mobile/src/screens/MatchSetupScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/MatchSetupScreen.tsx#L395)
- [`apps/mobile/src/screens/OnlineScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/OnlineScreen.tsx#L801-L1376)

1. In `AdBanner.tsx:24`: Update `export type AdBannerPlacement = 'home' | 'history' | 'leaderboard' | 'lobby' | 'setup';`
2. In `MatchSetupScreen.tsx:395`: Render `<AdBanner placement="setup" />` at the bottom of the `ScrollView` below the "Start Match" CTA button.
3. In `OnlineScreen.tsx`: Inside the Private Rooms sub-view (`showRoomsView === true`), render `<AdBanner placement="lobby" />` at the bottom of the Create/Join Room `ScrollView` (`line 1171`) and at the bottom of the Active Room waiting view (`line 1030`).

---

### Step 1.6 — Implement Offline "+3 Undos via Rewarded Video Ad"
**Files:**
- [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx)
- [`apps/mobile/src/components/RewardSheet.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/RewardSheet.tsx)
- [`apps/mobile/src/i18n/locales/en.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/i18n/locales/en.ts) (and locale fallbacks)

1. **State in `GameScreen.tsx`:**
   - `const [undoCredits, setUndoCredits] = useState<number>(0);`
   - `const [undoSheetOpen, setUndoSheetOpen] = useState<boolean>(false);`
   - `const undosUsedRef = useRef<number>(0);` (reset to `0` on new game / rematch; used by Phase 3's 3-Star Bot Mastery check).
   - Preload `'undo'` rewarded ad when `type === 'ai'` match starts (`preloadRewarded('undo')`).
2. **Helper `executeUndoMove()` in `GameScreen.tsx`:**
   - Only valid when `type === 'ai'`, `state.status === 'IN_PROGRESS'`, `!isAiThinking`, and `state.history.length >= 2`.
   - Determine target step:
     - Since it is the human's turn (`state.currentPlayerIndex === humanIdx`), popping the last AI move + the human's last move rewinds to `targetStep = Math.max(0, state.history.length - 2)`.
   - Reconstruct state using `rebuildStateAtStep(initialStateRef.current, state.history, targetStep)` (preserving `history: state.history.slice(0, targetStep)`).
   - Call `setState(rewoundState)`, `stateRef.current = rewoundState`, `undosUsedRef.current += 1`.
3. **Handler `handleUndoPress()`:**
   - If `isPremium`: call `executeUndoMove()` immediately (unlimited free undos for Premium!).
   - Else if `undoCredits > 0`: call `setUndoCredits(c => c - 1)` and `executeUndoMove()`.
   - Else (`undoCredits === 0`): open `setUndoSheetOpen(true)` (`RewardSheet` configured for `'undo'`: *"Watch a short video to get 3 Undo moves"*).
   - When the user watches the video in `RewardSheet` (`showRewarded('undo')` returns `res.earned === true`):
     - Grant `+3` credits and immediately consume `1` credit to perform the requested undo (`setUndoCredits(2); executeUndoMove(); setUndoSheetOpen(false);`)!
4. **UI Button in `GameScreen.tsx` (Bottom Tray Row for `type === 'ai'`):**
   - Next to the Wall Tray / Resign button, render a sleek **Undo** pill button (`Feather name="rotate-ccw"`):
     - Disabled when `state.history.length < 2 || isAiThinking`.
     - Shows badge:
       - If `isPremium`: `Undo`
       - If `undoCredits > 0`: `Undo (${undoCredits})`
       - If `undoCredits === 0`: `Undo (+3 🎬)` (with small video icon).

---

## 3. Verification Checklist for Phase 1
- [ ] Run `npx vitest run apps/mobile/src/monetization/` — update & add unit tests in `interstitial.spec.ts`, `ads.spec.ts`, and `realAds.spec.ts` covering:
  - `MaxAdContentRating.T` configuration
  - Preloaded interstitial immediate show & re-warm on close
  - `showRewarded` only stamping `lastRewardedAtMs` when `earned === true`
  - Smart Ad Pacing rules (Win + New Match = 75s gap; 2+ consecutive losses = suppressed; Rematch = never fires; `<20s` game = skipped)
- [ ] Run `npx tsc --noEmit -p apps/mobile/tsconfig.json` — 0 type errors.
