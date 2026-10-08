# MONETIZATION.md — DuoOrb Premium + Ads: Full Implementation Plan

> READ-ONLY PLAN. Do not implement until the user approves each phase.
> Codebase state at time of writing: Expo ~57 / RN 0.86 / NestJS 10 / Prisma 6.
> Zero billing or ads code exists today. Legal docs currently promise "no ads and no
> in-app purchases" — they MUST be updated before any monetized release (Phase P8).

---

## 0. Locked product decisions (user-confirmed — do not relitigate)

| # | Decision |
|---|---|
| D1 | **Premium = exactly 4 things**: (1) No ads · (2) Unlimited game analysis · (3) Exclusive board theme · (4) Small premium badge next to names. Bots are FREE for everyone (policy change 2026-10-08). Future cosmetics/themes can extend this list later. |
| D2 | **No lifetime purchase.** Products: monthly + yearly subscriptions only. |
| D3 | **Pricing: $3.99/month, $24.99/year** (7-day free trial on both — trial converts best per 2026 benchmarks; required Play disclosures handled by template copy in P7). |
| D4 | **Analysis is ONE type** (no fast/deep split). Free users get **1 full analysis per day**; further games unlock **per game by watching one rewarded video ad** (advertiser-controlled length, typically 15–30s — never promise "30s" in UI copy; reward fires on completion event, not on a timer). Premium = unlimited, no ad. |
| D5 | **All bots are FREE for everyone** (policy change 2026-10-08). Difficulty Easy/Normal/Hard plus every named personality — never gated. |
| D6 | **Nothing competitive is ever gated or sold.** No rating protection, no extra walls/time, no priority matchmaking, no ranked advantage from ads. Rewards = knowledge (analysis), cosmetics (theme/badge). |
| D7 | **Ad placements are NOT final.** Owner disagrees on some slots. Every placement in this plan is built behind `ADS_CONFIG` + `AdsManager` so positions/frequency change by editing constants, not architecture. Final placement sign-off happens at P6 implementation time. |
| D8 | Smallest correct changes per phase; verify (`tsc`, vitest, lint) after every phase; one commit per phase. |
| D9 | **Promotional pricing: $2.99/mo and $19.99/yr are reserved as limited-time promo prices** (never the base price). Run as Play introductory offers 2–3×/year max (launch window, Black Friday/holiday, anniversary) so users don't learn to wait for sales. See P0.8 + E25. |

### Open points (decide at P6 build time, defaults in brackets)

- O1: Banner on Home — DECIDED yes (replaces placeholder). O2: Banner on History/Leaderboard
  footers — DECIDED yes (below pager buttons). O3: REVISED — no interstitial; in-modal
  banner under all GameOverModal buttons — DECIDED yes. O4: post-3rd-game prompt — no.

---

## 1. Architecture overview

```
┌─ Play Console ──────────────────────────────┐
│ Products: duoorb_premium_monthly ($3.99, 7d trial)                            │
│           duoorb_premium_yearly  ($24.99, 7d trial)                           │
└──────────────┬──────────────────────────────┘
               │ receipts / renewals / cancels / expiries
┌─ RevenueCat (dashboard + webhooks) ─────────┐
│ 1 entitlement: `premium` · App User ID = DuoOrb userId                         │
└──────────────┬──────────────────────────────┘
               │ webhook POST (shared-secret auth)
┌─ DuoOrb server (NestJS) ─────────────────────┐
│ BillingModule → BillingController/ Service   │  ← NEW
│ Profile.isPremium / premiumExpiresAt         │  ← migration
│ SubscriptionEvent log (idempotency)          │  ← NEW table
│ GET /api/me returns { isPremium, ... }       │
└──────────────┬──────────────────────────────┘
               │ /me on boot, refresh, post-purchase
┌─ Mobile (Expo) ──────────────────────────────┐
│ usePremium() hook (server truth + cache)     │  ← NEW
│ PremiumSheet (GuestGate-pattern paywall)     │  ← NEW
│ AnalysisGate (rewarded-ad OR premium)        │  ← NEW
│ BotRoster (locked personalities)             │  ← NEW data + UI
│ ThemeContext (light + midnight)              │  ← refactor singleton
│ <PremiumBadge/> at 6 name render sites       │  ← NEW component
│ AdsManager (banner/interstitial/rewarded)    │  ← NEW, ADS_CONFIG-tuned
│ react-native-purchases (+ui)                 │
│ react-native-google-mobile-ads v17           │
└──────────────────────────────────────────────┘
```

**Trust rule:** server is source of truth for `isPremium`. Client cache (`@duoorb:premium:v1`)
is a fast-path for hiding banners/gates only; any scarce grant (analysis unlock counts are
per-game and local-compute, so client-side is acceptable — see P3 edge cases) never relies on
client state alone for *ranked-affecting* logic. Analysis runs fully on-device
(`packages/game-core`); it cannot affect ranked outcomes, so per-game client unlock is safe.

**Guest rule:** guests have no `User` row (only `GuestSession`), so entitlements key to linked
accounts. Purchase/restore flow forces Google-link first via the existing `GuestGate` pattern.
`linkGuest()` carries progress; entitlement attaches to the surviving `User.id`.

---

## 2. Product + account setup (P0 — dashboards only, no code)

### P0 — Store / AdMob / RevenueCat accounts and products

- [ ] P0.1 Create AdMob account → register app `com.asdigital.duoorb` → record
      `ADMOB_APP_ID=ca-app-pub-6057010656402010~3789437235` ✅ DONE (2026-10-04).
  Create 3 ad units, record IDs:
  - `ADMOB_BANNER_ID=ca-app-pub-6057010656402010/8570242197` (`DuoOrb_Banner_Main`) ✅ DONE.
  - `ADMOB_INTERSTITIAL_ID=ca-app-pub-6057010656402010/9282446220` (`DuoOrb_Interstitial_PostGame`) ✅ DONE.
  - `ADMOB_REWARDED_ID=ca-app-pub-6057010656402010/6459084176` (`DuoOrb_Rewarded_Analysis`, reward item `AnalysisUnlock` × 1, single unit reused for any future reward) ✅ DONE.
