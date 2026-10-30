# DuoOrb — Production Readiness & Product Plan

> **Status:** Draft for owner review · **Date:** 2026-10-28  
> **Scope:** product, UX, monetization, online operations, and launch sequencing.  
> **This document changes no code and does not prescribe an implementation design.** It records what exists, what the owner wants, and what must be decided before launch.  
> **Evidence labels:** **Verified** = read in code or measured; **Reported** = owner observation, not reproduced in this audit; **Proposed** = product direction from the conversation, not final.

---

## 0. The one-sentence version

DuoOrb does not have a feature shortage. It has a **launch-focus and truth problem**: online is split across too many queues, analysis is free/unlimited and unprotected on a small burstable server, several premium claims do not match behavior, and the assist, board, and local-play experiences are inconsistent.

---

## 1. Executive summary

### 1.1 The six findings that matter most

1. **Online liquidity is being diluted by configuration.** The visible match options create at least **105 exact matchmaking buckets** (Classic 15, Center Rush 45, Race 45). A new player can choose a combination nobody else is queueing for. The owner’s instinct — one Classic queue with 3+0 and 10 walls — is the correct launch shape.
2. **Analysis is currently free and unlimited, and the endpoint is not protected per user.** The mobile gate resolves to “unlocked” for everyone, while the paywall/settings/legal copy sells “unlimited analysis.” The server endpoint is unauthenticated, accepts arbitrary game histories, and is limited only by a global 100 requests/minute per IP. That is both a monetization leak and a denial-of-service risk.
3. **The small server cannot safely absorb “free unlimited” analysis.** A 40-ply review costs about **3.35 CPU-seconds** on the development machine; a 60-ply review about **5.1 CPU-seconds**. On a 2-vCPU burstable instance, the safe simultaneous envelope is roughly **3 typical reviews or 2 long reviews** — not 5–8. The client gives up at 12 seconds while the server keeps computing, so retries can pile up.
4. **Several premium promises are not true today.** Walnut is sold as premium but is reported broken; bots are described as a premium benefit but are free; “unlimited analysis” is true only because analysis is free for everyone; the undo ad sheet says “Premium players get unlimited undos” but the undo economy is not enforced at all.
5. **Assists and bot mastery do not match the intended rules.** Undo credits are written but never spent; the undo ad sheet is never opened; hints are unlimited and free. Bot stars count undos but ignore hints, and still use a margin/wall formula instead of “clean win = 3 stars.”
6. **The board and local-play experience is inconsistent.** Tactile is the default skin but ignores dark mode, so a dark app can show a bright Tactile board. Walnut is premium-gated. Pass-and-play uses a stripped-down hub and always keeps Player 1 at the bottom, so Player 2 sees the board upside down.

### 1.2 Recommended launch shape

| Area | Recommended launch shape | Why |
|---|---|---|
| **Quick Match** | **Classic 1v1 only; 3+0; 10 walls.** One button, no configuration. | One queue gives the best chance of a match. All other combinations move to rooms/casual. |
| **Private Rooms / Challenges** | All modes, player counts, walls, and clocks remain available, clearly **casual/unrated** unless deliberately ranked later. | Friends can still play everything without splitting the public queue. |
| **Analysis** | Free users watch a rewarded video per analysis (or use a small daily free allowance); subscribers get analysis without ads, under a fair-use/concurrency cap. | Protects the server, gives the paywall a real benefit, and keeps the free experience usable. |
| **Premium** | No ads · analysis without ads · premium orb/wall designs · crown badge. **Walnut free temporarily; bots free.** | Every bullet becomes testable and true. Cosmetics replace the broken Walnut promise. |
| **Assists** | Per-match budget. Free users watch one ad for 3 shared assists; subscribers get a larger/no-ad budget. Stars count every assist. | Turns a dead economy into a clear, fair, non-pay-to-win system. |
| **Board** | **Tactile default**; separate **dark Tactile** usable in light app mode; Walnut free until fixed. | Matches the owner’s design direction and removes the dark-mode mismatch. |
| **Local Pass & Play** | One shared “New Game” hub; clear same-device context; manual board flip (or optional auto-rotate). | Removes navigation inconsistency and the upside-down-player problem. |

### 1.3 If you only fix five things before open testing

1. **Collapse Quick Match to one Classic 3+0 / 10-wall queue.**
2. **Put real server-side limits around analysis** (identity, per-user usage, concurrency, request size) and verify the target instance.
3. **Make every premium claim true** — or remove it from the paywall/settings/legal copy until it is.
4. **Fix the no-show/AFK first minute** — 90-second join quorum plus 45-second grace is too long for a 3+0 game.
5. **Enforce the assist economy and make bot stars reflect hints and undos.**

---

## 2. Current state: what the code actually does

