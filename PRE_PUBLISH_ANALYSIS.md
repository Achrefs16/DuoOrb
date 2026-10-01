# DuoOrb - Full Pre-Publish Analysis - DO NOT PUBLISH YET

> Generated: 2026-10-01
> Scope: read-only audit, no code changed
> App: DuoOrb tactical orb board game - Expo SDK 57.0.25 / RN 0.86.3 / React 19.2.3 + NestJS + Prisma + Postgres + Supabase Auth + Socket.IO + Glicko-2
> Package: `com.duoorb.mobile`, version `1.0.0`, portrait

**Verdict: NOT READY for Google Play Production. You will be rejected 100% if you submit now.**

You have **5 automatic rejection blockers + 3 high-risk uninstall triggers + 1 critical build-breaker** that makes the app dead on real phones.

Custom navigator in `App.tsx` (NOT Expo Router), guest-first, no IAP, no ads, no chat (only emoji reactions).

---

## PART 1: Google Play Console Conditions 2026 - What You Must Have

Researched from live Play Help + Developer docs. As of Oct 2026:

### 1.1 Account + Identity

1. `$25 one-time` fee, Personal vs Organization.
2. Personal = gov ID verification, fast. Organization = D-U-N-S + 1-4 weeks verification.
3. **New Personal accounts created after Nov 13, 2023:** Production + Pre-registration buttons are **disabled** until you pass Closed Test.
4. Android Developer Verification 2026: package name `com.duoorb.mobile` must be registered to your verified identity. For new apps this is automatic on Create App because you use Play App Signing. Don't sideload same package elsewhere first.

### 1.2 Technical gates - upload will be blocked if you miss

1. **Target API 36 (Android 16) mandatory since Aug 31, 2026** for new apps + updates. Phones/tablets must target 36+. Extension to Nov 1, 2026 only on request. Your Expo SDK 57 defaults to 36 - good, but you must verify in Play Console after `eas build`, do not assume.
2. **AAB only, no APK** for new apps. Must be signed + Play App Signing enrolled. Your repo has `android/app/build/outputs/apk/release/app-release.apk` committed - **never upload this**. Use `eas build --platform android --profile production`.
3. 64-bit, `versionCode` increment on every upload. You have `versionCode 1` + `eas.json: autoIncrement:true + appVersionSource:remote` - OK only on EAS, local builds stay at 1.
4. Edge-to-edge enforced on API 35+. You have `edgeToEdgeEnabled=true` - good, but test on API 35/36 gesture + 3-button nav.
5. Pre-launch Report will auto-test on real devices and flag crashes. Fix all crashes before review.

Sources:
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://developer.android.com/google/play/requirements/target-sdk

### 1.3 Store Listing - cannot go live without

`Title 30 chars + Short desc 80 chars + Full desc 4000 chars + Icon 512x512 PNG + Feature Graphic 1024x500 JPG/PNG no-alpha + min 2 screenshots (320px-3840px, max side <=2x min side, up to 8 per device type) + category + content rating + contact email`. Placeholder text / blurry shots = `Minimum Functionality` rejection. Tablet `supportsTablet:true` means you need tablet screenshots.

### 1.4 App Content forms - all mandatory, lies = ban

1. **Privacy Policy URL:** HTTPS, public no-login, must work in incognito. Required in Console AND inside app if you collect anything. Broken link = auto-reject.
2. **Data Safety Form:** mandatory even if you collect 0 data. Must match code + SDKs exactly. You collect `email, user IDs, username/displayName/bio/avatar, game history, rating, IP hash, user-agent, diagnostics`. If you hide one, account ban risk.
3. **Content Rating (IARC):** 5 min questionnaire, determines age badge.
4. **Target Audience + Families/COPPA:** declare age group. If under-13 can install, you need neutral age screen + Families compliance. You have no age gate now.
5. **App Access / Demo credentials:** If login exists, you must give reviewer working login + instructions + QR if needed. Your app is guest-first which helps, but online + friends + history need a demo account with data. No credentials = `couldn't test` rejection.
6. **Ads / Financial / Gambling / Health declarations:** You must declare `No ads, No IAP, No gambling, No real-money`. You are skill-only Glicko-2, good. Declare it.
7. **Permissions declaration:** every sensitive permission needs justification + video sometimes.