- [ ] P0.2 Set AdMob frequency safety net: app-level cap **3 interstitial impressions / 24h**
      (client enforces tighter rules; this is the backstop). Enable test-device IDs for all dev devices.
- [x] P0.3 Serve `app-ads.txt` via `AdsTxtController` (`ads-txt.controller.ts`, root path —
      NOT under `/legal/*`) with the AdMob publisher line. ✅ SHIPPED (build clean, 210/210).
      REMAINING: deploy → confirm `https://api.duoorb.com/app-ads.txt` AND `https://duoorb.com/app-ads.txt` return the line as
      `text/plain` → wait ~24h → verify in AdMob console.
- [ ] P0.4 Play Console → DuoOrb app → Subscriptions → create base plans:
  - `duoorb_premium_monthly` — $3.99, 1 month, auto-renew, 7-day free trial, grace period ON (3 days), account hold ON, restore ON.
  - `duoorb_premium_yearly` — $24.99, 1 year, auto-renew, 7-day free trial, same grace/hold/restore.
  - Both plans: resubscribe enabled, tags `premium`.
- [ ] P0.5 RevenueCat → project → link Play Console service-credentials → create entitlement
      `premium` → attach both products as packages `$rc_monthly` / `$rc_annual` inside one
      offering `duoorb_premium`. Set App User ID mode: custom IDs (we pass DuoOrb `userId`).
- [ ] P0.6 RevenueCat → Integrations → add webhook:
      URL `https://<api>/api/billing/revenuecat`, header `Authorization: Bearer <secret>`,
      events: `INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE,
      PRODUCT_CHANGE`. Store `<secret>` as server env `REVENUECAT_WEBHOOK_SECRET`.
- [ ] P0.7 Add Play license-test accounts (all dev Gmail addresses) + closed/internal test track
      containing the monetized build for purchase sandbox testing.
- [ ] P0.8 Promotional offers (dashboard-only, no code): on each base plan (P0.4) pre-create a
      disabled introductory offer — monthly: $2.99 for the first 1 month, then $3.99;
      yearly: $19.99 for the first 1 year, then $24.99. RevenueCat picks these up as
      `introPrice` on the same packages automatically. Rules: enable an offer only during a
      declared promo window (launch, Black Friday, anniversary — max 3×/year); offers apply to
      NEW subscribers only; existing subscribers keep their current price untouched.
      Test each offer once with a license-tester account, then disable until launch promo.

**Verify P0:** products ACTIVE in Play Console; RevenueCat offering shows 2 packages; webhook
test-event delivers HTTP 200 (after P1 ships — re-run then).

---

## 3. Server — entitlement + webhook (P1)

New module mirrors existing patterns (`history.module.ts:6-11`, `aiwins.module.ts:6-11`).

### P1.1 — Prisma migration: premium fields + event log

- [x] P1.1.1 `apps/server/prisma/schema.prisma` — extend `Profile` (`70-84`):
  `isPremium Boolean @default(false)`, `premiumExpiresAt DateTime?`,
  `premiumSource String?` (`"revenuecat"` | `"grant"`), `premiumUpdatedAt DateTime?`.
  New model `SubscriptionEvent { id, userId String, eventType String, productId String?,
  expiresAt DateTime?, rcEventId String @unique, createdAt }` + relation to `User`
  (attach near `AiWin 252-276` / `Achievement 281-291` style relations on `User 10-37`).
- [x] P1.1.2 `npx prisma migrate dev --name premium-entitlement`; regenerate client.
- [x] P1.1.3 `.env.example` (+ real `.env` / deploy secrets): `REVENUECAT_WEBHOOK_SECRET=`.

### P1.2 — BillingModule (webhook public, reads authed)

- [x] P1.2.1 `src/billing/billing.module.ts` (copy `history.module.ts:6-11`).
- [x] P1.2.2 `src/billing/billing.service.ts`:
  - `applyEvent(evt)`: upsert `SubscriptionEvent` by `rcEventId` first (idempotency — duplicate
    webhook deliveries must be no-ops); map `INITIAL_PURCHASE/RENEWAL → isPremium=true,
    premiumExpiresAt=evt.expiresAt`; `CANCELLATION → keep true until expiresAt`
    (user keeps paid period — Play policy); `EXPIRATION → isPremium=false`;
    `BILLING_ISSUE → leave true` (grace/hold covers it; lazy-expiry on `/me` is backstop).
  - `getStatus(userId)`: return `{ isPremium, premiumExpiresAt }` with **lazy expiry**:
    if `premiumExpiresAt < now` → flip `isPremium=false` and return false (covers missed webhooks).
- [x] P1.2.3 `src/billing/billing.controller.ts` `@Controller('api/billing')`:
  - `POST /revenuecat` — **public** (copy public-route pattern `legal.controller.ts:10-40`).
    Auth: `Authorization: Bearer <secret>` compared with `timingSafeEqual` against
    `REVENUECAT_WEBHOOK_SECRET` (copy `guest-token.ts:52-54,114` + multi-secret loop `108-118`
    for rotation). Wrong/missing → 401. Throttler: global guard applies (`app.module.ts:34`);
    100 req/min is plenty for webhooks — no bypass needed.
  - Body: RevenueCat v1 event JSON (`{ event: { type, app_user_id, product_id,
    expiration_at_ms, id } }`). `app_user_id` = DuoOrb `userId` (client sets it — P2).
    Unknown `app_user_id` → 200 + warn-log (never 500; RevenueCat retries 500s).
- [x] P1.2.4 Register `BillingModule` in `src/app.module.ts:17-33` imports.
- [x] P1.2.5 `users.service.ts:getMe (36-106)` + `getPublicProfile (196-261)`:
  append `isPremium` (+ `premiumExpiresAt` on `/me` only, never public).
  Mirror in mobile `UserMeDto` (`apiClient.ts:24-34`) — P2.
- [x] P1.2.6 `linkGuest()`: VERIFIED no change needed — purchases require Google-link first
      (P2.4), so entitlement always lands on the surviving account; the merge never touches the
      account's `Profile` row, and cascade deletes subscription events with the user.
  surviving account — no extra code unless link *replaces* user rows; verify by reading the
  merge path during implementation and add a test asserting `isPremium` survives guest-link.

### P1 edge cases (must all be handled — tests in P9)

