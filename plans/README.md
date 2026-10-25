# DuoOrb — Closed Test Master Implementation Plans (By Phase)

This directory contains the detailed, step-by-step engineering implementation plans for each of the 6 phases required before DuoOrb's Google Play production release.

---

## Phase Overview & Execution Order

| Phase | Plan File | Status | Core Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | [`PHASE_1_ADMOB_SMART_PACING_AND_UNDO.md`](./PHASE_1_ADMOB_SMART_PACING_AND_UNDO.md) | **Complete & Verified** | Fix AdMob video ads not showing (`app.json` Android/iOS IDs + preloaded `InterstitialAd` / `RewardedAd` instances), build the **App-Wide Smart Ad Pacing Engine** (`adPacingEngine.ts`) across all modes/rooms (with **never on Rematch** and tilt protection), replace `GameOverModal` banner with video ad integration, and add **Offline "+3 Undos via Rewarded Video Ad"** in `GameScreen.tsx`. |
| **Phase 2** | [`PHASE_2_RUST_ANALYSIS_BLUNDER_FIX.md`](./PHASE_2_RUST_ANALYSIS_BLUNDER_FIX.md) | **Complete & Verified** | Fix the backend Rust analyzer (`packages/analyzer-rust`) where almost every non-best move was marked as `BLUNDER` due to the 10-ply random rollout scaling mismatch (`±0.036` vs `±0.25`) and lack of sign-flip checks. Align `packages/game-core/src/analysis.ts` with the same calibrated win-probability delta (`ΔW`) + bar-flip (`evalBefore * evalAfter < 0`) criteria. |
| **Phase 3** | [`PHASE_3_AI_THREADING_BOTS_AND_3_STARS.md`](./PHASE_3_AI_THREADING_BOTS_AND_3_STARS.md) | **Complete & Verified** | Move AI thinking off the main UI thread (Async Time-Sliced MCTS + Web Worker so the game clock and UI never freeze), optimize MCTS with PUCT + RAVE + Zobrist Transposition Table, widen the bot difficulty gap, expand the bot roster to **10 distinct bots** with non-repeating move variety (Dirichlet noise + Softmax temperature + opening book), and implement the **3-Star Bot Mastery System (`⭐⭐⭐`)**. |
| **Phase 4** | [`PHASE_4_OFFLINE_PREMIUM_HISTORY_AND_REPLAY.md`](./PHASE_4_OFFLINE_PREMIUM_HISTORY_AND_REPLAY.md) | **Complete & Verified** | Fix the 3 root causes of Offline Premium failing, unify local AI match history with online server history in `HistoryScreen.tsx`, fix the Replay & Review board orientation / `(You)` label bug when playing as Red or spectating another user's match from `PlayerProfileScreen.tsx`, and add **Review Match / New Game / Summary** buttons to the in-match Replay bar. |
| **Phase 5** | [`PHASE_5_UI_POLISH_BOT_BUBBLE_AND_CROWNS.md`](./PHASE_5_UI_POLISH_BOT_BUBBLE_AND_CROWNS.md) | **Complete & Verified** | Add custom bot avatar image support (`BotAvatar.tsx` with 10 normalized 512×512 square portraits: Martin, Pip, Elias, Bram, Nelson, Vex, Jamal, Marcus, Viktor, Achref), redesign `BotSpeechBubble.tsx` into a compact top-header pill that never covers bot info, move the `HomeScreen` ad banner between the 4 modes and Journey Mode, fix the native mobile bottom nav gap (`BottomNav.tsx`), and render the Premium Crown (`<PremiumBadge />`) across all 11 missing backend/frontend places. |
| **Phase 6** | [`PHASE_6_WEB_ADSENSE_AND_INSTALL_MODAL.md`](./PHASE_6_WEB_ADSENSE_AND_INSTALL_MODAL.md) | **Complete & Verified** | Keep Web/PWA free of subscriptions, fix `public/index.html` crawler layout blockers + wire AdSense H5 Games Ads (`adBreak` / `adConfig`), configure standalone PWA launch (`manifest.json` + `sw.js`), and build the custom `InstallPromptModal.tsx` for iOS ("Add to Home Screen") and Android Web ("Install from Google Play" + PWA prompt). |

---

## Master Plan Reference
- Full architectural context & cross-phase summary: [`../CLOSED_TEST_MASTER_PLAN.md`](../CLOSED_TEST_MASTER_PLAN.md)
