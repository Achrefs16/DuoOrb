# Implementation Plan — Expert Response → Build Tasks (Web-Only)

> Source: `expertresonde.md` (1035 lines, read fully 2026-10-15) + current tree state (`DUOORB_WEB_EXPERT_BRIEF.md`).
> Scope: `apps/mobile/public/` + ONE server text sync (`apps/server/src/legal/legal-content.ts` §6). Mobile app (`src/`, `App.tsx`) untouched. Design frozen — only existing `css/style.css` classes. No competitor brands. No Notify-me. Both stores Coming Soon.
> Status: PLAN ONLY — no code changed in this pass.

---

## 0. Expert analysis — verdict and conflict resolutions

**Spot-checks passed:** expert line refs match reality (`index.html:506` + `about.html:60` Play-live contradiction ✅, `quoridor-online.html:185` missing dims ✅, `rules.html:333/+0.9` ✅, `app.html:187` 4-digit ✅, 7-bot truth ✅, orphan files ✅). The plan is technically sound and adopted with 4 adjustments:

| # | Expert says | Conflict | Resolution |
|---|---|---|---|
| 1 | DELETE `play.html` + 301 to `/` | Owner overlay links to `/play.html` (intercepted by JS) | Accept delete. Replace all `href="/play.html"` with `href="/"` + `data-duoorb-play="true"` (expert Part 1 §37), delete file, drop from sitemap, add `Disallow: /play.html` to robots. Needs a hosting-level 301 (static host config, outside repo — flag to owner). |
| 2 | Remove ad tags from about/privacy/terms/cookies/contact | We added tags to all 11 pages | Accept removal (5 pages). Ads stay on 7 editorial pages only. Inventory loss is the price of passing review. |
| 3 | Consent Mode v2 default-deny bootstrap, no custom CMP code (Funding Choices in dashboard) | We have zero consent | Accept. Paste-only JS, no CSS, no design impact. Dashboard step is owner-side (Part 2 §60). |
| 4 | Visible dates strategy | Owner removed visible dates | Keep owner rule: dates live in `dateModified` JSON-LD + sitemap `lastmod` only. Expert never demands visible dates. No conflict. |

**Risk notes:** (a) Default-deny consent throttles EEA ad serving until Funding Choices message is published — dashboard step must ship same release. (b) Anchor/Side-rail OFF is a dashboard toggle, not code — owner-side. (c) `showGame()` change unmounts `#duoorb-home` ads on entry — prevents overlap bans. (d) Deleting `play.html` without a hosting 301 leaves a soft-404 for crawlers — add redirect at host + keep `Disallow`.

---

## Phase A — Deletions, ad-tag gating, consent (do first, unblocks review)

- [ ] **A1.** Delete `public/play.html`. Remove from `sitemap.xml`. Add `Disallow: /play.html` to `robots.txt` (full robots rewrite in Phase E).
- [ ] **A2.** Replace every `href="/play.html"` with `href="/"` + `data-duoorb-play="true"`: `index.html` overlay (`:465,:487,:523`), any content-page references. Keep JS intercept as-is.
- [ ] **A3.** Remove `adsbygoogle.js` `<script>` from `about.html`, `privacy.html`, `terms.html`, `cookies.html`, `contact.html` (`:10/15` each). Keep on the 7 editorial pages.
- [ ] **A4.** Paste Consent Mode v2 default-deny bootstrap immediately above the ad tag on the 7 ad pages (`/`, `quoridor-online`, `rules`, `strategy` NEW, `bots-and-analysis` NEW, `what-is`, `app`). Exact snippet: expert Part 2 §62-80 (dataLayer, gtag consent default denied + regions list + `wait_for_update:500`, `ads_data_redaction`, `url_passthrough:false`).
- [ ] **A5.** `index.html` `showGame()`: switch to `home.style.display='none'` + `aria-hidden` + `body.duoorb-playing` + sessionStorage (expert §86-97). Keeps toggle/menu logic untouched.
- [ ] **A6.** P0 text fixes: store line → “Coming soon to Google Play and the Apple App Store. Play instantly in your browser or install the web app (PWA) today.” (`index.html:506`, `about.html:60`); `rules.html:7` meta “official rules guide” → “complete illustrated rules and tactical handbook”; `rules.html:142` H1 → “How to Play DuoOrb & Quoridor: Complete Illustrated Rules & Tactics”; `app.html:87` eyebrow → “Mobile App & PWA Edition”.
- [ ] **A7.** Owner dashboard (not code): publish Funding Choices IAB TCF v2.3 message for `duoorb.com`; turn OFF Anchor + Side-rail ads (exclude `/?room=*`, `/?join=*`).
- [ ] Verify A: grep `adsbygoogle` = 7 files only; `play.html` gone from disk + sitemap; consent snippet above tag on all 7; no `/play.html` hrefs remain.

