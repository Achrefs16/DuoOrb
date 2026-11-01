# @duoorb/mobile

The primary frontend client application for DuoOrb, supporting Android, iOS, and Web (PWA) with tactile design, responsive layouts, real-time online play, offline AI matches, post-match analysis, and Google Play billing.

---

## 1. Technologies & Dependencies

- **Framework:** [Expo](https://expo.dev/) (SDK ~57.0.25)
- **Runtime:** React Native 0.86.3, React 19.2.3
- **Graphics & Vectors:** `react-native-svg` (15.15.4), `phosphor-react-native`
- **Native Audio:** `duoorb-sfx` (Expo autolinked native audio module)
- **Native AI Acceleration:** `duoorb-ai-native` (Android JNI module) & `duoorb_analyzer.wasm` (Web/iOS fallback)
- **Networking:** `socket.io-client` 4.8.3, `@supabase/auth-js` 2.117.1
- **Monetization:** `react-native-purchases` (RevenueCat 10.11.0), `react-native-google-mobile-ads` (AdMob 17.2.0)
- **Testing:** `vitest` (3.2.7)

---

## 2. Directory Structure

```
apps/mobile/
├── assets/                  # Icons, splash screens, bot portraits, cosmetic assets
├── public/                  # Web marketing pages, PWA service worker, duoorb_analyzer.wasm
├── src/
│   ├── ai/                  # AI background worker client & slice coordinator
│   ├── analysis/            # Move evaluation loaders, graph calculations, blunder filters
│   ├── audio/               # Audio player wrapper over duoorb-sfx
│   ├── components/          # Reusable UI components (GameBoard, Modals, HUDs, AdBanner)
│   ├── i18n/                # Localization (EN, AR, DE, ES, FR, ID, IT, PL, PT-BR, TR)
│   ├── monetization/        # RevenueCat billing, AdMob interstitial/rewarded, smart pacing
│   ├── network/             # Socket.IO connection manager, reconnect grace, REST API
│   ├── screens/             # Application screen views
│   ├── storage/             # AsyncStorage wrappers (match history, bot mastery, settings)
│   └── theme/               # Centralized theme tokens, cosmetics catalog, orb palettes
├── App.tsx                  # Root component, state-based screen navigator, global providers
├── app.json                 # Expo project configuration and native build plugins
└── package.json
```

---

## 3. Screen Routing

DuoOrb uses **state-driven screen routing** managed in `App.tsx`:
- `home`: Play hub with game mode selector, quick match button, and active ad banners.
- `game`: Active board view for offline AI, local pass-and-play, and live online matches.
- `bots`: Roster of 39 distinct AI personalities with 3-star victory ratings.
- `online`: Real-time ranked matchmaking radar and 6-letter private room lobbies.
- `review`: Post-match tactical analysis with move scrubber and win probability graph.
- `reviewSummary`: High-level match performance card with accuracy score.
- `history`: Combined local offline and online server game history.
- `profile`: User statistics, head-to-head records, and cosmetics inventory.
- `friends`: Friend list, search, presence indicators, and direct challenges.
- `settings`: Audio toggles, language picker, account controls, and legal terms.

---

## 4. Development & Build Scripts

```bash
# Start Metro bundler (interactive QR code)
npm run start --workspace=@duoorb/mobile

# Run in Android emulator or connected device
npm run android --workspace=@duoorb/mobile

# Run in iOS simulator (macOS required)
npm run ios --workspace=@duoorb/mobile

# Start web development server
npm run web --workspace=@duoorb/mobile

# Run test suite
npm run test --workspace=@duoorb/mobile

# Run TypeScript typecheck
npm run typecheck --workspace=@duoorb/mobile
```