| Area | Verified current behavior | Evidence |
|---|---|---|
| **Online matchmaking** | A match requires the exact same mode, time control, increment, and wall count. No rating-range or “nearby config” matching. | `apps/server/src/matchmaking/matchmaking.service.ts:116-166` |
| **Visible online options** | 3 modes (Classic, Center Rush, Race), up to 4 player counts, 3 wall choices (10/15/unlimited), 5 visible clocks (1, 1+1, 3, 5, no timer). Classic is 1v1 only. This yields **105 exact buckets** (15 + 45 + 45). | `apps/mobile/src/components/MatchOptionsPicker.tsx:11-13,88-208`; `apps/mobile/src/timeControls.ts:27-37` |
| **Online entry points** | Home has Play Online, Play a Bot, Play a Friend, Pass & Play, and a sticky Play button. Play Online and sticky Play open the full setup screen; the Online tab also has Quick and Rooms. Custom setup can launch a 3P/4P or non-Classic ranked search. | `apps/mobile/src/screens/HomeScreen.tsx:211-294`; `apps/mobile/App.tsx:1013-1015,1128-1155` |
| **Rating scope** | All online human games are server-marked ranked, including private rooms and friend challenges. One universal rating covers every mode. | `apps/server/src/gateway/game.gateway.ts:1105-1113,1390,1522`; `apps/mobile/src/screens/GameScreen.tsx:3356` |
| **AFK** | Fixed **45 seconds** per turn while connected. Warning appears after **15 seconds** (30-second countdown). Not scaled by time control. | `apps/server/src/game/authoritative-game.service.ts:34-51` |
| **Disconnect grace** | Fixed **45 seconds** for ranked and casual. The clock keeps running while the seat is away. AFK and disconnect are separate states. | `apps/server/src/game/authoritative-game.service.ts:1537-1563` |
| **Join quorum** | A created game waits **90 seconds** for every seat to join, then treats no-shows as disconnected and starts another 45-second grace. Worst case is about **135 seconds** before the match resolves. | `apps/server/src/game/authoritative-game.service.ts:53-59,587-612` |
| **AFK/disconnect UI** | Seat cards show a small 11px status pill under the name: `Disconnected · Xs`, `No move · Xs`, `Move or forfeit · Xs`, or `You forfeit in Xs`. AFK uses a clock icon; disconnect uses Wi-Fi-off. Compact cards truncate to one line. | `apps/mobile/src/components/GameHud.tsx:46-79,216-295` |
| **Local hub** | Pass & Play shows only “Switch to Online Match” and “Play Bots” as secondary actions; Online shows “Play a Friend,” “Play Bots,” “Pass & Play,” and “More match options.” Header/title and CTA copy also differ. | `apps/mobile/src/screens/MatchSetupScreen.tsx:168-174,248-313` |
| **Local perspective** | Local games always use seat index 0 for the bottom player and rotate the board from Player 1’s goal. Player 2/3/4 see the board from Player 1’s side. | `apps/mobile/src/screens/GameScreen.tsx:1577,2094-2107,817-829` |
| **Entry kind mapping** | `initialKind === 'ai'` renders the **online** hub (`vsType = 'online'`), so the screen’s title and secondary actions can contradict the entry point. | `apps/mobile/src/screens/MatchSetupScreen.tsx:80-82` |
| **Bot stars** | 1 star for a win; 2 stars if no undo and (opponent distance ≥ 2 or walls ≥ 2); 3 stars if no undo and (opponent distance ≥ 3 or (distance ≥ 2 and walls ≥ 3)). Hints are not counted. Best-ever stars are retained; losses never lower them. | `apps/mobile/src/screens/GameScreen.tsx:1185-1207`; `plans/PHASE_3_AI_THREADING_BOTS_AND_3_STARS.md:195-202` |
| **Assist economy** | `undoCredits` is set but never read. `setUndoSheetOpen(true)` is never called. `handleUndoPress` executes an undo directly. Hints are unlimited and free. The undo ad sheet is unreachable. | `apps/mobile/src/screens/GameScreen.tsx:493-500,1703-1761,1907-1969,2868-2898` |
| **Analysis access** | Analysis is free and unlimited for everyone. `resolveAccess` always returns `unlocked` (or `premium` for subscribers); `requestAnalysisEntry` never returns `locked`; `FREE_ANALYSES_PER_DAY = Infinity`. | `apps/mobile/src/monetization/analysisAccess.ts:5-9,23-24,39-43,60-74` |
| **Analysis engine** | 6,000 simulations per ply by default, clamped 3,000–10,000. Review parallelizes plies with Rayon. Runs off the Node main thread but on the same CPU box. Results cached by `gameId`. | `packages/analyzer-rust/src/mcts.rs:482-484`; `packages/analyzer-rust/src/review.rs:112-127`; `apps/server/src/analysis/analysis.service.ts:117-121` |
| **Analysis endpoint** | `POST /api/analysis/review` is unauthenticated. It accepts arbitrary `initialState`, `history`, or `moves` with no history-size cap. Global throttle is 100 requests/minute per IP. | `apps/server/src/analysis/analysis.controller.ts:21-30`; `apps/server/src/analysis/dto/review-request.dto.ts:4-23`; `apps/server/src/app.module.ts:21-24` |
| **Analysis client timeout** | Mobile aborts the request at **12 seconds**. The server continues computing after the client gives up; a retry starts another review. | `apps/mobile/src/network/apiClient.ts:481-485`; `apps/mobile/src/analysis/reviewLoader.ts:44-58` |
| **Board skins** | Classic follows light/midnight. Tactile is the render-store default but always light; Walnut/Stone also ignore the app theme. Walnut is premium-only. Stone and Tactile are free. | `apps/mobile/src/theme/boardTheme.ts:5-23,180-215,233-263,282-314,316-328,345-399` |
| **Orb/wall cosmetics** | Only one orb palette exists (`classic`). There are no selectable wall skins. Board skins change orb finish (gloss vs flat disc) but not as an independent cosmetic. | `apps/mobile/src/theme/orbTheme.ts:3-21`; `apps/mobile/src/theme/boardTheme.ts:88-106` |
| **Premium badge** | Premium crown exists and is propagated to opponents through the frozen `premiumUserIds` list. | `apps/server/src/game/authoritative-game.service.ts:70-76`; `apps/mobile/src/components/GameHud.tsx:269-274` |
| **Premium copy** | Paywall renders three bullets (no ads, Walnut, crown); settings copy promises “No ads · unlimited analysis · bots · premium boards · crown”; legal copy mentions bots, analysis, theme, and badge. `MONETIZATION.md` says analysis is 1 free/day + ad, bots free, Walnut premium. These do not agree. | `apps/mobile/src/components/PremiumSheet.tsx:39-44,91-95`; `apps/mobile/src/i18n/locales/en.ts:112-114,246-249`; `apps/mobile/src/legal-content.ts:42,89`; `MONETIZATION.md:10-22,235-238,389-410` |

---

## 3. Problem register

### 3.1 Online liquidity and scope

**ONL-1 — Too many exact queues.**
At least 105 visible configurations can enter matchmaking. A player who chooses Center Rush 3P, 15 walls, 5+0 is waiting for the exact same combination. The public queue is fragmented before the first match. This is the owner’s primary concern and the highest-impact product fix.

