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
export const PRIMARY_COLOR = '#2563EB'; // Tactical Vibrant Blue (Default)
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

---

## 5. Anti-Slop UI & Visual Skill (`antislop-ui`)

```yaml
name: antislop-ui
description: UI and visual skill for antislop. Use when building or editing any interface: color, layout, components, motion. Load with the core.
allowed-tools: [Read, Write, Edit, Glob, Grep]
```

# antislop-ui
## Anti Slop: Rules for AI Coding Agents. UI & Visual skill
Part of the antislop system. Read together with antislop.md (the core). This skill deep-dives the UI/visual concern: color, layout, components, decoration, structural flow, and motion. It references core rules by number and never duplicates or renumbers them. Load it when the task builds or edits a website, web app, or any interface.

### How to use this skill
Load together with antislop.md whenever the task is UI or visual work. The core holds the mechanism (the purpose test, the three tiers, the Delivery Gate); this skill holds UI-specific depth.
Every entry has the same shape: **Tell** (the pattern), **Why** (why it reads as slop), **Fix** (what to do instead), with the governing core rule cited as R-XX.
The Delivery Gate in the core remains the gate. The "UI Skill Checklist" at the end of this file is the UI-specific supplement to run alongside it.

### Visual & Color

#### Generic Blue-Purple Gradient
- **Tell**: blue-to-purple, blue-to-cyan, or purple-to-pink gradients used as the primary color treatment, or a full-page colored glow.
- **Why**: the most over-represented color treatment in training data. It signals "no brand identity", not "our palette", and marks the design as AI-generated at a glance.
- **Fix**: pull the palette from DESIGN.md or the product's own identity. Keep a gradient only as a hierarchy function with the reason written down (R-01). A gradient separating one level from another is craft; the same gradient on every section is a default.
- *The same default family*: harsh or rainbow gradients, purple-and-black schemes, neon or pastel palettes, and blurred radial orbs behind the hero. They are the same tell wearing different clothes: color from the model's default, not from the brand. All of them are FORBIDDEN as defaults without purpose (R-01).

#### Excessive Glassmorphism
- **Tell**: blur/backdrop-filter on the navbar, cards, modals, and sidebar at the same time.
- **Why**: blur removes texture and sits every surface in the same frosted layer, flattening hierarchy. When every surface is glass, nothing is foreground.
- **Fix**: treat glass as an accent, not a character trait. Dose cap: at most 1-2 elements (R-10). The surface that needs the attention gets the glass; everything else stays solid.

#### Excessive Border Radius
- **Tell**: every element is pill-shaped: buttons, inputs, cards, badges, modals.
- **Why**: uniform pill shapes erase the visual language of "this is an input, this is a card". Radius becomes decoration instead of a hierarchy tool.
- **Fix**: set a small set of radii in the design system and apply them deliberately (R-11). One generous radius on the primary CTA reads as intentional; the same radius on every element reads as a default.

#### Overly Soft Shadows
- **Tell**: every component carries a large shadow, so the whole page feels like it is floating.
- **Why**: when everything is elevated, elevation communicates nothing. The page loses its ground plane and becomes generic softness.
- **Fix**: use shadow as an elevation marker only, and write the elevation reason down (R-12). Most elements should sit flat; the one or two that need to lift above the page carry the shadow.

#### Glow Everywhere
- **Tell**: glow on cards, buttons, icons, badges, backgrounds, and borders simultaneously.
- **Why**: glow is an attention amplifier. Applied everywhere it amplifies nothing, and it is one of the fastest ways to look "made by AI".
- **Fix**: reserve glow for a maximum of 1-2 important elements as a focus accent (R-13). Everything else stays matte.

#### Background Grid
- **Tell**: grid squares, blueprint lines, graph paper, dot grids, or thin repeating lines behind content.
- **Why**: it is a default way to make a flat page feel "technical" without doing any real work. It reads as texture without intent.
- **Fix**: use texture or pattern only when it genuinely supports the product's identity, with the reason written down (R-07). A real identity motif (core Part 3) beats a stock grid every time.

