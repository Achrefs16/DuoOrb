# DuoOrb Mobile & Core Engine Quality Audit & Action Plan

**Date**: October 26, 2026  
**Focus**: Mobile Layout, Navigation Flow, Match HUD, AI Behavior, and Review Accuracy

---

## 1. Issues Summary & Root Cause Analysis

### Issue 1: Excessive Bottom Gap & Play Button Overlap on Mobile
- **Symptom**: On mobile devices, there is a large empty gap beneath the bottom navigation bar (`BottomNav`), and the sticky "Play" button in `HomeScreen` and the bottom dock in `BotsScreen` are partially covered by the navbar.
- **Root Cause**: Double-counted safe area insets:
  1. In `App.tsx`, `<SafeAreaView style={chrome.root} edges={['top', 'bottom']}>` already pads the bottom of the screen by `insets.bottom`.
  2. Inside `BottomNav.tsx`, `useSafeAreaInsets().bottom` is added *again* (`height: BOTTOM_NAV_HEIGHT + bottomInset` and `paddingBottom: bottomInset`).
  3. `HomeScreen.tsx` hardcoded `bottom: BOTTOM_NAV_HEIGHT` (58px) and `BotsScreen.tsx` hardcoded `bottom: BOTTOM_NAV_HEIGHT` (58px), completely omitting `insets.bottom`. As a result, the navbar extends 58 + `bottomInset` px upward, directly covering the buttons.
- **Fix**:
  1. `App.tsx`: Set `SafeAreaView` `edges={['top']}` so the app background extends edge-to-edge behind the Android navigation bar.
  2. `BottomNav.tsx`: Retains `paddingBottom: insets.bottom` to ensure tabs stay above the device home indicator.
  3. `HomeScreen.tsx` & `BotsScreen.tsx`: Set `bottom: BOTTOM_NAV_HEIGHT + insets.bottom` on the sticky CTA dock, with matching scroll container padding.

---

### Issue 2: Preview / Review Summary Back Button Navigation
- **Symptom**: On `GameReviewSummaryScreen` (move breakdown & accuracy preview), pressing the Back button does not return to where the user came from (e.g., dumped to Home instead of Bots tab, or broken return).
- **Root Cause**: `handleCloseReview` in `App.tsx` calls `dismissMatchToOrigin()`, which had no condition for `gameConfig.type === 'ai'` and fell through to `dismissTo('PLAY', null)`.
- **Fix**: In `dismissMatchToOrigin()`, route AI games to `dismissTo('BOTS', null)`. For games reviewed from History/Profile, cleanly execute `goBack()` to the originating screen.

---

### Issue 3 & 4: Remove "Long Thinking AI" & "Premoves" from Settings
- **Symptom**: "Long Thinking AI" (`testThink`) was a testing feature that adds unnecessary delay, and "Premoves" (`premoveEnabled`) causes race conditions and UI desyncs.
- **Root Cause**: Legacy debug toggles in `SettingsScreen.tsx`.
- **Fix**: Remove both rows from `SettingsScreen.tsx`. Default `testThink` to `false` and disable premoves cleanly in `GameScreen.tsx`.

---

### Issue 5: Redundant Settings Icon in Match Screen
- **Symptom**: The top header in `GameScreen.tsx` has a gear icon that opens the exact same options modal as the bottom action dock's Options button.
- **Root Cause**: Duplicate trigger in `GameScreen.tsx` lines 2403–2410.
- **Fix**: Remove the top header settings icon to give a clean header with only Back and DuoOrb branding.

---

### Issue 6: Vs Bot Match Back Button Routing
- **Symptom**: Pressing Back in an AI game exits to the Home screen instead of the Bots tab.
- **Root Cause**: `handleCloseMatch` calls `dismissMatchToOrigin()`, which defaulted to `dismissTo('PLAY', null)` when `type === 'ai'`.
- **Fix**: Check `gameConfig.type === 'ai'` in `dismissMatchToOrigin()` and route to `dismissTo('BOTS', null)`.

---

### Issue 7: Multi-Bot Selection in >2P Matches (3P/4P vs Bots)
- **Symptom**: In 3-Player or 4-Player games vs bots, the user plays against duplicate copies of the same bot (e.g. Martin 1, Martin 2).
- **Root Cause**: `BotsScreen.tsx` only allowed selecting a single `selectedBotId`.
- **Fix**:
  1. In `BotsScreen.tsx`: Track `selectedBotIds: string[]` based on `playerCount - 1` (2 bots for 3P, 3 bots for 4P).
  2. Display selection order indicators (e.g. `1/2`, `2/2` or slot badges) on bot cards.
  3. Show all selected bots side-by-side in the top hero avatar bar.
  4. Pass `botIds` array to `onStartGame`.
  5. In `GameScreen.tsx`: Assign each AI seat its own distinct bot personality, name, color, and AI profile.

