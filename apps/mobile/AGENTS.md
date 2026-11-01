# DuoOrb Mobile Developer & Agent Guide

> **Target:** `apps/mobile` (`@duoorb/mobile`)  
> **Framework:** Expo ~57, React Native 0.86, React 19, TypeScript  
> **Source of Truth:** Production Codebase

---

## 1. Architecture & Navigation Invariant

> [!CAUTION]
> **DO NOT USE EXPO ROUTER OR `src/app/`**  
> DuoOrb Mobile uses **state-driven screen routing** managed in [`App.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx). Do not create or expect an Expo Router directory (`src/app/`).

### Screen Management
All screens live in [`src/screens/`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/):
- [`HomeScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HomeScreen.tsx) — Main play hub, game modes, journey card, ad banner.
- [`GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx) — Active match board, player HUD cards, clocks, undos, and surrender.
- [`BotsScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/BotsScreen.tsx) — 39 bot personalities roster, 3-star victory mastery.
- [`OnlineScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/OnlineScreen.tsx) — Ranked matchmaking radar and private custom rooms.
- [`GameReviewScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx) — Move-by-move tactical review, win-probability bar, and blunder annotations.
- [`HistoryScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HistoryScreen.tsx) — Unified local offline + online server match history.
- [`ProfileScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/ProfileScreen.tsx) — User stats, cosmetics catalog, and head-to-head records.
- [`FriendsScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/FriendsScreen.tsx), [`SettingsScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/SettingsScreen.tsx), [`TutorialScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/TutorialScreen.tsx).

---

## 2. Design System & Theme Conventions

- All styling is centralized in [`src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts).
- Never hardcode arbitrary hex colors in screen styles. Import `useTheme()` or `PRIMARY_COLOR` from `src/theme.ts`:
  - `theme.colors.primary` — Tactile green `#69B342`
  - `theme.colors.surface`, `theme.colors.background`, `theme.colors.surfaceContainerLowest`
  - `theme.colors.text`, `theme.colors.textMuted`
- Typography: Font family is **Satoshi** (loaded via fonts loader).
- Board Graphics: [`src/components/GameBoard.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameBoard.tsx) renders the native SVG 9×9 grid. Do not alter core board geometry.

---

## 3. High-Performance Engines & Modules

- **AI & Analysis:**
  - Native Android builds load `modules/duoorb-ai-native` (`libduoorb_analyzer.so`).
  - Web & development fallbacks load `public/duoorb_analyzer.wasm` via Web Worker in `src/ai/aiWorker.ts`.
- **SFX Audio:**
  - Multi-voice native audio is handled by `modules/duoorb-sfx` (`SoundPool` on Android, `AVAudioPlayer` on iOS). Use `playSound(name)`.

---

## 4. Monetization & Ads

- **RevenueCat:** Configured in `src/monetization/premium.ts` via `react-native-purchases`.
- **AdMob:** Configured in `src/monetization/realAds.ts` and `src/monetization/interstitial.ts`.
  - Always obey `adPacingEngine.ts` limits (retention-safe; never show ads on Rematch or rage-quit).
  - Rewarded ads grant **+3 Undos** in offline AI matches.
  - Premium subscribers bypass all ads.

---

## 5. Development Commands

Always run commands from the project root or workspace:

```bash
# Start Expo development server
npm run mobile

# Run tests
npm run test --workspace=@duoorb/mobile

# Run typecheck
npm run typecheck --workspace=@duoorb/mobile

# Lint
npm run lint --workspace=@duoorb/mobile
```