#### Dark Mode Default for No Reason
- **Tell**: the whole page is dark simply because it looks "tech", with no branding consideration.
- **Why**: dark is a decision, not a default. Forcing it reads as following a trend, not serving the product.
- **Fix**: choose the theme from brand identity, product type, and audience (R-21). Developer and creative tools have legitimate reasons for dark; a content-first product usually does not. If there is no strong reason for a fixed theme, build a working light/dark toggle.

#### Too Many Colors in the Palette
- **Tell**: 5-7 different colors on one page with no clear design system.
- **Why**: a scattered palette has no hierarchy. When every element can be any color, nothing is distinguished.
- **Fix**: cap the active palette at 2-3 core colors + 1 accent (R-29), and let one of the cores be the neutral base. Restraint is what makes the accent land.

#### Excessive Accent Color
- **Tell**: one accent color on buttons, icons, badges, links, lines, backgrounds, and glows at once.
- **Why**: the accent stops being an accent the moment it is everywhere. It becomes just another color, and the design loses its focal point.
- **Fix**: the accent belongs at the key moment only (one deliberate accent, core Part 3). Zero accents is sterile; an accent everywhere is slop. Choose the one or two places it matters.

#### Sterile Default
- **Tell**: flat white or near-white, thin grey borders, small radius, no texture, generic font, no identity.
- **Why**: this is the "safe" result of over-filtering without direction. It is not slop, but it is not design either: it is a void where a design should be.
- **Fix**: this is a direction problem, not a filter problem. Add DESIGN.md or resolve the Design Read (core Part 3), then raise the liveliness dials. The fix is never more bans; it is state the purpose and add energy.

### Layout & Components

#### Monotonous Template Layout
- **Tell**: hero, subtitle, 2 CTAs, screenshot, feature grid, testimonials, FAQ, CTA, footer, in that order, every time.
- **Why**: the order is the training-data default, not the product's narrative. Sections appear because the template has them, not because the content needs them.
- **Fix**: build the structure around actual content needs (R-05, C-3). If the product has no testimonials, there is no testimonials section. Section order follows the product's story. Match the RHYTHM dial: if it is 3, sections visibly vary.

#### Copy-Paste Feature Cards
- **Tell**: identical size, height, icon, layout, and padding across all feature cards.
- **Why**: uniform cards flatten the content. When every feature is a card with an icon, the features with real weight and the ones without look the same.
- **Fix**: create variation that reflects content hierarchy, with the reason written down (R-14). Not every feature needs to be a card. The flagship feature may deserve a full-width treatment, the supporting ones a list.

#### Bento Grid
- **Tell**: a section made of a mosaic of differently-sized cards, some spanning two columns or two rows, filling the space like a tiled dashboard.
- **Why**: it is the default "app-like" landing layout of the last few years, so it signals nothing about the product. When every section could be a bento, the layout is a template, not a decision.
- **Fix**: use a bento grid only when the content genuinely has elements of different sizes to show (R-05). If every cell is roughly the same, a simple grid or list is more honest. The RHYTHM dial decides whether sections vary at all.

#### Uniform Spacing
- **Tell**: padding, margin, and gaps are identical across every section.
- **Why**: rhythm is a tool, and a single spacing value removes it. Sections stop relating to each other; the page reads as one flat strip.
- **Fix**: use whitespace as structure (core Part 3) and vary it with the RHYTHM dial. Establish a spacing scale, then use different levels to separate and connect. Uniform rhythm is a deliberate choice only when the dial says so (R-05).

#### "How It Works" Always 3 Steps
- **Tell**: round icon + number 1, 2, 3 + short text, always three steps, always the same shape.
- **Why**: the product's real process is rarely a tidy three-step list. The template forces the process into its shape, not the other way around.
- **Fix**: present the process as it actually is (R-05). Three steps with round icons is fine if that is genuinely the process; otherwise use whatever shape the real workflow takes, including two steps or five.

