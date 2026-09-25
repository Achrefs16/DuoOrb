# DuoOrb Tactical Design System

> **Centralized UI/UX Specification for DuoOrb Mobile**  
> *Derived from Stitch Design Prototypes (`apps/mobile/desginstitch/`)*

---

## 1. Core Principles & Architecture

1. **Board-First Tactile Focus**:
   - **CRITICAL MANDATE**: The internal board game—the 9×9 grid squares, player orb spheres, placed barriers, goal baselines, and legal move indicators in [`GameBoard.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameBoard.tsx)—is preserved using our native graphics and physics engine. It is NEVER replaced with static mockups.
   - All surrounding screens, headers, HUDs, inventory trays, dialogs, matchmaking radars, friends lists, and history cards strictly implement the modern Stitch tactile design system.

2. **Single-Point Palette Customization**:
   - The entire application's color theme is anchored around a **single primary color token** in [`src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts).
   - Changing `PRIMARY_COLOR` automatically computes and cascades all tints, elevated surfaces, hover states, card borders, active tabs, and focus rings across all screens.

3. **100% Dynamic & Backend-Linked**:
   - Zero static placeholders.
   - Every button, room code input, friend challenge action, AI difficulty selector, replay scrubber, and matchmaking cancellation is wired to `@duoorb/game-core`, `@duoorb/protocol`, Socket.io matchmaking, Supabase auth/session, and local offline storage.

---

## 2. Palette & Color Token System

All color tokens are defined in [`src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts).

### How to Change the Palette from One Place
To change the entire theme color, simply update the `PRIMARY_COLOR` constant in [`src/theme.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/theme.ts):

```typescript
// apps/mobile/src/theme.ts
export const PRIMARY_COLOR = '#2563EB'; // Vibrant Tactical Blue (Default)
// Change to any brand color, e.g. '#004AC6', '#6366F1', or '#0D9488'
```

### Color Token Reference Table

| Token | Default Hex / RGBA | Stitch Mapping | Role / Usage |
| :--- | :--- | :--- | :--- |
| `primary` | `#2563EB` | `primary` | Primary action buttons, active tabs, win rate highlights |
| `primaryLight` | `#DBEAFE` | `primary-fixed` | Light chip backgrounds, selected pills, active container |
| `primaryDark` | `#1D4ED8` | `on-primary-fixed-variant` | Hover / pressed state for primary actions |
| `primaryContainer` | `#2563EB` | `primary-container` | Filled primary surfaces |
| `secondary` | `#E5484D` / `#BB0112` | `secondary` | Player 2 / Opponent accent, loss badge, resign button |
| `secondaryContainer` | `#FEE2E2` | `secondary-container` | Loss badge background, red wall count chip |
| `tertiary` / `success` | `#16A34A` | `tertiary` / `game-green` | Quick Match hero button, victory badge, online dot |
| `tertiaryLight` | `#E8F8EE` | `surface-container-low` | Victory badge background, online friend indicator |
| `background` | `#FAF8FF` | `background` / `surface` | Screen background canvas |
| `surface` | `#FAF8FF` | `surface` | Base app surface |
| `surfaceContainerLowest` | `#FFFFFF` | `surface-container-lowest` | Elevated cards, dialog modals, white input fields |
| `surfaceContainerLow` | `#F2F3FF` | `surface-container-low` | Neutral sub-cards, pill backgrounds, timer boxes |
| `surfaceContainer` | `#EAEDFF` | `surface-container` | Dividers, subtle borders, inactive chips |
| `surfaceContainerHigh` | `#E2E7FF` | `surface-container-high` | Elevated hover pills, search bars |
| `inverseSurface` | `#131B2E` | `inverse-surface` | Dark contrast buttons, selected filter chips |
| `onSurface` | `#131B2E` | `on-surface` | High-contrast primary text, headlines, titles |
| `onSurfaceVariant` | `#434655` / `#64748B` | `on-surface-variant` | Secondary subtitles, ratings, elapsed timers |
| `outline` | `#737686` / `#CBD5E1` | `outline` | Card borders, subtle button borders |
| `outlineVariant` | `#C3C6D7` / `#E2E8F0` | `outline-variant` | Divider lines, radar waves, inactive icons |
| `danger` / `error` | `#DC2626` | `error` | Resign game confirmation, critical alerts |

---