### 1.5 Account Deletion Policy - automatic rejection if missing

If app allows account creation (yours does: Guest + Google via Supabase):

1. In-app path to delete account + associated data.
2. External web link where user can request deletion **without reinstalling** (e.g. `https://duoorb.com/delete-account`), linked in Data Safety + visible on store listing.
3. Must delete associated data too, or clearly explain retention for fraud/legal in privacy policy.

Source: https://support.google.com/googleplay/android-developer/answer/13327111

### 1.6 UGC Policy - you ARE in scope

Any app with usernames, display names, bios, avatars, friends, reactions = UGC. Must have:

1. Terms of Use accepted before creating UGC, defining objectionable content.
2. In-app Report for users AND content, clearly labelled.
3. In-app Block for 1:1 interactions (friends, challenges, DMs).
4. Moderation + enforcement in reasonable time. No chat helps you, but profiles/friends still count.

Source: https://support.google.com/googleplay/android-developer/answer/9876937

### 1.7 The 12 testers / 14 days rule

Only for new Personal accounts:
`Closed Testing track with >=12 testers opted-in continuously for 14 days`. They must install via Play opt-in link (not raw APK), keep installed, actually use app daily. Then `Dashboard > Apply for production` + answer 3 sections: About closed test, About app/game, Production readiness + 1-7 days human review. Fake accounts / install-and-forget = fail, must continue testing. Organization accounts skip this but pay D-U-N-S delay.

Timeline realistic: `Console setup 3-6h + Internal testing immediate + Closed 14 days + Production review 1-7 days`.

---

## PART 2: YOUR 5 PLAY BLOCKERS - Will Cause Rejection

### BLOCKER 1: No Privacy Policy + No Terms Anywhere - P0

Grep `privacy|terms|EULA|gdpr|delete.*account` in `apps/mobile/src` = **0 hits**.

- `src/screens/WelcomeScreen.tsx:25` comment literally says `no legal text` + `:36-86` renders no links.
- `src/screens/SettingsScreen.tsx:271-534` has Account, Display Name, Gameplay, Feedback - no Legal section.
- No `privacy*`, `terms*` file in whole repo.
- `app.json`, `eas.json` have no privacy URL.

Play requires URL in Console + in-app link. Data Safety cannot be approved without it.

Fix needed: host `https://yourdomain/privacy` + `/terms` + `/delete-account`, link in Welcome (above Guest/Google buttons, not as blocking checkbox) + Settings Legal section with `Linking.openURL`.

### BLOCKER 2: No Account Deletion - P0

- Server `apps/server/src/users/users.controller.ts:1-83`: only `GET /api/me`, `PATCH /api/me/profile`, `GET /profiles/:id`, `GET /users/*`, `POST /link`. **Zero DELETE.**
- `users.service.ts:1-479`: no `deleteUser()`. `linkGuest():350-478` deletes guest row on merge only.
- `auth.service.ts:92-174` only upserts, never deletes Supabase Auth user.
- Mobile `src/network/session.tsx:316-327` `signOut()` only clears local + socket + onboarding.
- `src/network/apiClient.ts:391-620` has `DELETE /friends/:id` but no `DELETE /me`.
- `SettingsScreen.tsx:328-332` only Sign out.

You have cascade deletes in `prisma/schema.prisma:10-37` but no endpoint to trigger them. Play + Apple will reject.

Fix needed: `DELETE /api/me` + Supabase Auth Admin delete + Settings Delete button + local wipe + web deletion URL.

### BLOCKER 3: UGC Without Report/Block/Filter - P0

Good: **No chat**. `src/gateway/game.gateway.ts:39-42,1150-1169` only `REACTION_KINDS={laugh,wow,cry,angry,clap,fire}`, ephemeral, 500ms throttle, never stored. Keep this, declare `No chat` in Data Safety.

