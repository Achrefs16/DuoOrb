# Phase 5 Implementation Plan: UI Polish, Bot Avatars, Compact Bot Bubble, Layout & Universal Premium Crowns

## 1. Phase Goal & Scope
Address all UI/UX polish items reported by testers and requested by the user:
1. **Custom Bot Avatars (`BotAvatar.tsx`):** Support custom generated PNG/WebP portraits for all 10 bots (`apps/mobile/assets/bots/<botId>.png`) with automatic SVG fallback.
2. **Compact Bot Speech Bubble (`BotSpeechBubble.tsx` & `GameScreen.tsx`):** Redesign the bot speech bubble so it sits in the empty space of the top header bar above the bot's HUD card instead of covering the bot's name, rating, wall pips, and clock.
3. **Home Page Ad Banner Position (`HomeScreen.tsx`):** Move `<AdBanner placement="home" />` so it sits **under the 4 game mode cards** and **on top of the Journey mode card** (in the middle, not at the top).
4. **Native Mobile Bottom Nav Bar Gap (`BottomNav.tsx`):** Remove the double-counted bottom safe-area inset on native Android/iOS so the bottom navigation bar sits flush and clean.
5. **Universal Premium Crown (`<PremiumBadge />`):** Ensure `isPremium` is returned by all backend endpoints/socket payloads and `<PremiumBadge />` is rendered next to premium users' names in **every single screen, modal, toast, and HUD**.

---

## 2. Files to Modify

| File Path | Action | Responsibility |
| :--- | :--- | :--- |
| `apps/mobile/src/components/BotAvatar.tsx` | **Modify** | Load custom generated bot avatar images from `assets/bots/*.png` with SVG fallback. |
| `apps/mobile/src/components/BotSpeechBubble.tsx` | **Modify** | Compact single/two-line pill layout without redundant bot name label, docked above the top HUD bar. |
| `apps/mobile/src/screens/GameScreen.tsx` | **Modify** | Reposition `BotSpeechBubble` container so it never overlaps the opponent's `PlayerStrip`. |
| `apps/mobile/src/screens/HomeScreen.tsx` | **Modify** | Move `<AdBanner placement="home" />` between `styles.modeGrid` and `styles.journeyCard`. |
| `apps/mobile/src/components/BottomNav.tsx` | **Modify** | Fix native Android/iOS bottom gap (`Platform.OS === 'web' ? bottomInset + 20 : 6`). |
| `apps/server/src/users/users.service.ts` | **Modify** | Include `isPremium` in `searchUsers` response. |
| `apps/server/src/friends/friends.service.ts` | **Modify** | Include `isPremium` in `getRequests` and `sendRequest` responses. |
| `apps/server/src/history/history.service.ts` | **Modify** | Include `isPremium` in `getUserHistory` (`opponent`) and `getGameReplay` (`players`). |
| `packages/protocol/src/index.ts` | **Modify** | Add `isPremium?: boolean` to `RoomSlot`, `MatchmakingMatchedPayload`, `RoomInviteDto`, and `ChallengeDto`. |
| `apps/server/src/gateway/game.gateway.ts` | **Modify** | Populate `isPremium` in `SocketUserInfo`, room slots, matchmaking seats, room invites, and friend challenges. |
| `apps/mobile/src/network/apiClient.ts` | **Modify** | Add `isPremium?: boolean` to `FriendRequestItemDto`, `UserSearchItemDto`, `GameHistoryItemDto['opponent']`, and `GameReplayResponse['players'][number]`. |
| `apps/mobile/src/screens/LeaderboardScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` in `PodiumSpot` (Top 1, 2, 3 podium cards). |
| `apps/mobile/src/screens/FriendsScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` in Incoming Friend Requests and Add-Friend Search modal. |
| `apps/mobile/src/screens/HistoryScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` next to opponent name in match history rows. |
| `apps/mobile/src/screens/PlayerProfileScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` next to opponent name in profile recent matches. |
| `apps/mobile/src/components/MatchResultModal.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` next to player and opponent names in the Elo delta row. |
| `apps/mobile/src/screens/GameReviewScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` in both Player Accuracy columns and board top/bottom HUD strips. |
| `apps/mobile/src/screens/OnlineScreen.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` in Matchmaking VS preview, Private Room Slots, Challenge Waiting Modal, and Rematch Modal. |
| `apps/mobile/src/components/ChallengeToast.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` next to challenger name. |
| `apps/mobile/src/components/RoomInviteToast.tsx` | **Modify** | Render `<PremiumBadge size="xs" />` next to inviter name. |

