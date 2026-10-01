# Play Console - Legal URLs Setup (DuoOrb)

Source of truth: `apps/server/src/legal/legal-content.ts`, served by
`apps/server/src/legal/legal.controller.ts` with no login required.

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
3. **Store listing > Contact** -> `support@duoorb.com` (or `LEGAL_CONTACT_EMAIL`).
4. **App access** (if reviewer needs login): create a demo Google account + a guest with friends/history, document:
   - `Install > Continue as Guest works with no credentials. For full social test use demo@gmail.com / <password> (friends + history pre-filled).`
5. **Content rating / Target audience**: DuoOrb is 13+, no chat, fixed emoji reactions only, no gambling/ads.

## 3. In-app locations (reviewer can verify)

- First launch: `Welcome > below Continue as Guest > Terms + Privacy Policy links`.
- Anytime: `BottomNav PROFILE or PLAY > gear > Settings > LEGAL (Privacy, Terms, Delete help) + DANGER ZONE (Delete account & data with double confirm)`.
- Web fallback: `Settings > Legal > Delete account & data` opens the same `/legal/delete-account` page that explains the email request (`support@duoorb.com`, subject `Delete my DuoOrb account`, 30-day SLA).

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