## Phase B — Shared chrome + schema + assets (one pass, all pages)

- [ ] **B1.** Header nav (`.nav-links` + `#mobile-nav-drawer` + `#duoorb-webnav` + footer) → 6 links on ALL pages: Online (`/quoridor-online.html`) · Rules (`/rules.html`) · Strategy (`/strategy.html`) · AI & Analysis (`/bots-and-analysis.html`) · App (`/app.html`) · About (`/about.html`). Viral guide stays footer-linked (Learn col), not header.
- [ ] **B2.** Primary CTAs → `href="/"` (overlay keeps `data-duoorb-play="true"`).
- [ ] **B3.** Publisher schema on all 7 ad pages + About: add `author` + `publisher` (AS Digital, `https://duoorb.com/about.html`, `support@duoorb.com`, logo `icon-512.png`) to each JSON-LD block; `dateModified` in JSON-LD only. Add `BreadcrumbList` to privacy/terms/cookies/contact.
- [ ] **B4.** Assets: confirm native doesn't reference `fonts/Satoshi-*` + `Manrope_200ExtraLight/300Light` → delete 6 fonts (~390KB) + `icons/splash-icon.png` (~17.5KB). Compress `og-image.png` → <180KB via `pngquant --quality=70-85` (keep 1200×630, same filename). `manifest.json`: `theme_color #FFFFFF`, `background_color #FAFAFB`; `index.html:18` theme-color → `#FFFFFF`.
- [ ] **B5.** Image CLS: add `width="300" height="650"` to `quoridor-online.html:185` (or swap in `modal-dialog.png` per expert — do the swap: unique image wins) and `app.html:215`; wire `match-setup.png` into index overlay (spec in Phase C).
- [ ] Verify B: 6-link nav everywhere; publisher in 8 JSON-LD blocks; 0 orphans; og-image <180KB; no CLS gaps.

## Phase C — Page builds (in order, with word targets)

- [ ] **C1. `index.html` overlay → 800+ words.** Add Arena Specifications table (4 modes × players/coords/walls/goals, expert §130-180) + Fairness grid-2 (Zero-RNG card linking `/strategy.html` + `match-setup.png` artifact card) between cards and footer. Fix card 6 to both-coming-soon. Add publisher to JSON-LD. Keep hero/H1/cards/menu.
- [ ] **C2. `quoridor-online.html` → 1300+ words.** Title → “Play Quoridor Online Free — 1v1 Rated & Private Rooms | DuoOrb”. Add clocks table (7 Fischer presets, §212-290) + rooms/Glicko grid-2 (§292-311) before FAQ. Modal-dialog image swap (§203). Keep hero/peach/table/FAQs.
- [ ] **C3. `rules.html` → 1600+ words.** H1/meta de-“official” (A6). Alt/H3 `+0.9` → shortest-path wording (§319). Bot FAQ → full 7 + 3 tiers + link `/bots-and-analysis.html` (§321). Jump matrix: 3 diagonal triggers (wall/edge/occupied) + mandatory-straight + finished-ghosts (§323). Add multiplayer table (§328-384) + notation grid-3 (§386-406).
- [ ] **C4. NEW `strategy.html` → 1700+ words.** Same head/nav/footer shell. Title/meta/canonical/Article+FAQ JSON-LD (§415-421). Sections: hero + 3 laws (Δd≥+2 / 3-space / parity) + openings (Central March 3+3, back-wall/gap) + 4-motif table + 4-FAQ. Copy: expert §424-545 verbatim, class-checked.
- [ ] **C5. NEW `bots-and-analysis.html` → 1350+ words.** Title/meta/canonical/TechArticle+FAQ (§553-559). Hero + 7-bot table (sims/budget/randomness/style per Appendix E) + grading grid-2 (Δq×40 thresholds + stepper artifact). Copy: expert §562-679 verbatim.
- [ ] **C6. `what-is…` → 950+ words.** Title → “…| Play Free on DuoOrb”. Lead de-hyped to evergreen clip description (§685-686). Delete “Solo Journey & Quests” card (not in engine). Replace §4 with ID table (5 rows: orbs/walls/jumps/golden-rule/center-rush, §693-737).
- [ ] **C7. `app.html` → 950+ words.** Eyebrow (A6). Bots → full 7 + tiers (§745). Room code → 6-letter (§747). Walls/clocks → 10/15/99 + 7 Fischer (§749-750). `+0.9` → MCTS curve + dims (§752). Add PWA install grid-3 (iOS Safari / Android Chrome / sync, §757-777).
- [ ] **C8. `about.html` → 750+ words, NO ad tag (A3).** Store fix (A6). Add engineering grid-3 (server authority / 10-language a11y / respectful monetization, §790-810).
- [ ] **C9. Legal/support expands, NO ad tags (A3):** `cookies.html` → 450 + cookie table (`duoorb-played/sb-*-auth/__gads/__gpi/FCNEC`, §818-873); `contact.html` → 400 + SLA + 3 template cards (§874-887); `privacy.html` → 550; `terms.html` → 550 (keep Premium §5 aligned with server sync below).
- [ ] **C10. Server sync (only non-web edit):** `legal-content.ts` §6 → “All game modes and all 7 offline AI bot personalities are free… Premium ($3.99/mo or $24.99/yr, 7-day trial) removes app ads and unlocks unlimited Engine Match Reviews (free: 1/day + rewarded extras).” (§889-893).
- [ ] Verify C: per-page word counts via strip-tags count; schema parity (FAQ body = JSON-LD); zero “Zero ads/official/4-digit/unlimited-time/3-bot” strings; zero competitor brands.