---

## 3. Step-by-Step Implementation Details

### Step 5.1: Custom Bot Avatars (`apps/mobile/src/components/BotAvatar.tsx`)
1. Place the custom generated square avatar images in `apps/mobile/assets/bots/`:
   - `martin.png`, `pip.png`, `elena.png`, `bram.png`, `nelson.png`, `vex.png`, `sofia.png`, `marcus.png`, `viktor.png`, `achref.png`.
2. In `apps/mobile/src/components/BotAvatar.tsx` (lines 413–474), add an image map at the top of the component:
   ```tsx
   import { Image, ImageSourcePropType } from 'react-native';

   const BOT_AVATAR_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
     martin: require('../../assets/bots/martin.png'),
     pip: require('../../assets/bots/pip.png'),
     elena: require('../../assets/bots/elena.png'),
     bram: require('../../assets/bots/bram.png'),
     nelson: require('../../assets/bots/nelson.png'),
     vex: require('../../assets/bots/vex.png'),
     sofia: require('../../assets/bots/sofia.png'),
     marcus: require('../../assets/bots/marcus.png'),
     viktor: require('../../assets/bots/viktor.png'),
     achref: require('../../assets/bots/achref.png'),
   };
   ```
3. Inside `BotAvatar`:
   - Check `const customImg = BOT_AVATAR_IMAGES[botId];`
   - If `customImg` exists, render:
     ```tsx
     <Image
       source={customImg}
       style={{
         width: innerSize,
         height: innerSize,
         borderRadius: innerSize / 2,
       }}
       resizeMode="cover"
     />
     ```
     inside the existing themed circular border & glow container (`borderColor: accentColor`), preserving the SVG `PortraitComponent` as a fallback if an image is missing.

---

### Step 5.2: Compact Bot Speech Bubble Above Top Bar (`BotSpeechBubble.tsx` & `GameScreen.tsx`)
Currently, `BotSpeechBubble.tsx` (`lines 141–190`) renders inside `styles.sideWrap` (`GameScreen.tsx:1886`) with `position: 'absolute', top: 0, left: 8, right: 8, minHeight: 52`, which completely covers the opponent's `PlayerStrip` (hiding the bot's name, rating, wall counter, and clock for 6.5 seconds on every message).

1. **Update `apps/mobile/src/components/BotSpeechBubble.tsx`:**
   - Remove the redundant `botLabel` line (`<Text style={styles.botLabel}>{botName}</Text>` at lines 118–120) since the bot's name is already visible right below the bubble on the `PlayerStrip`.
   - Reduce the display duration in `useBotDialogue.ts` from `6500ms` to `4200ms` so messages feel snappy.
   - Update styles in `BotSpeechBubble.tsx`:
     ```ts
     container: {
       position: 'absolute',
       top: -44,
       left: 52, // Clears the 38px back button on the left of the header
       right: 48, // Clears any right header action icon
       zIndex: 60,
       alignItems: 'flex-start',
     },
     bubble: {
       flexDirection: 'row',
       alignItems: 'center',
       maxWidth: '100%',
       paddingVertical: 5,
       paddingHorizontal: 11,
       borderRadius: 12,
       borderWidth: 1,
       backgroundColor: 'rgba(15, 23, 42, 0.96)',
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.3,
       shadowRadius: 4,
       elevation: 5,
     },
     dialogueText: {
       fontSize: 11.5,
       lineHeight: 15,
       color: '#F1F5F9',
       fontWeight: '500',
     },
     pointerDown: {
       marginLeft: 18, // Points directly down at the bot's avatar in PlayerStrip
     },
     ```
   - Set `numberOfLines={2}` on `dialogueText`.