**ONL-2 — The entry points multiply the confusion.**
“Play Online” opens a full setup screen rather than a one-tap queue; the sticky “Play” button does the same; the Online tab has its own Quick/Rooms split. A new player must understand modes, player counts, walls, clocks, and the difference between custom search and rooms before seeing an opponent.

**ONL-3 — Everything online is rated.**
Private rooms, friend challenges, 3P/4P, 15-wall games, and no-timer games all feed the same universal rating. This makes the rating less comparable, exposes friends to rating changes in casual rooms, and turns every custom configuration into a “ranked” queue. It also makes the “only Classic online” decision incomplete unless rated/casual scope is decided.

**ONL-4 — No-timer and long fallback are poor launch fits.**
No Timer is offered in the same picker as 3+0. The client only flags “taking long” after **120 seconds** (`useMatchmaking.ts:132-134`), which is longer than a 3+0 game’s entire clock. A no-show can waste 90 seconds of quorum plus 45 seconds of grace. For a fast 1v1 game, this is a bad first-minute experience.

### 3.2 AFK, disconnect, and no-show

**AFK-1 — One fixed 45-second allowance for every clock.**
In 3+0, 45 seconds is 25% of the entire game clock. In 15+10, it is relatively short. A single rule cannot be fair across 1+0, 3+0, and 15+10.

**AFK-2 — The no-show path is longer than the game.**
Join quorum 90s + disconnect grace 45s = up to 135s. The opponent may spend more time waiting for a no-show than playing a 3+0 match. This needs a launch-specific policy, not the generic “slow client” allowance.

**AFK-3 — The status presentation is too quiet.**
The state is a small pill under the name, using a clock icon for AFK and a Wi-Fi-off icon for disconnect. On compact cards the text truncates to one line. The player must infer:
- whether the opponent is disconnected or merely idle;
- whether the countdown is a reconnect window or a forfeit deadline;
- whether their own clock is still running;
- which deadline will actually end the game first.

**AFK-4 — The clock and grace can contradict each other.**
During a disconnect the clock keeps running. If the disconnected player has 20 seconds left, the UI can show “Disconnected · 45s” while the clock expires in 20 seconds. The player sees two different deadlines and no explanation of which one wins.

**What is already good:** AFK and disconnect are deliberately separate states, with separate timers and copy. The model is sound; the tuning and presentation are the problem. Do not collapse them into one “inactive” state.

### 3.3 Assists and bot mastery

**AST-1 — The undo economy is dead code.**
`undoCredits` is written but never spent. The undo sheet is never opened. `handleUndoPress` always executes the undo. Free users and subscribers both get unlimited undo in AI games. The “watch an ad for 3 undos” flow cannot be reached.

**AST-2 — Hints are unlimited and free.**
The hint button has no cost, no counter, and no ad gate. It runs a 15,000-simulation/2.5-second search. There is no difference between a hint and an undo in terms of scarcity, even though the owner wants both to cost stars.

**AST-3 — Bot stars ignore hints and still use margin/walls.**
The current formula rewards a clean win plus opponent distance/walls. A player can use three hints and still earn 3 stars if they used no undo. The owner’s intended rule is simpler and more legible: no assists = 3 stars; assists reduce the rating; more than one assist caps a win at 1 star.

**AST-4 — Premium copy promises a system that is not enforced.**
The undo sheet says “Premium players get unlimited undos.” In practice everyone has unlimited undos, and the owner is now considering limited premium lives. The copy, the code, and the intended product all disagree.

### 3.4 Analysis access, cost, and trust

**ANA-1 — Analysis is free and unlimited, so the paywall’s analysis promise is empty.**
`analysisAccess.ts` explicitly says “Analysis is 100% free for all players.” The paywall, settings, legal copy, and `MONETIZATION.md` still sell “unlimited analysis.” This is the clearest monetization contradiction in the app.

**ANA-2 — The server has no per-user protection.**
The endpoint is unauthenticated, accepts arbitrary histories, and is limited only by 100 requests/minute per IP. A single IP can request 100 reviews in a minute; at roughly 3.35 CPU-seconds per 40-ply review, that is about **5.6 vCPU sustained** — far beyond a 2-vCPU burstable box. Distributed or authenticated abuse is also possible. Client-side gates cannot protect server cost.

**ANA-3 — The 12-second timeout does not cancel the work.**
The mobile client aborts at 12 seconds, but the server keeps computing. A user who retries adds another review. Under load this creates a queue of abandoned work, which is exactly when live WebSocket games need CPU.

**ANA-4 — There is no free-user analysis flow.**
The rewarded-ad placement exists (`analysis`), and the reward sheet copy exists, but the gate never returns `locked`. Free users never see the ad flow; subscribers never get a differentiated “no ad” experience. The monetization surface is built but disconnected.

**ANA-5 — The capacity story is not proven on the target instance.**
The current benchmark was run on a development laptop, not the production box. The production instance type is unverified; the owner described “2 GB RAM but t3.micro,” which is inconsistent (t3.micro is 1 GiB). This must be resolved before analysis is promoted.

### 3.5 Themes and cosmetics

**THM-1 — Tactile ignores dark mode.**
Tactile is the default board, but `resolveBoardSkin` only swaps Classic to Midnight. A dark app with Tactile selected renders a light board. The owner wants a separate dark Tactile variant that can be used even when the app is in light mode.

**THM-2 — Walnut is premium and reported broken.**
Walnut is gated as a premium skin and sold in the paywall/settings/legal copy, but the owner reports it is broken. Selling a broken cosmetic is a refund/chargeback and review risk. The owner’s direction is to make it free for everyone temporarily until it is fixed.

**THM-3 — Premium orb/wall cosmetics do not exist yet.**
The orb palette system has only `classic`; there are no wall skins. Board skins alter orb finish, but there is no independent cosmetic selection, no opponent visibility, and no premium catalog. The owner wants premium orb designs visible to opponents and selectable premium wall designs.

**THM-4 — The premium value stack is incoherent.**
Current claims mix no ads, analysis, Walnut, bots, crown, and “premium boards.” Reality: analysis is free, bots are free, Walnut is broken, and only no-ads + crown are clearly true. A subscription cannot be sold on that stack without a truth audit.

