# DuoOrb.com Migration — Analysis + Implementation Plan

> Bought: `duoorb.com` + `support@duoorb.com`.
> Decision (locked): backend/API = `https://api.duoorb.com`, website = `https://duoorb.com`.
> Current prod still on `https://duoorbapi.duckdns.org` + `digitalas.support@gmail.com`.
> This file is ANALYSIS + PLAN ONLY. No code was changed to write it.
> Secrets are referenced by LOCATION, never written here.

---

## 1. Where we are today (proven working)

- API + legal + `app-ads.txt` all served by the same Nest server on the VPS.
- Public entry = Caddy (TLS) → `127.0.0.1:4000` (see `docker-compose.yml:27-30`, `apps/server/src/main.ts:13-16`).
- Canonical prod base: `https://duoorbapi.duckdns.org`
  - Privacy: `…/legal/privacy`
  - Terms: `…/legal/terms`
  - Delete: `…/legal/delete-account`
  - Ads: `…/app-ads.txt` (must stay at domain ROOT, not `/legal/*` — `apps/server/src/legal/ads-txt.controller.ts:7-15`)
- Play listing Website + AdMob verification domain = `https://duoorbapi.duckdns.org` (`SETUP_JOURNEY.md:22-25,33`).
- RevenueCat webhook = `POST https://duoorbapi.duckdns.org/api/billing/revenuecat` (`SETUP_JOURNEY.md:76-83`).
- Contact everywhere = `digitalas.support@gmail.com`.
- Mobile bakes `EXPO_PUBLIC_SERVER_URL` at BUILD time — changing domain = mandatory rebuild + `versionCode+1` + new AAB.

---

## 2. Target state (api = backend, apex = website)

| Item | Old | New |
|---|---|---|
| API canonical (app, socket, legal, webhook) | `https://duoorbapi.duckdns.org` | `https://api.duoorb.com` |
| Website (Play listing + AdMob verification) | duckdns URL | `https://duoorb.com` (+ `https://www.duoorb.com` alias). For NOW both serve the same Nest backend, so `/app-ads.txt` + `/legal/*` 200 on BOTH hosts. Later a real marketing site can replace apex, but it must keep serving `/app-ads.txt`. |
| Legal canonical | `duoorbapi.duckdns.org/legal/*` | `https://api.duoorb.com/legal/*` (identical copy also live at `duoorb.com/legal/*` while same Caddy backend serves both) |
| `app-ads.txt` content | same line | UNCHANGED (`google.com, pub-6057010656402010, DIRECT, f08c47fec0942fa0`); must 200 on BOTH `api.duoorb.com` and `duoorb.com` (same controller) |
| RevenueCat webhook | `duoorbapi.duckdns.org/api/billing/revenuecat` | `https://api.duoorb.com/api/billing/revenuecat` |
| Support inbox | `digitalas.support@gmail.com` | `support@duoorb.com` |
| Play Website | duckdns URL | `https://duoorb.com` |
| Play contact | gmail | `support@duoorb.com` |
| Play Privacy URL | duckdns `/legal/privacy` | `https://api.duoorb.com/legal/privacy` (apex copy works too; pick api as canonical so it matches what the app opens) |
| Data Safety deletion link | duckdns `/legal/delete-account` | `https://api.duoorb.com/legal/delete-account` |
| AdMob Website / verification | duckdns | `https://duoorb.com` |
| Mobile `EXPO_PUBLIC_SERVER_URL` | duckdns | `https://api.duoorb.com` |
| Server `PUBLIC_BASE_URL` | duckdns | `https://api.duoorb.com` |
| Server `PUBLIC_WEB_URL` | (defaults to BASE) | leave UNSET (so footers render api URLs). Do NOT set it to `duoorb.com` — `legal-content.ts:20` prefers `PUBLIC_WEB_URL` and would split canonical URLs. |
| Server `LEGAL_CONTACT_EMAIL` | gmail | `support@duoorb.com` |
| `CORS_ORIGINS` | unset (native-only today) | `https://duoorb.com,https://www.duoorb.com,https://api.duoorb.com` (only matters if web build ships) |