Bad - remaining UGC unmoderated:

- `apps/server/src/users/username.ts:14-18,46-109`: username `[a-z0-9_ 3-24]`, displayName <=32, reserved list `:21-36`. **No profanity/slur filter.**
- `users.service.ts:140-144`: `bio=slice(0,280)`, `avatarUrl=any string`. **No profanity check, no https allowlist, no image moderation.**
- `friends.controller.ts:55-61` + `friends.service.ts:200-226`: `POST /friends/block/:userId` exists and correctly deletes friendships, **but no GET /blocks, no Unblock, no POST /reports, no socket report, no moderation queue.** Grep `report|moderation|abuse` = only `reportHardAiWin`.

Fix needed: `POST /api/reports {targetUserId, reason, evidence}` + Report button on `PlayerProfileScreen` + History opponent + Friend row + keep Block + add Unblock/List + server profanity blocklist + avatar `https://` allowlist + Terms acceptance.

### BLOCKER 4: Production Build Will Point to localhost - App Dead on Install - P0

This is the biggest user-deletes-app bug:

- `apps/mobile/.env:1-3` committed to git: `EXPO_PUBLIC_SERVER_URL=http://localhost:4000` + real Supabase anon key.
- `.env.local` has prod `https://duoorbapi.duckdns.org` but `.gitignore` only ignores `.env*.local`, so EAS production build bakes **localhost**.
- `eas.json:17-19` `production:{autoIncrement:true}` has **no `env`**, `preview` only sets `NODE_ENV`.
- `src/network/config.ts:3-5` fallback `10.0.2.2:4000 / localhost:4000`.
- `src/lib/supabase.ts:8-9` reads env, `supabase.ts:23-25` throws if unconfigured.

Result: reviewer / tester installs AAB -> Welcome -> Guest -> `Could not reach server` (`OnboardingFlow.tsx:42`) -> stuck, no retry, uninstall + 1-star + failed Closed Test. Pre-launch Report will also flag it.

Fix needed: gitignore `.env`, set `EXPO_PUBLIC_SERVER_URL` in EAS Cloud env / `production.env`, never commit `.env`.

### BLOCKER 5: Excessive Permissions + Stale android/ - P0

`apps/mobile/android/app/src/main/AndroidManifest.xml`:

```xml
INTERNET, READ_EXTERNAL_STORAGE(maxSdk32), SYSTEM_ALERT_WINDOW, VIBRATE, WRITE_EXTERNAL_STORAGE(maxSdk32)
```

- `SYSTEM_ALERT_WINDOW` (draw over other apps) = sensitive permission review + runtime prompt. You have **zero overlay code** in `src/`. Likely transitive. Must strip via `app.json: permissions:[]` allowlist.
- `READ/WRITE_EXTERNAL_STORAGE` - you only use bundled `assets/` + `AsyncStorage`, no picker. Declare as not accessed or strip.
- `VIBRATE` - `gameStorage.ts:47` `hapticsEnabled` has no `expo-haptics` usage found. Verify or remove.
- No CAMERA/LOCATION/CONTACTS/MIC/NOTIFICATIONS - good.
- Root `android/` with `applicationId com.duoorbmonorepo` is stale bare workflow. Real app is `com.duoorb.mobile` via CNG. Per `AGENTS.md` never hand-edit `android/`. Delete root `android/` from release path, submit via EAS only.
- `eas.json:21-23` `submit.production:{}` is empty - no service account, track, Apple IDs - `eas submit` will fail in CI.

---

## PART 3: Illogical Pages / Dead Navigation - Looks Unfinished to Reviewer

Custom navigator `App.tsx:51-59,101-102,139,143-148,155-161,164-187` is actually disciplined (`navigate` vs `dismissTo` to avoid Home-dead-match loop, `matchSession` remount keys `:502-507`, `OnlineJoinGate` to avoid blank connecting page). But:

1. **Leaderboard unreachable - HIGH:** Defined `App.tsx:55`, rendered `:586-591`, but **zero** `navigate(*,'LEADERBOARD')` calls. `LeaderboardScreen.tsx:16,21,90` has `onBack` but no entry from Home/Profile/BottomNav. Dead Play feature = `broken functionality` rejection.
2. **ReplayScreen dead - HIGH:** `src/screens/ReplayScreen.tsx:21` exported but never imported in `App.tsx` (only `GameReviewScreen`). `REVIEW` always mounts `GameReviewScreen :627-637` with `bare` flag. Delete file or wire it.
3. **History onBack dead - MEDIUM:** `HistoryScreen.tsx:19,31` declares `onBack`, `App.tsx:483` passes `()=>setCurrentTab('PLAY')`, but header `:253-255` renders only `<Text>History</Text>` - no button calls it. Hardware back then triggers exit-ask instead of going to PLAY. Also `:483` bypasses `goBack()/dismissTo()`.
4. **No deep-link routing - MEDIUM:** `scheme:duoorb` + `AndroidManifest singleTask` + `session.tsx:291,298,32,305-307` OAuth `duoorb://auth/callback` works, but no `expo-linking` listener. `duoorb://room/ABC`, `duoorb://player/xyz` land on MainActivity and die. Invites require manual copy (`OnlineScreen.tsx:339-346,972-985`) + in-app `inviteName :119,348-357`. Reviewer will mark invites as broken.
5. **`adBanner` naming - MEDIUM:** `HomeScreen.tsx:76-79` dashed `COMPETITIVE TURN-BASED GRID STRATEGY` styled as `adBanner`. If no ads, rename to `taglineBanner`. Otherwise reviewer asks `Contains ads?` + Data Safety mismatch.
6. **Predictive back disabled:** `app.json:20` `false` + `App.tsx:178-187` always `return true`. Android 14+ gets no preview, double-back-to-exit `:687-688` feels non-native. Set `true`.
7. **No splash config:** No `splash` key, no `expo-splash-screen`. Native `styles.xml Theme.App.SplashScreen` + `drawable-*/splashscreen_logo.png` + JS `SplashScreen.tsx:6 SPLASH_MIN_MS=1500` + `:44-53` exist, but EAS doesn't control resize/background. Add `splash:{image:./assets/splash-icon.png, backgroundColor:#FAF8FF, resizeMode:contain}` - currently `#FFFFFF` vs `THEME #FAF8FF` flashes.
8. **Contradicts AGENTS.md:** `AGENTS.md` says `Use Expo Router, routes in src/app/`. You have no `src/app/`, no `_layout`, no `expo-router` in `package.json`. Either update doc or migrate.

Bottom tabs `BottomNav.tsx:7,26-31` `PLAY|FRIENDS|HISTORY|PROFILE` only rendered when `subScreen===null App.tsx:640-650`, badge polling every 8s `App.tsx:787` - OK.

---

## PART 4: Big Errors That Make Users Delete the App

### 4.1 Crash on start - MEDIUM-HIGH RISK

Boot chain `App.tsx:438-445` `fonts 5x Manrope + hydrateIdentity + 1500ms splash` never shows blank - good. But test:

- Prod localhost bug (above) = guaranteed stuck on Welcome offline.
- `supabase.ts:18` offline guest boot works, but `--no-supabase` build untested.
- `GameScreen.tsx 2333 lines` heaviest screen, `analyzeGame` moved off first paint `GameReviewScreen.tsx:97-116` - good, but low-end API 26 + 3-4P AI untested. Must run `eas build preview` + Firebase Test Lab + `expo-doctor`.

### 4.2 Silent offline - STRONG infra, SILENT UI

