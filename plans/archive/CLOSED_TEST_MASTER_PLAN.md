# DuoOrb Closed-Test Fixes, Smart Ad Pacing, AI/Rust Overhaul & Detailed Phase-by-Phase Implementation Plan

> **Status:** Master Technical Audit & Detailed Per-Phase Execution Blueprint  
> **Scope:** `@duoorb/mobile` (Android, iOS, Web/PWA), `@duoorb/game-core`, `@duoorb/analyzer-rust`, `@duoorb/protocol`, and `@duoorb/server` (AWS NestJS/Prisma).  
> **Locked Rules from Product Owner:**
> 1. **Zero Gameplay Rigging:** We NEVER rig gameplay or add fake "Revive" mechanics. DuoOrb is a pure tactical board game.
> 2. **Rewarded Video for +3 Undos in Offline/AI Mode:** In offline AI matches, players can use an **Undo** button; watching a Rewarded Video Ad grants **+3 Undos** (Premium users get unlimited/free undos).
> 3. **App-Wide Smart Ad Pacing Engine:** Interstitial/video ad placement across the **entire app** (Online, AI, Local, Room navigation) uses an intelligent retention-safe algorithm that maximizes ad impressions on positive transitions (e.g. Win $\rightarrow$ **New Match**, never on **Rematch**) while suppressing ads during frustration/rage-quit moments so players never close the app.
> 4. **3-Star Bot Mastery (`⭐⭐⭐`) + More Bots with Distinct Playstyles & Non-Repeating Moves:** Winning against bots awards **1–3 Stars** based on performance. Expand the bot roster and overhaul MCTS so every bot has a unique playing style/opening preference and **never repeats the exact same move sequence every game**.
> 5. **Fix Backend Rust Analysis "Everything is a Blunder" Bug:** A `BLUNDER` must only be flagged when a move genuinely flips the evaluation bar to the other side or throws away the game—not on every non-best step.
> 6. **Web/PWA Stays Without Subscriptions:** Do not set up Web/PWA subscriptions; focus Web on AdSense/web ads + the custom iOS PWA / Android Google Play Install Modal.

---

## Part 1: Master Issue & Root-Cause Matrix (All 16 Items)