What does NOT change: package `com.asdigital.duoorb`, AdMob App ID `ca-app-pub-6057010656402010~3789437235` + 3 unit IDs, RevenueCat entitlement `premium` / offering `duoorb_premium` / key `goog_…` (location: `apps/mobile/.env.local`), Supabase project URL/keys, upload keystore `C:\keys\duoorb-upload.keystore`.

---

## 3. Domain design (locked per your call)

- `api.duoorb.com` = backend canonical. App, socket, `/api/*`, `/legal/*`, webhook all live here. This is `PUBLIC_BASE_URL` + `EXPO_PUBLIC_SERVER_URL`.
- `duoorb.com` (+ `www`) = website. Play Website + AdMob verification point here. During transition Caddy routes apex + www to the SAME Nest backend, so `duoorb.com/app-ads.txt` and `duoorb.com/legal/*` return byte-identical responses to the api host. No separate site needed yet.
- Later, if a real marketing site lands on apex: it MUST still serve `/app-ads.txt` with the exact publisher line, otherwise AdMob goes red. API stays on `api.duoorb.com` untouched.

---

## 4. How to link `duoorb.com` to the VPS (full steps)

You bought the NAME; now point its DNS at the MACHINE running Caddy + `duoorb-server`.

### 4.1 Find your VPS public IP (on the VPS/SSH)

```bash
curl -4 ifconfig.me
# example output: 15.237.181.59  <- your A-record value (confirmed)
```

Also confirm Caddy holds 80/443 and find the Caddyfile:

```bash
sudo ss -tlnp | grep -E ':80|:443'
cat /etc/caddy/Caddyfile 2>/dev/null || cat ~/Caddyfile 2>/dev/null || caddy fmt --overwrite 2>&1 | head -5
```

Note the Caddyfile PATH — needed in §5. CONFIRMED: `/etc/caddy/Caddyfile` (single block `duoorbapi.duckdns.org → 127.0.0.1:4000`, Caddy listening on :80 + :443).

### 4.2 Registrar DNS panel (where you bought duoorb.com)

Create these records (VPS IP `15.237.181.59`; TTL 300–600 during migration):

| Type | Host/Name | Value | Purpose |
|---|---|---|---|
| `A` | `@` | `15.237.181.59` | `duoorb.com` → VPS (website) |
| `A` | `www` | `15.237.181.59` | `www.duoorb.com` → VPS (alias) |
| `A` | `api` | `15.237.181.59` | `api.duoorb.com` → VPS (backend) |
| `AAAA` | `@` / `www` / `api` | (only if VPS has IPv6) | optional, skip if unsure |
| keep | DuckDNS | untouched | fallback until cutover proven |

Do NOT delete/move email `MX` records your mail setup added. Web `A` + mail `MX` coexist fine.

Verify propagation (expect `15.237.181.59` on all three):

```bash
nslookup duoorb.com
nslookup www.duoorb.com
nslookup api.duoorb.com
# or:
dig +short duoorb.com
dig +short www.duoorb.com
dig +short api.duoorb.com
```

Wait until all three resolve globally (5 min–4 h; `https://dnschecker.org` if unsure).

### 4.3 Email `support@duoorb.com` — verify BEFORE publishing it

1. Mail provider (Workspace / registrar / Cloudflare Routing — whichever you used), confirm:
   - `MX` present for `duoorb.com`
   - `SPF` TXT on `@` includes sender (e.g. `v=spf1 include:_spf.google.com ~all` for Workspace)
   - `DKIM` TXT enabled + verifying
   - `DMARC` TXT on `_dmarc` (start `v=DMARC1; p=none; rua=mailto:support@duoorb.com`)
2. Send test both ways: `support@` → gmail AND gmail → `support@`. Both must arrive, not spam.
3. Only AFTER green, swap contact (Phase C). Until then keep gmail live.