## Phase D — Crawler/GEO files + dist rebuild

- [ ] **D1.** `robots.txt` := expert §941-974 (per-bot allows + `Disallow: /play.html` + sitemap).
- [ ] **D2.** `llms.txt` := expert §975-1000 (7 bots, 7 clocks, 12 pages).
- [ ] **D3.** `ai-catalog.json` := expert §1001-1027 (v2.0.0, 12 resources).
- [ ] **D4.** `sitemap.xml` := 12 URLs (drop `/play.html`, add `/strategy.html` 0.90 + `/bots-and-analysis.html` 0.88) + image tags for 7 screenshots (§1028-1029).
- [ ] **D5.** `cd apps/mobile && npx expo export --platform web`; verify 12 HTML + ads.txt + llms.txt + sitemap land in `dist/`.
- [ ] Verify D: validators (JSON-LD, sitemap, robots), 200s, canonicals, `duoorb.com/ads.txt` 200 text/plain.

## Phase E — Pre-review gate (all must be true)

1. Ad tags on exactly 7 editorial pages + consent bootstrap above each. 2. Legal/support/about carry no ad tag. 3. Zero store/official/bot/room/clock contradictions (grep clean). 4. Word targets met (C1–C9). 5. Nav 6-link everywhere; CTAs → `/`. 6. Publisher schema ×8, BreadcrumbList ×4. 7. 0 orphans, og-image <180KB, 0 CLS gaps. 8. `dist/` fresh. 9. Dashboard: Funding Choices live, anchor/side-rail OFF. 10. Request review.

---

## Appendix — Expert-to-file traceability

| Expert Part | This plan |
|---|---|
| Part 1 arch table + nav (§15-37) | Phase A1/A2, B1/B2, C1–C9 targets |
| Part 2 AdSense 4 fixes (§39-110) | Phase A3–A7 |
| Part 3 pages 1–12 specs (§112-893) | Phase C1–C10 (copy blocks referenced by §) |
| Part 4 assets/schema/dist (§895-936) | Phase B4/B3/D5 |
| Part 5 GEO files (§938-1029) | Phase D1–D4 |

*End of plan. Build order: A → B → C1–C10 → D → E. One commit per phase step; `tsc`/lint unaffected (static HTML); re-run word-count + grep gates after each phase.*

---

## Build log (2026-10-15 — implemented A→D, web-only, design frozen, game + mobile src untouched)

- Phase A done: `play.html` deleted (+ hosting 301 still owner-side), links → `/`, ad tags on 7 editorial pages with Consent Mode v2 above each, `showGame()` unmounts overlay, P0 text fixes (store/official/eyebrow).
- Phase B done: 6-link nav everywhere (footers also carry pillar links in Play col — deliberate PageRank boost), CTAs → `/`, publisher schema ×8 + BreadcrumbList ×4, 6 fonts + 1 icon deleted (~407KB), manifest + theme → white, CLS dims fixed, modal-dialog + match-setup orphans wired with verified alts.
- Phase C done: C1–C10 incl. NEW `strategy.html` + `bots-and-analysis.html` (expert copy verbatim, `eyebrow`→`section-tag` mapped), server `legal-content.ts` §6 synced (only non-web edit).
- Phase D done: robots/llms/catalog/sitemap rewritten. `dist/` rebuild + og-image compression + dashboard steps (Funding Choices, anchor OFF) are owner-side.
- Word counts (visible, ~150 boilerplate): index 791 · online 1235 · rules 1468 · strategy 1086 · bots 753 · viral 859 · app 866 · about 570 · privacy 522 · terms 411 · contact 274 · cookies 386. Strategy/bots fall short of expert targets on expert's own copy — expert to extend or accept.