2. **Update `apps/mobile/src/screens/GameScreen.tsx` (`lines 1876–1926`):**
   - Ensure `styles.sideWrap` has `overflow: 'visible'` and `zIndex: 30` so the negative-top `BotSpeechBubble` floats cleanly in the empty center-left area of the `56px` top header bar right above the bot's avatar without overlapping any HUD stats.

---

### Step 5.3: Home Page Ad Banner Position & Mobile Bottom Nav Gap

#### A. Move Home Page Ad Banner (`apps/mobile/src/screens/HomeScreen.tsx`)
1. Remove `<AdBanner placement="home" style={styles.adBanner} />` from line 144 (where it currently sits above the 4 mode cards).
2. Insert `<AdBanner placement="home" style={styles.adBanner} />` at line 269 — immediately **after** the closing `</View>` of `styles.modeGrid` (the 4 main game modes) and **before** `<View style={styles.journeyCard}>` (Journey Mode).
3. Update `styles.adBanner` margin so it has clean vertical rhythm (`marginTop: 4, marginBottom: 14`).

#### B. Reduce Native Mobile Gap Under Bottom Nav (`apps/mobile/src/components/BottomNav.tsx`)
In `App.tsx:880`, the root container is already wrapped in `<SafeAreaView style={styles.root} edges={['top', 'bottom']}>`, which applies the OS bottom inset padding. However, `BottomNav.tsx:42` also applies `bottom: bottomInset + 20`, double-counting the home indicator inset plus an extra `20px` on Android/iOS!
In `apps/mobile/src/components/BottomNav.tsx` (line 42), replace:
```ts
{ bottom: bottomInset + 20 },
```
with:
```ts
{ bottom: Platform.OS === 'web' ? bottomInset + 20 : 6 },
```
And in `App.tsx`, reduce the bottom scroll padding for tabbed screens on native from `110` to `88` so content sits closer to the floating pill nav bar.

---

### Step 5.4: Universal Premium Crown (`<PremiumBadge />`) Across Backend & Frontend

#### A. Backend DTO Updates (4 Services + WebSocket Gateway)
1. **`apps/server/src/users/users.service.ts` (`searchUsers`, lines 367–377):**
   - Add `isPremium: true, premiumUntil: true` to the Prisma `select` clause and return `isPremium: this.computeIsPremium(u)` on each search result item.
2. **`apps/server/src/friends/friends.service.ts` (`getRequests` lines 81–96, `sendRequest` line 170):**
   - Add `isPremium: true, premiumUntil: true` to the `sender` / `receiver` Prisma `select` clauses and include `isPremium` in the returned DTOs.
3. **`apps/server/src/history/history.service.ts` (`getUserHistory` line 86, `getGameReplay` line 156):**
   - Select `isPremium: true, premiumUntil: true` on `player1` and `player2` relations.
   - Include `isPremium` inside `opponent` in `getUserHistory` and inside each entry of `players` in `getGameReplay`.
4. **`packages/protocol/src/index.ts` & `apps/server/src/gateway/game.gateway.ts`:**
   - Add `isPremium?: boolean` to `SocketUserInfo` (`game.gateway.ts:31`), `RoomSlot`, `MatchmakingMatchedPayload['seats'][number]`, `RoomInviteDto`, and `ChallengeDto`.
   - When authenticating the socket in `game.gateway.ts:194`, query `isPremium` and `premiumUntil` from Prisma and store `isPremium: Boolean(user.isPremium && (!user.premiumUntil || user.premiumUntil > new Date()))` on `SocketUserInfo`.
   - Pass `isPremium: info.isPremium` in `room:state` slots (`line 598`), `matchmaking:matched` (`line 926`), `room:invite_received` (`line 1155`), and `challenge:received` (`line 1919`).