#### "Trusted By" Logo Bar
- **Tell**: a row of generic company logos directly below the hero.
- **Why**: it is a trust claim with no evidence: generic logos, no real customers named, no proof of use.
- **Fix**: only show real, verifiable logos (R-18, R-36, C-5). If the product has no such customers yet, do not fabricate a logo bar. Real social proof beats a generic one every time.

#### "Most Popular" Pricing Card
- **Tell**: the middle pricing tier always highlighted with a capsule badge.
- **Why**: it is the default pattern, which means it is not a decision. When every pricing section does it, the highlighted tier stops meaning anything.
- **Fix**: highlight the tier that actually serves the product's goals, and write why (R-31). If no tier deserves emphasis, highlight none.
- *Three columns is part of the tell*: pricing shown as three tiers whatever the real structure, the middle one highlighted. That shape is the default, so it is not a decision (R-05). Use as many tiers as the product really has, and highlight the one that serves it.

#### Demo Without a Product
- **Tell**: the page sells a product that is never shown working: no real demo, no Terms of Service, no Privacy Policy, just promises.
- **Why**: it is a demo wearing a product's clothes. Every claim is trust with nothing behind it, and the missing legal pages are the quiet tell that nothing real exists yet.
- **Fix**: show the real product working, or say honestly that it is not shipped yet (R-38, C-5). If the page asks for signups or payment, the Terms of Service and Privacy Policy must exist. An honest "coming soon" beats a convincing demo.

#### 4-Column Template Footer
- **Tell**: Product / Company / Resources / Legal columns with no variation.
- **Why**: the columns exist because templates have them, not because the site has that many link groups.
- **Fix**: structure the footer around what the product actually links to (R-05). A single column of links can be more useful than four half-empty ones.

#### Uniform Section Rhythm
- **Tell**: every section is centered title + subtitle + identical card grid, with no variation.
- **Why**: identical composition makes sections blur together, and the page feels repetitive and flat.
- **Fix**: vary composition with the RHYTHM dial (R-05). Alternate text-heavy and visual sections, asymmetric and symmetric layouts. A page where every section follows the same template is a page designed by a template.

### Decorative Elements

#### Generic AI Icons
- **Tell**: sparkle, star, magic, lightning, diamond, cube, robot, or AI orb as feature icons.
- **Why**: these glyphs are the generic vocabulary of "AI product". They communicate nothing about the specific feature.
- **Fix**: use icons genuinely relevant to the content, with the relevance written down when the glyph is generic (R-04). If no appropriate icon exists, use none. The feature label does the work.

#### Lucide Icons
- **Tell**: every icon comes from the same thin-stroke, rounded-corner library (Lucide or a visual clone), so all icons share one recognizable look.
- **Why**: a single default icon library makes every AI site's icons identical, so the icons stop telling you anything about the product. The glyphs may be relevant; the uniform library look is the tell.
- **Fix**: the icon set is a visual choice, not a default (R-04). Pick icons for relevance first; then decide whether the library's weight and stroke suit the product's character. Two icons that look "same-ish" can still read as yours if the set is a decision, not an import.

#### Emoji as Decoration
- **Tell**: literal emoji scattered through the copy, headings, badges, and buttons: 🚀 in a headline, ✅ beside every feature bullet, 🔥 on a CTA, 📈 above a chart title.
- **Why**: emoji is the loudest shorthand for "this was generated, not written". In a UI it competes with the content for attention and flattens the product's voice into the same cheerful default as every other AI site.
- **Fix**: remove emoji from UI text. If a concept needs a mark, use a real, relevant icon with the reason written down (R-04), or no mark at all. The copy carries the meaning; the emoji adds nothing.

#### Small Arrows on Every Button
- **Tell**: → or ↗ placed on almost every button as pure decoration.
- **Why**: the arrow becomes a pattern, not a signal. When every CTA has one, none of them point anywhere specific.
- **Fix**: arrows are not the default identity for buttons (R-08). Keep them for the action that genuinely benefits from a direction cue, sized proportionally, with the purpose written down.