## 3. Typography & Spacing Tokens

- **Font Family**: **Manrope** (loaded via `@expo-google-fonts/manrope` with high-legibility geometric sans curves).
  - Regular (`Manrope_400Regular`)
  - Medium (`Manrope_500Medium`)
  - SemiBold (`Manrope_600SemiBold`)
  - Bold (`Manrope_700Bold`)
  - ExtraBold (`Manrope_800ExtraBold`)
- **Font Sizes**:
  - `display`: `32px` (Bold 700, LineHeight `40px`) — Large timer, rating delta
  - `headline`: `22px` (Bold 700, LineHeight `30px`) — Screen titles, modal headings
  - `title`: `16px`–`18px` (SemiBold 600) — Card titles, player names
  - `body`: `14px` (Regular 400 & Medium 500) — Descriptions, instructions
  - `label`: `11px`–`12px` (SemiBold 600 / Bold 700, Uppercase tracking) — Section headers, badges
- **Border Radius**:
  - `sm`: `6px` — Mini tags, timer badges
  - `md`: `10px` — Buttons, chips, input fields
  - `lg`: `16px` — Cards, mode items, wall controls
  - `xl`: `24px` — Modals, bottom navigation
  - `full`: `9999px` — Orbs, round avatar chips, pill buttons
- **Elevations / Shadows**:
  - `card`: Subtle tactile depth (`shadowColor: #0F172A`, `shadowOpacity: 0.05`, `elevation: 2`)
  - `modal`: High elevation backdrop shadow (`shadowOpacity: 0.15`, `elevation: 8`)

---

## 4. Screen & Component Architecture

### A. Play Hub (`HomeScreen.tsx`)
- **Stitch Reference**: `duoorb_play_minimalist_board_game_1/code.html`
- **Elements**:
  1. Top App Header with brand badge (`DuoOrb Tactical Grid`) and quick Settings icon.
  2. Quick Match Hero Action with vibrant green CTA button (`#16A34A`), play icon, and clock settings button.
  3. Game Mode Cards:
     - **Vs AI** (Solo · 1v1, Race, Rush Center)
     - **Local** (Pass & Play · On one device)
     - **Private Rooms** (With Friends · Custom lobby)
     - **Custom Match** (Custom rules & time controls)
  4. Objectives & Rules swipeable cards (Classic 9×9, Race Mode, Rush Center).
- **Backend Linkage**:
  - Directly launches match via `onStartGame` or opens `OnlineScreen` in matchmaking or rooms mode.

### B. In-Game HUD & Wall Controls (`GameHud.tsx`, `WallTray.tsx`, `GameScreen.tsx`)
- **Stitch Reference**: `duoorb_active_match_wall_inventory_1/code.html`
- **Opponent HUD**:
  - Rounded-xl white card above the board.
  - Avatar initial in player color, opponent username, rating chip (`1500`), fence wall count badge (`10`), and timer box (`3:00`).
- **Game Board**:
  - **Custom GameBoard (`GameBoard.tsx`) preserved with full tactical precision.**
- **Player HUD**:
  - Rounded-xl white card below the board.
  - Player avatar, username, rating chip, turn pulse dot indicator, and timer box.
- **Wall Placement Inventory**:
  - 3-column card:
    1. Horizontal wall button with visual preview bar.
    2. Available wall count center badge (`8 Available`).
    3. Vertical wall button with visual preview bar.
  - Supports both drag-and-drop gestures and tap-to-place interactions.
- **Resign Action**:
  - Subtle flag icon + "Resign game" button at the bottom.

### C. Victory & Match Outcome Modal (`GameOverModal.tsx`)
- **Stitch Reference**: `duoorb_victory_result_tactical_rivalry/code.html`
- **Elements**:
  1. Trophy badge icon (gold/amber for win) or defeat icon for loss.
  2. Bold outcome title: `YOU WIN`, `YOU LOSE`, or `DRAW`.
  3. Rating delta with animated float effect (`+16` / `-14`) and rating transition badge (`1500 → 1516`).
  4. Opponent identity chip.
  5. Action buttons:
     - Primary: **Rematch** (`restart_alt`)
     - Secondary: **New Game** (`play_arrow`)
     - Utilities: **Replay** and **Analyze** buttons
     - Exit: **Lobby** link