#### B. Frontend Components & Screens (11 Missing Places)
Import `<PremiumBadge size="xs" />` from `../components/PremiumBadge` and render it inline next to the username whenever `isPremium` is truthy in:
1. **`LeaderboardScreen.tsx` (`PodiumSpot`, lines 78–80):**
   ```tsx
   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
     <Text style={styles.podiumName} numberOfLines={1}>{item.displayName || item.username}</Text>
     {item.isPremium && <PremiumBadge size="xs" />}
   </View>
   ```
2. **`FriendsScreen.tsx`:**
   - Incoming Friend Requests card (`line 456`): render `{req.sender.isPremium && <PremiumBadge size="xs" />}`.
   - Add-Friend Search Modal results (`line 648`): render `{user.isPremium && <PremiumBadge size="xs" />}`.
3. **`HistoryScreen.tsx` (`lines 346–350`):**
   - Next to `item.opponent.displayName || item.opponent.username`, render `{item.opponent.isPremium && <PremiumBadge size="xs" />}`.
4. **`PlayerProfileScreen.tsx` (`lines 841–848`):**
   - Next to `item.opponent.displayName || item.opponent.username` in the recent matches list, render `{item.opponent.isPremium && <PremiumBadge size="xs" />}`.
5. **`MatchResultModal.tsx` (`lines 72–75`):**
   - Accept `myIsPremium?: boolean` and `opponentIsPremium?: boolean` props (passed from `GameScreen.tsx`) and render `<PremiumBadge size="xs" />` next to the player and opponent names in the rating breakdown card.
6. **`GameReviewScreen.tsx` (`lines 686, 753, 987, 1054`):**
   - Render `<PremiumBadge size="xs" />` next to `userPlayer.name` and `opponentPlayer.name` in both the Accuracy Summary header and the board HUD bars when that seat is Premium.
7. **`OnlineScreen.tsx` (`lines 582, 647, 681, 914, 1253`):**
   - Render `<PremiumBadge size="xs" />` in the Matchmaking "VS" screen, Private Room Host & Guest slots, Challenge Waiting modal, and Rematch offer modal.
8. **`ChallengeToast.tsx` (`line 88`) & `RoomInviteToast.tsx` (`line 24`):**
   - Render `<PremiumBadge size="xs" />` next to the challenger's / inviter's display name.

---

## 4. Verification & Testing Checklist
- [ ] **Bot Avatars:** Open `MatchSetupScreen` and start a match against each of the 10 bots $\rightarrow$ custom avatar images render crisp inside the circular frame with fallback to SVG if an asset is omitted.
- [ ] **Bot Speech Bubble:** Trigger bot dialogue at match start, wall block, and capture threat $\rightarrow$ bubble appears in the top header bar above the bot's avatar, never covering the bot's name, rating, wall pips, or timer.
- [ ] **Home Screen Layout:** Open `HomeScreen` as a non-premium user $\rightarrow$ `<AdBanner placement="home" />` renders below the 4 mode cards and directly above the Journey Mode card; on native Android/iOS, the bottom nav bar sits close to the bottom edge without excessive empty gap.
- [ ] **Premium Crown Audit:** Toggle `isPremium = true` for a test user and an opponent $\rightarrow$ verify the gold crown `<PremiumBadge />` appears in Leaderboard Podium + Rows, Friends List + Requests + Search, History Rows, Player Profile Header + Recent Matches, Online Lobby Slots + Matchmaking VS + Toasts, In-Match HUD, Match Result Modal, and Game Review Screen.