## Build log 3 (expert navigation audit — verified item-by-item, stale claims rejected)

- P1 footers: expert's “4 footers” described PRE-wave-2 state — already unified then; now re-unified to his §3 template on all 11 files (Play: Play Now/?play=1, Home Overview, Time Controls&Clocks · Learn & Master: Complete Rules, Strategy & Openings, AI Bots & Analysis, Two Balls & Walls Game Guide · Mobile & Studio: App&PWA, About&AS Digital, Support&Contact · legal bar “© 2026 DuoOrb by AS Digital”).
- P2 split anchors FIXED (was genuinely broken after clocks moved): /#time-controls dangles removed → rooms links /#private-room-architecture, clocks /rules.html#clocks (section renamed time-controls→clocks); noscript + llms updated.
- P3 funnels CLOSED: rules bottom gained Strategy link; strategy + bots gained bottom CTA banners (Play Now ± bots link).
- P4 DOM-dedup DECLINED (desktop+drawer duplication is standard responsive practice, zero ranking impact, high breakage risk); noscript links EXPANDED (Rules, Strategy, AI, App, About, legal row).
- P5 sessionStorage trap: already removed earlier; cookies table duoorb-played row DELETED. / without params always shows landing — /?home=1 unneeded, not implemented.
- P6 rename: already done in wave 2, verified site-wide.
- Gates: 11 JSON-LD valid, zero leftovers (quoridor-online/sessionStorage/duoorb-played/old labels), dist/ re-synced.

## Build log 4 (orphan pages merged into Home — App paused, Viral folded)

- `app.html` → redirect stub (meta refresh + canonical + noindex) to `/#mobile`; Home gained full “Play on Your Phone” section (Pass&Play + 3 install steps + status). Delisted from nav; footers/text-links/sitemap/llms/catalog rewired to `/#mobile`. Revive by restoring content at launch.
- Viral guide → redirect stub to `/#viral-guide`; ID table moved to Home above FAQ. Delisted from nav; Learn-col links repointed to `/#viral-guide`. Sitemap 11→9, robots +2 Disallows.
- Legal type size: `body.legal` H1 clamp-down on privacy/terms/contact/cookies. Desktop nav links absolutely centered (>900px).
- Words now: index ~1424 · rules ~1411 · strategy ~1141 · bots ~753 · about ~385 · privacy ~558 · terms ~446 · contact ~288 · cookies ~388 · stubs ~35 each (noindex).
- Gates: JSON-LD 12/12 valid, sitemap 12/12 balanced, banned-phrase grep clean, 7 ad tags + consent verified (re-verified after wave 3: catalog + 11 JSON-LD blocks OK; words now index 1076 · rules 1411 · strategy 1098 · bots 717 · app 532 · about 373 · privacy 546 · terms 434 · contact 276 · cookies 388 · viral 851; dist/ re-synced incl. bundle tag).

## Build log 2 (expert follow-up directive — one-job-per-page restructure)

- Expert's coordinate fix was VERIFIED against `notation.ts:45-64` and found inverted: Blue (8,4) = `e9`, Red (0,4) = `e1` (rank = RANKS[row]). Applied corrected mapping (Classic e9/e1, 4P +a5/i5, race Rank-9 cols, goals Rank 1/9 edges); center stays `(4,4)`. Expert's `Blue: e1 · Red: e9` rejected with evidence.
- H1s de-branded: Rules → “How to Play DuoOrb: Complete Illustrated Rules & Tactics”, Strategy → “DuoOrb Strategy Guide: Openings, Wall Parity & 9×9 Endgame Calculation” (body keeps classic-game context, no store-claim risk).
- Home: hero ads clause cut; Arena + Clocks tables moved to Rules (deleted from Home); BFS line lives on About; added “Play on Your Phone” (Pass&Play + PWA condensed from App).
- Rules: clocks table added; Wall Parity peach CUT and merged into Strategy Invariant 03; Grandmaster Analysis CUT to AI-link card (FAQ kept); jump matrix + notation + legality kept.
- Strategy: Wall Depletion woven into Invariant 03; Hd4/Ve6 motif examples added.
- AI page: MCTS/Randomness explainer added above roster.
- App delisted from header nav everywhere (footers keep store-status links); page leaned to hero + status + PWA + CTA (modes/peach/comparison removed as Home/AI duplicates).
- About: “What DuoOrb serves” + “By the Numbers” grids DELETED; Mission paragraph added to engineering section.
- Not built: animated 3-turn preview (existing “Anatomy of a Turn” cards cover the 5-second understanding goal with zero fake animation).