### 3.6 Local Pass & Play

**LOC-1 — The local hub is a reduced version of the online hub.**
Online shows Play a Friend, Play Bots, Pass & Play, and More options. Local shows only Switch to Online Match and Play Bots. The same “New Game” intent produces different navigation depending on how the player arrived.

**LOC-2 — Player 1 always owns the bottom of the board.**
Local games use seat 0 for perspective. Player 2/3/4 see their pieces from the opposite/side orientation. For pass-and-play, this is a usability problem: the player whose turn it is may be reading the board upside down.

**LOC-3 — The entry kind can contradict the screen.**
`initialKind === 'ai'` maps to the online hub. The header and secondary actions can say “New Game”/online while the player entered from a bot-related path. This is a small but visible consistency bug.

### 3.7 Monetization truth and legal

**MON-1 — The paywall, settings, legal copy, and `MONETIZATION.md` disagree.**
- Paywall renders: no ads, Walnut, crown.
- Settings says: no ads, unlimited analysis, bots, premium boards, crown.
- Legal says: no ads, analysis, bots, theme, badge.
- `MONETIZATION.md` says: no ads, unlimited analysis, exclusive board, badge; bots free; analysis 1 free/day + rewarded ad.
- Code says: analysis free unlimited; bots free; Walnut premium/broken; undo unlimited.

**MON-2 — Dead surfaces create false expectations.**
The reward sheet for analysis and the undo ad sheet are built but unreachable. Users who see the copy cannot complete the promised flow. This is worse than not shipping the surface at all.

**MON-3 — Walnut is the wrong thing to sell right now.**
A broken premium board is a direct refund risk. The owner’s “free until fixed” direction is the right trust-preserving move. It must be paired with removing Walnut from the paywall and explaining the temporary status.

**MON-4 — “Bots” is still sold as premium in settings/legal copy.**
All bot personalities are marked `premium: false` in the roster. The copy must stop selling them. This is a small change with a large trust payoff.

---

## 4. Priority plan

### 4.1 Priority definitions

| Tier | Meaning | Launch rule |
|---|---|---|
| **P0** | Launch blocker. The product is not ready for open testing without it. | Must be resolved before any public/closed-test push. |
| **P1** | Launch quality. Should ship with P0 or immediately after. | Resolve before a store-facing release. |
| **P2** | Post-launch growth. Valuable, but not required for the first stable release. | Schedule after retention/liquidity data. |
| **P3** | Later/opportunistic. | Revisit after the core loop is healthy. |

### 4.2 P0 — Launch blockers

| ID | Outcome | Why now | Evidence |
|---|---|---|---|
| **P0-1** | **One public Quick Match queue:** Classic 1v1, 3+0, 10 walls. All other configurations move to rooms/casual or are hidden from the primary flow. | 105 buckets cannot produce reliable matches at launch population. This is the owner’s top concern. | ONL-1, ONL-2 |
| **P0-2** | **Analysis is protected and capacity-safe:** server-enforced identity/quota/concurrency, request-size limits, target-instance benchmark, clear wait/timeout UX. | Free unlimited + unauthenticated + 2 vCPU is a DoS and live-game risk. | ANA-2, ANA-3, ANA-5; §6 |
| **P0-3** | **Every premium claim is true or removed:** analysis, Walnut, bots, undo, premium boards. Paywall/settings/legal/`MONETIZATION.md` agree. | Refund, review, and truth-in-advertising risk. | MON-1–MON-4 |
| **P0-4** | **No-show/AFK policy for 3+0:** shorter join quorum, clear countdown, clock-aware messaging. | A 135-second no-show wait is longer than the game. | AFK-1, AFK-2, AFK-4 |
| **P0-5** | **Assist economy is either enforced or removed from the UI:** no dead ad sheet, no false “unlimited” claim, no free unlimited undo/hint if the product says otherwise. | Dead monetization surfaces and unfair mastery undermine trust. | AST-1, AST-2, AST-4 |

### 4.3 P1 — Launch quality

| ID | Outcome | Why now | Evidence |
|---|---|---|---|
| **P1-1** | **Bot stars reflect assists:** 0 assists = 3 stars; 1 assist = 2 stars; 2+ assists = 1 star on a win. Hints and undos both count. | Matches the owner’s intended mastery rule and makes hints meaningful. | AST-3 |
| **P1-2** | **Local hub and perspective:** unified New Game hub; manual flip or optional auto-rotate; clear same-device context. | Pass-and-play is a core mode and currently feels secondary/upside down. | LOC-1–LOC-3 |
| **P1-3** | **Tactile default + dark Tactile variant**, independent of app light/dark mode. | Removes the bright-board-in-dark-app mismatch and matches the design direction. | THM-1 |
| **P1-4** | **Walnut free until fixed**, removed from the paywall, with a clear temporary status and a visual-QA acceptance bar. | Stops selling a broken cosmetic; preserves trust. | THM-2, MON-3 |
| **P1-5** | **Premium cosmetics v1:** 2 orb finishes + 2 wall finishes, premium-only, visible to opponents, hue-preserving, fallback-safe. | Gives Premium a real, testable cosmetic pillar while Walnut is free. | THM-3, THM-4 |
| **P1-6** | **Rated vs casual scope:** only the standard Quick Match queue is rated; rooms/challenges/custom are casual unless deliberately ranked later. | Protects rating integrity and makes the “Classic only” launch coherent. | ONL-3 |
| **P1-7** | **Queue fallback and entry simplification:** one primary Play button; offer bot/room after a short wait; remove custom configuration from the primary queue. | Reduces cognitive load and dead waiting. | ONL-2, ONL-4 |
| **P1-8** | **Free-user analysis ad flow** (after P0-2): ad → analysis; early close = no charge; ad failure = clear fallback; subscribers skip ads. | Makes the analysis paywall real without harming capacity. | ANA-1, ANA-4 |

### 4.4 P2 — Post-launch growth