Socket `socket.ts:179-182` `reconnection:true attempts:15 delay 1s/max 5s`, `:194-212` states, `useOnlineGame.ts:234` auto rejoin, `GameScreen.tsx:1493,1538` reconnecting + forfeit grace - strong.
API every screen `.catch(()=>null|[])` - `HistoryScreen:56-57`, `ProfileScreen:76,84-86`, `FriendsScreen:66-67` - offline falls back to local history `History:66-104`, canonical identity `Profile:93-118`, AI-win outbox `aiWins.ts:5` - strong.
But: all catches are silent (`History:171`, `Profile:184`, `Friends:156`, `OnlineJoinGate:86`). Only signal is `No players online yet HomeScreen:94`. No `expo-network`/NetInfo banner, Quick Match stays enabled offline, Guest creation offline shows generic error `OnboardingFlow:42` with no Retry. Users think app is broken and uninstall.

### 4.3 Error handling - GOOD but logcat noisy

`LoadingState/EmptyState/ErrorState StateViews.tsx` used everywhere with `onRetry` - good. `ApiError.status apiClient:303-311`, `Settings:188-193`, `ChooseUsername:98-103` branching - good.
But shipped `console.*` will appear in Logcat:
`aiWins:72,96 (DEV-gated ok), gameStorage:167,180,189,200,215,225,234,245 error, sfx:51,56,84,88, socket:99,201,207, useOnlineGame:430`. Replace with `__DEV__` logger or Sentry. `test-online-flow.ts` has 19 logs - exclude from bundle.

### 4.4 No push - invites die when app killed - MEDIUM

No `expo-notifications`, no FCM, no permission. Invites are in-app toasts `ChallengeToast`, `RoomInviteToast` + 8s polling `App:787`, `FriendsScreen:88-92`. If app killed, no invite. Must declare `No notifications` in Data Safety, or users will report `friends feature doesn't work` -> uninstall. Don't add FCM without Data Safety update.

### 4.5 Auth - GOOD with iOS trap

Guest-first, no forced login: `OnboardingFlow:20-22` only Guest button, `session:120-179` never mints on boot, `ChooseUsername:179-182` Skip allowed - **passes forced-login check**, zero billing code (grep `purchase|billing|IAP` = only `unsubscribe`). All modes free - excellent for retention.
Google via Supabase PKCE `session:271-314` handles cancel silently - good.
Gaps: (a) No Apple Sign-In - if you ship iOS later with Google login, Apple Guideline 4.8 requires Apple option; (b) `session:28-29` `linkGuest` fire-and-forget - test guest->Google progress carry or users lose rating and rage-quit; (c) `WelcomeScreen` has no legal checkbox - don't add blocking wall, just links.

### 4.6 Size / performance - MEDIUM

`assets/ 3.58MB` before bundle: `icon.png 961KB + logo.png 1080KB` (should be <=200KB 1024px), `android-icon-foreground 396KB` (compress <150KB + safe-zone), `android-icon-monochrome 4KB unused` (add as `monochromeImage` for Android 13+ themed icons), `splash-icon 17KB unused`, sounds duplicated `30secondsleft.wav 177KB vs mp3 10KB`, `game-start.wav 79KB vs mp3 5KB`, `placewall.wav 76KB vs mp3 4KB` - ship mp3 only saves ~600KB. + Hermes + Fresco `gif+webp` -> APK likely 35-55MB. Enable `shrinkResources/minify` (currently false in `build.gradle`) for release. Compress or users on low storage uninstall.

### 4.7 Game-specific rage-quit risks