### D. Match Setup Modal (`MatchSetupModal.tsx`)
- **Stitch Reference**: `duoorb_match_setup_vs_ai_local/code.html`
- **Elements**:
  1. Type toggle: `Vs AI` | `Local`
  2. Mode selection chips: `Classic` | `Center Rush` | `Race`
  3. Player count chips (2, 3, 4 players)
  4. AI difficulty chips: `Easy (1200 ELO)` | `Normal (1500 ELO)` | `Hard (1800 ELO)`
  5. Side selection chips: `Blue` | `Red` | `Random`
  6. Time control chips: `1+0` | `3+0` | `3+2`
  7. Rule hint banner with info icon
  8. Primary Action: `Play vs AI` / `Start Pass & Play`

### E. Friends (`FriendsScreen.tsx`)
- **Stitch Reference**: `duoorb_friends_clean/code.html`
- **Elements**:
  1. Header with "Friends" title and `+` Add Friend button.
  2. Search bar with instant filter.
  3. Friend Requests section with counter badge (`Friend Requests · 1`), accept (`✓`) and decline (`✕`) buttons.
  4. Online friends section with status dot, rating, and **Play** challenge button.
  5. Offline friends section.
  6. Add Friend modal with username search and invite links.

### F. History (`HistoryScreen.tsx`)
- **Stitch Reference**: `duoorb_history_spacious_clean/code.html`
- **Elements**:
  1. Header with "History" title and Filter button.
  2. Spacious Performance Summary card:
     - Matches, Wins, Losses, Win Rate %, Current Rating.
  3. Filter Pills: `All (N)` | `Wins (N)` | `Losses (N)`
  4. Clean Match Cards:
     - Result square badge: `W` (emerald) / `L` (rose)
     - Opponent username + rating
     - Game mode tag (e.g. `Ranked · Classic (9×9)`)
     - Rating delta (`+16` / `-14`)
     - Tap opens game replay or review.

### G. Profile & Player Profile (`ProfileScreen.tsx`, `PlayerProfileScreen.tsx`)
- **Stitch Reference**: `duoorb_my_profile/code.html` & `duoorb_opponent_profile/code.html`
- **Elements**:
  1. Identity card with tactile orb avatar, online status, username, joined date.
  2. 3-Stat Ribbon: Rating (`1,500`), Win Rate (`63%`), Matches (`92W · 54L`).
  3. Rating Progression Curve: Clean SVG sparkline curve with peak rating badge and month milestones.
  4. Recent Matches list.
  5. Head-to-Head Rivalry card (in Player Profile).

### H. Online Matchmaking & Private Rooms (`OnlineScreen.tsx`)
- **Stitch Reference**: `duoorb_matchmaking_loading/code.html` & `duoorb_private_rooms_clean/code.html`
- **Radar Matchmaking View**:
  - "Searching for Opponent" header with cancel (`✕`) button.
  - Match mode chip: `Classic · 3+0 · Ranked`.
  - Animated radar dots between YOU and opponent avatar with ping waves.
  - Live search timer (`00:08 Searching`).
  - Matched transition state (`Opponent Found! You vs Ahmed`).
- **Private Rooms View**:
  - Mode selector & time controls.
  - "Create New Room" button generating 6-digit room code with One-Tap Copy.
  - "Join Room" input field and Join button.

### I. Match Review (`GameReviewScreen.tsx`)
- **Stitch Reference**: `duoorb_match_review_board_matched/code.html`
- **Elements**:
  1. Header with back arrow and centered "Match Review" title.
  2. Match result & summary badge (`Victory · +16 · Classic 3+0`).
  3. Opponent HUD card directly above the board.
  4. Preserved `GameBoard` in the center.
  5. User HUD card directly below the board.
  6. Move scrubber progress bar and move counter (`Move 22 / 28`).
  7. Playback cluster: First (`|‹`), Prev (`‹`), Play/Pause (`▶`/`⏸`), Next (`›`), Last (`›|`).
  8. Move strip chips and analysis evaluation panel.

### J. Bottom Navigation (`BottomNav.tsx`)
- **Stitch Reference**: Mobile bottom nav in Stitch HTML
- **Elements**:
  1. 4 Tabs: `PLAY`, `FRIENDS`, `HISTORY`, `PROFILE` with icons.
  2. Active tab indicator in `PRIMARY_COLOR`.
  3. Pending friend requests notification badge.