| # | Area | Issue / Feature | Exact Root Cause in Codebase | Phase |
| :- | :--- | :--- | :--- | :--- |
| **1** | **AdMob Video Ads** | Video ads (Interstitial & Rewarded) don't show; only Banners appear | 5 bugs: (1) [`GameOverModal.tsx:422`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx#L422) renders `<AdBanner placement="modal" />` instead of video; (2) [`adsNative.ts:61`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts#L61) sets `MaxAdContentRating.G` (blocking >80% of 13+ gaming video ads); (3) [`adsNative.ts:234`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts#L234) cold-loads interstitials after unmount with zero preloading; (4) [`interstitial.ts:40-65`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/interstitial.ts#L40-L65) only counts `gamesFinished` when clicking "Close Match"; (5) [`ads.ts:97`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/ads.ts#L97) stamps cooldown even when a rewarded ad fails to load | **Phase 1** |
| **2** | **Smart App-Wide Ad Pacing Engine** | Show video ads at the right moments across the whole app (Win + **New Match**, never on **Rematch**, room transitions) without making users close the app | Static rules in [`interstitial.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/interstitial.ts) ignore player frustration, session depth, ad tolerance, and `onNewGame` ([`GameScreen.tsx:2315`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L2315)). [`MatchSetupScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/MatchSetupScreen.tsx) & [`OnlineScreen.tsx:801-1376`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/OnlineScreen.tsx#L801-L1376) (Private Rooms) have no ad slots | **Phase 1** |
| **3** | **Offline +3 Undos via Video Ad** | Allow players in offline AI mode to undo moves; watching a video ad grants **+3 Undos** | Currently [`GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx) has no Undo button or `undoCredits` state in AI matches | **Phase 1** |
| **4** | **Backend Rust Analysis "Everything is a Blunder" Bug** | Almost every move that isn't the #1 best move is marked as `BLUNDER` | **4 critical bugs found in [`packages/analyzer-rust/src/mcts.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/mcts.rs):** (1) **Cooperative Selection Bug (`mcts.rs:259-271`)**: opponent nodes maximize the root player's win rate instead of the opponent's, inflating `best_q` to `0.85–0.95` on every turn; (2) **Starved `played_action` Visits (`mcts.rs:402-423`)**: `played_action` only gets 1–4 noisy visits (often `played_q = 0.00` or `0.25`), creating fake `delta_q = 0.89 - 0.00` blunders; (3) **20% Random Backward Walks in Rollouts (`mcts.rs:342`)** + leaf eval ignoring turn tempo & wall count; (4) **No Bar-Flip Guard in [`classifier.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/classifier.rs)** | **Phase 2** |
| **5** | **AI Threading & Clock Freeze** | AI runs on main JS thread, lagging UI and freezing/skipping the clock during AI turns | [`mcts.ts:605`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts#L605) runs synchronous 150-sim chunks (2,100 rollout plies + ~15,000 BFS calls/chunk) on the main JS thread; [`GameScreen.tsx:769`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L769) uses a naive `setInterval(..., 1000)` that starves when JS is busy and loses sub-second AI turns | **Phase 3** |
| **6** | **Bot Skill Gap, Move Variety, New Bots & 3-Star System** | Easy bots aren't easy; bots with similar ELO think identically; even the same bot plays the exact same moves every game; add more bots + **3-Star Victory Rating (`⭐⭐⭐`)** | (1) [`mcts.ts:284-288, 534-556`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts#L284-L288) sets `shouldSprint = true` whenever `myDist <= minFoeDist` (true on >50% of turns!), forcing `wallProb = 0.05` and overriding all bots to walk straight down column 4; (2) [`engine.ts:325`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/engine.ts#L325) uses deterministic `positionSeed` and ignores `profile.randomness` & `profile.weights`; (3) No 3-star bot progression in `MatchSetupScreen` / `GameOverModal` | **Phase 3** |
| **7** | **Offline Premium Bug** | Premium status does not stay active when the user is offline | 3 bugs: (1) [`session.tsx:161-186`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/network/session.tsx#L161-L186) wipes cached `username` and halts boot on `<NoConnectionSection>` when a Google-linked user boots offline; (2) [`GameReviewScreen.tsx:291-312`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx#L291-L312) has no offline fallback when `api.requestGameReview` fails; (3) [`offers.ts:184`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/offers.ts#L184) doesn't immediately persist `@duoorb:premium:v1` before webhook polling | **Phase 4** |
| **8** | **Unified AI + Online History** | Save AI match history in the same History page alongside Online matches | [`GameScreen.tsx:924`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L924) saves AI games locally, **but** [`HistoryScreen.tsx:107-120`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx#L107-L120) discards `savedLocal` whenever `serverRes.games.length > 0`! Also `SavedGameRecord` omits `botId`, `botName`, `botRating`, and `timeControl` | **Phase 4** |
| **9** | **Replay & Review Perspective / `(You)` Bug** | Opening Replay/Analysis from History or Opponent Profile puts Blue at bottom even when user played Red, swaps names, and prints `(You)` on wrong player or 3rd-party matches | (1) [`App.tsx:763,800`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx#L763) hardcodes `perspectiveIdx: 0`; (2) [`HistoryScreen.tsx:225`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx#L225) & [`PlayerProfileScreen.tsx:331`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/PlayerProfileScreen.tsx#L331) never resolve `myPlayerId` or spectator status; (3) [`GameReviewScreen.tsx:635,753`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx#L635) hardcodes `userPlayer = players[0]` and unconditionally prints `(You)` | **Phase 4** |
| **10** | **Replay Controls Missing After Match End** | Clicking "Replay" in `GameOverModal` shows the board with no **"Review Match"** or **"New Game"** button | [`GameScreen.tsx:2048-2121`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L2048-L2121) (`styles.replayBar`) only renders playback transport icons (`<<`, `<`, `Play`, `>`, `>>`) and no action buttons | **Phase 4** |
| **11** | **Bot Avatars & Compact Bot Speech Bubble** | Replace SVG bot avatars with custom images; bot speech bubble covers the bot's HUD card in match screen | [`BotAvatar.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotAvatar.tsx) uses inline SVGs; [`BotSpeechBubble.tsx:141-151`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotSpeechBubble.tsx#L141-L151) is `position: 'absolute', top: 0` over `PlayerStrip` instead of a compact pill in the top header bar | **Phase 5** |
| **12** | **Home Ad Banner & Mobile BottomNav Gap** | Move Home banner under 4 modes and above Journey mode; reduce gap under `BottomNav` on native mobile only | [`HomeScreen.tsx:144`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HomeScreen.tsx#L144) puts `<AdBanner>` at top instead of line `269`; [`BottomNav.tsx:42`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BottomNav.tsx#L42) adds `bottomInset + 20` inside `App.tsx:880` (`SafeAreaView edges={['top', 'bottom']}`), double-counting `bottomInset` | **Phase 5** |
| **13** | **Premium Crown Everywhere** | Show `<PremiumBadge />` next to premium users' names everywhere in the app | Missing in 11 places across frontend & backend (Leaderboard Top-3 Podium, Friend Requests & Search, History rows, Opponent Profile matches, MatchResultModal, GameReviewScreen HUD, Online Matchmaking / Room Slots / Quick-Add / Toasts) | **Phase 5** |
| **14** | **Web AdSense Fix & Custom PWA / Play Store Install Modal** | Fix AdSense "Getting Ready" crawler blockers (keep Web without subscriptions); add custom modal encouraging iOS PWA install & Android Google Play install | [`public/index.html:251,415`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/index.html#L251) locks `body` scroll behind fixed overlays; [`manifest.json:5`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/manifest.json#L5) uses `"start_url": "/"`; no `InstallPromptModal.tsx` or `sw.js` exists | **Phase 6** |

---

## Part 2: Detailed Phase-by-Phase Implementation Plans

Below is the exact engineering specification for each of the **6 Phases**, listing every file, function signature, state change, and verification test.

---

# PHASE 1: AdMob Video Fix, App-Wide Smart Ad Pacing Engine & Offline +3 Undos via Video Ad

### Goal
Make Interstitial and Rewarded video ads load and display reliably, replace static post-game ad rules with an intelligent **App-Wide Retention-Safe Ad Pacing Engine**, place ads in Local/Private Room navigation, and add the **Offline +3 Undos via Rewarded Video** feature.

### Step 1.1 — Fix AdMob Video Loading & Preloading (`adsNative.ts` & `ads.ts`)
- **File:** [`apps/mobile/src/monetization/adsNative.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/adsNative.ts)
  1. **Line 61 (`maxAdContentRating`):** Change `MaxAdContentRating.G` $\rightarrow$ `MaxAdContentRating.T` (matches DuoOrb's 13+ Terms of Service and unlocks >80% of gaming video interstitial & rewarded inventory).
  2. **Lines 226–305 (`Preloaded Interstitial Manager`):**
     - Add module-scoped state:
       ```ts
       let cachedInterstitial: any | null = null;
       let interstitialLoadingPromise: Promise<boolean> | null = null;
       ```
     - Export `preloadInterstitial(): Promise<boolean>`:
       - Instantiates `InterstitialAd.createForAdRequest(adUnitId('interstitial'))`, subscribes to `AdEventType.LOADED` and `AdEventType.ERROR`, and calls `ad.load()`.
       - Once loaded, stores the ready instance in `cachedInterstitial`.
     - Update `showInterstitial()`:
       - If `cachedInterstitial` is ready, call `cachedInterstitial.show()` **immediately** (`< 50ms`), wait for `AdEventType.CLOSED`, clear `cachedInterstitial`, and trigger `void preloadInterstitial()` in the background for the next match!
       - If not yet preloaded, wait up to `2,500ms` max for an in-flight `interstitialLoadingPromise` (never `12,000ms` cold after navigation so an ad never pops up late mid-screen!).
- **File:** [`apps/mobile/src/monetization/ads.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/ads.ts)
  1. **Line 16 (`RewardedPlacement`):** Extend type:
     ```ts
     export type RewardedPlacement = 'analysis' | 'undo';
     ```
  2. **Lines 96–99 (`showRewarded`):** Only stamp `lastRewardedAtMs = Date.now()` **after** `const res = await provider.showRewarded(placement); if (res.earned) { lastRewardedAtMs = Date.now(); }` so a failed/unfilled rewarded ad never blocks interstitials!
  3. Export `preloadInterstitial()` through `ads.ts`.

### Step 1.2 — Build the App-Wide Smart Ad Pacing Engine (`interstitial.ts`)
Instead of dumb static counters or touching gameplay, upgrade [`apps/mobile/src/monetization/interstitial.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/interstitial.ts) into a **Context- & Retention-Aware Ad Decision Engine** used across the entire app:

1. **Tracked Session & Player Signals (`AdPacingState`)**:
   - `sessionGamesCompleted`: number of matches finished in the current session.
   - `consecutiveLosses`: number of consecutive losses across Online/AI matches.
   - `lastMatchDurationSec`: duration of the just-completed match.
   - `lastMatchOutcome`: `'WIN' | 'LOSS' | 'DRAW' | 'ABANDON'`.
   - `lastInterstitialShownAtMs`: timestamp of last interstitial shown.
   - `lastRewardedEarnedAtMs`: timestamp of last voluntary rewarded video completed (`'analysis'` or `'undo'`).
   - `interstitialsShownToday`: daily count (cap raised from `3` to `10` for engaged sessions).
   - `historicalExitAfterAdCount` / `historicalInterstitialsShown`: rolling ad-tolerance score in `@duoorb:ad-pacing:v2`.
2. **Smart Transition Triggers (`AdTriggerPoint`)**:
   - `'post_match_new_game'`: User finished a match and tapped **"New Match"** (`onNewGame`).
   - `'post_match_exit'`: User finished a match and tapped **"Close Match" / Back to Home / Lobby** (`onHome` / `handleBackPress`).
   - `'room_leave'`: User leaves an Online Private Room or Local Setup after playing.
   - **Explicitly Excluded (`NEVER` shows ad):**
     - **`'rematch'` (`onRematch`)**: Never show an ad when two opponents or a player taps **Rematch**!
3. **Retention-Safe Eligibility & Dynamic Cooldown Rules (`shouldShowInterstitial(ctx)`)**:
   - **Rule 1 (Premium Gate):** `if (ctx.isPremium) return false;`
   - **Rule 2 (Rage-Quit / Tilt Protection):**
     - If `ctx.lastMatchOutcome === 'ABANDON'` or `ctx.lastMatchDurationSec < 18` (instant resign / abort): **return `false`** (never punish an aborted match with an ad).
     - If `ctx.consecutiveLosses >= 2` and `ctx.trigger !== 'post_match_new_game'`: **return `false`** (when a user loses 2+ games in a row, showing an ad on exit causes them to close the app; let them recover first!).
   - **Rule 3 (Rewarded Karma Shield):**
     - If the user voluntarily watched a Rewarded Video Ad (`'analysis'` or `'undo'`) within the last **180 seconds**, **return `false`**.
   - **Rule 4 (Dynamic Cooldown Based on Mood & Engagement):**
     - **High-Dopamine State (`ctx.userWon === true` + tapped `"New Match"` or `"Close Match"`):** Minimum cooldown is only **`75 seconds`** and eligible starting from the **1st completed win** of the session (provided `lastMatchDurationSec >= 20`)!
     - **Neutral State (Completed Loss with `consecutiveLosses === 1` and `lastMatchDurationSec >= 45` on `"New Match"`):** Minimum cooldown is **`150 seconds`** and requires `sessionGamesCompleted >= 2`.

### Step 1.3 — Replace Ending Modal Banner with Video Ad & Wire Room/Setup Ad Slots
1. **[`apps/mobile/src/components/GameOverModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx#L422):**
   - Remove `<AdBanner placement="modal" />` at line `422` (and unused import at line `20`).
2. **[`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx):**
   - Call `preloadInterstitial()` when the match starts (mount effect) and at `state.status === 'COMPLETED'` (`line 919`).
   - Call `recordGameFinished({ userWon: Boolean(userWon), gameSec })` inside the `state.status === 'COMPLETED'` effect (`line 920`) so every completed match updates the pacing engine.
   - In `onNewGame` (`line 2315`), `onHome` (`line 2333`), and post-completion `handleBackPress` (`line 1382`): await `showInterstitialIfDue({ userWon: Boolean(userWon), gameSec, trigger: 'post_match_new_game' | 'post_match_exit' })` before navigating.
   - Keep `onRematch` (`line 1205`) 100% ad-free.
3. **[`apps/mobile/src/screens/MatchSetupScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/MatchSetupScreen.tsx#L395) & [`AdBanner.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/AdBanner.tsx#L24):**
   - Add `'setup'` to `AdBannerPlacement` in `AdBanner.tsx`.
   - Render `<AdBanner placement="setup" />` at the bottom of `MatchSetupScreen.tsx` `ScrollView` (below the "Start Match" button).
4. **[`apps/mobile/src/screens/OnlineScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/OnlineScreen.tsx#L801-L1376):**
   - Inside the Private Rooms sub-view (`showRoomsView === true`), render `<AdBanner placement="lobby" />` at the bottom of the Create/Join Room `ScrollView` (`line 1171`) and inside the Active Room waiting lobby footer (`line 1030`).

### Step 1.4 — Implement Offline "+3 Undos via Rewarded Video Ad" (`GameScreen.tsx` & `GameHud.tsx`)
1. **How Undo Works in Offline AI Mode (`type === 'ai'`)**:
   - Track `undoCredits` in `GameScreen.tsx` (initialized to `0` for Free users so watching a video ad gives **`+3` Undo moves**, or unlimited `Infinity` for Premium users!).
   - When is **Undo** enabled?
     - Whenever `type === 'ai'`, `state.status === 'IN_PROGRESS'`, `!isAiThinking`, and `state.history.length >= 2` (so there is at least 1 human move + 1 AI reply on the board to undo back to the human's turn).
   - What happens when the player taps **Undo** in the bottom control bar (`GameScreen.tsx` alongside Wall Tray / Resign)?
     - **If `isPremium` or `undoCredits > 0`:**
       - Immediately pop the last 2 plies (the AI's last action and the human's last action) by rebuilding state via `rebuildStateAtStep(initialStateRef.current, state.history, state.history.length - 2)`!
       - Decrement `undoCredits` by `1` (if not Premium) and increment `undosUsedThisMatchRef.current += 1` (used for the 3-Star Bot Mastery check in Phase 3!).
     - **If `undoCredits === 0` (Free user):**
       - Open `RewardSheet` (or inline video prompt) with title `"Get 3 Undo Moves"` and subtitle `"Watch a short video to get 3 Undo moves for this match"`.
       - Call `const res = await showRewarded('undo')`.
       - When `res.earned === true`:
         - Grant `+3` Undo credits, immediately execute the 1st Undo (leaving **`2` Undo credits remaining** displayed on the Undo button badge `Undo (2)`!), and close the sheet!

### Phase 1 Verification
- `npx vitest run apps/mobile/src/monetization/` passes all updated interstitial, rewarded, and undo tests.
- `tsc --noEmit` clean across `apps/mobile`.

---

# PHASE 2: Fix Backend Rust Analysis Engine ("Everything Is a Blunder" Bug)

### Goal
Fix the 4 mathematical and algorithmic bugs in `packages/analyzer-rust` (`mcts.rs`, `review.rs`, `classifier.rs`, `rules.rs`) so that:
1. Move analysis evaluates every move with **true adversarial MCTS** (where the opponent plays to win, not to help the mover!).
2. The played move (`played_action`) is **never starved of simulations** or evaluated with noisy 1-visit rollouts.
3. **`BLUNDER` is strictly reserved for moves that genuinely flip the evaluation bar to the other side** (from winning/equal to losing, or missing a forced win / allowing a 1-step loss / losing $\ge 3$ net steps).

### Root Causes Discovered in Live Simulation of `packages/analyzer-rust`
When we ran `packages/analyzer-rust` on a 30-move game, we observed:
- On Move 7 (`p1`), `best_q` was **`0.770`** (77% for P1), and 1 ply later on Move 8 (`p2`), `best_q` was **`0.874`** (87.4% for P2), and on Move 13 (`p1`), `best_q` was **`0.898`**, while `played_q` was **`0.000`** (`0/1` visits) or **`0.250`** (`1/4` visits)!
- **Why?**
  1. **Bug 2.1 — Cooperative Tree Selection (`packages/analyzer-rust/src/mcts.rs:259-271`)**:
     - `total_reward` is accumulated from `root_mover`'s perspective (`if winner == mover_idx { 1.0 } else { 0.0 }` at line `363`).
     - At depth 1 (where it is the **opponent's** turn!), line `262` selects the child that **maximizes `child.total_reward / child.visits`** — meaning the opponent in MCTS intentionally chooses moves that make the root player win! That inflates `best_q` to `0.85–0.95` on every single turn!
  2. **Bug 2.2 — Starved `played_action` Visits (`packages/analyzer-rust/src/mcts.rs:244, 402-423`)**:
     - `run_mcts_analysis` runs one tree from `root_state` with `UCT_C = 0.45`. If `played_action` loses its first 1 or 2 random rollouts, its `q` drops to `0.00`, so UCT never visits it again (`visits = 1..4` out of `1,000`!).
     - Even worse, if the player placed a wall not in `get_mcts_actions` (which only picks the top 8 blocking walls), `played_action` is **not even in the tree** (`played_q = None`)!
  3. **Bug 2.3 — 20% Random Backward Walks in Rollouts & Naive Leaf Eval (`mcts.rs:342, 365-384`)**:
     - In rollouts (`line 342`), `rng.next_f64() < 0.80` means on 20% of rollout steps, pawns walk in a random direction (including backward!), creating huge rollout variance.
     - And at rollout cutoff (`line 381`), `lead = (opp_dist - my_dist)` ignores **whose turn it is (`±0.5` step tempo)** and **remaining walls (`0.35 * (my_walls - opp_walls)`)**!
  4. **Bug 2.4 — Missing Bar-Flip Guard in [`packages/analyzer-rust/src/classifier.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/classifier.rs#L12-L62)**:
     - `classify_mcts_move` only looked at `delta_q` without checking whether the evaluation bar actually flipped sides or whether the path differential actually worsened!

### Exact Code Changes in `packages/analyzer-rust`

#### Step 2.1 — Fix Adversarial Multi-Player Rewards & Tree Selection (`src/mcts.rs`)
- Change `MctsNode.total_reward: f64` (`mcts.rs:203`) to `rewards: [f64; 4]` (indexed by player index `0..player_count`).
- At leaf evaluation (`mcts.rs:361-385`), compute `reward_vec: [f64; 4]` for all active players:
  - Include **turn tempo**: the player whose turn it is at `sim_state.current_player_index` gets a `+0.5` step tempo credit (`effective_dist = dist - 0.5`).
  - Include **wall reserve**: each remaining wall contributes `-0.30 * phase_factor` to effective distance so strategic walls aren't treated as pure tempo loss.
  - Sigmoid scale: `1.0 / (1.0 + (-effective_lead / 3.5).exp())`.
- In Selection (`mcts.rs:252-281`), let `node_mover = tree[cur_node_idx].mover_idx`. Select the child that maximizes:
  $$Q_{\text{adversarial}} = \frac{\text{child.rewards}[\text{node\_mover}]}{\text{child.visits}}$$
  Now at depth 1 (opponent's turn), the opponent picks the move that maximizes **the opponent's** win probability!

#### Step 2.2 — Guarantee Accurate Evaluation of `played_action` (`src/mcts.rs` & `src/review.rs`)
- In `run_mcts_analysis` (`mcts.rs:213-433`):
  1. Ensure `played_action` is **always inserted** into `initial_actions` at the root if it is not already present (`if !initial_actions.contains(played_action) { initial_actions.push(played_action.clone()); }`).
  2. Instead of relying on however many visits UCT happens to give `played_action`, allocate **dedicated simulations**:
     - Run `700` adversarial MCTS simulations from `root_state` to find `best_action` and `best_q` (ensuring `best_action` has $\ge 100$ visits).
     - If `played_action == best_action`, then `played_q = best_q` (`delta_q = 0.0` $\rightarrow$ **`BEST`**!).
     - If `played_action != best_action` and `played_child.visits < 80`, run **`250` dedicated adversarial MCTS simulations directly rooted at `state_after_played`** (where it is the opponent's turn, so `played_q = 1.0 - opponent_best_q`)!
     - This completely eliminates 1-visit `0.000` / `0.250` noise on `played_action`!

#### Step 2.3 — Calibrate `classify_mcts_move` with a True Bar-Flip Blunder Guard (`src/classifier.rs`)
- Update `classify_mcts_move(best_q, played_q, net_step_loss, forced)` in [`packages/analyzer-rust/src/classifier.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/classifier.rs):
  - Compute `delta_q = (best_q - played_q).max(0.0)`.
  - **What is a `BLUNDER`?**
    A move is classified as `MoveAssessment::Blunder` **ONLY** when:
    1. **The Bar Flips to the Other Side (or Collapses):** `best_q >= 0.45` (player was winning or equal before the move) AND `played_q <= 0.28` (after the move, the opponent now dominates the bar with $\ge 72\%$ win probability) AND `delta_q >= 0.25`; **OR**
    2. **Catastrophic Path/Mate Blunder:** `delta_q >= 0.35` (a massive $\ge 35\%$ true adversarial win-chance collapse, such as failing to block an opponent 1 step from goal or walking into a multi-step box trap where `net_step_loss >= 3`).
  - **If `delta_q` is large on a move that does NOT flip the bar** (e.g., player goes from `0.78` to `0.56` — still ahead, or from `0.52` to `0.40` — a 1-step tempo inaccuracy):
    - Grade it as **`GOOD`** (`delta_q <= 0.08`), **`INACCURACY`** (`delta_q <= 0.16`), or **`MISTAKE`** (`delta_q <= 0.26` or non-flipping swing) — **never `BLUNDER`**!

#### Step 2.4 — Fix 3P/4P Goal Completion in `src/rules.rs` & Rebuild Native Addon
- In [`packages/analyzer-rust/src/rules.rs:122-128`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/rules.rs#L122-L128): When a player's `Move { to }` lands on `is_goal_cell(*to, goal_direction, &state.mode)`, mark `next.players[mover_idx].status = "FINISHED"` and set `winner_id` if first to finish.
- Rebuild `duoorb-analyzer.node` via `cargo build --release` + `node scripts/copy-binary.js` and verify with `tests/binding.test.js` and our 30-move game test!

---

# PHASE 3: AI Off-Main-Thread Execution, Clock Fix, 3-Star Bot Mastery & Bot Playstyle/Variety Overhaul

### Goal
1. Stop the game from lagging and stop the clock from freezing when the AI thinks by moving AI computation off the main thread (Web Worker on Web + Native Rust / `<5ms` micro-sliced async on Mobile) and fixing the clock to use real `Date.now()` timestamps.
2. Widen the **Bot Difficulty Gap** so Easy bots are genuinely easy for beginners while Top bots run deep PUCT MCTS.
3. Give every bot a **Distinct Playstyle & Non-Repeating Move Variety** (removing the `shouldSprint` override bug that forced all bots to play identical moves), **add new bots** with unique tactical archetypes, and add a **3-Star Victory Rating System (`⭐⭐⭐`)** when beating bots.

### Step 3.1 — Fix the Game Clock Freezing During AI Thinking (`GameScreen.tsx`)
- **File:** [`apps/mobile/src/screens/GameScreen.tsx:769-786`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L769-L786)
- **Root Cause:** Currently `setInterval(..., 1000)` subtracts `1` second whenever the JS event loop ticks, and does not track `Date.now()` or reset on turn changes.
- **Exact Fix:**
  - Store `remainingMsRef = useRef<Record<string, number>>({})` (initialized to `timeControl.initialSeconds * 1000`) and `lastTickMsRef = useRef<number>(Date.now())`.
  - Run a lightweight `200ms` interval that computes `const now = Date.now(); const elapsed = now - lastTickMsRef.current; lastTickMsRef.current = now;` and subtracts `elapsed` from the active player's `remainingMsRef.current[activeId]`, updating `timers` state (`Math.ceil(remainingMs / 1000)`) only when the displayed integer second changes!
  - Whenever a turn changes (human move or AI move applied), immediately deduct the exact `Date.now() - lastTickMsRef.current` elapsed ms from the player who just moved and add `incrementSeconds * 1000`!
  - Also fix line `813` (`isBlitzMatch`): only treat `minutes < 3` or `'bullet'` as ultra-fast `250ms` cap so standard `3+0` games let bots use their proper thinking budget.

### Step 3.2 — Off-Main-Thread AI Execution (Web Worker + Rust Native + `<5ms` Frame-Budgeted Fallback)
1. **Frame-Budgeted Micro-Slicing in [`packages/game-core/src/mcts.ts:597-616`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts#L597-L616)**:
   - Currently `CHUNK_SIZE = 150` blocks the JS thread for 100ms–400ms per chunk, and `createMctsSession` runs root expansion synchronously before yielding.
   - Change `mctsBestActionAsync` so that:
     - It yields once before root expansion if needed.
     - Instead of a fixed 150-sim count, each slice runs a tight `while (i < sims && performance.now() - sliceStart < 4.5)` loop (max **`4.5ms` per slice**, leaving `12ms` out of every `16.6ms` frame free for 60 FPS animations, clock ticks, and touch gestures!).
2. **Dedicated Web Worker for Web / PWA (`apps/mobile/src/ai/aiWorkerClient.ts`)**:
   - On `Platform.OS === 'web'`, spawn a dedicated `Worker` (using a self-contained Blob/module worker bundling the MCTS engine or WASM binary) so 100% of AI search runs on a separate OS thread.
3. **Rust Engine AI Endpoint (`packages/analyzer-rust/src/mcts.rs` & `lib.rs`)**:
   - Export `choose_ai_move_sync(state_json, options_json)` and `choose_ai_move_async(state_json, options_json)` in `packages/analyzer-rust/src/lib.rs` so the Rust bitboard MCTS engine can compute bot moves in `<30ms` for 5,000+ simulations.

### Step 3.3 — Fix "All Bots Think the Same & Repeat Identical Moves" + Widen Bot Difficulty Gap
- **Files:**
  - [`packages/game-core/src/mcts.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts)
  - [`packages/game-core/src/ai/engine.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/engine.ts)
  - [`packages/game-core/src/ai/types.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/types.ts)
  - [`packages/game-core/src/ai/personalities.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/personalities.ts)

1. **Remove the Global `shouldSprint` Override Bug (`mcts.ts:284-288, 534-556`)**:
   - Currently, `isLeadingRace = myDist <= minFoeDist` sets `shouldSprint = true` for **all bots** whenever tied or ahead in distance, crushing `wallProb` to `0.05` and forcing every bot to walk straight down column 4!
   - **Fix:** Only set `shouldSprint = true` when `foe.wallsRemaining === 0 && myDist < minFoeDist` (a mathematically pure no-wall race conversion) OR when a bot's explicit archetype is `'sprinter'`. Respect each bot's `wallMoveProb` and `blockMoveProb` on all normal turns!

2. **Eliminate Deterministic Move Repetition (`engine.ts:325` & `mcts.ts:527-578`)**:
   - **Bug:** `engine.ts:325` passed `positionSeed(state, currentPlayer.index)` whenever `profile.randomness <= 0`, and `mcts.ts:528` picked `child.visits > best.visits` in deterministic order (`UP/DOWN` always first).
   - **Fix:**
     - Always mix a per-match/per-turn entropy salt into the live game MCTS seed (`randomSeed` is only fixed when explicitly passed by unit tests!).
     - Shuffle equal-distance pawn moves before expansion so Left/Right/Straight paths with equal distance or within `softmaxTemp` get explored with variety.
     - In `finalize()` (`mcts.ts:527`): among root moves whose win-rate $Q$ is within the bot's **`varietyWindow`** (e.g. within `1.5%` win probability for Master bots, `4%` for Intermediate bots, `12%` for Beginner bots), sample using **Softmax temperature (`softmaxTemp`)** instead of deterministic `argmax`! Even Grandmaster bots will vary between equally strong opening marches, side-steps, and wall setups every match!

3. **Wire True Playstyle Archetypes & Wall Geometry Biases into `MctsOptions`**:
   Add these personality parameters to `AIProfile` and `MctsOptions`:
   - `blunderRate?: number`: Probability of picking a suboptimal 2nd/3rd move or sideways step (`0.40` for Martin 800, `0.28` for Easy, `0.15` for Elena, `0.0` for Hard/Masters).
   - `missDefenseProb?: number`: Probability of overlooking an opponent's 1-step goal threat (`0.45` for Martin, `0.30` for Easy, `0.15` for Elena, `0.0` for Intermediate/Master).
   - `naiveWallProb?: number`: Probability of placing a simple 1-step frontal wall without checking if the opponent can easily walk around it (`0.45` for Martin, `0.30` for Easy).
   - `wallStyle?: 'balanced' | 'horizontal_barricade' | 'vertical_corridor' | 'defensive_backwall' | 'flank_trap' | 'minimal'`:
     - Gives each bot a signature geometric preference when expanding candidate walls!
   - `openingStyle?: 'center_march' | 'wing_drift' | 'early_fence' | 'back_gate' | 'mixed'`:
     - Gives each bot a distinct opening personality on moves 1–4!
   - **PUCT Heuristic Priors + `selfCost` Wall Pruning (`mcts.ts:82-197, 310-349`)**:
     - Never expand self-blocking walls where `myDistAfter - myDistBefore >= oppDistAfter - oppDistBefore` (unless `naiveWallProb` triggers for a beginner bot).
     - Incorporate `jumpTrapPenalty` and `repetitionPenalty` into root move selection so top bots never oscillate or jump into a box trap, and raise top-bot simulation counts (`Marcus` 8,000, `Viktor` 14,000, `Achref` 25,000).

4. **Expand the Bot Roster with New Distinct Personalities (`personalities.ts`)**:
   Expand `BOT_ROSTER` from 7 to **10 distinct bots** across the ELO ladder so players experience completely different strategies:

| # | Bot | ELO | Tier | Signature Archetype & How They Play |
| :- | :--- | :-: | :--- | :--- |
| 1 | **Martin** (*The Friendly Dad*) | `800` | Beginner | `blunderRate: 0.40`, `missDefenseProb: 0.45`, `naiveWallProb: 0.45`. Walks casually, often steps sideways, places simple avoidable walls, and frequently misses 1-step blocks. |
| 2 | **Pip** (*The Curious Sprinter*) — **NEW** | `950` | Beginner | `wallMoveProb: 0.08`, `openingStyle: 'wing_drift'`, `blunderRate: 0.30`. Almost never places walls—just races wildly down the left or right flank trying to jump over you! |
| 3 | **Elena** (*The Eager Student*) | `1100` | Beginner | `openingStyle: 'early_fence'`, `blunderRate: 0.18`, `missDefenseProb: 0.18`. Loves testing early opening walls on turns 2–4, but misses multi-wall counter-traps. |
| 4 | **Bram** (*The Bricklayer*) — **NEW** | `1300` | Intermediate | `wallMoveProb: 0.60`, `wallStyle: 'horizontal_barricade'`, `blunderRate: 0.10`. Obsessed with building wide horizontal walls across the middle of the board early, often running out of walls in the endgame! |
| 5 | **Nelson** (*The Aggressive Challenger*) | `1450` | Intermediate | `wallMoveProb: 0.48`, `blockMoveProb: 0.75`, `openingStyle: 'center_march'`. Charges straight at you to force face-to-face jump tactics and drops walls right in front of your nose. |
| 6 | **Vex** (*The Maze Trickster*) — **NEW** | `1550` | Intermediate | `wallStyle: 'vertical_corridor'`, `openingStyle: 'wing_drift'`, `softmaxTemp: 0.35`. Builds vertical side-corridors and diagonal jump traps to confuse standard center-march players. |
| 7 | **Sofia** (*The Calm Competitor*) | `1650` | Intermediate | `wallMoveProb: 0.25`, `wallStyle: 'defensive_backwall'`, `openingStyle: 'back_gate'`. Conserves walls patiently, protects her own highway with defensive back-walls, and wins on endgame wall parity. |
| 8 | **Marcus** (*The Seasoned Master*) | `1900` | Master | `simulations: 8000`, `wallStyle: 'flank_trap'`, `blunderRate: 0`. Builds multi-wall wing pinches and punishes wasted walls ruthlessly. |
| 9 | **Viktor** (*The Master Analyst*) | `2100` | Master | `simulations: 14000`, `wallStyle: 'balanced'`, `blunderRate: 0`. Deep PUCT calculation, exact step-counting, zero wasted tempo. |
| 10 | **Achref** (*The System Architect*) | `2400` | Master | `simulations: 25000`, full board horizon, PUCT + trap solver + endgame solver + dynamic opening mix. The ultimate boss challenge. |

### Step 3.4 — Implement the 3-Star Bot Mastery System (`⭐⭐⭐`)
1. **Create Bot Stars Storage (`apps/mobile/src/storage/gameStorage.ts`)**:
   - Key: `@duoorb:bot_stars:v1` storing `Record<string, { stars: 1 | 2 | 3; wins: number; bestMoves: number }>` keyed by `botId` (e.g. `'martin'`, `'pip'`, ..., `'achref'`, plus `'easy'`, `'normal'`, `'hard'`).
2. **How Stars Are Calculated on Bot Victory (`computeBotWinStars`)**:
   When the human wins an AI match (`type === 'ai'` and `state.winnerId === humanPlayer.id`):
   - ⭐ **1 Star (Victory):** Defeated the bot!
   - ⭐⭐ **2 Stars (Clean Win):** Defeated the bot with **0 Undos used** (`undosUsed === 0`) AND won with opponent at least **2 steps away from goal** (`oppDist >= 2`) or with $\ge 1$ wall remaining.
   - ⭐⭐⭐ **3 Stars (Grandmaster Mastery):** Defeated the bot with **0 Undos used** (`undosUsed === 0`) AND won decisively: **`oppDist >= 3`** (or won in $\le 22$ moves / with $\ge 3$ walls remaining)!
   - Always save `Math.max(previousStars, earnedStars)` so a player never loses stars they already earned.
3. **Where the 3 Stars Are Displayed**:
   - **`MatchSetupScreen.tsx` (Bot Roster Cards & Selected Bot Banner):**
     - On every bot card, display a 3-star badge (`★★★` in gold `#D9A62E` for earned stars, muted outline `☆☆☆` for unearned stars) + total progress counter (`e.g. 18 / 30 ★`) at the top of the Bot section!
   - **`GameOverModal.tsx` (Victory Screen vs AI):**
     - When `type === 'ai'` and `userWon` is true, render a prominent **3-Star Mastery Row** above the stats showing the 1, 2, or 3 stars earned in this match + criteria hint for the next star (e.g. *"Win by 3+ steps without Undo for ★★★"*).

---

# PHASE 4: Offline Premium Fix, Unified AI + Online History & Replay/Review Bugs

### Step 4.1 — Fix Premium Not Staying Active Offline (`session.tsx`, `premium.ts`, `offers.ts`, `GameReviewScreen.tsx`)
1. **[`apps/mobile/src/network/session.tsx:161-186`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/network/session.tsx#L161-L186):**
   - Before constructing `nextIdentity` for a Supabase-authenticated user, load `const cachedIdentity = await loadIdentity();`.
   - Preserve `username: (cachedIdentity?.userId === u.id ? cachedIdentity.username : '') || ''` and `displayName: (cachedIdentity?.userId === u.id ? cachedIdentity.displayName : '') || ...`.
   - At lines `181-186`: When `!serverNames && isRetryable(profileError)` (i.e. device booted offline!), if `nextIdentity.username` is already present from cache, **do NOT return early with `setBootError`**! Instead, call `setStatus('ready')` so Google-signed-in Premium users boot smoothly into the app offline with their cached `@duoorb:premium:v1` state!
2. **[`apps/mobile/src/monetization/offers.ts:184, 221`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/offers.ts#L184) & [`premium.ts:39-59`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/monetization/premium.ts#L39-L59):**
   - In `offers.ts:184` and `221`: Immediately call `await ingestMe({ isPremium: true, premiumUntil: info.entitlements.active[PREMIUM_ENTITLEMENT]?.expirationDate ?? null })` as soon as `hasActivePremiumEntitlement(info)` is true, before polling the server.
   - In `premium.ts:39-59`: Extend `OFFLINE_GRACE_MS` to 30 days when `raw.premiumUntil` is in the future (`Date.parse(raw.premiumUntil) > now`).
3. **[`apps/mobile/src/screens/GameReviewScreen.tsx:291-312`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx#L291-L312):**
   - When `api.requestGameReview` throws a network/offline error, instead of leaving `review = null` on an infinite loading spinner, compute a local on-device fallback review in TS (`computeLocalFallbackReview(safeInitial, history)`) using `@duoorb/game-core`'s MCTS engine so Premium users can review games 100% offline!

### Step 4.2 — Save & Merge AI History with Online Matches in `HistoryScreen.tsx`
1. **[`apps/mobile/src/storage/gameStorage.ts:5-24`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/storage/gameStorage.ts#L5-L24):**
   - Add `botId?: string | null`, `botName?: string | null`, `botRating?: number | null`, `timeControlMinutes?: number`, `incrementSeconds?: number`, `endedReason?: string`, and `perspectivePlayerId?: string | null` to `SavedGameRecord`.
2. **[`apps/mobile/src/screens/GameScreen.tsx:913-944`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L913-L944):**
   - Populate `botId`, `botName: activeBot?.name`, `botRating: activeBot?.elo`, `timeControlMinutes`, `incrementSeconds`, and `endedReason` when calling `saveGameToHistory(record)`.
3. **[`apps/mobile/src/screens/HistoryScreen.tsx:89-193`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx#L89-L193):**
   - Convert all local AI & Pass-and-Play games (`savedLocal.filter(lg => lg.type !== 'online')`) into `GameHistoryItemDto[]` using the human player's seat (`mySeatId = lg.myPlayerId ?? 'p1'`) to compute `WIN / LOSS / DRAW` and displaying the bot's real name (`lg.botName ?? "AI"`) and rating (`lg.botRating`).
   - **Always merge** `[...(serverRes?.games ?? []), ...localDtos]` (deduplicated by `gameId`) and sort by `new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()` in both `fetchHistory` and `loadMore`!

### Step 4.3 — Fix Replay & Analysis Perspective, Board Flip & `(You)` Label Bugs
1. **[`apps/mobile/src/screens/HistoryScreen.tsx:225-255`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx#L225-L255) (`resolveRecord`):**
   - When building `SavedGameRecord` from `api.getGameReplay(gameItem.gameId)`:
     - Find the current user in `replay.players` via `identity?.userId` (or the player whose `userId !== gameItem.opponent?.userId`).
     - Set `myPlayerId = initialState.players[myEntry.playerIndex]?.id ?? 'p1'`.
     - Copy player display names & ratings from `replay.players` into `initialState.players`.
2. **[`apps/mobile/src/screens/PlayerProfileScreen.tsx:331-369`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/PlayerProfileScreen.tsx#L331-L369) (`resolveRecord`):**
   - Check if `identity?.userId` is in `replay.players`:
     - If **yes** (the logged-in user played in this match): set `myPlayerId` to the logged-in user's seat ID (`'p1'` or `'p2'`).
     - If **no** (the user is viewing a match played between the profile owner and a 3rd player): set `myPlayerId: null` and `perspectivePlayerId` to the profile owner's seat ID!
3. **[`apps/mobile/App.tsx:130-138, 752-811`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx#L752-L811):**
   - Add `isViewerSeated?: boolean` to `ReplayData`.
   - In `handleSelectGameFromHistory` (`line 763`) and `handleAnalyzeGameFromHistory` (`line 800`), replace hardcoded `perspectiveIdx: 0` with:
     ```ts
     const targetSeatId = record.myPlayerId ?? record.perspectivePlayerId ?? 'p1';
     const resolvedIdx = record.initialState.players.findIndex((p) => p.id === targetSeatId);
     const perspectiveIdx = resolvedIdx >= 0 ? resolvedIdx : 0;
     const isViewerSeated = record.myPlayerId != null;
     ```
4. **[`apps/mobile/src/screens/GameReviewScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx):**
   - Accept `isViewerSeated = true` prop.
   - **Line 349 (`flip`):** Set initial flip to `1` (`180deg`) whenever `initialState.players[perspectiveIdx]?.goalDirection === 'DOWN' || perspectiveIdx === 1`, so if the user played Red (`p2`), the Red orb starts at the bottom of the board!
   - **Lines 635–636 (`userPlayer` & `opponentPlayer`):**
     ```ts
     const bottomIdx = perspectiveIdx >= 0 && perspectiveIdx < currentState.players.length ? perspectiveIdx : 0;
     const topIdx = bottomIdx === 0 ? Math.min(1, currentState.players.length - 1) : 0;
     const userPlayer = currentState.players[bottomIdx] || currentState.players[0];
     const opponentPlayer = currentState.players[topIdx] || currentState.players[0];
     ```
     Now the bottom HUD card always shows the player whose orb is at the bottom of the board, and the top HUD card always shows the opponent at the top of the board!
   - **Lines 753 & 1054 (`(You)` label):** Only append `{t('gameover.you')}` when `isViewerSeated === true`! When viewing a match between two other players from `PlayerProfileScreen`, neither player says `(You)`.

### Step 4.4 — Add "Review Match" & "New Game" Buttons to Match-End Replay Bar (`GameScreen.tsx`)
- **File:** [`apps/mobile/src/screens/GameScreen.tsx:2048-2121`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L2048-L2121)
- Inside `styles.replayBar`, directly below `styles.replayRow`, add `styles.replayActionsRow` with:
  1. **"Review Match" (`handleAnalyzePress`)**: Primary button with `bar-chart-2` icon + `{t('gameover.analyze')}`.
  2. **"New Game" (`onNewGame ?? handleRematch`)**: Secondary button with `play` icon + `{t('gameover.newGame')}`.
  3. **"Match Summary" (`() => setShowGameOver(true)`)**: Re-opens `GameOverModal`.

---

# PHASE 5: Bot Avatars, Compact Speech Bubble, Home Layout & Premium Crown Everywhere

### Step 5.1 — Support Custom Bot Avatar Images (`BotAvatar.tsx`)
- **File:** [`apps/mobile/src/components/BotAvatar.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotAvatar.tsx)
- Add `BOT_AVATAR_IMAGES` mapping for `apps/mobile/assets/bots/{martin,pip,elena,bram,nelson,vex,sofia,marcus,viktor,achref}.png` (rendering `<Image resizeMode="cover" />` when the image asset is present, and cleanly falling back to the styled SVG portrait until each image file is dropped into `assets/bots/`).

### Step 5.2 — Make `BotSpeechBubble` Compact & Position Above Top Bar (`BotSpeechBubble.tsx` & `GameScreen.tsx`)
- **Files:** [`apps/mobile/src/components/BotSpeechBubble.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotSpeechBubble.tsx) and [`apps/mobile/src/screens/GameScreen.tsx:1876-1926`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L1876-L1926)
- **Fix:**
  - Move `<BotSpeechBubble />` so it renders inside the empty right/center area of the `56px` top header bar (`styles.header`, `left: 52, right: 12, top: 8`) directly **above** the bot's `PlayerStrip` card, with a small pointer triangle pointing down at the bot's avatar.
  - Remove the redundant `botLabel` line inside `BotSpeechBubble.tsx`, reduce padding (`paddingVertical: 5, paddingHorizontal: 10`), set `fontSize: 11.5`, and cap to `numberOfLines={2}` so it never overlaps the bot's HUD card or board.

### Step 5.3 — Move Home Ad Banner to Middle & Reduce Native Mobile `BottomNav` Gap
1. **[`apps/mobile/src/screens/HomeScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HomeScreen.tsx):**
   - Move `<AdBanner placement="home" />` from line `144` (top of `ScrollView`) to line `269` — directly **below** `</View>` of `styles.modeGrid` (the 4 modes) and directly **above** `<View style={styles.journeyCard}>` (Journey mode).
2. **[`apps/mobile/src/components/BottomNav.tsx:42`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BottomNav.tsx#L42):**
   - Because `App.tsx:880` already wraps the app in `<SafeAreaView edges={['top', 'bottom']}>`, change `{ bottom: bottomInset + 20 }` to:
     ```tsx
     <View style={[styles.container, { bottom: Platform.OS === 'web' ? bottomInset + 20 : 6 }]}>
     ```
     This eliminates the double safe-area gap on native Android/iOS while leaving Web unchanged.

### Step 5.4 — Add Premium Crown (`<PremiumBadge />`) to All 11 Missing Locations
1. **Backend (`apps/server` & `packages/protocol`):**
   - [`users.service.ts:367-377`](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/users/users.service.ts#L367-L377) (`searchUsers`): include `isPremium`.
   - [`friends.service.ts:81-96, 170`](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/friends/friends.service.ts#L81-L96) (`getRequests` & `sendRequest`): include `isPremium`.
   - [`history.service.ts:86, 156`](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/history/history.service.ts#L86) (`getUserHistory` & `getGameReplay`): include `isPremium` on `opponent` and `replay.players`.
   - [`packages/protocol/src/index.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/protocol/src/index.ts) & [`game.gateway.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/gateway/game.gateway.ts): include `isPremium` on `RoomSlot`, `matchmaking:matched` seats, `RoomInviteDto`, and `ChallengeDto`.
2. **Frontend (`apps/mobile`):**
   - Render `<PremiumBadge />` in:
     1. [`LeaderboardScreen.tsx:78`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/LeaderboardScreen.tsx#L78) (Top 3 Podium names)
     2. [`FriendsScreen.tsx:456, 648`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/FriendsScreen.tsx#L456) (Incoming Friend Requests & Add-Friend Search modal)
     3. [`HistoryScreen.tsx:346`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx#L346) (Match history rows)
     4. [`PlayerProfileScreen.tsx:841`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/PlayerProfileScreen.tsx#L841) (Recent match rows)
     5. [`MatchResultModal.tsx:72`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/MatchResultModal.tsx#L72) (Match detail modal opponent name)
     6. [`GameReviewScreen.tsx:686, 753, 987, 1054`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx#L686) (Replay & Review top/bottom HUD player cards)
     7. [`OnlineScreen.tsx:582, 647, 681, 914, 1253`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/OnlineScreen.tsx#L647) (Matchmaking cards, Private Room slots, Quick-Add Friends modal)
     8. [`ChallengeToast.tsx:88`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/ChallengeToast.tsx#L88) & [`RoomInviteToast.tsx:24`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/RoomInviteToast.tsx#L24)

---

# PHASE 6: Web AdSense Crawler Fix & Custom PWA / Google Play Install Modal (No Web Subscriptions)

### Step 6.1 — Fix Web AdSense Crawler Blockers (`public/index.html` & `adsNative.web.ts`)
- **Keep Web/PWA 100% free without subscriptions** (as requested).
- In [`apps/mobile/public/index.html`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/index.html):
  1. Allow normal document scrolling when the editorial landing page `#duoorb-home` is visible (`body:not(.duoorb-playing) { overflow-y: auto; height: auto; }`) and add a CSS auto-fade fallback on `#duoorb-splash` so Google's AdSense Mediapartners crawler can crawl the full page layout without getting blocked by a fixed splash overlay.
  2. Define `window.adBreak = window.adConfig = function(o) { adsbygoogle.push(o); };` so `adsNative.web.ts` can trigger H5 game interstitials & rewarded ads once AdSense approves the domain.

### Step 6.2 — Standalone PWA Launch & Service Worker (`public/manifest.json` & `public/sw.js`)
1. In [`apps/mobile/public/manifest.json:5`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/manifest.json#L5): Set `"start_url": "/?play=1"`.
2. In [`apps/mobile/public/index.html:792`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/index.html#L792): Auto-call `showGame()` when `window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true` so installed PWA users open straight into the game!
3. Create [`apps/mobile/public/sw.js`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/public/sw.js) and register it in `public/index.html`, plus capture `window.__duoorbDeferredPrompt` on `beforeinstallprompt`.

### Step 6.3 — Build Custom Install Prompt Modal (`InstallPromptModal.tsx`)
- Create [`apps/mobile/src/components/InstallPromptModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/InstallPromptModal.tsx) and mount it in `App.tsx` (Web-only, hidden when already running in `standalone` mode or during an active match, with a 7-day dismissal cooldown in `AsyncStorage`):
  - **On iOS (iPhone / iPad):** Custom visual card encouraging the player to install DuoOrb as a full-screen app (**1. Tap Safari Share icon $\rightarrow$ 2. Tap "Add to Home Screen"**).
  - **On Android Browser:** Featured primary CTA card to **Install DuoOrb from Google Play Store** (`https://play.google.com/store/apps/details?id=com.asdigital.duoorb`) + secondary one-tap **"Install Instant Web App"** button (`deferredPrompt.prompt()`).
  - **On Desktop Browser:** One-tap **"Install Web App"** button (`deferredPrompt.prompt()`) + Google Play link.