- `GameScreen:1264-1321` hardware back mid-match - verify it shows forfeit dialog, not instant `onHome`. `leaveFinishedAndHome :1182-1194` + `game:leave :400,1182` suggests handled, but test on Android 14.
- Modals `MatchResultModal`, `Profile:462-467`, `Online:1158-1197` rely on `onRequestClose` - ensure hardware back closes modal first, not underlying screen, because global handler always consumes.
- Rating: `gateway:579,829,902` forces `isRanked:true` server-side (client can't spoof casual) + `authoritative-game.service` validates via `game-core` + `aiwins.service:166-211` replays notation - excellent anti-cheat. But `ratings.service:68-94` `flagSuspiciousTransfers()` is observe-only `never auto-punishes`. Farming via colluding accounts possible -> legit users face smurfs and quit. Add same-opponent cooldown before competitive launch.
- No `TODO/FIXME/lorem` - clean. Only legit `placeholder=` props.

---

## PART 5: Backend / Security Gaps for Play Review

1. **Unauthenticated enumeration - HIGH:** `history.controller:29-38` `GET /games/user/:userId/history` no guard (vs `:17-18` guarded), `:40-43` `GET /games/:gameId` replay no guard, `users.controller:36-39` `GET /profiles/:userId` no guard (exposes `isOnline/isPlaying`), `ratings.controller:8-26` leaderboard/rating-history no guard. Any scraper can pull all histories. Fix: `JwtAuthGuard` everywhere + friendship/seat check for replay + `limit<=50` clamp + `offset` NaN check.
2. **Search abuse:** `users.controller:50-54` guarded but `users.service:305-342` `contains+insensitive take:20` no min-length, no throttle -> spam/harassment enumeration.
3. **Rate limiting partial:** Guest `60/hour` sliding window `guest/rate-limiter:40-67`, `ipKey=sha256(ip) :70-72`, HS256 `guest-token:56-78,87-130`, `180d TTL guest.service:58-64,235-245` - good. But no global `ThrottlerModule`, no `helmet`, no `ValidationPipe` (`server/package.json:16-31` confirms missing). `friends.request`, `users.search`, `ai-wins.submit`, `matchmaking:find`, `challenge:send`, `room:create` unthrottled. Limiter in-memory `:17-24` - restart clears, scale splits. Fix: add throttler+helmet, move to Redis/DB, stop logging raw IP `guest.controller:93-94` (logs raw IP while DB hashes - GDPR inconsistency), add Play Integrity before launch.
4. **JWT nits:** `auth.service:44-87` verifies guest HMAC first, then Supabase JWKS `issuer=${SUPABASE_URL}/auth/v1 :69-71` - solid, old `dev-` bypass removed. Missing `audience:authenticated` check. Socket accepts `handshake.query?.token gateway:122` - leaks to logs/proxies, use `auth.token`/header only.
5. **CORS correct:** `main.ts:13-17` + `cors.ts:20-54` + `gateway:44-48` allowlist from `CORS_ORIGINS`, localhost default, `*` requires opt-in with warn. Keep. Prod set `CORS_ORIGINS=https://duoorb.com`.
6. **Retention/GDPR/COPPA:** Only `GuestSession` has TTL `180d`. `Game/GameMove/RatingHistory/AiWin/FriendRequest` forever - no policy, no export, no erasure, no DPO, no DSAR, no age gate. Must declare in Data Safety: `email, IDs, usernames, gameplay, diagnostics (IP hash, UA)`, add retention policy, decide `13+` or `18+` or neutral age screen.
7. **Secrets:** Server-only never in client: `POSTGRES_PASSWORD, DATABASE_URL, SUPABASE_SECRET_KEY, GUEST_TOKEN_SECRET>=32 chars, SUPABASE_JWKS_URL, CORS_ORIGINS`. Client `EXPO_PUBLIC_*` embedded - only anon keys. Never put `SUPABASE_SECRET_KEY` in mobile. Your `.env.example` correctly warns this.

---

## PART 6: Pre-Publish Criteria Checklist - GO / NO-GO

### Account & Technical

- [ ] Personal vs Organization chosen, ID/D-U-N-S verified, $25 paid - ?
- [ ] Package `com.duoorb.mobile` reserved, Play App Signing on - NO, not yet built via EAS prod
- [ ] AAB targeting API 36, versionCode bumped - NO, verify after EAS build, don't upload local APK
- [ ] Edge-to-edge tested API 26 + 35/36 gesture/3-button - NO
- [ ] `eas.json submit.production` filled (service account, track, releaseStatus) + `production.env EXPO_PUBLIC_SERVER_URL=https://duoorbapi.duckdns.org` - NO
- [ ] Pre-launch Report 0 crashes - NOT RUN

### Policy

- [ ] Privacy + Terms hosted HTTPS + in-app links Welcome + Settings - NO - BLOCKER
- [ ] Data Safety complete + matches code (email, IDs, gameplay, diagnostics, no location/contacts, no ads, encryption in transit?) - NO - BLOCKER
- [ ] Account deletion in-app + web link + Data Safety answers - NO - BLOCKER
- [ ] Content Rating IARC done - NO
- [ ] Target Audience set, age gate decided - NO
- [ ] App Access demo account with friends/history/rating data + instructions - NO
- [ ] UGC Terms + Report + Block/Unblock + profanity/avatar filter - PARTIAL (Block exists, rest NO) - BLOCKER
- [ ] Permissions stripped (`SYSTEM_ALERT_WINDOW`, storage) + Data Safety consistent - NO - BLOCKER
- [ ] `SYSTEM_ALERT_WINDOW` removed from manifest via `permissions:[]` - NO

### Store Listing

- [ ] Title, short, full description proofread, no placeholder - NO
- [ ] Icon 512x512 + Feature 1024x500 + >=2 screenshots phone + tablet (supportsTablet true) - NO
- [ ] Category + tags + contact email + `contains ads? No` - NO
- [ ] Screenshots from current version, core loop: Welcome->Home->Setup->Game->Online lobby->Friends->History->Profile - NO

### Quality - illogical / deletion triggers

- [ ] Leaderboard wired or deleted - NO
- [ ] ReplayScreen wired or deleted - NO
- [ ] History back fixed - NO
- [ ] `adBanner` renamed if no ads - NO
- [ ] Icons compressed (<200KB), wavs removed, `monochromeImage` added, `splash` added, `predictiveBack:true` - NO
- [ ] Offline banner + disable Quick Match offline + Retry on Guest fail - NO
- [ ] Cold start airplane-mode test, mid-match back test, invite->lobby->start->rematch test, sign-out->guest->Google merge test - NO
- [ ] `console.*` gated, `android/` + `dist/` + `*.apk` gitignored, `.env` gitignored - NO
- [ ] Server: guard history/replay/profile/leaderboard, throttle search/friends/matchmaking, helmet, no raw IP log, no `?token` - NO
- [ ] 12 testers recruited (20-30 backups), opt-in link flow, daily activity plan, feedback doc, bugfix during test - NO (if Personal new account)

---

## What To Do Next - In Order

**P0 - Rejection guaranteed if skipped (1-2 weeks):**

1. Host Privacy/Terms/Delete web pages, link in app + Console.
2. Build `DELETE /me` + Supabase Auth delete + Settings Delete button + local wipe.
3. Add `POST /reports` + Report/Block UI + profanity + avatar allowlist + Terms acceptance.
4. Fix prod env: gitignore `.env`, set EAS prod URL, test `preview` AAB on real device with mobile data (not wifi localhost).
5. Strip `SYSTEM_ALERT_WINDOW`/storage perms in `app.json`, delete root `android/` from release, fill `eas.json submit`, add `splash`, `permissions`, `monochromeImage`, `predictiveBack:true`.
6. Wire or delete Leaderboard + ReplayScreen, fix History back, rename adBanner, compress icons, drop wavs.

**P1 - Uninstall / 1-star prevention:**

7. Offline banner + NetInfo gate + Retry, modal back handling, forfeit dialog test, low-end device test, Sentry instead of console.
8. Guard all public endpoints, add throttler+helmet, stop IP logging, add Play Integrity, add same-opponent ranked cooldown.
9. Prepare store graphics + descriptions + demo account + Data Safety + Content Rating + Target Audience.

**P2 - Before Apply for Production:**

10. Internal Testing -> Closed Testing 14 days / 12 testers with daily use + feedback log + at least 1 update during test -> write detailed answers (how recruited, devices, feedback quotes, what you changed, how you decided ready) -> submit, wait 7 days, don't change app during review.

---

*End of report. No code was modified to produce this file.*
