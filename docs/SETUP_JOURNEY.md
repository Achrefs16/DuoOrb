# DuoOrb Launch Setup Journey — 2026-10-05

Everything wired on this day, in the order it happened, so any future setup
(and future-you) can replay it. Secrets are referenced by LOCATION, never
written here — this file may one day be committed.

---

## 1. AdMob (monetization)

- Account created. App: **DuoOrb**, Android, App ID
  `ca-app-pub-6057010656402010~3789437235`.
- 3 ad units (all partner-bidding OFF — no third-party mediation):
  - Banner `DuoOrb_Banner_Main` → `.../8570242197`
  - Interstitial `DuoOrb_Interstitial_PostGame` → `.../9282446220`
    (reserved for a possible future; NO interstitial code ships)
  - Rewarded `DuoOrb_Rewarded_Analysis` → `.../6459084176`
    (reward item `AnalysisUnlock` × 1)
- Frequency safety net: app-level cap 3 interstitial / 24h (backstop only).
- Test device added: Samsung M14, advertising ID `2c4cdfa5-...` (look for the
  "Test ad" badge before tapping anything in dev).
- `app-ads.txt` served by the API itself: `AdsTxtController` answers
  `GET /app-ads.txt` with `google.com, pub-6057010656402010, DIRECT, ...`.
  No website needed — the Play listing's Website field points at
  `https://duoorbapi.duckdns.org`, where the file lives.
- Status: app shows **"Requires review — Limited ad serving"**. Real fill
  stays throttled until the app is linked to a PUBLIC store page (closed
  tracks are invisible to AdMob search) and approved. Test ads unaffected.

## 2. Google Play Console (products + declarations)

- Store settings: Game → **Strategy**; tags incl. Board/Chess/Tactics;
  contact `digitalas.support@gmail.com`; Website `https://duoorbapi.duckdns.org`.
- Merchant profile completed (payments profile `5755-7095-8215`).
  No payout method on file yet — sales accrue, payout waits for a bank account.
- Subscriptions (Monetize → Products → Subscriptions):
  - `duoorb_premium_monthly` — $3.99/mo, 7-day trial, 7-day grace, hold ON.
  - `duoorb_premium_yearly` — $24.99/mo… **/yr** ($24.99/year), same terms.
  - Product IDs are permanent. Prices set per-country from USD.
- Advertising ID declaration: **Yes** → purpose **Advertising or marketing** only.
- Data Safety → Purchase history: Collected + Shared, not ephemeral, required,
  purpose App functionality.
- Still open: subscriptions declaration + target-age/ads declaration honesty
  pass (P8.4), Data Safety ad-ID row.

## 3. Google Cloud (service account for RevenueCat)

- `API access` page was unfindable (account-level menu, role-gated UI) —
  bypassed entirely via Cloud Console direct route.
- Cloud project → IAM & Admin → Service Accounts → `revenuecat-duoorb` →
  Keys → JSON downloaded.
- Trap hit: org policy `iam.disableServiceAccountKeyCreation` blocked key
  creation → overridden to **Off** at project level (propagates in ~10 min).
- Play side: Users and permissions → invited the service-account email with
  **View app information and download bulk reports (read only)** +
  **View financial data, orders and cancellation survey responses** (+ kept
  **Manage orders and subscriptions**).
- Second trap: **Google Play Android Developer API** was not enabled on the
  Cloud project → enabled it; catalog validation needs it.

## 4. RevenueCat (entitlements + webhooks)

- Project `DuoOrb` → Android app `com.asdigital.duoorb` → Play linked via
  the service-account JSON (all validations green after the API enable).
- Public API key (Android): `goog_pEpJbXovkXXGfGcDRWRQQwMGStT`
  → wired into the app as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`.env.local`;
  documented in `.env.example`). Rebuild required to take effect (baked at
  build time).
- Entitlement: **`premium`** (exact word — the app checks
  `entitlements.active['premium']`; a `duoorb_pro` misfire was deleted).
- Offering: **`duoorb_premium`** with packages **`$rc_monthly`** →
  monthly base plan, **`$rc_annual`** → yearly base plan (exact identifiers —
  the app looks these up; Test Store products stay OUT of this offering).
- Promo strategy (pre-created pattern): intro offers $2.99 first month /
  $19.99 first year, enabled max ~3×/year (launch, Black Friday, anniversary).
- Webhook: `POST https://duoorbapi.duckdns.org/api/billing/revenuecat`,
  `Authorization: Bearer <48-char secret>`, env BOTH sides,
  events INITIAL_PURCHASE/RENEWAL/CANCELLATION/EXPIRATION/BILLING_ISSUE.
  - Webhook secret location: server deploy env (`REVENUECAT_WEBHOOK_SECRET`).
    NEVER only in repo `.env` — compose `environment:` is an explicit
    allowlist; the variable must be NAMED there (lesson learned the hard way:
    an evening of 401s). Repo `docker-compose.yml` + `.env.example` now carry it.
  - Test event returns 200 + `unknown user` server log = pipe proven.
- Sandbox: Test Store key exists for drills; allow-listed by DuoOrb userId
  (from Supabase Auth users table or `users`/`profiles` SQL by email —
  guests must link Google first, they have no stable ID).

## 5. Local release build recipe (Windows, Android AAB)

Prerequisites in place: keystore recovered (`duoorb-upload.keystore.bak` →
verified by SHA-1 `DF:B0:…:97:96` against Play Console) → lives at
`C:\keys\duoorb-upload.keystore` (alias `duoorb`). Passwords live ONLY in
`C:\Users\achra\.gradle\gradle.properties` (`DUOORB_UPLOAD_*`).

Every release, in order:
1. `cd apps\mobile` → bump `versionCode` in `app.json` (+1, Play rejects reuse).
2. `npx expo prebuild` — REGENERATES `android/` (wipes local edits incl.
   signing block; the `.gradle` passwords survive, the build.gradle edit does
   not — re-apply signing block if wiped, or keep a patch note).
3. Re-apply release `signingConfigs` in `android/app/build.gradle` if prebuild
   wiped it (points at `C:\keys\…`, passwords from global properties; build
   fails loudly if missing — by design).
4. `cd android` → `.\gradlew bundleRelease -PRNGMA_ANDROID_BACKEND=classic`
   (the `-P` flag bypasses the ads-library engine-selection crash without
   touching files; permanent equivalent is `"androidSdk": "classic"` in the
   app.json plugin — already set, so fresh prebuilds carry it).
5. `jarsigner -verify` the AAB → upload to Play track.
6. Root cause learned: v17 ads library requires an engine choice the Expo
   plugin doesn't default — standard installs fail without the parameter.

## 6. Still open (launch gates)

- EAS vs local decision for future builds (EAS signs automatically).
- Payout bank account.
- AdMob store link + approval (needs PUBLIC listing → production publish).
- Real-time developer notifications topic (optional, faster renewals).
- P9 device matrix: sandbox $0 license-tester purchase → webhook → Premium
  flip → cancelExpiry behavior, on the build containing the app key.
- Pre-release code hygiene: remove `DEV_UNLOCK_BOTS`, `DEV_UNLOCK_THEME`,
  `DEV_UNLOCK_MIDNIGHT_RENDER`; delete the `.bak` from the repo; commit all.