---

## 5. Server / Caddy changes (on the VPS, NOT in repo code)

Current Caddy has ONE site block for `duoorbapi.duckdns.org` → `127.0.0.1:4000`. Extend to FOUR names on the SAME backend, keep old host until cutover:

```caddy
# TRANSITION Caddyfile (illustrative — adapt to your real file from §4.1)
api.duoorb.com, duoorb.com, www.duoorb.com, duoorbapi.duckdns.org {
    reverse_proxy 127.0.0.1:4000
}
```

Steps:

1. `sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-duckdns` (path per §4.1).
2. Add `api.duoorb.com, duoorb.com, www.duoorb.com` to the site line (keep duckdns for now).
3. `sudo systemctl reload caddy` (or `caddy reload`).
4. Caddy auto-issues Let's Encrypt certs for the three new names (port 80 must be open — it is, duckdns TLS already works).
5. Verify (ALL must 200, `app-ads.txt` byte-identical everywhere):
   ```bash
   curl -i https://api.duoorb.com/legal/privacy | head -20
   curl -i https://api.duoorb.com/app-ads.txt
   curl -i https://duoorb.com/app-ads.txt
   curl -i https://www.duoorb.com/app-ads.txt
   curl -i https://duoorbapi.duckdns.org/app-ads.txt
   curl -i https://api.duoorb.com/legal/delete-account | head -5
   ```

Rollback: restore `.bak-duckdns`, reload — 30 seconds.

---

## 6. Every code/config reference to update (inventory — DO NOT edit yet)

Order: server env FIRST (dual-serve), consoles SECOND, mobile rebuild LAST (bakes URL).

### A. Server deploy env (on VPS, `~/DuoOrb/.env` per SETUP_JOURNEY)

| Var | Old | New |
|---|---|---|
| `PUBLIC_BASE_URL` | `https://duoorbapi.duckdns.org` | `https://api.duoorb.com` |
| `PUBLIC_WEB_URL` | (defaults to BASE) | leave UNSET |
| `LEGAL_CONTACT_EMAIL` | `digitalas.support@gmail.com` | `support@duoorb.com` (only after §4.3 proven) |
| `CORS_ORIGINS` | unset | `https://duoorb.com,https://www.duoorb.com,https://api.duoorb.com` |

Then: `docker compose up -d server` + re-run `curl` checks in §5 (footers now say `api.duoorb.com`).

Repo defaults in the SAME later commit (not now):

- `docker-compose.yml:52-53` — defaults → `https://api.duoorb.com`
- `docker-compose.yml:54` — `LEGAL_CONTACT_EMAIL` default → `support@duoorb.com`
- `docker-compose.yml:48` — extend CORS comment to include `https://api.duoorb.com`
- `.env.example:47,49` — comment + `PUBLIC_BASE_URL` → `https://api.duoorb.com`
- `.env.example:51` — `LEGAL_CONTACT_EMAIL=support@duoorb.com`
- `apps/server/.env.example:24,26` — same two values
- `apps/server/src/legal/legal-content.ts:22` — fallback → `'https://api.duoorb.com'`
- `apps/server/src/legal/legal-content.ts:15` — fallback → `'support@duoorb.com'`

No logic change: `ads-txt.controller.ts` (host-independent), `cors.ts` (env-driven), `main.ts` (proxy/TRUST unchanged).

### B. Mobile (requires NEW AAB — plan it, don't trigger yet)