| ID | Outcome | Why later |
|---|---|---|
| **P2-1** | Expand public online modes (Center Rush/Race/4P) only after queue data shows enough population, or run them as scheduled/casual events. | Do not split the queue before liquidity is proven. |
| **P2-2** | Expand the premium cosmetic catalog (more orb/wall finishes, board variants, profile showcase). | Needs the v1 entitlement/visibility system and purchase data. |
| **P2-3** | More board themes and light/dark variants (Stone dark, Walnut dark, etc.). | Cosmetic breadth after the default/dark foundation is stable. |
| **P2-4** | Bot mastery migration/leaderboards: decide what happens to existing best-ever stars when the formula changes. | Needs a communication plan; not a launch blocker. |

### 4.5 P3 — Later/opportunistic

- Seasonal cosmetic drops and limited-time board finishes.
- Tournaments or scheduled casual events for 4P/Center Rush.
- Social showcase of equipped orb/wall designs outside the match.
- Advanced AFK policy per time control, only if launch data shows it matters.

---

## 5. Decisions and open questions

### 5.1 Decision log (owner leans from the conversation)

| ID | Decision | Current status | Notes |
|---|---|---|---|
| **D1** | Quick Match = Classic 1v1, 3+0, 10 walls. | **Proposed / lean** | Owner’s stated direction. Needs final sign-off and a decision on what happens to custom/rooms. |
| **D2** | Walnut free for everyone temporarily until fixed. | **Proposed / lean** | Remove from paywall while free; define “fixed” acceptance. |
| **D3** | Tactile 3D is the default board; separate dark Tactile usable in light app mode. | **Proposed / lean** | Tactile is already the render-store default, but not dark-mode aware. |
| **D4** | Bot stars: 0 assists = 3; assists cost stars; 2+ assists caps a win at 1 star. | **Proposed / lean** | Hints and undos both count. Decide whether margin still matters as a tip only. |
| **D5** | Subscribers get limited assist lives per match; free users watch an ad for 3 per match. | **Open** | 3 shared vs 3 each; premium 3 vs 5 vs unlimited; per-match reset. |
| **D6** | Free users watch a rewarded video when requesting server analysis; subscribers get it free. | **Proposed / lean** | Open: keep 1 free/day, or ad on every request? |
| **D7** | Premium orb designs visible to opponents + selectable premium wall designs. | **Proposed / lean** | Scope, entitlement, and fallback need definition. |
| **D8** | Only Classic is available for public online at launch. | **Proposed / lean** | Rooms may keep all modes; decide rated/casual. |

### 5.2 Must decide before launch

| Question | Why it blocks launch | Recommended default |
|---|---|---|
| **Is Quick Match only Classic 3+0/10, or can players choose other configs?** | Determines queue liquidity and the entire online UX. | One Classic 3+0/10 queue. All other configs in rooms/casual. |
| **Are rooms/challenges/custom rated?** | Rating integrity and player expectations. | Only standard Quick Match rated; rooms/challenges casual. |
| **What is the AFK allowance and join quorum for 3+0?** | First-match experience; no-show waits. | 30s AFK for ≤3 min, 45s for 5 min, 60s for ≥10; warning at half. Join quorum 20–30s. |
| **What is the disconnect grace, and how is the clock conflict shown?** | Players see two deadlines; need one authoritative message. | Keep 45s grace but show “clock may expire first” when applicable; consider 30s for 3+0. |
| **What is the assist budget?** | Monetization, mastery, and ad flow all depend on it. | 3 shared for free (one ad); 5 shared for premium (no ad); no carryover; reset per match. |
| **What is the free analysis allowance?** | Determines paywall value and server load. | 1 free/day + ad per extra (friendlier), or ad every time (stronger gate). Pick one and make copy match. |
| **What does Premium include at launch?** | Paywall/legal copy and refund risk. | No ads, analysis without ads, orb/wall designs, crown. Walnut free; bots free. |
| **What is the Walnut “fixed” bar and temporary period?** | Selling a broken cosmetic is a refund risk. | Visual QA on 2P/3P/4P, light/dark app, low-end Android; free until it passes. |

### 5.3 Can decide after launch

- Whether dark Tactile is free or premium (recommend free).
- Whether local perspective uses manual flip or auto-rotate (recommend manual default + optional auto).
- Whether bot margin/walls remain as a “quality” tip after stars become assist-based.
- How to migrate existing best-ever bot stars.
- Which additional board/cosmetic variants to build after v1.
- Whether to reintroduce Walnut as premium after it is fixed.

---

## 6. Analysis capacity deep dive

This is the most important operational question in the plan. The conclusion is conservative: **do not plan for 5–8 simultaneous reviews on the current small server.** Plan for roughly **2–4 typical reviews**, and **1–2 long reviews**, then verify on the actual instance.

### 6.1 What one review costs

- Default **6,000 simulations per ply**, clamped 3,000–10,000 (`packages/analyzer-rust/src/mcts.rs:482-484`).
- Review parallelizes plies with Rayon (`packages/analyzer-rust/src/review.rs:112-127`). One review can use both vCPUs.
- NAPI async moves work off the Node main thread, but it is still the same CPU box. The compose file runs Postgres and the NestJS server on the same host (`docker-compose.yml:21-57`).
- The client gives up at **12 seconds** (`apps/mobile/src/network/apiClient.ts:481-485`), but the server keeps computing.
- Results are cached by `gameId` (`apps/server/src/analysis/analysis.service.ts:41-65`), so repeat views are cheap. An attacker can vary `gameId`/history to avoid the cache.

### 6.2 Local benchmark (indicative, not target hardware)

**Machine:** 13th Gen Intel i5-13450HX, 16 logical CPUs, 16 GB RAM, Windows, Node 22.14, Rust release build.  
**Workload:** synthetic legal 2P game, same history replayed for concurrency. No DB/cache. Rayon threads forced to 1 or 2 to approximate 1–2 vCPU.

