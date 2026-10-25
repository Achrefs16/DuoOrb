# DuoOrb × Chess.com UI Overhaul — Locked Master Implementation Plan

> [!IMPORTANT]
> **All Design Decisions Locked Across All 13 Screenshots (Zero Code Changed Yet)**
> Every branch of the design tree — including the **Ongoing Online Match (`ongoingonlinmacth.jpg`)** and the **Disconnected Wi-Fi Slash (`wifi-off`) Avatar Replacement** — has been analyzed and locked. This document is the single source of truth for implementing the Chess.com-inspired **Light-Mode-First** UI across DuoOrb while preserving 100% of our game rules, 9×9 board engine, wall mechanics, online socket architecture, and monetization gates.

---

## 1. Summary of Locked Decisions (`/grill-me` Outcomes)

| # | Area | Locked Decision |
| :--- | :--- | :--- |
| **1** | **Global Palette & Light Mode** | **Full Chess.com Light Mode Palette**: Warm light stone/alabaster canvas (`#F5F4F0`), crisp white cards (`#FFFFFF`), dark slate ink (`#262421` / `#1E293B`), and **Chess.com Green (`#69B342` / `#81B64C` with `#4E8C2F` 3D bottom bevel)** as the primary accent across all CTAs, active tabs, and selection borders. |
| **2** | **Bottom Navigation Bar** | **Docked Full-Width 5-Tab Bar** (Icon + Label, replacing the floating icon-only pill): **`Home` \| `Bots` \| `Friends` \| `Leaderboard` \| `Profile`**. Sticky `Play` buttons on `Home` and `Bots` stack directly on top of this bar. |
| **3** | **Home Screen Layout** | **Vertical 1-by-1 Visual Board Rows** (replacing the 2×2 grid): Each row has a **square 9×9 DuoOrb Mini-Board preview on the left** + **Icon/Avatar, Title, and Subtitle on the right**: (1) `Play Online`, (2) `Play a Bot`, (3) `Play a Friend` (Private Rooms), (4) `Pass & Play` (Local), (5) `Match History / Review`. Sticky 3D Green `Play` button at the bottom opens the `New Game` screen. |
| **4** | **`New Game` + `Time/Options` Flow** | Tapping sticky `Play` on Home opens the **`New Game` screen** (`[⏱️ Classic · 3 min ⌄]` selector button + 3D Green `Start Game` CTA + secondary buttons: `Play a Friend`, `Play Bots`, `Pass & Play`). Tapping the selector opens the **Unified Options/Time view** containing DuoOrb's **Match Type** (`Classic 1v1`, `Center Rush`, `Race` + `2P/3P/4P` + `10/15/∞ Walls`) AND **Categorized Time Controls** (`Bullet`, `Blitz`, `Rapid` — no `Daily`). |
| **5** | **Dedicated `Bots` Page & Drawer** | Top **Bot Showcase** (Large `BotAvatar` + left-tailed White Speech Bubble + Name/ELO/3 Mastery Stars) + **Categorized Bot Grid** (`Beginner`, `Intermediate`, `Master`, `Engine`) + **Sticky Bottom Control Bar** (`[Options ⌄]` + `[Blue \| ? \| Red]` side buttons) stacked above the **Sticky 3D Green `Play` button**. Tapping `Options` expands an **in-place bottom drawer** (with `No Timer` + `Bullet/Blitz/Rapid` + `Classic/Center/Race` + `Walls`) while `Play` remains pinned to the navbar. |
| **6A** | **Ongoing Online Match (`ongoingonlinmacth.jpg`)** | **Top App Bar**: `←` Back \| `DuoOrb` Logo \| Right **Signal Bars (`📶`)**. **Under Header**: Live **Horizontal Move Notation Strip** (`1. e2  e8 ...`). **Player Bars (Top Opponent & Bottom User)**: Left Square Avatar (`44×44`), **replaced by the `wifi-off` (Wi-Fi with diagonal slash) icon inside the avatar box whenever that player loses connection (`disconnected` / `reconnecting`)**, Middle `Username (Rating)` + Walls badge + reconnect countdown when disconnected, Right **Turn-Aware Clock Box** (muted surface when waiting; high-contrast active surface + `⏱` clock icon when it is that player's turn). **Bottom**: `WallTray` + **4-Icon Bottom Toolbar** (`Options`, `Chat`, `Back <`, `Forward >` — no `Undo` in online matches). |
| **6B** | **Ongoing Bot Match (`ongoingmacthaginstbot.jpeg`)** | **Top**: Large `BotAvatar` on left + left-tailed White Speech Bubble on right (with compact Wall Count & Clock if timed). **Center**: `GameBoard`. **Bottom**: User Player Bar + `WallTray` + **5-Icon Bottom Toolbar** (`Options`, `Chat`, `Undo`, `Back <`, `Forward >`). |
| **7** | **Post-Match Result Modal (`GameOverModal`)** | Full Chess.com Result Modal: Header (`Sound`, **`You Won!`** / **`You Beat [Bot]!`** + reason subtitle, `✕` Close), Rating Delta (`Online`) or 3 Mastery Stars (`Bot`), Avatar + White Speech Bubble, **3-Column Move Counters** (`Best ★`, `Excellent 👍`, `Good !` — pre-computed in background & cached), full-width 3D Green **`★ Game Review`** CTA, 2-Column row (`Rematch` \| `New 3 min` or `New Bot` \| `Rematch`), and `AdBanner` + `Remove Ads`. |
| **8** | **Finished Match Board (Post-Modal)** | Closing (`✕`) the Result Modal transforms `GameScreen`: keeps the **Horizontal Scrollable Move Notation Strip** directly under the top header (`1. e2  e8  2. Hd4 ...`, tappable to scrub), hides `WallTray`, and docks the **5-Action Bottom Bar** (`Options`, `Summary`, **Center 3D Green `[★]` Review Button**, `Back <`, `Forward >`). |
| **9** | **Two-Phase `Game Review` Screen** | **Phase 1 (`Summary`)**: Coach Speech Bubble + Win/Eval Area Chart with colored key-moment dots + 2-Column Player Comparison Table (`Players`, `Accuracy` pills, `Best ★`, `Excellent 👍`, `Good !`, `Inaccuracy ?!`, `Mistake ?`, `Blunder ??`) + sticky 3D Green **`Start Review`** button. **Phase 2 (`Board`)**: Coach Move Bubble + **Vertical Left Eval Bar** + `GameBoard` with move badges + Move Strip + Bottom Bar (`Show`, `Best`, `Retry`, and 3D Green **`Next`** button). |
| **10** | **Board Engine & Mini-Boards** | Keep DuoOrb's 9×9 `GameBoard.tsx` and skins (`Classic` Light Slate & `Walnut` Wood) intact; build a lightweight `MiniBoardPreview` using DuoOrb's real 9×9 grid, orbs, and walls for the Home Screen rows. |
| **11** | **Pass & Play, Challenge & History** | Unify `Pass & Play` and `Friend Challenge` setup into the same Chess.com-style Options + 3D Green CTA UI, and add a dedicated `Match History` section/button inside `ProfileScreen.tsx` (in addition to Home). |

---

## 2. Global Theme & Token Specification ([`src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts))

### 2.1 Color Tokens (Light Mode Primary + Dark Mode Support)
We will update [`apps/mobile/src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts) so `PRIMARY_COLOR` and surface tokens deliver the **Chess.com Light Mode** aesthetic while keeping player orb colors (`Player 1 Blue #2563EB / #3B82F6`, `Player 2 Coral #E5484D`, `Player 3 Green #0E9F6E`, `Player 4 Amber #D9930D`) distinct on the board:

| Token | Light Mode Value (Primary) | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `PRIMARY_COLOR` / `primary` | `#69B342` (Chess.com Tactile Green) | `#81B64C` | Primary 3D buttons, active nav tab, selected borders |
| `primaryBevel` *(new)* | `#4E8C2F` | `#5D8C30` | 4px bottom 3D lip on primary green buttons (`Play`, `Start Game`, `Start Review`, `Next`) |
| `background` | `#F5F4F0` (Warm Alabaster / Stone) | `#262421` (Warm Charcoal) | Main screen canvas |
| `backgroundCard` / `surfaceContainerLowest` | `#FFFFFF` | `#312E2B` | Cards, rows, speech bubbles, docked bars |
| `surfaceMuted` / `surfaceContainerLow` | `#EAE8E1` | `#3B3834` | Secondary buttons (`Options`, `Rematch`, time chips) |
| `secondaryBevel` *(new)* | `#D0CEC4` | `#22201E` | 3px bottom 3D lip on secondary tactile buttons |
| `surfaceHairline` / `surfaceContainer` | `#DFDDD5` | `#45423E` | Card borders, row dividers |
| `textPrimary` / `onSurface` | `#262421` | `#FFFFFF` | Headlines, titles, speech bubble text |
| `textSecondary` / `onSurfaceVariant` | `#52504C` | `#C3C2C0` | Subtitles, secondary labels |
| `textMuted` | `#7D7A75` | `#989795` | Captions, inactive tab icons |
| `player1` | `#3B82F6` (Tactical Blue Orb) | `#60A5FA` | Kept blue so Player 1 orb (`Blue`) & Side Picker stay distinct from Green UI chrome |

### 2.2 Reusable 3D Tactile Button Pattern
Every primary and secondary button in the Chess.com screenshots features a signature tactile 3D bottom lip:
- **Primary 3D Green Button**: `backgroundColor: THEME.colors.primary`, `borderBottomWidth: 4`, `borderBottomColor: THEME.colors.primaryBevel`, `borderRadius: 10`, bold white text (`fontSize: 18–20`).
- **Secondary 3D Button** (`Options`, `Rematch`, `New 3 min`, Time cells): `backgroundColor: THEME.colors.surfaceMuted`, `borderBottomWidth: 3`, `borderBottomColor: THEME.colors.secondaryBevel`, `borderRadius: 8`.

---

## 3. Page-by-Page Analysis & Detailed Implementation Plan

### Page 1: Bottom Navigation & Sticky CTA Architecture
- **Reference**: `home secreen.png`, `bots page.jpeg`
- **Files to Modify**:
  - [`apps/mobile/src/components/BottomNav.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BottomNav.tsx)
  - [`apps/mobile/App.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx)
- **What Changes**:
  1. Update `MainTab` type in `BottomNav.tsx` and `App.tsx`:
     ```ts
     export type MainTab = 'PLAY' | 'BOTS' | 'FRIENDS' | 'LEADERBOARD' | 'PROFILE';
     ```
     *(Note: `HISTORY` becomes a `SubScreen` reachable from both `HomeScreen` and `ProfileScreen` so no functionality is lost).*
  2. Restyle `BottomNav.tsx` from a floating pill (`position: 'absolute', left: 16, right: 16, borderRadius: 30`) to a **full-width docked bottom bar** (`height: 58 + bottomInset`, `backgroundColor: THEME.colors.backgroundCard`, `borderTopWidth: 1`, `borderTopColor: THEME.colors.surfaceHairline`):
     - Each tab renders **Icon (`size: 22`) + Label (`fontSize: 11`)** underneath (`Home`, `Bots`, `Friends`, `Leaderboard`, `Profile`).
     - Active tab uses `THEME.colors.primary` (`#69B342`) for both icon and label.
  3. Export `BOTTOM_NAV_HEIGHT = 58` so `HomeScreen` and `BotsScreen` dock their sticky bottom `Play` containers flush against the top edge of `BottomNav`.

---

### Page 2: Home Screen (`HomeScreen.tsx` + `MiniBoardPreview.tsx`)
- **Reference**: `home secreen.png`, `hom secreen.webp`
- **Differences vs. Chess.com**:
  - Chess.com shows `Play Online`, `Play Computer`, `Solve Puzzles`, `Daily Puzzle`, `Take Lessons`, `Play Coach`.
  - DuoOrb does **not** have Puzzles, Lessons, or Coach. Instead, we showcase DuoOrb's real game modes one-by-one vertically with real 9×9 DuoOrb mini-board previews!
- **Files to Create / Modify**:
  - **Create** `apps/mobile/src/components/MiniBoardPreview.tsx`: A lightweight, non-interactive 9×9 SVG/View mini-board (`size: ~116px`) that renders DuoOrb cells, placed walls, and colored player orbs in realistic mid-game presets (`online1v1`, `botMatch`, `friendsRoom`, `local4p`, `historyReview`).
  - **Modify** [`apps/mobile/src/screens/HomeScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/HomeScreen.tsx):
    1. **Top Header**:
       - Left: Online presence pill (`● 14 Online` or retry state) or `Sign In` pill if guest.
       - Center: DuoOrb Logo + `DuoOrb` title.
       - Right: `Install App` icon (on web) + `Settings` gear icon.
    2. **Vertical 1-by-1 Feature Rows** (scrollable list above the sticky footer):
       - **Row 1 — `Play Online`**: Left `MiniBoardPreview` (`online1v1`) | Right: Hand/Orb icon + **`Play Online`** + subtitle `Classic 3+0 vs Random` (or last-used online config). Tapping opens the `New Game` screen (`SETUP` with `online`).
       - **Row 2 — `Play a Bot`**: Left `MiniBoardPreview` (`botMatch`) | Right: [`BotAvatar`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotAvatar.tsx) of featured/last bot + **`Play a Bot`** + subtitle `Martin · Friendly (800 ELO)`. Tapping switches to the `BOTS` tab!
       - **Row 3 — `Play a Friend`**: Left `MiniBoardPreview` (`friendsRoom`) | Right: Two-players icon + **`Play a Friend`** + subtitle `Create or join a private room`. Tapping opens `OnlineScreen` (`rooms`).
       - **Row 4 — `Pass & Play`**: Left `MiniBoardPreview` (`local4p`) | Right: Device icon + **`Pass & Play`** + subtitle `2–4 players on one device`. Tapping opens `SETUP` (`local`).
       - **Row 5 — `Match History & Review`**: Left `MiniBoardPreview` (`historyReview`) | Right: Star/Review icon + **`Match History`** + subtitle `Replay & analyze your past games`. Tapping opens `HistoryScreen`.
       - Keep `<AdBanner placement="home" />` cleanly integrated at the bottom of the scroll list.
    3. **Sticky Bottom CTA Container**:
       - Pinned directly above `BottomNav`: Full-width 3D Green button **`Play`** / **`New Game`** (`height: 52`, `borderBottomWidth: 4`) → opens the `New Game` hub (`SETUP` with `online`).

---

### Page 3: "New Game" Hub & Unified Time/Match Config Selector
- **Reference**: `newgameafter clcik on play button.jpeg`, `chosing time.jpeg`
- **Differences vs. Chess.com**:
  - Chess.com's `New Game` has `Tournaments` and `Play Coach` (which we don't have), and its `Time` screen has `Daily (1 day / 3 days / 7 days)` correspondence (which we don't have).
  - DuoOrb has **Match Modes** (`Classic 1v1`, `Center Rush`, `Race`), **Player Counts** (`2P`, `3P`, `4P`), and **Walls** (`10`, `15`, `Unlimited`) in addition to **Bullet / Blitz / Rapid** clocks.
- **Files to Modify**:
  - [`apps/mobile/src/timeControls.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/timeControls.ts):
    - Add `category: 'bullet' | 'blitz' | 'rapid' | 'untimed'` to `TimeControl`, plus `NO_TIMER_CONTROL` (`id: 'no-timer', name: 'No Timer', short: 'No Timer', minutes: 0, incrementSeconds: 0, category: 'untimed'`) for AI/Local games.
  - [`apps/mobile/src/screens/MatchSetupScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/MatchSetupScreen.tsx):
    - Redesign into the **Chess.com `New Game` Hub**:
      1. **Header**: `←` Back arrow + Icon + Title (`New Game`, `Pass & Play`, or `Challenge [Name]`).
      2. **Config Selector Button** (Full-width 3D secondary button):
         - Displays Stopwatch/Category icon + current summary (e.g., **`3 min · Classic (10 Walls)`**) + Chevron `⌄`.
         - Tapping this button toggles/opens the **Time & Match Options View (`chosing time.jpeg`)**:
           - **Match Mode Section**: 3-column tactile buttons (`Classic 1v1` | `Center Rush` | `Race`).
           - **Players Section** (shown when Center Rush or Race is selected): 3-column tactile buttons (`2 Players` | `3 Players` | `4 Players`).
           - **Walls Section**: 3-column tactile buttons (`10 Walls` | `15 Walls` | `Unlimited`).
           - **Time Controls by Category** (with category icons: 🚀 `Bullet`, ⚡ `Blitz`, ⏱️ `Rapid`, plus `No Timer` when in `local` mode):
             - 3-column tactile buttons with `2.5px` green active border on the selected option.
      3. **Primary 3D Green CTA Button**:
         - **`Start Game`** (or `Send Challenge` in challenge mode) — immediately launches matchmaking (for `online`) or starts the local game!
      4. **Secondary Navigation Stack** (shown when `vsType === 'online'`):
         - Full-width tactile row button: **`👥 Play a Friend`** → opens Private Rooms (`OnlineScreen` `rooms`).
         - Full-width tactile row button: **`🤖 Play Bots`** → switches to the new `BOTS` tab.
         - Full-width tactile row button: **`📱 Pass & Play`** → switches `vsType` to `'local'`.

---

### Page 4: Dedicated Bots Page & Inline Expandable Options Drawer
- **Reference**: `bots page.jpeg`, `optionsinbotspagewhenclcikonbutton optionitopenthis...jpeg`
- **Files to Create / Modify**:
  - **Create** `apps/mobile/src/screens/BotsScreen.tsx`
  - **Modify** [`apps/mobile/App.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx) to render `BotsScreen` when `currentTab === 'BOTS'`.
- **Detailed UI & Behavior of `BotsScreen.tsx`**:
  1. **Top Header**: Bot icon + **`Bots`** title + right-side Mastery Star counter pill (`★ X / 30`).
  2. **Selected Bot Hero Showcase (Fixed above scroll/drawer)**:
     - **Row 1**: Large [`BotAvatar`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotAvatar.tsx) (`size="lg"`) on the left + **White Speech Bubble** with left-pointing triangle tail on the right, showing `selectedBot.quote` (or `dialogue.greetings[0]`).
     - **Row 2**: Bold **Bot Name** (`Martin`) + **ELO** (`800`) + **Role Badge** (`The Friendly Dad`) + **3 Mastery Stars (`★★★`)** on the right.
  3. **Middle Body — Scrollable Categorized Bot Grid**:
     - Grouped by DuoOrb's tiers from [`personalities.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/personalities.ts):
       - **`Beginner · 3`**: Martin (800), Pip (950), Elias (1100)
       - **`Intermediate · 4`**: Bram (1250), Nelson (1350), Vex (1500), Jamal (1650)
       - **`Master · 3`**: Marcus (1800), Viktor (1950), Achref (2100)
       - **`Standard Engine · 3`**: Easy (1200), Normal (1500), Hard (1800)
     - Rendered as a 4- or 5-column grid of square avatar tiles (`borderRadius: 10`), with a `2.5px` green border (`#69B342`) on the selected bot and compact 3-star mastery indicators under each avatar.
  4. **Sticky Bottom Dock + Inline Expandable `Options` Drawer**:
     - Positioned directly above `BottomNav`:
     - **Control Strip Row**:
       - Left (`flex: 1`): **`Options`** tactile button (board+clock icon + `Options` label + current summary chip e.g. `Classic · No Timer` + chevron `⌄` / `^`).
       - Right: **3 Square Side-Selection Buttons** (`46×46px` each):
         1. `[Blue Orb]` (`side === 'blue'`)
         2. `[?]` Split-square Random icon (`side === 'random'`)
         3. `[Red/Coral Orb]` (`side === 'red'`)
         - Selected side button wears a `2.5px` green outline.
     - **Inline Expandable `Options` Drawer** (when `optionsOpen === true`, matching `optionsinbotspage...jpeg`):
       - Smoothly expands between the Selected Bot Showcase and the sticky `Play` button!
       - Scrollable interior containing:
         - **`No Timer`** full-width tactile button at the top
         - **🚀 Bullet** (`1+0`, `1+1`), **⚡ Blitz** (`3+0`, `3+2`, `5+0`, `5+3`), **⏱️ Rapid** (`10+0`) 3-column grids
         - **Match Mode**: `Classic 1v1` | `Center Rush` | `Race` (+ `2P / 3P / 4P` if Center/Race)
         - **Walls**: `10 Walls` | `15 Walls` | `Unlimited`
     - **Sticky Primary CTA Row**:
       - Full-width 3D Green **`Play`** button (`height: 52`) pinned right above `BottomNav`. Tapping `Play` launches `GameScreen` with the selected bot, side, mode, walls, and clock!

---

### Page 5, 5B & 7: Ongoing Online Match, Ongoing Bot Match & Finished Match Board (`GameScreen.tsx` & `GameHud.tsx`)
- **Reference**:
  - `ongoingonlinmacth.jpg` (Ongoing Online Match)
  - `ongoingmacthaginstbot.jpeg` (Ongoing Bot Match)
  - `finsihedmacthboardafterclosemodalof teh eneding macth.jpeg` (Finished Match Board after closing Result Modal)
- **Files to Modify**:
  - [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx)
  - [`apps/mobile/src/components/GameHud.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameHud.tsx)
  - [`apps/mobile/src/components/BotSpeechBubble.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/BotSpeechBubble.tsx)

#### 5A. Detailed Breakdown of Ongoing Online Match (`ongoingonlinmacth.jpg`)
1. **Top App Bar**:
   - Left: `←` Back arrow (`onPress` prompts leave confirmation if match is active).
   - Center: DuoOrb Icon + **`DuoOrb`** brand header.
   - Right: **Connection Signal Bars (`Feather` `bar-chart-2` / `wifi-off`)** showing real-time socket health (`green` bars when connected, `danger` red `wifi-off` when socket is reconnecting/offline).
2. **Live Horizontal Move Notation Strip (Directly Below Top App Bar)**:
   - Just like `ongoingonlinmacth.jpg` (`1.  [e4]`), render the horizontal scrollable move notation strip right below the top app bar **during ongoing online/local matches as well as finished matches** (`1. e2  e8   2. Hd4  Ve5 ...`).
   - The current ply (`viewingStep ?? totalSteps`) is highlighted inside a rounded pill (`[e4]`). Tapping any move or using `<` / `>` in the bottom bar scrubs the board to inspect previous moves.
3. **Player Bars (`InGamePlayerChip` / `PlayerStrip` in `GameHud.tsx`)**:
   - **Left Square Avatar (`44×44px`) & Disconnected Wi-Fi Slash Rule**:
     - When the player is connected (`status === null` or `status.kind === 'afk'`): Renders the square profile avatar (`44×44px`, rounded `8px`).
     - **CRITICAL RULE — Disconnected Profile Replacement**: When a player loses connection (`status?.kind === 'disconnected'` or `status?.kind === 'reconnecting'`), **replace their profile avatar inside the `44×44px` square box with the `wifi-off` icon (Wi-Fi symbol with diagonal slash line)** on a danger-tinted square (`backgroundColor: THEME.colors.dangerLight`, `borderColor: THEME.colors.danger`, `Feather name="wifi-off" size={22} color={THEME.colors.danger}`), and show the countdown (`Disconnected · 30s` / `Reconnecting…`) right beside/under their username!
     - Tapping an opponent's avatar or username still opens `PlayerInspectModal`.
   - **Middle Identity Column**:
     - Bold **Username** (`Erlanimus` / `achrefes`) + **Rating in parentheses** `(720)` + Premium/Flag badge + DuoOrb **Fence Icon + Walls Remaining (`10`)**.
   - **Right Turn-Aware Clock Box (`ongoingonlinmacth.jpg`)**:
     - **Inactive Turn Clock** (Top opponent in screenshot: `9:57`): Muted stone/grey rectangular pill (`backgroundColor: THEME.colors.surfaceMuted`, dark/muted text, no clock icon).
     - **Active Turn Clock** (Bottom player in screenshot: `⏱ 9:20`): High-contrast dark charcoal/ink rectangular box (`backgroundColor: '#262421'`, bold white text `#FFFFFF`) with a **Clock Icon (`⏱`) on the left side of the time**! (Turns red/amber when `≤30s` / `≤10s`).
4. **Bottom Area in Ongoing Online Match**:
   - User's Player Bar (`Avatar / Wifi-Off` + `Username (Rating)` + `Active Clock Box`).
   - [`WallTray`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/WallTray.tsx) (`[ Horizontal Wall | Count | Vertical Wall ]`).
   - **Docked 4-Icon Bottom Toolbar (`ongoingonlinmacth.jpg`)**:
     - In Online Matches, there is **no `Undo` button** — render the exact 4-button bar from `ongoingonlinmacth.jpg`:
       1. **`Options`** (`list` icon + `Options` label → opens sheet with `Resign`, `Sound Toggle`, `Game Rules`)
       2. **`Chat`** (`message-circle` icon + `Chat` label → toggles quick emoji reaction pop-up)
       3. **`Back`** (`chevron-left` `<` + `Back` label → steps backward in move history)
       4. **`Forward`** (`chevron-right` `>` + `Forward` label → steps forward in move history)

#### 5B. Detailed Breakdown of Ongoing Bot Match (`ongoingmacthaginstbot.jpeg`)
1. **Top Area — Bot Coach Header**:
   - In 1v1 AI Bot Matches, render the **Bot Coach Header**: Large `BotAvatar` (`52×52`) on the left + a **White Speech Bubble with left-pointing tail** on the right displaying live `botDialogue.text` (or the bot's active status/quote), with a compact metadata strip showing `Bot Name (ELO)` · `Fence Icon + Walls Remaining` · `Clock Box` (hidden if `No Timer`).
2. **Bottom Area — 5-Icon Toolbar**:
   - User Player Bar + `WallTray` + **5-Icon Bottom Toolbar**:
     - `Options` | `Chat` | **`Undo`** (`rotate-ccw` icon) | `Back (<)` | `Forward (>)`.

#### 5C. Detailed Breakdown of Finished Match Board (`finsihedmacthboardafterclosemodalof teh eneding macth.jpeg`)
1. When the match finishes and the user closes (`✕`) the `GameOverModal` (`isCompleted && !showGameOver`):
   - **Top**: Header (`←` Back | `DuoOrb` | `🔍` Review icon) + **Horizontal Move Notation Strip** (`1. e2  e8  2. Hd4 ...`) + Opponent Player Bar.
   - **Bottom**: User Player Bar (`WallTray` is hidden) + **Finished Match 5-Action Bottom Bar**:
     - **`Options`** (`list` icon → `New Game`, `Rematch`, `Exit to Home`)
     - **`Summary`** (`award` icon → re-opens `GameOverModal`)
     - **Center Highlighted 3D Green Square Button (`[ ★ ]`)** → triggers `handleAnalyzePress()` to open **`Game Review`**!
     - **`Back (<)`** (step backward)
     - **`Forward (>)`** (step forward)

---

### Page 6: Post-Match Winning / Result Modal (`GameOverModal.tsx`)
- **Reference**: `wiingmodalfistoption.jpeg` (Online), `wiingmodalscsecondoptionvsbot.jpeg` (Vs Bot)
- **Files to Modify**:
  - [`apps/mobile/src/components/GameOverModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx)
  - [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx)
- **What Changes**:
  1. **Background Pre-Compute of Move Counts**:
     - When `state.status === 'COMPLETED'` in `GameScreen.tsx`, immediately kick off `analyzeMatchLocal` (or server review) in the background and store it in `REVIEW_CACHE` so:
       - `GameOverModal` receives `moveCounts: { best: number; excellent: number; good: number } | null` for the human player.
       - When the user taps **`★ Game Review`**, the review is **already cached** and opens in `0ms`!
  2. **Modal Layout (`GameOverModal.tsx`)**:
     - **Top Bar**: Sound mute/unmute icon on left | Bold Title (**`You Won!`** / **`You Beat [BotName]!`** / **`Defeat`**) + Subtitle (`by Goal Reached`, `by Timeout`, `by Resignation`, `by Abandonment`) in center | `✕` Close button on right.
     - **Rating / Mastery Row**:
       - Online: Mode clock icon + **`1516`** + green/red delta **`+16`**.
       - Bot match: **3 Mastery Stars (`★★★`)** earned.
       - 3P/4P Multiplayer: Compact finishing order list (`1ST`, `2ND`, `3RD`, `4TH`).
     - **Avatar + White Speech Bubble**:
       - Left: `BotAvatar` (in Bot games) or Coach/Player avatar (in Online games).
       - Right: White speech bubble with left-pointing tail displaying the bot's win/lose quote or tactical summary line.
     - **3-Column Move Quality Counters**:
       - Column 1: Blue/Teal `!` badge + count + `Good / Great`
       - Column 2: Green `★` badge + count + `Best`
       - Column 3: Green `👍` badge + count + `Excellent`
     - **Primary 3D Green CTA**:
       - Full-width 3D Green button: **`★ Game Review`** (`onPress={onAnalyze}`).
     - **2-Column Secondary Buttons**:
       - In Bot games: **`New Bot`** | **`Rematch`**.
       - In Online games: **`Rematch`** | **`New [3+0]`**.
     - **Ad / Remove Ads Slot**:
       - `<AdBanner placement="gameover" />` + `Remove Ads` button (for non-premium users, opening `PremiumSheet`).

---

### Page 8 & 9: Two-Phase Game Review (`GameReviewScreen.tsx`)
- **Reference**:
  - Phase 1 (Summary): `gamereviewliek summrie before start full eview.jpeg`, `gamereviewliek summrie before start full review1.jpeg`
  - Phase 2 (Board): `gamereviewsecreen.jpeg`
- **Files to Modify**:
  - [`apps/mobile/src/screens/GameReviewScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameReviewScreen.tsx)
  - [`apps/mobile/src/components/WinGraph.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/WinGraph.tsx)
  - [`apps/mobile/src/components/AnalysisPanels.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/AnalysisPanels.tsx)
- **What Changes**:
  1. **Add `reviewPhase: 'summary' | 'board'` State to `GameReviewScreen.tsx`**:
     - Full reviews (`!bare`) start in `reviewPhase = 'summary'` (just like `gamereviewliek summrie before start full eview.jpeg`).
     - Bare replays from History (`bare === true`) go straight to `'board'` (with the `Analyze` upgrade button).
  2. **Phase 1: Summary & Comparison View (`reviewPhase === 'summary'`)**:
     - **Top Header**: `←` Back | **`Game Review`** | Right icons (`📊` / `⚙️`).
     - **Coach Speech Bubble**: Coach/Bot avatar on left + white speech bubble with `review.summary.keyLesson.detail`.
     - **Upgraded `WinGraph.tsx`**:
       - Area chart showing Player 1 vs Player 2 win probability across the match, with **colored dots** plotted at key moments/blunders (`decidingMoments`).
     - **2-Column Player Comparison Table**:
       - **Players Row**: Label `Players` on left | User Avatar (with green border) + Name in Col 1 | Opponent/Bot Avatar + Name in Col 2.
       - **Accuracy Row**: Label `Accuracy` on left | High-contrast pill badge (`79.3`) in Col 1 | Pill badge (`76.6`) in Col 2.
       - **Classification Breakdown Rows** (computed per player from `review.moveAnalyses`):
         - `Best` (`★` green circle badge in center)
         - `Excellent` (`👍` green circle badge in center)
         - `Good` (`!` blue/teal circle badge in center)
         - `Inaccuracy` (`?!` amber circle badge in center)
         - `Mistake` (`?` orange circle badge in center)
         - `Blunder` (`??` red circle badge in center)
     - **Sticky Bottom CTA**:
       - Full-width 3D Green button: **`Start Review`** → switches `reviewPhase` to `'board'`!
  3. **Phase 2: Step-by-Step Board Review (`reviewPhase === 'board'`)**:
     - **Top Header**: `←` Back | **`Game Review`** | Right button to toggle back to `Summary` (`📊`).
     - **Coach Move Speech Bubble (Above Board)**:
       - Left: Avatar (`BotAvatar` or Coach avatar).
       - Right: White speech bubble with left-pointing tail containing:
         - Assessment badge icon (`★`, `👍`, `!`, `?!`, `?`, `??`) + bold verdict (`"Hd4 is the best move"`) + Eval pill (`+1.4`) on right + 1–2 line explanation underneath.
     - **Vertical Left Evaluation Bar + `GameBoard`**:
       - Place the animated Evaluation Bar vertically along the left side of the board (`width: 12px`, `height: measuredBoardSize`), with the numeric eval label at the top/bottom edge, and `GameBoard` beside it rendering the move arrow, teal best-move arrow, ghost wall, and corner classification badge (`★`, `??`, `?`, `?!`).
     - **Horizontal Move Strip Navigator (Below Board)**:
       - `<` | Scrollable move chips (`1. e2`, `1... e8`, `2. Hd4`, etc.) | `>`
     - **Bottom Action Bar**:
       - Left 3 icon+label buttons:
         - **`Show`** (toggles best-move arrow/wall overlay)
         - **`Best`** (isolates best move)
         - **`Retry`** / **`Details`** (opens `TryAgainPanel` / `DetailsRows`)
       - Right primary 3D Green button: **`Next`** (`flex: 1`, jumps to next key moment or next move).

---

### Page 10: Profile & Match History Integration (`ProfileScreen.tsx`)
- **Files to Modify**:
  - [`apps/mobile/src/screens/ProfileScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/ProfileScreen.tsx)
  - [`apps/mobile/App.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/App.tsx)
- **What Changes**:
  - Since `BottomNav` is now `Home | Bots | Friends | Leaderboard | Profile`, add a prominent **`Match History & Game Review`** card/button inside `ProfileScreen.tsx` (in addition to the `Match History` row on `HomeScreen`) that navigates to `HistoryScreen` (`navigate(currentTab, 'HISTORY')`), ensuring past games and reviews are always 1 tap away from both `Home` and `Profile`.

---

## 4. Execution Order (When You Click "Proceed")

1. **Step 1 — Theme & Time Controls (`theme.ts`, `timeControls.ts`)**: Apply the Full Chess.com Light Mode palette (`#F5F4F0` canvas, `#FFFFFF` cards, `#69B342` 3D green buttons) + `No Timer` & speed categories (`Bullet`, `Blitz`, `Rapid`).
2. **Step 2 — Docked 5-Tab BottomNav & App Routing (`BottomNav.tsx`, `App.tsx`)**: Switch to the docked 5-tab bar (`Home | Bots | Friends | Leaderboard | Profile`) and wire `HISTORY` as a sub-screen accessible from `Home` and `Profile`.
3. **Step 3 — Home Screen & Mini-Board Previews (`MiniBoardPreview.tsx`, `HomeScreen.tsx`)**: Build the 1-by-1 vertical Chess.com-style rows with left-side 9×9 DuoOrb mini-boards and the sticky 3D Green `Play` button stacked above `BottomNav`.
4. **Step 4 — Dedicated Bots Page & Inline Options Drawer (`BotsScreen.tsx`)**: Build the full Bots page with top Bot Avatar + Speech Bubble, categorized bot grid, `[Options ⌄] + [Blue | ? | Red]` control bar, inline expandable Options drawer, and sticky 3D Green `Play` button.
5. **Step 5 — Unified `New Game` & `Time/Match Options` Screen (`MatchSetupScreen.tsx`)**: Rebuild the setup flow into the Chess.com `New Game` hub + categorized Time & Mode selector.
6. **Step 6 — Active Match Screen (Online & Bot), Disconnected `wifi-off` Avatar, Finished Match Board & Result Modal (`GameScreen.tsx`, `GameHud.tsx`, `BotSpeechBubble.tsx`, `GameOverModal.tsx`)**: Implement the Online Match header (`📶` signal bars + live move strip + turn-aware clock boxes + **`wifi-off` icon replacing the player's avatar when disconnected** + 4-icon bottom toolbar), Bot Match header (Bot Speech Bubble + 5-icon toolbar), Finished Match Board (center Green `[★]` button), and `GameOverModal` with pre-computed move counters.
7. **Step 7 — Two-Phase Game Review (`GameReviewScreen.tsx`, `WinGraph.tsx`, `AnalysisPanels.tsx`)**: Implement Phase 1 (`Summary` comparison table + `WinGraph` dots + `Start Review` CTA) and Phase 2 (Coach Move Bubble + Vertical Left Eval Bar + Board + `Show / Best / Retry / Next` bar).
8. **Step 8 — Verification & Testing**: Run TypeScript typechecking and unit tests across `apps/mobile` to verify zero regressions.