| # | Case | Handling |
|---|------|----------|
| E1 | Duplicate webhook delivery | `rcEventId` unique → second insert caught → return prior state, 200 |
| E2 | Events arrive out of order (EXPIRATION before RENEWAL) | Only apply if `expiresAt` newer than stored `premiumExpiresAt`; else log + ignore |
| E3 | Cancel then resubscribe | CANCELLATION keeps `true` till expiry; new INITIAL_PURCHASE extends `expiresAt` |
| E4 | Billing issue / grace period | Keep `true`; lazy-expiry on `/me` flips only after `expiresAt` passes |
| E5 | Refund/revoke (if enabled later) | Treat `EXPIRATION` with past date → `false` immediately |
| E6 | Webhook secret rotation | Multi-secret verify loop (old + new accepted during rotation window) |
| E7 | Guest purchases | Impossible by construction — client forces Google-link first (P2.4) |
| E8 | Two devices, one account | Both read `/me` → same `isPremium`; no device binding anywhere |
| E9 | Clock skew on expiry compare | Server `now()` only; client never decides expiry |

**Verify P1:** `npx prisma migrate deploy` clean; unit tests for E1–E4 (vitest, copy
`reports.service.ts:52-58` 24h-window count pattern for test style); `curl` webhook with
bad secret → 401, good secret + fixture → 200 and `Profile` row updated; `/api/me` returns
`isPremium` (+ lazy-expiry test: expired row returns `false`).

> P1 STATUS (2026-10-05): SHIPPED. Build clean, 223/223 server tests (13 new billing specs
> covering E1–E4, lazy expiry, unknown user, webhook auth). Migration SQL validated by applying
> it to a scratch Postgres (dev DB has no published ports by design); it auto-applies on next
> container deploy via the Dockerfile `migrate:deploy` step. Live `curl` webhook check runs
> against staging after P0.6 webhook registration.

---

## 4. Client foundation — premium plumbing + purchases (P2)

Install (dev build required — neither SDK runs in Expo Go):

```
npx expo install react-native-purchases react-native-purchases-ui
```

- [ ] P2.1 `app.json` plugins: add `react-native-purchases` (API key via `extra`,
      **public** RevenueCat *public* key is safe to embed; secret stays server-side).
      No Purchases plugin config beyond key. Rebuild dev client (`eas.json` development profile).
- [ ] P2.2 New `src/monetization/premium.ts`:
  - `syncPremium()`: `Purchases.configure(publicKey, appUserID=userId)` on boot **after**
    session ready (`session.tsx:boot 141-218` — hook into `refreshProfile 408-422` path);
    `getCustomerInfo()` → `entitlements.active.premium` → `POST` nothing (server learns via
    webhook) → read authoritative status from `api.getMe()` → cache
    `@duoorb:premium:v1 { isPremium, expiresAt, syncedAt }` (key pattern `gameStorage.ts:25-28`).
  - `usePremium(): { isPremium, expiresAt, loading, refresh }` — single hook every gate uses.
  - `purchasePackage(pkg)` / `restorePurchases()` wrappers with error mapping
    (user-cancelled = silent, network = retryable toast, other = support copy).
  - Guest guard: if `identity.isGuest` → return `{ needsLink: true }` (caller opens link prompt).
- [x] P2.3 `apiClient.ts:UserMeDto` / `PublicProfileDto` += optional `isPremium` (+
      `premiumExpiresAt` on `/me` only). ✅ SHIPPED (2026-10-05): optional (old servers =
      free tier, fail closed). Premium is NOT folded into `CanonicalIdentity` (would persist a
      stale flag to disk); it lives in `src/monetization/premium.ts` state + `@duoorb:premium:v1`
      cache instead — same guarantee, cleaner boundary.
- [x] P2.5 (partial — sync core) Boot wiring: `hydratePremiumCache()` at session boot +
      `ingestMe()` inside `fetchProfile` (zero extra requests) + `refreshPremium()` for
      post-purchase/foreground. ✅ SHIPPED with 5 specs (expiry backstop, cache hydrate).
      REMAINING: 24h-stale foreground refresh + sign-in hookup (lands with P2.2b SDK wiring).
- [ ] P2.4 Guest-link-before-pay: `PremiumSheet` (P7) — when guest taps any buy button →
      show `GuestGate`-style card (`GuestGate.tsx:13-78` pattern: title/message + Save-with-Google
      + secondary "Not now") → after `signInWithGoogle()` + `linkGuestProgress (93-99)` succeed →
      continue to purchase. Purchases are **never** initiated with a guest identity.
- [ ] P2.5 Boot/restore wiring (`App.tsx` session effects): on `ready` → `syncPremium()`;
      on `signInWithGoogle` completion → `syncPremium()`; on app foreground after 24h stale cache
      → background `syncPremium()` (silent fail — keep cached value).
      (Sync core already shipped — see P2.3 note; this item now tracks only the SDK-side
      configure-on-ready + 24h foreground refresh in P2.2b.)

**Verify P2:** `tsc --noEmit` clean; offline boot uses cache (airplane test); sandbox purchase in
internal track flips `/me.isPremium=true` within ~60s of webhook; restore on second device works.

---

## 5. Game analysis gating + rewarded unlock (P3 — highest ROI, build right after P2)

Single analysis type. No profiles split. **Free: 1 full analysis per day; further
games cost one rewarded view each. Premium: unlimited.** (D4)

- [x] P3.1 New `src/monetization/analysisAccess.ts`: ✅ SHIPPED (2026-10-05).
  - `resolveAccess(premium, unlocked)` pure table + `useAnalysisAccess(gameId, len)` hook
    over `usePremium()` + unlock cache `@duoorb:rewarded-analysis:v1:{gameId}:{historyLength}`
    storing `{u:1,t}` with 30-day prune (E24).
  - Free daily quota `@duoorb:free-analysis-day:v1:{YYYY-MM-DD}` (`FREE_ANALYSES_PER_DAY=1`).
    `requestAnalysisEntry` is the single gate for every Analyze tap: premium →
    unlimited, unlocked → free, else spend the daily when available
    (unlock-first so a store failure never burns the quota, E12), else locked
    → ad gate. Serialized against rapid double-taps. Re-verification never
    spends (read-only).
  - `markAnalysisUnlocked(gameId, historyLength)` after earned reward; throws (no silent
    grant) if the store write fails (E12).
  - Online games use server `gameId`; AI/local use `state.gameId` (fresh per mount + rematch).
    History/Profile replays (`bare=true`) carry the same `accessKey` (`SavedGameRecord.id`)
    and offer the upgrade to full review from the replay itself (P3.6).