| Workload | Rayon threads | Wall time | Approx. CPU work | JSON size |
|---|---:|---:|---:|---:|
| 1 × 40-ply review | 1 | 3.35s | 3.35 CPU-s | 11.1 KB |
| 1 × 40-ply review | 2 | **1.78s** | 3.35 CPU-s | 11.1 KB |
| 1 × 60-ply review | 1 | 5.10s | 5.10 CPU-s | 16.5 KB |
| 1 × 60-ply review | 2 | **2.72s** | 5.10 CPU-s | 16.5 KB |
| 3 × 40-ply concurrent | 2 | **5.32s** | ~10.1 CPU-s | — |
| 4 × 40-ply concurrent | 2 | **6.89s** | ~13.4 CPU-s | — |
| 2 × 60-ply concurrent | 2 | **4.99s** | ~10.2 CPU-s | — |
| 3 × 60-ply concurrent | 2 | **7.92s** (two finish at 7.92s, one at 2.76s) | ~15.3 CPU-s | — |

**What this shows:** the engine scales well across 2 threads (1.88× on 40 plies), but total work is the constraint. Concurrency does not create CPU; it only queues work. The 12-second client timeout is the real budget.

### 6.3 Target-server envelope

Assume the target 2-vCPU instance is **1.5–2.5× slower per core** than the development laptop (a reasonable range for a burstable cloud vCPU). Multiply the dev wall time accordingly:

| Scenario | Dev wall | 1.5× slower | 2× slower | 2.5× slower | 12s verdict |
|---|---:|---:|---:|---:|---|
| 1 × 40-ply | 1.78s | 2.67s | 3.56s | 4.45s | Safe |
| 3 × 40-ply | 5.32s | 7.98s | 10.64s | 13.30s | Safe up to ~2×; not 2.5× |
| 4 × 40-ply | 6.89s | 10.34s | 13.78s | 17.23s | Only safe at 1.5× |
| 1 × 60-ply | 2.72s | 4.08s | 5.44s | 6.80s | Safe |
| 2 × 60-ply | 4.99s | 7.49s | 9.98s | 12.48s | Safe up to ~2×; marginal at 2.5× |
| 3 × 60-ply | 7.92s | 11.88s | 15.84s | 19.80s | Only marginal at 1.5× |

**Practical launch envelope:**

- **~3 concurrent 40-ply reviews** on a 2× slower 2-vCPU box.
- **~2 concurrent 60-ply reviews** on the same box.
- If the box is only 1.5× slower: ~4 concurrent 40-ply, ~2–3 concurrent 60-ply.
- If the box is 2.5× slower: ~2 concurrent 40-ply, ~1–2 concurrent 60-ply.
- **5–8 concurrent reviews is not a safe planning number** unless the target benchmark proves the box is much faster than assumed.

### 6.4 Abuse math

The global throttle allows **100 requests/minute per IP** (`app.module.ts:21-24`). At 3.35 CPU-seconds per 40-ply review:

- 100 × 3.35 = **335 CPU-seconds/minute** = **5.6 vCPU average**.
- At 5.10 CPU-seconds per 60-ply review: **510 CPU-seconds/minute** = **8.5 vCPU average**.

A t3.micro baseline is **0.2 vCPU** (10% of 2 vCPU); a t3.small baseline is **0.4 vCPU** (20% of 2 vCPU). The abuse rate is **14–28× the baseline**. Burst credits can absorb a short spike, but not a sustained one. This is a denial-of-service vector even before considering distributed IPs.

The endpoint is unauthenticated and accepts arbitrary `initialState`/`history` with no size cap. A modified client does not need the mobile gate at all. **Client-side analysis gating is not a capacity control.**

### 6.5 Burstable CPU and memory

- **t3.micro** = 2 vCPU / **1 GiB** RAM, 10% baseline per vCPU.
- **t3.small** = 2 vCPU / **2 GiB** RAM, 20% baseline per vCPU.
- The owner’s “2 GB RAM but t3.micro” is inconsistent. Verify the actual instance type in AWS. If it is really t3.micro, 1 GiB is shared by the OS, Node, Postgres, and Rust analysis; that is tight even if a single review’s RSS is modest.
- One 60-ply review added about **1.4 MB RSS** in our test, so memory is less alarming than CPU. But 1 GiB total still leaves little headroom for Postgres, the gateway, and concurrent work.
- Sustained analysis will exhaust CPU credits. After credits run out, even one or two reviews can exceed 12 seconds. This is the biggest hidden risk in “it works in testing.”

### 6.6 Capacity conclusion and launch gates

**Conclusion:** Treat the current analysis service as a **small-batch feature**, not an unlimited consumer feature. The safe launch envelope is **2–4 typical concurrent reviews** (and fewer long ones), with server-side protection. If the product needs 5–8 concurrent reviews, the target instance or the engine workload must change before launch.

**Launch gates:**

- [ ] Verify the actual instance type, vCPU baseline, RAM, and CPU-credit status.
- [ ] Run the benchmark on the target instance with 1, 2, 3, and 4 concurrent 40/60-ply reviews.
- [ ] Record p50/p95 latency and CPU-credit burn at expected launch volume.
- [ ] Require authentication and a per-user analysis quota; do not rely on the mobile gate.
- [ ] Cap request size/history length and reject malformed/oversized payloads.
- [ ] Cap concurrent reviews; queue or reject excess with a clear user-facing wait state.
- [ ] Ensure a 12-second client timeout does not leave unbounded work or trigger retry storms.
- [ ] Confirm live WebSocket game ticks are unaffected at peak analysis load.
- [ ] Add a CPU-credit/low-headroom alarm and a kill switch for analysis if the box is saturated.

---

## 7. Monetization truth table

| Claim / surface | Where it appears | Current reality | Launch action |
|---|---|---|---|
| **“No ads, anywhere”** | Paywall, settings | Premium hides ads; free users see ads. | Keep, if verified on every surface. |
| **“Unlimited game analysis”** | Settings, translations, `MONETIZATION.md` | Analysis is free and unlimited for everyone. | If free users get ad-gated analysis, Premium’s “no ad / generous fair use” becomes real. Otherwise remove the claim. |
| **“Walnut board design”** | Paywall, settings, legal | Premium-gated; owner reports broken. | Make free temporarily; remove from paywall; add back only after visual QA. |
| **“Bots”** | Settings, legal | All bots are free (`premium: false`). | Remove from Premium copy. |
| **“Premium crown”** | Paywall, settings, legal | Works and is visible to opponents. | Keep. |
| **“Unlimited undos”** | Undo sheet | Not enforced; everyone has unlimited undos. | Enforce the chosen budget or remove the claim. |
| **“Premium orb/wall designs”** | Not shipped | No orb palettes beyond classic; no wall skins. | Do not claim until v1 is live and opponent-visible. |
| **“1 free analysis/day + ad”** | `MONETIZATION.md` | Not implemented. | Choose the free tier; make code, paywall, and legal agree. |