---

### Issue 8: Match Screen (>2P vs Bots) Top Opponent HUD Layout
- **Symptom**: In >2P bot games, the large speech bubble is crowded and confusing.
- **Root Cause**: 2-player bot speech bubble was still rendering in 3P/4P games.
- **Fix**:
  1. Hide `BotSpeechBubble` whenever `playerCount > 2`.
  2. Display opponents in a horizontal row of vertical columns:
     - Avatar image at top
     - Clock below avatar (if timed)
     - Remaining wall count below clock
     - Turn indicator ring/highlight on active bot

---

### Issue 9: Bot Giving Up / Backward Shuffle When Opponent is Winning
- **Symptom**: When the player is 100% winning, bots give up, stop advancing, and shuffle back and forth.
- **Root Cause**:
  1. In `packages/game-core/src/mcts.ts`, when a position is lost (`bestRate < 0.15`), all legal actions evaluate to ~0 win rate.
  2. The losing-rescue (`march along shortest path`) was gated behind `&& rootMover.wallsRemaining === 0`. If the bot still had walls, the rescue never ran.
  3. `shouldSprint` was disabled in classic 2P when far behind because `isRacingFarBehind` required `isRacing` (only race/center modes).
- **Fix**:
  1. Remove `rootMover.wallsRemaining === 0` restriction on the losing-rescue: if no wall can delay the opponent, march along the shortest path towards the goal!
  2. Disallow candidate selection from picking backward moves when forward moves along the shortest path exist.

---

### Issue 10: Review Accuracy & Move Rating Overhaul
- **Symptom**: In the game review, almost every move is rated 90%+ accuracy and "Best Move", opening moves are all labeled "Great", and jumping over a ball is called "Brilliant".
- **Root Cause**: In `packages/analyzer-rust/src/classifier.rs`:
  1. `commanding_threshold = 0.52 / mode_scale`: Anyone with 52% win rate could never receive worse than "Good" (minimum 88% accuracy).
  2. Opening pawn moves had `gap_to_second >= 0.11` because moving forward beats moving backward, falsely triggering `GREAT`.
  3. Normal pawn jumps had `gap_to_second >= 0.14`, falsely triggering `BRILLIANT`.
- **Fix**:
  1. Opening plies (ply < 6): standard pawn steps are `BEST` or `BOOK`, never `GREAT` or `BRILLIANT`.
  2. `BRILLIANT`: Only for non-obvious multi-ply trap walls or game-swinging tactical deflections. Basic pawn jumps are normal moves.
  3. `GREAT`: Only for critical game-saving wall placements or decisive single-winning moves.
  4. Fix `commanding_threshold` to `0.85` and allow blunders/mistakes even when winning.
  5. Calibrate accuracy scaling so games show realistic, nuanced percentages (e.g. 68%–92%).

---

## 2. Implementation Status & Verification

| Step | Area | Description | Status |
| :--- | :--- | :--- | :--- |
| **1** | Layout & Insets | Fix `App.tsx`, `BottomNav.tsx`, `HomeScreen.tsx`, `BotsScreen.tsx` | ✅ Completed |
| **2** | Settings Cleanup | Remove `testThink` and `premoveEnabled` from `SettingsScreen.tsx` & `GameScreen.tsx` | ✅ Completed |
| **3** | Screen Navigation | Fix Back routing in `dismissMatchToOrigin()` and `GameReviewSummaryScreen.tsx` | ✅ Completed |
| **4** | Multi-Bot Selection | Update `BotsScreen.tsx` and `GameScreen.tsx` for 3P/4P multi-bot picks | ✅ Completed |
| **5** | Match Header & HUD | Remove settings gear icon; build 3P/4P vertical opponent columns; hide speech bubble | ✅ Completed |
| **6** | Core Bot Movement | Fix lost-position forward march in `packages/game-core/src/mcts.ts` | ✅ Completed |
| **7** | Review Classifier | Rebalance move assessments & accuracy in `classifier.rs` and `review.rs` | ✅ Completed |
| **8** | Verification | Run all mobile tests (189 passed), game-core tests (160 passed), rust tests (22 passed), and typecheck | ✅ Verified |