- [x] P3.6 History/Profile direct Analyse: ✅ SHIPPED (2026-10-08). The match
  detail modal (`MatchResultModal`, shared by History + player profiles) shows
  Analyse beside Replay and jumps straight to full review through the same
  gate — no replay-first detour. Bare replays keep their in-place Analyze
  upgrade button (`App.handleUpgradeReviewToFull` flips `reviewBare`).
- [x] P3.2 Analyze row → new press flow (gate lives in `GameScreen.handleAnalyzePress`, modal
  untouched): ✅ SHIPPED. Premium/unlocked/daily → straight to review; locked →
  `RewardSheet` ("Watch a short video…", [Watch ad], "Not now"; premium link lands with P7
  `PremiumSheet` — no dead buttons). Reward → unlock → auto-continues. Errors render
  inline rows (E10/E11). Copy-moves button removed from the modal.
- [x] P3.3 `GameReviewScreen` defense-in-depth: ✅ SHIPPED. `accessKey` prop + `useAnalysisAccess`
  re-verification; compute never starts unless `premium`/`unlocked`; locked panel with in-place
  ad unlock in the skeleton slot; rendered reviews never yanked (E14). No deep/fast split (D4).
- [x] P3.4 `App.handleOpenReview` threads `accessKey` through `ReplayData` to
  `<GameReviewScreen>`. ✅ SHIPPED.
- [x] P3.5 `AdsManager.showRewarded(placement)` interface + fail-closed default + mock
  providers: ✅ SHIPPED. Real AdMob provider wires in at P6 with zero caller changes;
  `preloadRewarded('analysis')` already fires on game completion.

### P3 edge cases

| # | Case | Handling |
|---|------|----------|
| E10 | User closes ad early (no reward) | `earned=false` → stay on RewardSheet, no unlock, no error toast (not a failure) |
| E11 | Ad SDK not loaded / airplane / AdMob error | Catch → inline "unavailable" row + premium alternative; never crash, never hang |
| E12 | Reward earned but app killed before `markAnalysisUnlocked` | Accept loss (one ad view). Do NOT auto-unlock on next boot without proof — predictable beats clever |
| E13 | Same game analyzed twice | Unlock cache hit → no second ad, no second daily spent. Rematch/new game = new id = new gate |
| E14 | Premium expires mid-session | `usePremium` refresh on foreground; next Analyze tap re-evaluates (never yank an open review) |
| E15 | History/Profile replays | `bare=true` replay always free; Analyse beside Replay jumps straight to full review through the same gate (P3.6) |
| E16 | UI copy promises duration | Copy says "short video", never "30 seconds" — creative length is advertiser-controlled |

**Verify P3:** free → Analyze → ad → reward → full review renders; early-close → no unlock;
airplane → graceful unavailable row; premium → direct; `tsc` + targeted vitest for
`getAnalysisAccess` state machine (locked/unlocked/premium/expired).

> P3 STATUS (2026-10-05): SHIPPED. `tsc` clean, 92/92 mobile tests (13 new monetization
> specs), lint zero new (19 pre-existing errors unchanged, blame-verified September).
> End-to-end ad path runs against `MockGrantingProvider` until P6 wires the real SDK —
> manual matrix T2/T3/T9 re-runs then.

---

## 6. Bots are free for everyone (P4 — policy change 2026-10-08)

POLICY CHANGE: all bot personalities are free. Premium is analysis + no-ads +
board theme (+ badge) only — no gameplay or roster gating.

Hard Easy/Normal/Hard stay free and generic (D5), and every named personality
is now free too. Engine already supports arbitrary parameter sets (`AI_PROFILES` shape in
`packages/game-core/src/ai/constants.ts`, `AIProfile{depth,randomness,weights,
maxCandidateWalls,timeBudgetMs}`).

### P4.1 — Roster data (single source of truth)

- [x] P4.1.1 `packages/game-core/src/ai/personalities.ts` + export in `ai/index.ts`:
  ✅ SHIPPED (2026-10-05, game-core side as preferred — server can reuse for future
  verified bot events).
```ts
export type BotPersonality = {
  id: string; name: string; title: string;       // "Vex", "The Trickster"
  elo: number;                                    // 900–2100 ladder
  profile: AIProfile;                             // tuned depth/randomness/weights
  color: string; avatarGlyph: string;             // orb tint + initial/glyph
  style: string;                                  // one-line flavor ("Loves early walls")
  banter: { taunt: string[]; praise: string[] };  // ReactionKind-mapped lines
  premium: boolean;                               // false ONLY for easy/normal/hard entries
};
```
- [x] P4.1.2 Launch roster (6 premium + 3 free generics): ✅ SHIPPED (2026-10-05).
  free: Easy 1200 / Normal 1500 / Hard 1800 (existing, unchanged).
  premium: `Pip 900`, `Bram 1350`, `Vex 1600`, `Sage 1750`, `Queen Mab 1950`,
  `The Clockmaker 2100`. Weights tuned from `AI_PROFILES`; no engine changes needed.
  Verified: 6/6 vitest (data validation + every personality returns a legal opening move
  via `getBestAction`), game-core `tsc` build clean.
- [x] P4.1.3 Banter hookup: ✅ SHIPPED (2026-10-05, minimal form). Personality taunts use
  the `angry` dock bubble (reads as a jab), praise stays `clap`; generic bots keep
  laugh/clap. Same once-per-game guards, same 2p-only scope. The roster's text lines are
  stored for future coach-caption use — no new UI surface at launch.

### P4.2 — Selection UI (locked cards → paywall)

- [x] P4.2.1 Opponent section in `MatchSetupScreen` (below difficulty track):
  ✅ SHIPPED (2026-10-05). 6 personality rows (glyph + name + ELO + title, weakest-first).
  POLICY CHANGE (2026-10-08): lock removed — every personality selects directly,
  free for everyone. Selecting a
  bot adopts its difficulty tier; touching difficulty drops back to generic.