**Rule for launch:** every bullet on the paywall must be demonstrable in under 30 seconds by a tester on a production build. If it cannot be demonstrated, it does not ship.

---

## 8. UX acceptance criteria

### 8.1 Online Quick Match

- [ ] One primary “Play” action starts Classic 1v1, 3+0, 10 walls; no mode/wall/clock choices in the primary flow.
- [ ] The chosen format is visible before and during search.
- [ ] If no match is found within a short window (target: 30 seconds), offer a bot match or a private room instead of a two-minute dead wait.
- [ ] Private rooms clearly say “casual” if they are unrated.
- [ ] No Timer, 15 walls, 4P, Center Rush, and Race are not in the public Quick Match pool at launch.

### 8.2 AFK and disconnect

- [ ] Disconnected and idle are visually distinct, with different icons and copy.
- [ ] Own vs opponent copy is distinct: “You forfeit in Xs” vs “Opponent disconnected · Xs.”
- [ ] The consequence is explicit: reconnect window vs move-or-forfeit deadline.
- [ ] The UI explains that the clock keeps running during a disconnect.
- [ ] If the clock will expire before the grace window, the UI says so instead of showing two conflicting deadlines.
- [ ] Status is readable on compact cards; no tiny 11px pill or truncated one-line copy.
- [ ] Escalation at 10s/5s (sound/haptic/color) without being obnoxious.
- [ ] No-show quorum is short enough for 3+0 (target: 20–30 seconds, not 90).

### 8.3 Analysis

- [ ] Free user sees a clear choice: free daily analysis or watch a short video; no dead “locked” state.
- [ ] Ad completion grants the analysis; early close grants nothing; ad failure gives a clear retry/premium fallback.
- [ ] Subscriber goes straight to analysis with no ad.
- [ ] Cached analysis opens instantly without an ad.
- [ ] A busy server shows a wait/queue state, not a silent 12-second timeout.
- [ ] A failed analysis has a retry path and never leaves an infinite spinner.
- [ ] The server enforces identity, quota, request size, and concurrency; the mobile gate is not the only control.

### 8.4 Assists and bot stars

- [ ] 0 assists = 3 stars; 1 assist = 2 stars; 2+ assists = 1 star on a win.
- [ ] Hints and undos both count as assists.
- [ ] Using an assist but not following the hint still counts.
- [ ] Assist budget is visible, cannot go negative, resets per match, and does not carry over.
- [ ] Free users get 3 assists after one rewarded ad; subscribers get the chosen no-ad budget.
- [ ] No assists are available in online matches.
- [ ] Best-ever stars are retained; a loss never lowers them.
- [ ] Existing best-ever records have a defined migration/communication plan.

### 8.5 Themes and cosmetics

- [ ] Tactile is the default for new installs; existing users keep their choice.
- [ ] Dark Tactile works when the app is in light mode, and light Tactile works in dark mode.
- [ ] Walnut is free and clearly marked “temporarily free while we fix it”; it is not in the paywall.
- [ ] Premium orb/wall designs are visible to opponents in online matches and replays.
- [ ] Cosmetics change finish/pattern, not seat hue; colorblind readability is preserved.
- [ ] A lapsed subscription falls back to the default cosmetic with no error or blank surface.
- [ ] The paywall previews only cosmetics that are actually live.

### 8.6 Local Pass & Play

- [ ] The local hub uses the same structure as the online hub: one New Game hub, one options summary, one primary CTA.
- [ ] The screen clearly says “Same device” / “Pass & Play.”
- [ ] Each player can orient the board to their side via a manual flip control, or an optional auto-rotate setting.
- [ ] No auto-rotation happens mid-move or without a visible transition.
- [ ] 2P/3P/4P seat labels, wall tray, and move hints remain correct after rotation.
- [ ] The header/title matches the entry point; `initialKind='ai'` does not silently become the online hub.

---

## 9. Risks and mitigations

| Risk | What happens if ignored | Mitigation |
|---|---|---|
| **Queue fragmentation** | Players wait, assume online is dead, churn. | One Classic queue; rooms for everything else; short fallback to bot/room. |
| **Analysis DoS / CPU exhaustion** | Live games lag or time out; server costs spike; app feels broken. | Auth, quota, concurrency cap, request limits, target benchmark, kill switch. |
| **False premium claims** | Refunds, bad reviews, legal/truth-in-advertising exposure. | Truth table; remove dead claims; test every bullet on a production build. |
| **Broken Walnut sale** | Refund/chargeback risk; premium trust damage. | Free until fixed; remove from paywall; visual QA gate. |
| **AFK/no-show frustration** | Players quit before the first move; “online is dead” perception. | Short quorum; clear countdown; clock-aware messaging. |
| **Cosmetic readability** | Players confuse seats/walls; competitive fairness complaints. | Preserve hue; finish/pattern only; colorblind testing; fallback. |
| **Rating integrity** | Casual/room games distort the universal rating; “ranked” loses meaning. | Only standard Quick Match rated; rooms/challenges casual. |
| **Walnut free devalues Premium** | Subscribers feel they lost a paid benefit. | Communicate temporary status; add orb/wall cosmetics; consider a goodwill cosmetic. |
| **Local auto-rotate disorientation** | Accidental moves; players lose track of whose turn it is. | Manual flip default; optional auto-rotate; lock input during rotation. |
| **T3 CPU credits** | Analysis works in tests, then slows to a crawl under real use. | Monitor credits; alarm; upgrade to a non-burstable/larger instance if needed. |

---

## 10. Launch gates

