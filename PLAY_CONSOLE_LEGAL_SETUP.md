# Play Console - Legal URLs Setup (DuoOrb by AS Digital)

Package: `com.asdigital.duoorb` (Android + iOS). Developer name in Console: `AS Digital`. Support: `digitalas.support@gmail.com`.

Source of truth: web = `apps/server/src/legal/legal-content.ts` served by
`apps/server/src/legal/legal.controller.ts` (no login). In-app = `apps/mobile/src/legal-content.ts` rendered by `src/screens/LegalScreen.tsx` (offline, no browser needed).

## 1. Deploy first, then copy these URLs

Default prod base (override via `PUBLIC_BASE_URL` / `PUBLIC_WEB_URL`):

- Base: `https://duoorbapi.duckdns.org`
- Privacy: `https://duoorbapi.duckdns.org/legal/privacy`
- Terms: `https://duoorbapi.duckdns.org/legal/terms`
- Delete (web, no reinstall needed): `https://duoorbapi.duckdns.org/legal/delete-account`
- Index: `https://duoorbapi.duckdns.org/legal`
- JSON (debug): `https://duoorbapi.duckdns.org/legal/urls`

Verify before submitting (must work in incognito, no login, HTTPS):

```bash
curl -i https://duoorbapi.duckdns.org/legal/privacy | head -20
curl -i https://duoorbapi.duckdns.org/legal/terms | head -20
curl -i https://duoorbapi.duckdns.org/legal/delete-account | head -20
```

If you move docs to `https://duoorb.com`, set:
- Server: `PUBLIC_BASE_URL=https://duoorb.com` (+ redeploy)
- Mobile: `EXPO_PUBLIC_LEGAL_BASE_URL=https://duoorb.com` (next EAS build)

## 2. Where to paste in Play Console

1. **App content > Privacy policy** -> Privacy URL (above).
2. **App content > Data safety > Data deletion** ->
   - `Does your app provide a way for users to request deletion?` = Yes
   - Deletion web link = `.../legal/delete-account`
   - In-app deletion path = `Profile tab > Settings (gear) > Danger Zone > Delete account & data (calls DELETE /api/me)`
3. **Store listing > Contact** -> `digitalas.support@gmail.com` (or `LEGAL_CONTACT_EMAIL`).
4. **App access** (if reviewer needs login): create a demo Google account + a guest with friends/history, document:
   - `Install > Continue as Guest works with no credentials. For full social test use demo@gmail.com / <password> (friends + history pre-filled).`
5. **Content rating / Target audience**: DuoOrb is 13+, no chat, fixed emoji reactions only, no gambling/ads.

## 3. In-app locations (reviewer can verify - no browser needed)

- First launch: `Welcome > tick "I agree to Terms + Privacy" (checkbox gates both buttons) > tap Terms/Privacy opens native reader modally`. Acceptance stored as `@duoorb:legal-accept:v1` (version `2026-10-01`); no account is created until ticked, so acceptance always precedes the first username/bio/avatar (UGC rule).
- Anytime: `BottomNav PROFILE or PLAY > gear > Settings > LEGAL > Privacy / Terms / Delete` opens `LegalScreen` natively (offline). Each screen has `Open web version` for the canonical https URL.
- Delete: `Settings > DANGER ZONE > Delete account & data` double-confirm calls `DELETE /api/me`, then signs out.
- Web fallback: `Settings > Legal > Delete` web button + `/legal/delete-account` explains the email request (`digitalas.support@gmail.com`, subject `Delete my DuoOrb account`, 30-day SLA).

## 4. What deletion does (for Data Safety answers)

`DELETE /api/me` (Bearer required):
- Revokes guest sessions/tokens first
- Deletes Supabase Auth user via admin API for Google accounts (`u_*` guests skip - local only)
- Deletes PG `User` row, cascading: profile, ratings, rating history, game-player links, friend requests, friendships, blocks, AI wins, achievements, badge slots, guest sessions
- Finished `Game` rows stay without the deleted seat so opponents keep history
- Mobile then signs out + wipes `@duoorb:identity:v2` + socket + onboarding -> back to Welcome
- Backups age out within 90 days; security/fraud logs only if legally required (disclosed on request)

Test:

```bash
# as logged-in user
curl -X DELETE https://duoorbapi.duckdns.org/api/me -H "Authorization: Bearer <token>"
# expect {"deleted":true,"userId":"..."}
```

## 5. Env checklist

- Server/prod: `PUBLIC_BASE_URL`, `LEGAL_CONTACT_EMAIL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (for Auth admin delete), `SUPABASE_JWKS_URL`, `DATABASE_URL`, `GUEST_TOKEN_SECRET`, `CORS_ORIGINS`
- Mobile EAS prod: `EXPO_PUBLIC_SERVER_URL=https://duoorbapi.duckdns.org` (never localhost), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, optional `EXPO_PUBLIC_LEGAL_BASE_URL`, `EXPO_PUBLIC_LEGAL_CONTACT_EMAIL`
- Never put `SUPABASE_SECRET_KEY` in mobile (`EXPO_PUBLIC_*` is embedded in the bundle).

## 6. UGC moderation (for the Play UGC questionnaire)

- Terms acceptance: Welcome checkbox gates Guest/Google creation; stored as `@duoorb:legal-accept:v1`.
- Report: `PlayerProfile > Report` (reason + details -> `POST /api/reports`, 10/day cap, `reports` table queue). Search results and History opponents open the same profile, so every UGC surface reaches Report in ≤2 taps.
- Block/Unblock: `PlayerProfile > Block/Unblock` (`POST|DELETE /api/friends/block/:userId`), `Friends > slash icon` + `BLOCKED` section with Unblock (`GET /api/friends/blocks`).
- Filters: `apps/server/src/moderation/profanity.ts` enforced on username/displayName/bio saves (400 on violation, mirrored in `usernamePolicy.ts`); avatars must be `https:` URLs.
- No chat anywhere: match reactions are a fixed emoji set, ephemeral, never stored - declare "No chat" in Data Safety.
- After deploy run `npm run db:push --workspace=@duoorb/server` once for the `reports` table, then `npm run db:generate --workspace=@duoorb/server`.