- [x] P4.2.2 Flow-through: ✅ SHIPPED. `onConfirm += botId` → `gameConfig.botId` (in mount
  key, so bot switches remount cleanly) → `GameScreen botId` → `playerNamesFor` uses the
  personality name (`"Vex"`, multi-seat `"Vex 2"` suffixing) → AI turn uses
  `personality.profile`, `thinkMsFor` unchanged.
- [x] P4.2.3 Rating/achievements: ✅ SHIPPED by construction. Personality games flow the
  untouched AI/unrated path; hard-win upload additionally requires `!personality`, keeping
  the anti-spoof `sequenceHash` set tight.

**Verify P4:** free user picks Easy/Normal/Hard unchanged; any user picks Vex →
plays vs named bot with custom weights + banter; rematch keeps personality;
`tsc` + roster unit test (ids unique, ELOs ascending, every premium entry has banter+profile).

> P4 STATUS (2026-10-05): SHIPPED except the locked-tap destination (P7 `PremiumSheet`).
> `tsc` clean, 92/92 mobile tests, game-core 6/6, lint 19 pre-existing errors unchanged.
> Manual matrix: free generic flow unchanged; premium selection needs a premium account
> (sandbox) for the full locked→unlocked check at P9.

---

## 7. Exclusive board theme + premium badge (P5)

### P5.1 — Board palette (scoped, not full ThemeContext)

SCOPE CORRECTION (2026-10-05): a full `ThemeContext` migration would touch 55 `THEME`
usages in `GameHud.tsx` alone (mostly module-scope StyleSheets) for a "board theme" whose
contract is the board surface. Implemented instead as a board-surface palette consumed by
the two match-surface components only (`GameBoard`, `WallTray`). Player orbs, placed
walls, HUD cards and menus keep identity colors on every palette. Full-app dark mode
remains a future extension reusing this exact pattern.

- [x] P5.1.1 New `src/theme/boardTheme.ts`: `BoardPalette` (boardBackground, boardBorder,
  cell, cellBorder, wallSlot, trayCard/Hairline/Pill/Count) + `LIGHT_BOARD` (pixel-identical
  to current tokens) + `MIDNIGHT_BOARD` (deep navy `#0F172A`/`#1E293B`, slate chrome, gold-
  friendly crown). ✅ SHIPPED.
- [x] P5.1.2 Theme-name store + `useBoardPalette()` (premium-gated, light fallback):
  ✅ SHIPPED. Choice persists in settings (`UserSettings.themeName`, default `'light'`,
  whitelist-parsed on load — E23); `App` syncs the render store on load + every change.
  No provider mount needed (sync external store, same pattern as premium/identity).
- [x] P5.1.3 `GameBoard` + `WallTray` converted to `getStyles(palette)` memoized per
  palette; orbs/walls/crown/marks untouched. ✅ SHIPPED. `GameHud` deliberately untouched.