- `apps/mobile/.env.local` (gitignored, YOUR PC): `EXPO_PUBLIC_SERVER_URL=https://api.duoorb.com`
- `apps/mobile/.env.example:16,18` — commented examples → `https://api.duoorb.com` + `support@duoorb.com`
- `apps/mobile/src/legal.ts:36` — fallback → `'support@duoorb.com'`
- `apps/mobile/src/legal-content.ts:58,81,108` — three gmail bodies → `support@duoorb.com` + bump `LEGAL_VERSION` (`legal-content.ts:13`, now `2026-10-05`) IF you want re-accept; email-only swap doesn't force it, but reviewers like a fresh date.
- `apps/mobile/src/network/config.ts:3-5` — NO change (env-driven).
- `apps/mobile/app.json` + `eas.json` — NO URL fields; only `versionCode+1` at build (now 4 → 5).
- `EXPO_PUBLIC_LEGAL_BASE_URL` — stay UNSET (legal follows `SERVER_URL` = api host, zero extra config).

Build recipe (per `SETUP_JOURNEY.md:95-109` + new URL): bump versionCode → `npx expo prebuild` → re-apply signing block if wiped → `.\gradlew bundleRelease -PRNGMA_ANDROID_BACKEND=classic` → `jarsigner -verify` → upload.

### C. Docs (same commit as code, not now)