#### Colored Left Stripe
- **Tell**: a thin colored vertical bar on the left edge of cards, list rows, or section headers, used as decoration.
- **Why**: the stripe adds color without adding meaning. It is the cheapest way to make a card "look designed", so it appears everywhere and says nothing.
- **Fix**: the stripe is decoration; it must carry information or go (R-01, R-31). A left edge that marks real state (active, warning, new) is a signal. A stripe that exists to look designed is a default.

#### AI Capsule Badges
- **Tell**: pill shape, thin border, glow, small dot, uppercase, containing "AI Powered", "Beta", "New".
- **Why**: the capsule-plus-glow-plus-dot combination is a self-referential badge that says "made by AI, about being made by AI". It adds noise, not information.
- **Fix**: badges only when functionally needed, with the need written down, and never the full combination (R-09). A real status label is fine; a decorative "AI Powered" pill is not.

#### Eyebrow Badge Above the Headline
- **Tell**: a small pill sitting directly above the H1, often with a dot and a thin border, holding a category label ("Aplikasi Tagihan UKM", "The platform for teams") that the headline beneath it already says.
- **Why**: the badge duplicates the headline, so it adds a line of reading without adding a fact. It lands in the same spot on every generated page, which is why it reads as a template rather than a decision. When it carries a dot as well, it borrows status-indicator language for a label that marks no state.
- **Fix**: cut it and let the headline do the work. If the label carries information the headline does not, fold it into the headline or the subheadline, where it reads as content instead of ornament. A badge above the fold needs a written reason like any other badge (R-09), and a dot inside it needs a real state to mark (R-31).

#### Decorative Status Dot
- **Tell**: a small colored dot beside a heading, eyebrow, nav item, or label, usually glowing and pulsing on a loop, that marks nothing. It borrows the visual language of a live or recording indicator for a page where nothing is live.
- **Why**: the dot is an attention grab with nothing behind it: a glow plus an endless pulse is a double bid for the eye over a fact that does not exist. It reads as AI because generated pages reach for system-status vocabulary as decoration, and the same dot lands in the same place on every one of them.
- **Fix**: a dot must mark a real state (active, live, recording, warning). If it does, keep one dot, drop the glow, and drop the endless pulse (R-19). If it marks nothing, remove it: a heading needs no indicator to be a heading (R-31).

#### Generic AI Typography
- **Tell**: large monospace headings, or uppercase labels with extreme letter-spacing ("HOW IT WORKS", "FEATURES").
- **Why**: monospace-as-aesthetic and wide-tracked uppercase are shorthand for "technical and modern" without doing any real typographic work.
- **Fix**: choose typeface from brand character, not the model's default pick, and write the reason (R-06). Typography must improve readability and reflect the product. A type choice with a reason beats a trend every time.
- *The default roster*: Inter, Geist, and Space Grotesk for sans; Geist Mono, JetBrains Mono, and Fira Code for mono. None are banned; each is valid with a brand reason. The tell is the font that shows up because it was the default, not because it fits (R-06).

#### Fake Terminal Window
- **Tell**: a styled terminal window with traffic-light dots, a prompt line, and typed-out commands, used as the hero or feature visual.
- **Why**: it is the generic "this is a developer tool" costume. The window is decoration; the real product rarely looks like that. It reads as a placeholder for a real screenshot.
- **Fix**: if the product is genuinely a terminal or CLI, a real, working screenshot is evidence. Otherwise show the actual product UI, not a costume (R-06, C-5). Monospace as aesthetic is already covered by R-06; a fake terminal is that pattern as a component.

#### Illustrations With No Connection
- **Tell**: Undraw, Storyset, or generic 3D blob characters with no real connection to the product.
- **Why**: decorative illustrations say the design is decorated, not designed. They fill space without serving the content.
- **Fix**: illustrations must have a direct connection to the product, with the connection written down (R-22). If none exists, use real screenshots or no illustration.