- [x] P5.1.4 Theme picker = new Settings BOARD THEME card (Classic free + Midnight
  locked-or-select). ✅ SHIPPED. Gated at selection AND render time (lapsed premium with
  midnight saved → light, no crash). Locked tap → hold toast (P7 `PremiumSheet` entry #3).

> P5.1 STATUS (2026-10-05): SHIPPED. `tsc` clean, 95/95 mobile tests (3 new theme specs:
> palette parity, E23 whitelist, premium gate), lint zero new. `DEV_UNLOCK_THEME` test flag
> active alongside `DEV_UNLOCK_BOTS` — both removed before any release build.

### P5.3 — Premium board skin: Walnut (Dark Mode board free)

POLICY CHANGE (2026-10-08): Midnight is FREE for everyone (dark-mode board).
Premium is one full board design (arena + glacier cut — walnut only);
orb/wall HUES stay identity colors (readability), only the finish changes.
on every skin (readability), only the finish changes. All skins stay 2D Views.

- [x] P5.3.1 `BoardSkin` system in `src/theme/boardTheme.ts`: `classic` (free,
  follows appearance) + `walnut` (premium-gated, classic
  fallback). `DEV_UNLOCK_MIDNIGHT_RENDER` removed; `resolveBoardPalette` free.
- [x] P5.3.2 `GameBoard` paints per skin: frame radius/border, inner bevel +
  sheen + goal lips, checker cells + tile bevels, capsule/bevelled walls with
  top-light strip, orb rim + grounding shadow + highlight strength, Glacier
  edge coordinates. Geometry (`boardMetrics`, `wallRect`) shared — 2p/4p and
  both appearances identical. `WallTray` follows skin radii/surfaces.
- [x] P5.3.3 Settings BOARD DESIGN picker (Classic free + 3 locked): locked tap
  opens `PremiumSheet` (entry `board-skin`); choice persists in
  `UserSettings.boardSkinId` (whitelisted on load — E23). Paywall bullets,
  Settings premium copy and legal copy sell premium boards, never Midnight.

> P5.3 STATUS (2026-10-08): SHIPPED. `tsc` clean, mobile tests green (skin gate,
> fallback + E23 specs), all 10 locales carry the board-design keys.

### P5.2 — PremiumBadge (6 render sites)

- [x] P5.2.1 New `src/components/PremiumBadge.tsx`: ✅ SHIPPED. 13px gold (`#D9A62E`)
  crown (`MaterialCommunityIcons`), memoized + named (display-name lint-clean),
  `accessibilityLabel="Premium member"`. Nesting trick: vector-icons render as Text, so the
  badge nests INSIDE truncated name Texts — zero layout change on every site.
- [x] P5.2.2 All 6 sites + 2 bonus: ✅ SHIPPED.
  1. Seat cards (chip + grid + compact via `PlayerStrip seatPremium`) 2. Leaderboard rows
  (`toEntry.isPremium`, effective, no-write) 3. Friends rows (same rule) 4. Own profile
  header (live `usePremium()` store — flips the moment a purchase lands) 5. PlayerProfile
  header (public `isPremium` — P1.2.5) 6. GameOver order rows (`seatPremium` prop) +
  BONUS 1v1 `vs` subtitle (`opponentIsPremium` prop).
  Server seat source: `premiumUserIds[]` frozen at game creation (one `findMany` per match,
  never per sync) → `GameSyncDto.premiumUserIds` (protocol) → `useOnlineGame` (absent-
  tolerant like `grace`) → `seatPremium` seat map. Mid-match subscriptions appear next
  game — badges never pop in late. Recovery path resolves fresh (async fn).
- [x] P5.2.3 Same glyph everywhere, no tier colors (one tier — D1). ✅ SHIPPED.

**Verify P5:** theme unit test (both themes define every token — iterate keys); non-premium with
stale `midnight` setting renders light; badge appears on all 6 sites for premium, absent otherwise;
menus unchanged.

> P5 STATUS (2026-10-05): SHIPPED. Server `tsc` clean, 225/225 tests (2 new
> `premiumUserIdsFor` specs); mobile `tsc` clean, 95/95 tests; protocol rebuilt; per-file
> lint baselines identical (Friends 2E, PlayerProfile 2E+1W, useOnlineGame 2E+1W, GameScreen
> 16E+2W — all September, zero new). Badges need deployed server fields + a premium account
> to SEE — sandbox check at P9.

---

## 8. Ads runtime (P6 — placements decided: O1 yes, O2 yes, O3 REVISED)

O3 REVISION (2026-10-05, owner decision): NO fullscreen interstitial. Instead a small
horizontal banner pinned at the BOTTOM of the GameOverModal under all buttons — visible on
every result, never covering or moving one. Rationale: zero interruption of the rematch
loop (highest-retention flow), exempt from interstitial "unexpected" rules, volume beats
rate. The interstitial ad unit stays reserved for a possible future; no interstitial code
ships. ADS_CONFIG interstitial keys below remain as documented retune points.

All behavior centralized in `src/monetization/AdsManager.ts` + `ADS_CONFIG` (tune without refactors):

```ts
ADS_CONFIG = {
  bannerEnabled: true,                 // O1/O2
  bannerScreens: ['PLAY','HISTORY','LEADERBOARD'],
  interstitialEnabled: true,           // O3
  interstitialMinGames: 2,             // show at most 1 per N completed games
  interstitialMaxPerDay: 3,
  interstitialMinGapSec: 180,
  interstitialMinGameSec: 60,          // skip after instant resigns/forfeits
  skipFirstSession: true,              // zero ads until 2nd app launch
  premiumHidesAll: true,               // D1.1 — single check in AdsManager
};
```

- [x] P6.1 SDK installed (`react-native-google-mobile-ads` 17.2.0) + `app.json` plugin with
  `androidAppId`. ✅ DONE earlier (P0/P2 track). Dev builds only.
- [x] P6.2 Real provider: ✅ SHIPPED (2026-10-05). `src/monetization/realAds.ts` —
  lazy-require SDK boundary (web/Expo Go/missing module → UnavailableProvider, app runs as
  if ads don't exist), UMP info-update + form BEFORE `initialize()` (library requirement),
  G-rated request config, `RealRewardedProvider` (load-with-timeout, earned-vs-dismissed
  resolution, in-flight sharing, auto-rewarm), `installRealAds()` at App boot.
  No AdsManager class needed — the provider interface + `ADS_CONFIG` constants already
  centralize behavior; no interstitial counters ship (no interstitial).
- [x] P6.3 Banner slots (`AdBanner`, anchored adaptive, fixed 56px reserve): ✅ SHIPPED.
  Home (replaces the `adBanner` placeholder), History + Leaderboard list footers BELOW the
  pager buttons (O1/O2). Mounts only when premium==false AND sessions>=2 AND load succeeds;
  premium/first-session/no-SDK/failure → null (pre-layout, nothing shifts).
- [x] P6.4 In-modal banner (revised O3): ✅ SHIPPED. `GameOverModal` bottom slot under Close
  Match — every button sits above it, so fills and failure-collapses can't move a tap
  target. Same gating as all slots.
- [x] P6.5 Rewarded path: ✅ SHIPPED. Real provider under the P3 interface, zero caller
  changes; `preloadRewarded('analysis')` already fired on completion; `__DEV__` uses Google
  demo units unconditionally (zero invalid-traffic risk — test-device status irrelevant).

### P6 policy guardrails (hard rules, review checklist in P9)

- No fullscreen ads ship at all — the interstitial rules from the original plan are moot
  unless the reserved unit is ever activated (requires a new P6.x entry + O-approval).
- Banners: below all interactive content on every surface; fixed reserve so fills never
  shift buttons; failures collapse (only space beneath buttons is affected); G-rated.
- Rewarded ads exempt from interstitial policy (explicit opt-in) — intro copy stays
  honest ("short video", never a duration).
- `__DEV__` demo units always; production IDs only in release builds.

**Verify P6:** airplane → no crash, no blank holes (slots collapse); premium → zero ad views
(assert via event log); `tsc` + visibility/session unit tests.

> P6 STATUS (2026-10-05): SHIPPED except on-device proof (needs the EAS build with both
> SDKs installed — Expo Go/old builds/web render no ads by design). `tsc` clean, 107/107
> mobile tests (6 new: unit selection, visibility matrix, session counting, safe install),
> lint zero new (App at 5-warning baseline). Manual matrix on the dev-build phone: demo
> banner on Home + modal, demo rewarded via Analyze → unlock → review (T2/T3).
>
> WEB BOUNDARY FIX (2026-10-05, post-review): the lazy `require` did not stop Metro from
> *bundling* the SDK on web (bundle failed on RN internals). All SDK access now lives in
> `adsNative.ts` with an `adsNative.web.ts` stub Metro resolves instead on web; `realAds.ts`
> is pure. Verified by a clean `expo export --platform web`. iOS is additionally gated off
> in `loadSdk()` (no `iosAppId` registered yet — the SDK crashes on init without one);
> registering the iOS AdMob app + plugin key + deleting that branch is a P0 follow-up
> before any iOS build.

---

## 9. Paywall UX + Settings (P7)

- [x] P7.1 `src/components/PremiumSheet.tsx`: ✅ SHIPPED (2026-10-05). GuestGate-pattern
  bottom sheet: crown header, 5 one-line bullets, plan selector (yearly preselected, "Best
  value"), dynamic prices from RevenueCat packages (`priceString` + `introPrice` → promo
  windows render themselves; static $3.99/$24.99 fallback with "Available soon" buy state
  until the P0.5 key exists), full Play disclosure visible with no extra taps, purchasing
  spinner, inline error + retry, silent user-cancel, Restore row, "Not now". Guest taps
  route to the link-first card (P2.4) and auto-continue after linking.
- [x] P7.2 Entry points: ✅ SHIPPED. Settings card (`entry=settings`), locked bot tap
  (`entry=bots`, App-level mount), locked theme tap (`entry=theme`), RewardSheet link
  (`entry=analysis`, GameScreen mount). No hard paywall, no onboarding paywall (O4).
- [x] P7.3 Settings PREMIUM card (ACCOUNT ↔ DISPLAY NAME): ✅ SHIPPED. Free → upgrade row;
  premium → active state + Manage button opening the Play Subscription Center (legally
  required cancel path). Restore lives in the sheet. Membership reads strictly live
  entitlement (never a dev flag).
- [x] P7.4 Status display: ✅ SHIPPED. Settings card + name badges (P5.2). No other chrome.
- [x] P7.5 Analytics: ✅ SHIPPED minimal bus (`track()` + bounded buffer, dev-logged, silent
  in prod; one-file swap when an SDK lands). Events live: paywall_viewed, plan_selected,
  trial_started, purchase_completed/failed, restored. Reward/interstitial/entitlement events
  fire when P6 lands and refresh paths call them.

> P7 STATUS (2026-10-05): SHIPPED except live purchasing (needs P0.5 RevenueCat key +
> products — the sheet degrades to "Available soon" until then, by design). `tsc` clean,
> 101/101 mobile tests (6 new: offers fallback/live-mapping/guest-guard + analytics
> buffer/cap), lint zero new (App back to 5-warning baseline). Live purchase/restore/trial
> matrix re-runs at P9 (T4–T8).

**Verify P7:** every entry opens sheet; guest entry → link-first flow (P2.4) then purchase;
cancel during trial → entitlement lapses at trial end (sandbox); copy matches Play disclosure
checklist (price, period, auto-renew, trial terms, cancel path, not-required statement).

---

## 10. Legal + policy updates (P8 — release blocker)

Current docs promise no ads/purchases — shipping monetization without updating = policy +
truth-in-advertising violation.

- [x] P8.1 Mobile `src/legal-content.ts`: ✅ SHIPPED (2026-10-05). Ad ID + AdMob/RevenueCat
  data-use rewrite, Premium subscription terms section ($3.99/$24.99, trial, renewal,
  cancel, promos, guest-link rule), deletion docs carry the cancel-first warning.
  `LEGAL_VERSION` bumped to 2026-10-05 → onboarding re-asks acceptance automatically.
- [x] P8.2 Server `src/legal/legal-content.ts`: ✅ SHIPPED. Same updates (data table +
  Premium §6, renumbered 1–10 verified; "$0" line now "free players who never subscribed:
  $0"; package name corrected to `com.asdigital.duoorb`; delete page lists subscription
  records + cancel-first warning).
- [x] P8.3 UMP consent: ✅ CODE SHIPPED (info-update + form before `initialize()`, G-rated
  config — live since P6). REMAINING: EEA-simulated test at P9; Data-safety form entries
  (dashboard, with owner).
- [ ] P8.4 Play listing: update description/screenshots if they claim "no ads"; complete the
  subscriptions declaration + target-age/ads declaration honestly. OWNER DASHBOARD TASK.

**Verify P8:** legal screens render updated copy offline (`LegalScreen` reader path);
Play Console declarations submitted; UMP shows in EEA-simulated test.

---

## 11. Testing + launch matrix (P9)

### P9.1 — Automated

- [ ] Server vitest: E1 duplicate webhook, E2 out-of-order, E3 cancel→resubscribe, E4 billing-issue
      grace, lazy-expiry on `/me`, bad-secret 401, unknown-user 200+warn.
- [ ] Mobile vitest: `getAnalysisAccess` state machine (locked/unlocked/premium/expired),
      AdsManager caps (1-per-2, 3/day, gap, short-game skip, first-session skip),
      theme token parity (midnight defines every `light` key), roster validation.
- [ ] `tsc --noEmit` + `expo lint` zero new violations per phase (existing baseline documented).

### P9.2 — Manual matrix (internal track + license testers + demo ad units)

| # | Test | Pass criteria |
|---|------|---------------|
| T1 | Fresh install → guest → 3 games | Zero ads, zero paywalls; analysis gate appears on 1st Analyze tap |
| T2 | Free → Analyze → watch ad → review | Reward fires → review opens; 2nd Analyze on same game = no ad |
| T3 | Ad closed early | No unlock, no error, sheet intact |
| T4 | Locked bot tap (guest) | Link prompt → link → paywall → sandbox buy → bot unlocked |
| T5 | Yearly trial → cancel in trial | Premium till trial end, then free; badge/badges disappear; theme falls back |
| T6 | Expiry while app open | Current review stays; next gate re-locks |
| T7 | Restore on 2nd device | Premium present after sign-in, no second purchase |
| T8 | Refund (if revoke enabled) | Immediate free tier |
| T9 | Airplane all flows | No crashes; ads show unavailable; premium cache gates correctly |
| T10 | Interstitial caps | 2 quick games → max 1 ad; 4th game same day → none; <60s game → none |
| T11 | Webhook down (server 500) | Purchase still grants via client `getCustomerInfo` fast-path on next `/me` sync; webhook retry reconciles |
| T12 | UMP consent (EEA) | Consent wall before any ad request; decline → no ad calls at all |

### P9.3 — Launch sequence

1. Ship P1→P2→P7 behind a killed switch? No remote-config infra exists — instead ship Premium
   fully but keep `ADS_CONFIG.interstitialEnabled=false` until retention baseline (2 weeks) is read.
2. Enable banner → watch D1/D7 + ANRs.
3. Enable interstitial (if O3 approved) → watch D7 + `interstitial_dismissed` rate.
4. Rewarded analysis live from day one (opt-in — no retention risk).

---

## 12. Work order + what to build first

```
P0 dashboards ──→ P1 server entitlement ──→ P2 client premium/purchases ──→ P3 analysis+rewarded
       │                                                              │
       │ (P0.1–0.3 AdMob setup can parallel P1–P2)                     ▼
       │                                              SHIP 1: Premium live (no-ads + analysis + bots?)
       ▼
P4 bots ──→ P5 theme+badge ──→ P6 ads runtime ──→ P7 paywall/settings ──→ P8 legal ──→ P9 test/launch
```

**Implement first (minimum viable monetization): P0 → P1 → P2 → P3 → P7 → P8 → P9.**
That slice = subscriptions sellable, no-ads + per-game-ad analysis working, paywall + settings +
legal compliant. Bots (P4), theme/badge (P5), banner/interstitial (P6) layer on afterward without
rework — every interface they need (`usePremium`, `PremiumSheet`, `AdsManager`) already exists.

---

## 13. Master edge-case register (all phases)

E1–E16 defined inline above. Global additions:

| # | Case | Handling |
|---|------|----------|
| E17 | RevenueCat outage at purchase time | Play still charges; client `getCustomerInfo` shows entitlement → grant fast-path; webhook reconciles later |
| E18 | User refunds via Play, keeps using app | Next `/me` (≤24h or foreground refresh) flips to free; no retroactive punishment |
| E19 | Price change later ($3.99→$X) | Play notifies; existing subs grandfathered per Play rules; update sheet copy + tests |
| E20 | Family sharing / multi-account on one device | Entitlement follows signed-in `userId`, never device — account switch re-syncs |
| E21 | Child / low-age account | No age-gated content exists; ads follow Families policy via AdMob settings (max-ad-content-rating G) |
| E22 | AdMob account limited/suspended | `AdsManager` fails closed: gates fall back to "unavailable, try Premium" — app never breaks |
| E23 | `midnight` theme + old app version after downgrade | Unknown `themeName` → default `light` (whitelist parse in settings load) |
| E24 | Analysis unlock cache bloat | Key per gameId; prune entries older than 30 days on boot (same pass as E23-style hygiene) |
| E25 | Promo subscriber renews at full price and complains/churns | Expected Play behavior — promo copy (P7.1) must show renewal price/date upfront; analytics: tag promo cohorts (`intro_offer:true`) and compare trial-to-paid + month-2 retention vs full-price cohorts before repeating a promo |

---

*End of plan. Phase sign-off gate: user approves P0 product details (exact prices/trial), then
P1 ships. Placement disputes (O1–O4) resolved at P6 — code is placement-agnostic until then.*

---

## 14. Full code review (2026-10-05, post-P8 — all phases)

Reviewed every monetization diff (35 files, +1097/−89) plus all new files, then fixed
everything found. Verdict: **no remaining blockers.**

### Blockers fixed in review

| # | Finding | Fix |
|---|---------|-----|
| S1 | Stale out-of-order EXPIRATION could kill a newer entitlement (E2 guard covered grants only) | Expirations older than the last entitlement write (via `event_timestamp_ms`) are ignored; real refunds still apply. +2 specs |
| M1 | Post-purchase `/me` sync races the webhook (~seconds): paying users saw free tier after buying | Fire-and-forget re-sync (now + 8s) after every purchase/restore success |
| M2 | Account switch called `Purchases.configure()` twice (corrupts customer mapping) | Key-change → `configure()`; user-change → `Purchases.logIn()` |
| M3 | `trial_started` fired on non-trial purchases | Gated on `trialLine` presence |
| M4 | Premium cache not namespaced per account: sign-out → offline boot leaked the previous owner's tier | `clearPremium()` (memory + disk) on both sign-out paths; +spec |
| M5 | Preload racing show minted two rewarded instances with crossed listeners | Load serialization (`loading` promise shared) |
| M6 | Shown ad instances never destroyed (native leak per view) | `destroy?.()` before null + reload |
| M7 | `ensureAdsReady()` cached `false` forever (offline boot = dark all session) | `false` drops the memo so the next show retries |
| M8 | Lint: `AdBanner` sync `setLib` in effect; `realAds.spec` + `realAds.ts` warnings | Lazy initializer; import reorder; `T[]` syntax |

### Investigated, not blockers (accepted residuals)

- R1: game-core suite has 9 failures in `tests/ai*.test.ts` + `enclosure` — reproduced on clean HEAD (stashed): pre-existing, time-budget-sensitive, unrelated to monetization. Roster spec 6/6 green.
- R2: grant events without `expiration_at_ms` + null stored expiry → indefinite premium. RevenueCat always sends expiry on grants; accepted as theoretical-only.
- R3: `TRANSFER` webhook events are log-only. Correct: our App User ID is the stable DuoOrb userId; cross-account transfers resolve through restore/purchase events.
- R4: webhook deliveries for unknown users accumulate `SubscriptionEvent` rows (audit trail). Negligible volume; add retention prune only if it ever matters.
- R5: `getPremiumPlans` fails closed to static prices on any error (correct during outages; non-USD stores see USD fallback copy until P0.5 live data flows).
- R6: whole-project lint parity proven via eslint JSON ground truth (E:46 W:24 identical both trees). `expo lint` summary counts wobble ±3 between runs — aggregation noise, not signal.

### Final verification (post-review)

- Server: `tsc` clean, **227/227** tests (17 billing specs).
- Mobile: `tsc` clean, **108/108** tests, lint E:46 W:24 identical to baseline.
- game-core: `tsc` clean, roster 6/6 (9 pre-existing engine failures, see R1).
- Protocol: `tsc` clean (dist rebuilt via `postinstall` on every install/EAS build).
- Release blockers remaining (non-code): EAS build with SDKs, P0.4–P0.6 dashboards, P8.4 Play declarations, P9 device matrix, 3 temp DEV flags.

### Final-review fixes (2026-10-05, post-§14 — code changed, report-first rule lifted by owner)

- **B1 FIXED**: webhook checks profile BEFORE inserting the event row. Unknown users
  return inactive with nothing stored (was: FK violation → 500 retry loop). E1 duplicate
  semantics preserved (unique constraint still serializes concurrent redeliveries).
  Spec strengthened: unknown-user case asserts zero rows stored.
- **B2 FIXED**: `AdBanner` validates SDK shape (`BannerAd` defined + `BannerAdSize`
  present), not just require-truthiness. Broken modules on web/Expo Go keep the slot
  empty instead of crashing the screen.