- `PLAY_CONSOLE_LEGAL_SETUP.md` — duckdns → `api.duoorb.com` for Base/Privacy/Terms/Delete/Index/JSON + curl + `DELETE /api/me` test; Website row → `https://duoorb.com`; contact → `support@duoorb.com`; `PUBLIC_BASE_URL=https://api.duoorb.com`; mobile `EXPO_PUBLIC_SERVER_URL=https://api.duoorb.com`
- `SETUP_JOURNEY.md` — keep history as-is; APPEND cutover entry (don't rewrite)
- `MONETIZATION.md:90` — verify URL → `https://api.duoorb.com/app-ads.txt` AND `https://duoorb.com/app-ads.txt`
- `PRE_PUBLISH_ANALYSIS.md:129,237` — duckdns refs → `api.duoorb.com`
- `README.md` — `grep` again at implementation time

---

## 7. External consoles (click-ops, in ORDER — after §5 verifies 200s)

1. **Supabase → Authentication → URL Configuration**
   - Add (keep existing): `https://api.duoorb.com/**`, `https://duoorb.com/**`, `https://www.duoorb.com/**` (native `duoorb://**` + PKCE in `apps/mobile/src/lib/supabase.ts:27-41` unaffected — don't delete).
   - Optional: Auth → Email Templates → From → `support@duoorb.com` (after §4.3).
2. **RevenueCat → Integrations → Webhook**
   - Add SECOND endpoint FIRST: `https://api.duoorb.com/api/billing/revenuecat`, same `Bearer` secret (server deploy env `REVENUECAT_WEBHOOK_SECRET`), same events.
   - Test event → 200 + `unknown user` log. Then make api primary, keep duckdns 7 days, delete.
3. **AdMob → Apps → DuoOrb → App settings**
   - Website → `https://duoorb.com`. Wait ~24 h → green (`curl https://duoorb.com/app-ads.txt` already 200 from §5; `api.duoorb.com/app-ads.txt` identical is a bonus).
   - Doesn't lift `Limited ad serving` alone — still needs PUBLIC Play listing + approval.
4. **Google Play Console** (URL-only saves, no AAB needed — but they only MATTER once the api AAB ships in §8)
   - Store listing → Website: `https://duoorb.com`
   - Store listing → Contact: `support@duoorb.com` (§4.3 must be green)
   - App content → Privacy policy: `https://api.duoorb.com/legal/privacy`
   - Data safety → Deletion link: `https://api.duoorb.com/legal/delete-account` (in-app path unchanged)
   - Open each in incognito (no login, HTTPS) BEFORE saving.

---

## 8. Cutover sequence

- [x] Phase 0 — Mail green both ways (§4.3, confirmed 2026-10-06 `support@duoorb.com` working). VPS IP `15.237.181.59` + Caddyfile `/etc/caddy/Caddyfile` recorded.
- [x] Phase 1 — DNS `A @` + `A www` + `A api` → `15.237.181.59`. `dig` green (Caddy obtained certs for `www.duoorb.com`, `curl` 200s on 2026-10-06).
- [x] Phase 2 — Caddy 4 names (`/etc/caddy/Caddyfile`), reload OK, `curl` `api/duoorb.com/app-ads.txt` 200 identical + `/legal/privacy` 200.
- [x] Phase 3 — Server env `PUBLIC_BASE_URL=https://api.duoorb.com` + `LEGAL_CONTACT_EMAIL=support@duoorb.com`, redeployed, footer `curl` proof green (privacy shows `support@` + `api.duoorb.com/legal/*`).
- [x] Phase 4 — Supabase allowlist + RevenueCat second webhook 200 + AdMob Website (§7.1-7.3) (confirmed by user 2026-10-06).
- [x] Phase 5 — Play URLs saved: Website `https://duoorb.com`, contact `support@duoorb.com`, Privacy/Deletion on `api.duoorb.com/legal/*` (§7.4) (confirmed by user 2026-10-06).
- [ ] Phase 6 — Mobile §6B edits DONE in repo + `.env.local` → api + `versionCode` 4→5; STILL TO DO: fresh AAB with `EXPO_PUBLIC_SERVER_URL=https://api.duoorb.com`, `jarsigner -verify`, upload.
- [ ] Phase 7 — Live proof on api build: legal opens, `DELETE /api/me` doc reachable, license-tester purchase → webhook 200 on api host → Premium flip.
- [ ] Phase 8 — 7-day soak all hosts live. Then: delete duckdns webhook endpoint, Caddy drop duckdns (or keep 301 → api — recommended keep one cycle), Play/AdMob re-verify green.

---

## 9. Risks + mitigations

| Risk | Hit if | Mitigation |
|---|---|---|
| Old builds hard-break | AAB still duckdns AND duckdns retired early | Keep `duoorbapi.duckdns.org` ≥ one release cycle (or 301 → api) |
| TLS fail on new names | DNS not propagated before Caddy reload | `dig` green first; `caddy reload` atomic; duckdns block stays as fallback |
| `app-ads.txt` red | Play Website host doesn't serve file | Both apex + api serve same controller now; if a future marketing site replaces apex, it must copy the exact line |
| Apex/api legal split confuses reviewer | Privacy on api but Website on apex | Both URLs serve identical doc during transition — note it in review notes; canonical = api (matches in-app links) |
| Deletion black hole | `support@` published before MX/DKIM proven | §4.3 gate blocks contact swap |
| Double webhook grant | duckdns + api endpoints both live | Handler idempotent per `event.id`; delete old after soak |
| CORS break web | `CORS_ORIGINS` misses a host | Exact `https://duoorb.com,https://www.duoorb.com,https://api.duoorb.com`; native ignores CORS |
| Legal drift | Web updated, in-app still gmail | Same-AAB ship; `grep digitalas.support@gmail.com apps/mobile/src` = zero before build |

---

## 10. Open questions

1. Registrar = ? (only for click-path screenshots — steps above work anywhere).
2. Mail provider for `support@` = ? (determines SPF/DKIM click-path).
3. ~~VPS IP~~ — LOCKED: `15.237.181.59`. Still needed: Caddyfile path from §4.1 (paste into implementation ticket).
4. ~~api vs apex canonical~~ — LOCKED: api = backend, apex = website.
5. Keep `duoorbapi.duckdns.org` as permanent 301 → `api.duoorb.com`, or delete after soak? (Recommendation: 301 one cycle.)

---

## 11. Implementation ticket (when you say "go")

1. DNS (`@`+`www`+`api`) + Caddy 4-name + `curl` proofs (§4–§5).
2. One commit: §6A + §6B + §6C; `tsc` + vitest + lint.
3. VPS env flip + `docker compose up -d server` + footer proofs.
4. Consoles: Supabase → RevenueCat (dual → cut) → AdMob → Play (§7).
5. `versionCode` 4→5 AAB with `EXPO_PUBLIC_SERVER_URL=https://api.duoorb.com`, upload, soak, retire duckdns (§8).