### Product decisions

- [ ] Quick Match scope signed off (Classic 3+0/10).
- [ ] Rated vs casual scope signed off.
- [ ] AFK/join-quorum/disconnect numbers signed off.
- [ ] Assist budget and Premium entitlement signed off.
- [ ] Free analysis allowance signed off.
- [ ] Premium value stack signed off.

### Online

- [ ] One public queue; no 105-bucket picker in the primary flow.
- [ ] Private rooms clearly casual (if unrated).
- [ ] Queue fallback within a short window.
- [ ] No Timer and non-Classic modes removed from Quick Match.
- [ ] Entry points simplified: one Play, one Play a Friend, one Bots, one Pass & Play.

### Match integrity

- [ ] AFK/disconnect copy and countdown verified on 3+0, 5+0, 15+10.
- [ ] No-show quorum shortened.
- [ ] Clock-vs-grace conflict handled.
- [ ] Compact-card readability verified on small screens.

### Analysis

- [ ] Target-instance benchmark complete.
- [ ] Auth/quota/concurrency/size limits live.
- [ ] 12-second timeout behavior verified; no retry storm.
- [ ] Free ad flow and subscriber no-ad flow verified.
- [ ] Live game tick unaffected at peak analysis load.
- [ ] CPU-credit alarm and analysis kill switch ready.

### Monetization

- [ ] Paywall/settings/legal/`MONETIZATION.md` all agree.
- [ ] Walnut removed from sale; free status visible.
- [ ] Bots removed from Premium copy.
- [ ] Undo/analysis claims match behavior.
- [ ] Premium orb/wall cosmetics only claimed if live.

### Themes and cosmetics

- [ ] Tactile default verified on fresh install.
- [ ] Dark Tactile verified in light app mode.
- [ ] Walnut visual QA passed (or remains free).
- [ ] Premium cosmetic visibility and fallback verified.
- [ ] Colorblind/contrast check passed.

### Local

- [ ] Local and online hubs share structure.
- [ ] Perspective control works for 2P/3P/4P.
- [ ] Entry kind no longer contradicts the screen.

### Legal and operations

- [ ] Legal copy updated for actual Premium benefits and ads.
- [ ] Refund/support playbook for Walnut/Premium ready.
- [ ] Analytics events for queue time, AFK, disconnects, analysis, ads, paywall, cosmetics.
- [ ] Rollback/kill switches documented.

---

## 11. Evidence index

| Topic | File / line |
|---|---|
| AFK 45s, warning 15s, quorum 90s | `apps/server/src/game/authoritative-game.service.ts:34-59` |
| Disconnect grace 45s | `apps/server/src/game/authoritative-game.service.ts:1537-1563` |
| Exact-config matchmaking | `apps/server/src/matchmaking/matchmaking.service.ts:116-166` |
| Online modes/walls/clocks | `apps/mobile/src/components/MatchOptionsPicker.tsx:11-13,88-208` |
| Time controls | `apps/mobile/src/timeControls.ts:27-37` |
| All online games rated | `apps/server/src/gateway/game.gateway.ts:1105-1113,1390,1522` |
| AFK/disconnect UI | `apps/mobile/src/components/GameHud.tsx:46-79,216-295` |
| Local hub | `apps/mobile/src/screens/MatchSetupScreen.tsx:80-82,168-174,248-313` |
| Local perspective | `apps/mobile/src/screens/GameScreen.tsx:1577,2094-2107,817-829` |
| Bot stars | `apps/mobile/src/screens/GameScreen.tsx:1185-1207` |
| Undo/hint economy | `apps/mobile/src/screens/GameScreen.tsx:493-500,1703-1761,1907-1969,2868-2898` |
| Analysis free unlimited | `apps/mobile/src/monetization/analysisAccess.ts:5-9,23-24,39-43,60-74` |
| Analysis engine settings | `packages/analyzer-rust/src/mcts.rs:482-484`; `packages/analyzer-rust/src/review.rs:112-127` |
| Analysis endpoint | `apps/server/src/analysis/analysis.controller.ts:21-30`; `apps/server/src/analysis/dto/review-request.dto.ts:4-23` |
| Global throttle | `apps/server/src/app.module.ts:21-24` |
| Client 12s timeout | `apps/mobile/src/network/apiClient.ts:481-485` |
| Board skins | `apps/mobile/src/theme/boardTheme.ts:5-23,180-215,233-263,282-314,316-328,345-399` |
| Orb palette | `apps/mobile/src/theme/orbTheme.ts:3-21` |
| Premium copy | `apps/mobile/src/components/PremiumSheet.tsx:39-44,91-95`; `apps/mobile/src/i18n/locales/en.ts:112-114,246-249` |
| Legal copy | `apps/mobile/src/legal-content.ts:42,89` |
| Monetization plan | `MONETIZATION.md:10-22,235-238,389-410` |
| Server + Postgres same host | `docker-compose.yml:21-57` |
| Queue “taking long” at 120s | `apps/mobile/src/network/useMatchmaking.ts:132-134` |

---

## 12. Appendix: benchmark method and limits

**Method:** synthetic legal 2P games of 40 and 60 plies; the same history was replayed for concurrent runs; `RAYON_NUM_THREADS` set to 1 or 2; release build; no database or cache. Concurrency used `analyzeGameAsync` with the shared Rayon pool, approximating a 2-vCPU box.

**Limits:**

- The benchmark machine is a 16-thread laptop, not the production server.
- The synthetic game may not match the real distribution of walls, forced moves, or game lengths.
- The target instance type and per-core speed are unverified.
- The benchmark does not include Node, Postgres, WebSocket traffic, or network overhead.
- Memory was measured for a single review only; concurrent RSS on the target box still needs measurement.
- The 1.5–2.5× slowdown assumption is a planning range, not a measurement.

**What to do next:** run the same matrix on the actual instance before making any public analysis promise. If the target cannot hold 3 concurrent 40-ply reviews under 12 seconds, the feature is not ready for an ad-gated launch.

---

*End of plan. No code was changed. This document is intended to be reviewed, amended, and signed off before implementation begins.*