### Structural & Flow

#### Dead Navigation
- **Tell**: navbar links to pages or sections that do not exist.
- **Why**: dead links are a broken promise. They break trust the moment a user clicks them.
- **Fix**: every navigation item must have a real destination (R-24). If a feature is not built, leave it out, or label it "Coming soon" clearly. The navbar reflects content that actually exists.

#### Non-Functional Controls
- **Tell**: buttons do nothing, dropdowns won't open, forms cannot submit.
- **Why**: the visual is finished but the behavior is not. This is the difference between a mockup and a product.
- **Fix**: every interactive element has real behavior, or it is removed (R-26). If an element genuinely cannot have a destination, ship a clear // TODO plus a visible "Coming soon" label, or do not ship it.

#### Sections That Fill a Template
- **Tell**: a section exists because "every AI landing page has one", not because the content needs it.
- **Why**: template sections are content without purpose. They add length and remove focus.
- **Fix**: every section earns its place from the product's content (C-3). Remove sections that only fill a template. A page with fewer, purposeful sections is stronger than a page with all the defaults.

### App & Dashboard
The patterns above are landing-page shapes. These are the app-side equivalents: the defaults an agent reaches for when the screen is a dashboard, an admin panel, or any signed-in view. The rules they break are the same ones; only the shape is new.

#### Default Dashboard Shell
- **Tell**: left sidebar, top bar, four stat cards, a chart, a table. Chosen before anyone asked what the screen is for, and identical whether it manages invoices, patients, or servers.
- **Why**: it is the landing-page template problem in an app: a layout picked from memory instead of from the work the screen supports. Swap the labels and it belongs to any product.
- **Fix**: name the screen's job and the one decision the user makes on it, then build the hierarchy around that (C-3, R-20). If the job is "spot the failing job and retry it", the failing jobs are the page and the stat row is a footnote. Sections that survive only because dashboards usually have them get cut (C-3).

#### Stat Cards With Invented Numbers
- **Tell**: a row of four cards reading 12,483 / 94.2% / $48.2K / 1,204, each with a green "+12% this week" delta.
- **Why**: the numbers are decoration, and the deltas are worse: a trend claim with no series behind it. Real dashboards have metrics that matter and metrics that do not, so four equal cards is already a hierarchy failure.
- **Fix**: show real numbers or none (R-17, R-38). Wire the cards to real data, or ship the one metric that is real. A delta appears only when the comparison period is real and named. If the screen is a prototype, label the values as placeholder where the user can see it (R-38).

#### Filler Activity Feed
- **Tell**: "Sarah Chen updated a document, 2 hours ago", repeated with rotating names and avatars.
- **Why**: invented people, invented events. It is the testimonial section wearing a different layout, and it makes an empty product look busy.
- **Fix**: the feed shows real events or does not ship (R-18, R-38). An honest empty state beats a fabricated feed, and it tells the user what to do first (R-27).

#### Charts Without a Question
- **Tell**: a line or donut chart placed because the space looked bare, with a generic title ("Overview", "Performance") and no axis the reader can act on.
- **Why**: a chart is an answer. Without the question, it is texture, and it costs more attention than a sentence would.
- **Fix**: write the question the chart answers before drawing it, and put that question in the title ("Failed jobs per hour, last 24h"). If a sentence answers it better, write the sentence (C-3). Chart segments still need 3:1 contrast against their neighbours (R-25).

#### Generic Table Columns
- **Tell**: Name, Status, Date, Actions, whatever the rows actually are, with a three-dot menu on every row.
- **Why**: the columns come from the table component, not from the data. The user scans for the field that decides their next move and it is not there.
- **Fix**: pick columns from the decision the user makes in this table, and put the deciding field early. The row menu holds actions that exist; anything that does nothing comes out (R-26).

#### Filler Data in Fields and Columns
- **Tell**: empty form fields and table columns filled with fake but plausible data: John Doe, johndoe@example.com, "Let's build something", phone numbers and dates that belong to nobody.
- **Why**: fabricated content disguised as real. It reads fine in a mockup and falls apart the moment a real user looks: the name is not a customer, the email is not a lead, and the message is a tagline. It is the strongest tell that the screen was generated, not built.
- **Fix**: leave empty cells empty, or use placeholders that clearly say what goes there: Your Name, email@example.com, Drop your message here..., or [REAL DATA] when a value is expected (R-23, R-38). Real data goes in when it exists. Generic filler copy like "Let's build something" is buzzword slop and does not belong in a data column (R-16).

#### Placeholder Empty and Loading States
- **Tell**: "No data available" with an illustration, a bare spinner, or a full-page skeleton that mimics a layout the real data never fills.
- **Why**: R-27 requires the states, and these technically have them. They still tell the user nothing: no cause, no next action, no idea whether this is normal.
- **Fix**: an empty state says why it is empty and gives the one action that fills it ("No jobs yet. Run a sync to see results here"). A loading state says what it is loading. An error state says what failed and what to do next (R-27). First run, filtered to nothing, and permission denied are different screens and read differently.

### Motion

#### Endless Pulses and Loops
- **Tell**: elements that pulse, bounce, or float forever with no user trigger.
- **Why**: perpetual motion is noise. It competes with the content for attention and never stops to let the user rest.
- **Fix**: motion must have a clear UX purpose, written down (R-19). Animation guides attention to a moment; it does not run on a loop. If the MOTION dial is 1 (hover states only), an endless loop is a FAIL against the declared dial.

#### Template Animations Stacked
- **Tell**: every element uses Fade Up + Fade In + Floating + Scale + Bounce simultaneously.
- **Why**: a page where everything animates has no focal point. Motion becomes wallpaper.
- **Fix**: choreograph motion to a purpose and to the MOTION dial (R-19). Not everything moves. The hero speaks, the supporting elements stay calm. Claimed "cinematic" pages must actually move; claimed "static" pages must not.

### UI Skill Checklist
Run these alongside the core Delivery Gate when the task is UI work. All answers must be yes:
- [ ] Is the palette derived from DESIGN.md or a written brand identity, not the default gradient set? (R-01, R-29)
- [ ] Is the accent used at the key moment only, not spread across every element? (core Part 3, one deliberate accent)
- [ ] Is the copy free of decorative emoji scattered through headings, bullets, and buttons? (R-04)
- [ ] Do section compositions vary according to the declared RHYTHM dial instead of repeating one template? (R-05)
- [ ] Is the layout free of the default AI shapes: bento-grid mosaic, fake terminal window, three pricing columns, and left-edge color stripes with no meaning? (R-05, R-01)
- [ ] Is the space above the H1 clear of a pill badge holding a label the headline already says? (R-09)
- [ ] Does every navigation item and interactive element have a real destination or behavior, or a visible "Coming soon" label? (R-24, R-26)
- [ ] Does motion follow the declared MOTION dial and serve a written purpose, with no endless loops? (R-19)
- [ ] Is glass, glow, shadow, and radius used at their dose caps, not as a page-wide default? (R-10, R-11, R-12, R-13)
- [ ] Is every colored dot and status light marking a real state, with no decorative glow or endless pulse? (R-13, R-19, R-31)
- [ ] On an app screen, is the layout built around the decision the user makes there, rather than the sidebar plus stat row plus chart plus table default? (C-3, R-20)
- [ ] Is every number, delta, feed entry, and table row real or a labelled placeholder, with no invented metrics? (R-17, R-18, R-38)
- [ ] Do empty form fields and table cells stay empty or carry honest placeholders (Your Name, email@example.com) instead of fake-looking data (John Doe, johndoe@example.com)? (R-23, R-38)
- [ ] Do the empty, loading, and error states name the cause and the next action instead of saying "No data"? (R-27)
- [ ] Does the page hold up at every breakpoint, theme, and state, and pass keyboard-only use? (R-03, R-34, C-4)
