import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AIDifficulty, GameMode, GameState, RecordedAction } from '@duoorb/game-core';
import { GameSyncDto, RoomDto } from '@duoorb/protocol';
import { GameReviewScreen } from './src/screens/GameReviewScreen';
import { GameScreen } from './src/screens/GameScreen';
import { MatchSetupScreen } from './src/screens/MatchSetupScreen';
import { OnlineMode, OnlineScreen } from './src/screens/OnlineScreen';
import { SideChoice } from './src/screens/MatchSetupScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { PlayerProfileScreen } from './src/screens/PlayerProfileScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import type { LegalKind } from './src/legal-content';
import { BottomNav, MainTab } from './src/components/BottomNav';
import { AppToast } from './src/components/AppToast';
import { PremiumSheet } from './src/components/PremiumSheet';
import { NoConnectionSection, OfflineModal } from './src/components/NoConnection';
import { ChallengeToast } from './src/components/ChallengeToast';
import { OnlineJoinGate } from './src/components/OnlineJoinGate';
import { RoomInviteToast } from './src/components/RoomInviteToast';
import * as SplashScreen from 'expo-splash-screen';
import { refreshPremium } from './src/monetization/premium';
import { useRoomInvites } from './src/network/useRoomInvites';
import { useChallenge } from './src/network/useChallenge';
import { socketManager } from './src/network/socket';
import { setBoardSkinId, setBoardThemeName } from './src/theme/boardTheme';
import { installRealAds } from './src/monetization/adsNative';
import { ensureSessionRecorded } from './src/monetization/realAds';
import {
  DEFAULT_SETTINGS,
  UserSettings,
  hydrateMatchSetupDrafts,
  loadSettings,
  saveSettings,
} from './src/storage/gameStorage';
import { releaseSounds, setSoundsMuted } from './src/audio/sounds';
import { SessionProvider, useSession } from './src/network/session';
import { flushIdentityStorage, hydrateIdentity, useIdentity } from './src/network/auth';
import { hasCompletedOnboarding, markOnboardingComplete } from './src/storage/onboarding';
import { isGeneratedUsername } from './src/usernamePolicy';
import { ChooseUsernameScreen } from './src/screens/ChooseUsernameScreen';
import type { SavedGameRecord } from './src/storage/gameStorage';
import { THEME, setThemeName, useTheme } from './src/theme';
import { DEFAULT_TIME_CONTROL, TimeControl } from './src/timeControls';
import { api, type FriendRequestItemDto } from './src/network/apiClient';
import { useConnectivity } from './src/network/useConnectivity';
import { sectionKind } from './src/network/errors';
import { hydrateLanguage, setLanguage, useTranslation } from './src/i18n';

import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Hold the single native splash (glossy logo on white, see app.json) until
// boot is complete. Without this the OS hides it the moment the runtime is
// up and any JS splash would flash in after it — the old double-splash.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Minimum time the native splash stays up. Kept short and fixed. */
const SPLASH_MIN_MS = 1500;

type SubScreen =
  | 'GAME'
  | 'SETUP'
  | 'PLAYER_PROFILE'
  | 'SETTINGS'
  | 'ONLINE'
  | 'REVIEW'
  | 'LEGAL'
  | null;

/** One entry in the in-app navigation history (hardware back stack). */
interface NavLoc {
  tab: MainTab;
  sub: SubScreen;
}

interface ActiveGameConfig {
  mode: GameMode;
  type: 'local' | 'ai' | 'online';
  onlineGameId?: string;
  onlineSource?: 'quick' | 'custom' | 'room';
  room?: RoomDto | null;
  aiDifficulty?: AIDifficulty;
  /** Premium personality id for AI games (null = generic difficulty bot). */
  botId?: string | null;
  timeControl?: TimeControl;
  sideChoice?: SideChoice;
  wallsEach?: number;
  /**
   * First sync snapshot from the pre-game join gate, when the entry was
   * gated. Lets the game screen render the board on its first frame.
   */
  initialSync?: GameSyncDto | null;
}

interface ReplayData {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx: number;
  /** Seat-id ratings when the entry point knows them (win/lose modal). */
  ratings?: Record<string, number>;
  /** Analysis gate key for full reviews (win/lose modal only; null = bare). */
  accessKey?: { gameId: string; historyLength: number } | null;
}

export default function App() {
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    'Tajarib-Regular': require('./assets/fonts/Tajarib-Regular.otf'),
    'Tajarib-Medium': require('./assets/fonts/Tajarib-Medium.otf'),
    'Tajarib-Bold': require('./assets/fonts/Tajarib-Bold.otf'),
    'Tajarib-Black': require('./assets/fonts/Tajarib-Black.otf'),
    'Tajarib-Light': require('./assets/fonts/Tajarib-Light.otf'),
  });

  const [currentTab, setCurrentTab] = useState<MainTab>('PLAY');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  const [selectedPlayer, setSelectedPlayer] = useState<{ userId: string; username: string } | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind>('privacy');
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const [gameConfig, setGameConfig] = useState<ActiveGameConfig>({
    mode: '2p',
    type: 'ai',
    aiDifficulty: 'normal',
  });
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  // History/Profile entries open the bare match page (board + step
  // controls, no analysis); the win/lose modal opens full review.
  const [reviewBare, setReviewBare] = useState(false);
  const [setupKind, setSetupKind] = useState<'ai' | 'local' | 'challenge' | 'online'>('ai');
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; username: string } | null>(null);
  const [onlineEntry, setOnlineEntry] = useState<{
    clock: TimeControl;
    view: OnlineMode;
    inviteName?: string | null;
    autoMatch?: { mode: GameMode; clock: TimeControl; wallsEach: number } | null;
    autoRoom?: { mode: GameMode; clock: TimeControl; wallsEach: number } | null;
    initialRoom?: RoomDto | null;
  }>({
    clock: DEFAULT_TIME_CONTROL,
    view: 'quick',
    inviteName: null,
    autoRoom: null,
  });
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  // Themed UI paints only after the persisted mode is applied, so first
  // paint already carries the right theme (no light-then-dark flash).
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  // Boot state: the native splash covers font loading and identity
  // hydration, so there is never a blank frame.
  const [splashElapsed, setSplashElapsed] = useState(false);
  // In-app navigation history for the Android hardware back button. Tab
  // switches are not recorded — backing out of any main tab asks to exit.
  const stackRef = useRef<NavLoc[]>([]);
  const [exitAsk, setExitAsk] = useState(false);
  // Paywall entry #2 (P7.2): locked bot taps open the sheet, not a toast.
  const [premiumOpen, setPremiumOpen] = useState(false);
  // Paywall attribution: which surface opened the sheet ('bots' default,
  // 'analysis' for the review upgrade path).
  const [premiumEntry, setPremiumEntry] = useState('bots');

  /** Forward navigation: records where we came from, then moves. */
  const navigate = (tab: MainTab, sub: SubScreen) => {
    stackRef.current = [...stackRef.current, { tab: currentTab, sub: subScreen }].slice(-50);
    setExitAsk(false);
    setCurrentTab(tab);
    setSubScreen(sub);
  };

  /**
   * Dismiss the current screen WITHOUT recording a return path to it.
   * Close/cancel/leave actions must use this, never navigate(): pushing
   * the screen you just left is what built the Home ⇄ dead-match circle.
   */
  const dismissTo = (tab: MainTab, sub: SubScreen) => {
    const stack = stackRef.current;
    stackRef.current = stack.length > 0 ? stack.slice(0, -1) : stack;
    setExitAsk(false);
    setCurrentTab(tab);
    setSubScreen(sub);
  };

  /** Back navigation: restores the previous location, or asks to exit. */
  const goBack = useCallback(() => {
    const stack = stackRef.current;
    if (stack.length === 0) {
      setExitAsk(true);
      return;
    }
    const prev = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    setExitAsk(false);
    setCurrentTab(prev.tab);
    setSubScreen(prev.sub);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitAsk) {
        BackHandler.exitApp();
        return true;
      }
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [exitAsk, goBack]);

  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    hydrateIdentity().finally(() => setIdentityReady(true));
  }, []);

  // Release the single native splash exactly once, when fonts, identity and
  // the minimum display time are all satisfied. The main tree (gates, tabs)
  // renders underneath from the first frame, so there is never a blank flash
  // and the logo appears exactly once.
  const booted = (Platform.OS === 'web' || fontsLoaded) && identityReady && splashElapsed;
  useEffect(() => {
    if (booted) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [booted]);

  useEffect(() => {
    // A kill before the async storage queue drains strands half an
    // identity on disk (next boot hydrates a stranger). Flush every
    // write the moment the app leaves the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void flushIdentityStorage();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Setup-screen drafts hydrate alongside settings so last-used picks
    // are in the sync cache before any setup screen can mount.
    void hydrateMatchSetupDrafts();
    loadSettings().then((s) => {
      setSettings(s);
      setSoundsMuted(!s.soundEnabled);
      // Appearance applies on first paint: the persisted mode selects the
      // active theme BEFORE any lazy screen module evaluates its styles.
      setThemeName(s.darkMode ? 'dark' : 'light');
      setSettingsLoaded(true);
      // Board follows the mode (single toggle): dark carries Midnight,
      // free for everyone. The persisted skin id selects premium boards;
      // the render gate keeps those premium-only.
      setBoardThemeName(s.darkMode ? 'midnight' : 'light');
      setBoardSkinId(s.boardSkinId);
      void hydrateLanguage();
    });
    // Ads runtime (P6): installs the real rewarded provider when the native
    // SDK exists (dev build) — no-op on web/Expo Go — and counts this launch
    // for the first-session banner gate.
    installRealAds();
    void ensureSessionRecorded();
  }, []);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    void saveSettings(patch);
    if (patch.soundEnabled !== undefined) setSoundsMuted(!patch.soundEnabled);
    if (patch.themeName !== undefined) setBoardThemeName(patch.themeName);
    if (patch.boardSkinId !== undefined) setBoardSkinId(patch.boardSkinId);
    if (patch.language !== undefined) void setLanguage(patch.language);
    // Instant: live styles + subscribers pick the new theme up on this
    // render pass — no reload. One toggle drives both: dark mode carries
    // the Midnight board, free for everyone.
    if (patch.darkMode !== undefined) {
      setThemeName(patch.darkMode ? 'dark' : 'light');
      const boardName = patch.darkMode ? 'midnight' : 'light';
      void saveSettings({ themeName: boardName });
      setBoardThemeName(boardName);
    }
  };

  const handleStartGame = (config: ActiveGameConfig) => {
    // Abandoned gate game: if two join gates race (e.g. a challenge accepted
    // mid-matchmaking), the loser's game screen never mounts, so its unmount
    // seat-release never runs. Free it here. Landing on a screen for the
    // previous game first (normal flow) already released it on unmount, and
    // a leave for a game we're not seated in is a server-side no-op.
    const prevOnlineId = gameConfig.type === 'online' ? gameConfig.onlineGameId : undefined;
    if (
      config.type === 'online' &&
      config.onlineGameId &&
      prevOnlineId &&
      prevOnlineId !== config.onlineGameId
    ) {
      try {
        socketManager.getSocket().emit('game:leave', { gameId: prevOnlineId });
      } catch {
        // offline — server grace path covers it
      }
    }
    setGameConfig(config);
    // A fresh entry mounts a fresh game screen. Rematches (via
    // handleFreshOnlineGame below) deliberately skip this: the finished board
    // stays mounted as the waiting visual while the new game syncs.
    setMatchSession((n) => n + 1);
    navigate(currentTab, 'GAME');
  };
  // Counts fresh game mounts. Rematches reuse the mounted screen, so only
  // fresh entries bump this — it is what keeps the rematch from remounting.
  const [matchSession, setMatchSession] = useState(0);

  // Global friend-challenge line: the toast holds a joining state while the
  // gate below confirms the sync, and both players enter with the board —
  // accepting never drops anyone onto a connecting page.
  const challenge = useChallenge({
    onGameStart: (gameId, mode, clock, initialSync) => {
      handleStartGame({
        mode,
        type: 'online',
        onlineGameId: gameId,
        timeControl: clock,
        initialSync: initialSync ?? null,
      });
    },
  });

  const roomInvites = useRoomInvites({
    onAccepted: (room) => {
      setOnlineEntry((prev) => ({
        ...prev,
        view: 'rooms',
        inviteName: null,
        autoMatch: null,
        autoRoom: null,
        initialRoom: room,
      }));
      navigate(currentTab, 'ONLINE');
    },
  });

  const handleOpenOnline = (clock: TimeControl, view: OnlineMode, inviteName: string | null = null) => {
    setOnlineEntry({ clock, view, inviteName, autoMatch: null, autoRoom: null, initialRoom: null });
    navigate(currentTab, 'ONLINE');
  };

  const handleOpenSetup = (kind: 'ai' | 'local' | 'online') => {
    setSetupKind(kind);
    setChallengeTarget(null);
    navigate(currentTab, 'SETUP');
  };

  const handleOpenChallengeSetup = (friend: { id: string; username: string }) => {
    setSetupKind('challenge');
    setChallengeTarget(friend);
    navigate(currentTab, 'SETUP');
  };

  // Close Match: return to the surface that match came from —
  // private room lobby, custom online setup page, or the home screen.
  // Dismissals pop (never push): the closed match must not stay in
  // history, or Back walks straight back into the dead game.
  const handleCloseMatch = () => {
    // Leaving the board frees decoded SFX (native mixer). Re-entry
    // re-initializes transparently: GameScreen preloads on mount and notify
    // toasts ensure-load on play.
    releaseSounds();
    if (gameConfig.type === 'online') {
      const clock = gameConfig.timeControl ?? DEFAULT_TIME_CONTROL;
      if (gameConfig.onlineSource === 'room' && gameConfig.room) {
        setOnlineEntry({
          clock,
          view: 'rooms',
          inviteName: null,
          autoMatch: null,
          autoRoom: null,
          initialRoom: gameConfig.room,
        });
        dismissTo(currentTab, 'ONLINE');
        return;
      }
      if (gameConfig.onlineSource === 'custom') {
        // Custom Online Match closes back to its configuration page.
        setSetupKind('online');
        setChallengeTarget(null);
        dismissTo(currentTab, 'SETUP');
        return;
      }
      // Quick Match closes to the home page.
      dismissTo('PLAY', null);
      return;
    }
    setSetupKind(gameConfig.type);
    setChallengeTarget(null);
    dismissTo(currentTab, 'SETUP');
  };

  // New Game from the result modal: re-queue the same online match type
  // (quick or custom) with a new opponent; AI/local return to setup.
  // The finished game is dismissed, not stacked: Back must not return
  // to a dead board.
  const handleNewGameAfter = () => {
    if (gameConfig.type === 'online') {
      const clock = gameConfig.timeControl ?? DEFAULT_TIME_CONTROL;
      setOnlineEntry({
        clock,
        view: 'quick',
        inviteName: null,
        autoMatch:
          gameConfig.onlineSource === 'custom'
            ? { mode: gameConfig.mode, clock, wallsEach: gameConfig.wallsEach ?? 10 }
            : null,
        autoRoom: null,
        initialRoom: null,
      });
      dismissTo(currentTab, 'ONLINE');
    } else {
      setSetupKind(gameConfig.type);
      setChallengeTarget(null);
      dismissTo(currentTab, 'SETUP');
    }
  };

  // Rematch accepted (online): the finished game is REPLACED by the new
  // one — stacking it would send Back into the dead match. Same mounted
  // screen (no session bump): the finished board stays visible until the new
  // sync lands. No snapshot here — the hook rejoins and the banner covers it.
  const handleFreshOnlineGame = (newGameId: string) => {
    const clock = gameConfig.timeControl ?? DEFAULT_TIME_CONTROL;
    setGameConfig({
      mode: gameConfig.mode,
      type: 'online',
      onlineGameId: newGameId,
      onlineSource: gameConfig.onlineSource,
      wallsEach: gameConfig.wallsEach,
      timeControl: clock,
      initialSync: null,
    });
    setOnlineEntry({
      clock,
      view: 'quick',
      inviteName: null,
      autoMatch: null,
      autoRoom: null,
      initialRoom: null,
    });
    dismissTo(currentTab, 'GAME');
  };

  /**
   * The one way into the player profile. Every surface that shows an opponent
   * (friends, leaderboard, the match board, the result modal, history, the
   * profile's recent matches) hands over the same server-issued userId and
   * lands on this same screen — no second profile implementation.
   */
  const handleOpenPlayerProfile = (player: { userId: string; username: string }) => {
    setSelectedPlayer(player);
    navigate(currentTab, 'PLAYER_PROFILE');
  };

  const handleOpenLegal = (kind: LegalKind) => {
    setLegalKind(kind);
    navigate(currentTab, 'LEGAL');
  };

  /**
   * One-shot lobby triggers (autoMatch/autoRoom) are consumed on arrival:
   * without this, popping back to the lobby remounts it with the stale
   * trigger and instantly re-queues / re-creates. Room context stays.
   */
  const consumeOnlineEntryTransients = useCallback(() => {
    setOnlineEntry((prev) =>
      prev.autoMatch || prev.autoRoom
        ? { ...prev, autoMatch: null, autoRoom: null }
        : prev
    );
  }, []);

  const handleChallengePlayer = (player: { id: string; username: string }) => {
    handleOpenOnline(DEFAULT_TIME_CONTROL, 'rooms', player.username);
  };

  const handleOpenReview = (
    initialState: GameState,
    history: RecordedAction[],
    perspectiveIdx = 0,
    access: { gameId: string; historyLength: number } | null = null,
    ratings?: Record<string, number>
  ) => {
    setReplayData({ initialState, history, perspectiveIdx, ratings, accessKey: access });
    setReviewBare(false);
    navigate(currentTab, 'REVIEW');
  };

  const handleSelectGameFromHistory = (savedGame: SavedGameRecord) => {
    setReplayData({
      initialState: savedGame.initialState,
      history: savedGame.history,
      perspectiveIdx: 0,
      // History/Profile replays open the bare match page (board, HUD cards,
      // step controls with speed) - no analysis panels. The key identifies
      // THIS finished game, so the bare page can offer the same one-ad
      // upgrade to full review that the win/lose modal gate uses.
      accessKey: {
        gameId: savedGame.id,
        historyLength: savedGame.history.length,
      },
    });
    // History/Profile replays open the bare match page (board, HUD cards,
    // step controls with speed) - no analysis panels.
    setReviewBare(true);
    navigate(currentTab, 'REVIEW');
  };

  // Bare replay -> full review upgrade (History/Profile Analyze path): the
  // GameReviewScreen gate already wrote the unlock, so flipping the flag
  // remounts into full mode (the App key includes the bare/full suffix).
  const handleUpgradeReviewToFull = () => {
    setReviewBare(false);
  };

  // Render-time chrome: these read the ACTIVE theme (post-setThemeName),
  // unlike the module-level StyleSheet below which bakes light values.
  // Memoized on the theme identity: parent re-renders (timers, toasts,
  // polling) reuse the same object instead of rebuilding it each pass.
  const theme = useTheme();
  const chrome: {
    root: ViewStyle;
    content: ViewStyle;
    exitCard: ViewStyle;
    exitTitle: TextStyle;
    exitSub: TextStyle;
    exitStay: ViewStyle;
    exitStayText: TextStyle;
    exitQuit: ViewStyle;
    exitQuitText: TextStyle;
  } = useMemo(
    () => ({
    root: { flex: 1, backgroundColor: THEME.colors.background },
    content: { flex: 1, backgroundColor: THEME.colors.background },
    exitCard: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: THEME.colors.backgroundCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      padding: 20,
      alignItems: 'center' as const,
      ...THEME.shadows.modal,
    },
    exitTitle: { fontFamily: THEME.fonts.bold, fontSize: 17, color: THEME.colors.inverseLabel },
    exitSub: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textSecondaryStrong,
      marginTop: 6,
      textAlign: 'center' as const,
    },
    exitStay: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: THEME.colors.surfaceMuted,
      paddingVertical: 12,
      alignItems: 'center' as const,
    },
    exitStayText: { fontFamily: THEME.fonts.semiBold, fontSize: 14, color: THEME.colors.textOnMuted },
    exitQuit: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: THEME.colors.danger,
      paddingVertical: 12,
      alignItems: 'center' as const,
    },
    exitQuitText: { fontFamily: THEME.fonts.bold, fontSize: 14, color: THEME.colors.onPrimary },
    }),
    // Factory reads the module THEME, which flips identity exactly on a
    // mode toggle — same contract as useStyles in theme.ts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme]
  );

  // One SessionProvider for the whole app. It owns the identity lifecycle:
  // `status === 'ready'` means a canonical identity is installed and `/me` has
  // been read, and only then may the authenticated UI mount. The native
  // splash covers this whole phase (see above), so no JS splash is needed.
  return (
    <SafeAreaProvider>
    <SafeAreaView style={chrome.root} edges={['top', 'bottom']}>
      <SystemChrome />
      <SessionProvider>
        {settingsLoaded ? (
        <SessionGate>
          {/* Authenticated-only side effects: nothing here runs before a
              canonical identity exists. */}
          <SessionEffects onFriendRequests={setFriendRequestsCount} onOnlineCount={setOnlineCount} />
        <View style={chrome.content}>
          {/* Main Tab Screens (when no subscreen is active) */}
          {subScreen === null && (
            <View style={styles.tabContent}>
              {currentTab === 'PLAY' && (
                <HomeScreen
                  onOpenOnline={(clock, view) => handleOpenOnline(clock, view)}
                  onOpenSetup={handleOpenSetup}
                  onOpenCustomOnline={() => handleOpenSetup('online')}
                  onOpenSettings={() => navigate(currentTab, 'SETTINGS')}
                  onlineCount={onlineCount}
                />
              )}

              {currentTab === 'FRIENDS' && (
                <FriendsScreen
                  onOpenChallengeSetup={handleOpenChallengeSetup}
                  onOpenPlayerProfile={handleOpenPlayerProfile}
                  onRequestCountChange={setFriendRequestsCount}
                />
              )}

              {currentTab === 'LEADERBOARD' && (
                <LeaderboardScreen
                  onSelectPlayer={handleOpenPlayerProfile}
                  onQuickMatch={() => handleOpenOnline(DEFAULT_TIME_CONTROL, 'quick')}
                />
              )}

              {currentTab === 'HISTORY' && (
                <HistoryScreen
                  onBack={() => setCurrentTab('PLAY')}
                  onSelectGame={handleSelectGameFromHistory}
                  onQuickMatch={() => handleOpenOnline(DEFAULT_TIME_CONTROL, 'quick')}
                  onOpenPlayerProfile={handleOpenPlayerProfile}
                />
              )}

              {currentTab === 'PROFILE' && (
                <ProfileScreen
                  onOpenSettings={() => navigate(currentTab, 'SETTINGS')}
                  onOpenPlayerProfile={handleOpenPlayerProfile}
                />
              )}
            </View>
          )}

          {/* Subscreens */}
          {subScreen === 'GAME' && (
            <GameScreen
              key={
                gameConfig.type === 'online'
                  ? `online-session-${matchSession}`
                  : `local-${gameConfig.mode}-${gameConfig.type}-${gameConfig.aiDifficulty ?? 'none'}-${gameConfig.botId ?? 'generic'}-${gameConfig.sideChoice ?? 'blue'}`
              }
              mode={gameConfig.mode}
              type={gameConfig.type}
              onlineGameId={gameConfig.onlineGameId}
              onlineSource={gameConfig.onlineSource}
              initialOnlineSnapshot={gameConfig.initialSync ?? null}
              aiDifficulty={gameConfig.aiDifficulty}
              botId={gameConfig.botId ?? null}
              timeControl={gameConfig.timeControl}
              sideChoice={gameConfig.sideChoice}
              wallsEach={gameConfig.wallsEach}
              incrementEnabled={settings.incrementEnabled}
              premoveEnabled={settings.premoveEnabled}
              extendedQueue={settings.extendedQueue}
              testThink={settings.testThink}
              onHome={handleCloseMatch}
              onNewGame={handleNewGameAfter}
              onRematchAccepted={handleFreshOnlineGame}
              onAnalyze={handleOpenReview}
              onOpenPlayerProfile={handleOpenPlayerProfile}
            />
          )}

          {subScreen === 'SETUP' && (
            <MatchSetupScreen
              initialKind={setupKind}
              challengeName={challengeTarget?.username}
              onBack={goBack}
              // Paywall entry #2 (P7.2): locked bot taps open the sheet.
              onLockedBot={() => {
                setPremiumEntry('bots');
                setPremiumOpen(true);
              }}
              onConfirm={(sel) => {
                if (sel.vsType === 'challenge' && challengeTarget) {
                  challenge.sendChallenge(challengeTarget.id, challengeTarget.username, {
                    mode: sel.mode,
                    clock: sel.clock,
                    wallsEach: sel.wallsEach,
                  });
                  setChallengeTarget(null);
                  dismissTo('FRIENDS', null);
                  return;
                }
                if (sel.vsType === 'challenge') {
                  goBack();
                  return;
                }
                // Custom Online Match: configured ranked matchmaking,
                // matched only against the same mode/time/walls queue.
                if (sel.vsType === 'online') {
                  setOnlineEntry({
                    clock: sel.clock,
                    view: 'quick',
                    inviteName: null,
                    autoMatch: { mode: sel.mode, clock: sel.clock, wallsEach: sel.wallsEach },
                    autoRoom: null,
                    initialRoom: null,
                  });
                  navigate(currentTab, 'ONLINE');
                  return;
                }
                handleStartGame({
                  mode: sel.mode,
                  type: sel.vsType,
                  aiDifficulty: sel.difficulty,
                  botId: sel.botId ?? null,
                  timeControl: sel.clock,
                  sideChoice: sel.side,
                  wallsEach: sel.wallsEach,
                });
              }}
            />
          )}
          {/* Paywall entry #2 mount (P7.2): Modal floats above SETUP. */}
          <PremiumSheet
            visible={premiumOpen}
            entry={premiumEntry}
            onClose={() => setPremiumOpen(false)}
            onDone={() => {
              setPremiumOpen(false);
              void refreshPremium();
            }}
          />

          {subScreen === 'PLAYER_PROFILE' && selectedPlayer && (
            <PlayerProfileScreen
              userId={selectedPlayer.userId}
              initialUsername={selectedPlayer.username}
              onBack={goBack}
              onChallenge={(p) => handleOpenChallengeSetup({ id: p.id, username: p.username })}
              onSelectGame={handleSelectGameFromHistory}
            />
          )}

          {subScreen === 'SETTINGS' && (
            <SettingsScreen
              settings={settings}
              onChange={updateSettings}
              onBack={goBack}
              onOpenLegal={handleOpenLegal}
            />
          )}

          {subScreen === 'LEGAL' && (
            <LegalScreen kind={legalKind} onBack={goBack} />
          )}

          {subScreen === 'ONLINE' && (
            <OnlineScreen
              key={`${onlineEntry.clock.id}-${onlineEntry.view}-${onlineEntry.inviteName ?? ''}`}
              initialClock={onlineEntry.clock}
              initialView={onlineEntry.view}
              inviteName={onlineEntry.inviteName}
              autoMatch={onlineEntry.autoMatch}
              autoRoom={onlineEntry.autoRoom}
              initialRoom={onlineEntry.initialRoom}
              onBack={goBack}
              onConsumeAutoEntry={consumeOnlineEntryTransients}
              onStartOnlineGame={(gameId, mode, clock, source, room, initialSync) => {
                handleStartGame({
                  mode,
                  type: 'online',
                  onlineGameId: gameId,
                  onlineSource: source,
                  room,
                  wallsEach: room?.wallsEach,
                  timeControl: clock,
                  initialSync: initialSync ?? null,
                });
              }}
            />
          )}

          {subScreen === 'REVIEW' && replayData && (
            <GameReviewScreen
              key={`${replayData.initialState.gameId}-${replayData.history.length}-${reviewBare ? 'bare' : 'full'}`}
              initialState={replayData.initialState}
              history={replayData.history}
              perspectiveIdx={replayData.perspectiveIdx}
              onBack={goBack}
              bare={reviewBare}
              ratings={replayData.ratings}
              accessKey={replayData.accessKey ?? null}
              onUpgradeToFull={handleUpgradeReviewToFull}
              onOpenPremium={() => {
                setPremiumEntry('analysis');
                setPremiumOpen(true);
              }}
            />
          )}

          {/* Bottom Navigation: visible when on main tabs */}
          {subScreen === null && (
            <BottomNav
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setExitAsk(false);
                setSubScreen(null);
                setCurrentTab(tab);
              }}
              friendRequestsCount={friendRequestsCount}
            />
          )}

          {/* Global overlay layer: toasts and the exit confirm render last,
              above every screen, with high elevation so Android draws them
              on top of inputs and other elevated views. */}
          <View style={styles.overlayLayer} pointerEvents="box-none">
            <ChallengeToast
              incoming={challenge.incoming}
              outgoing={challenge.outgoing}
              notice={challenge.notice}
              joining={!!challenge.joining}
              onAccept={() => challenge.respond(true)}
              onDecline={() => challenge.respond(false)}
              onCancelWaiting={challenge.cancelWaiting}
              onCancelJoining={() => challenge.cancelJoining()}
            />
            {/* Accepted-challenge join gate: holds navigation until the first
                sync lands with the board snapshot. Cancelling releases the
                seat via the gate's unmount. */}
            {challenge.joining && (
              <OnlineJoinGate
                gameId={challenge.joining.gameId}
                onSynced={(sync) => challenge.confirmJoining(sync)}
                onFailed={() =>
                  challenge.cancelJoining(t('app.joinFailed'))
                }
              />
            )}
            <RoomInviteToast
              invite={roomInvites.incoming}
              notice={roomInvites.notice}
              onAccept={() => void roomInvites.respond(true)}
              onDecline={() => void roomInvites.respond(false)}
            />
            {exitAsk && (
              <View style={styles.exitOverlay}>
                <View style={chrome.exitCard}>
                  <Text style={chrome.exitTitle}>{t('exit.title')}</Text>
                  <Text style={chrome.exitSub}>{t('exit.subtitle')}</Text>
                  <View style={styles.exitRow}>
                    <TouchableOpacity
                      style={chrome.exitStay}
                      onPress={() => setExitAsk(false)}
                      accessibilityLabel={t('exit.stayA11y')}
                    >
                      <Text style={chrome.exitStayText}>{t('exit.stay')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={chrome.exitQuit}
                      onPress={() => BackHandler.exitApp()}
                      accessibilityLabel={t('exit.exitA11y')}
                    >
                      <Text style={chrome.exitQuitText}>{t('exit.exit')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
        </SessionGate>
        ) : (
        <View style={styles.bootBlank} />
        )}
      </SessionProvider>
      <AppToast />
      <OfflineModal />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

/**
 * The real Android system chrome, configured identically everywhere.
 *
 * Rendered in BOTH root branches (splash and app): the splash branch used
 * to mount with no bar configuration, so every launch flashed from the OS
 * defaults into the app style the moment the session settled. One instance
 * is ever mounted at a time (early return), so there is nothing to merge
 * and no transition to flash.
 *
 * Light bar + dark buttons matches the light theme: with edge-to-edge the
 * app background (#FAF8FF) shows through behind the system buttons, and
 * the expo-navigation-bar config plugin sets this same style natively so
 * even the cold-start frame agrees.
 */
const SystemChrome: React.FC = () => {
  // Re-render with the tree so bar colors track an instant mode toggle.
  useTheme();
  return (
    <>
      <NavigationBar style={THEME.mode === 'dark' ? 'dark' : 'light'} />
      <StatusBar
        barStyle={THEME.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={THEME.colors.background}
      />
    </>
  );
};

/**
 * The single mount gate.
 *
 * `restoring` -> static background frame (the native splash covers boot).
 * `anonymous` -> onboarding, which is also where a guest account is created.
 * `ready`     -> the username step while the handle is still server-generated
 *                and onboarding never completed (full-screen overlay, no tabs
 *                behind it), else the app, rendered only once the canonical
 *                identity exists.
 *
 * Nothing else in the tree decides whether the user is signed in, so there is
 * exactly one place where "is there a session?" is answered.
 */
const SessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, bootError, retryBoot } = useSession();
  const identity = useIdentity();
  const { isConnected } = useConnectivity();
  // Device flag, keyed by account: a different sign-in must never inherit
  // the previous account's answer. Null while unread for the current user.
  const [record, setRecord] = useState<{ userId: string; done: boolean } | null>(null);
  const userId = identity?.userId ?? null;

  // The completion flag lives on device and reads async; re-read whenever the
  // session or account flips, so a fresh sign-in re-enters the gate.
  useEffect(() => {
    let cancelled = false;
    if (status === 'ready' && userId) {
      void hasCompletedOnboarding().then((v) => {
        if (!cancelled) setRecord({ userId, done: v });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  // Leaving the username step completes onboarding. There is no skip: every
  // new identity leaves this screen with a real handle.
  const handleUsernameDone = useCallback(() => {
    void markOnboardingComplete();
    if (userId) setRecord({ userId, done: true });
  }, [userId]);

  if (status === 'restoring') {
    // Boot failed reaching the server (a stored session exists but is
    // unreachable): retry section, never the Welcome page.
    if (!bootError) return <View style={styles.bootBlank} />;
    return (
      <View style={[styles.bootBlank, styles.bootErrorWrap]}>
        <NoConnectionSection
          kind={sectionKind(bootError.kind, isConnected)}
          message={bootError.message}
          onRetry={retryBoot}
        />
      </View>
    );
  }
  // Onboarding owns account creation only; the username step lives here.
  if (status === 'anonymous') return <OnboardingFlow />;
  const onboardingDone =
    status === 'ready' && userId && record?.userId === userId ? record.done : null;
  // Static same-background frame while the device flag loads. The logo lives
  // only on the native splash (already gone or going) — a second splash
  // instance here is what made it blink out and fade back in.
  if (onboardingDone === null) return <View style={styles.bootBlank} />;
  if (
    identity &&
    isGeneratedUsername(identity.username, identity.userId) &&
    !onboardingDone
  ) {
    return <ChooseUsernameScreen onDone={handleUsernameDone} />;
  }
  return <>{children}</>;
};

/**
 * Runs only while a session exists. Kept out of the root component so no
 * request is ever issued with a missing or stale identity.
 */
const SessionEffects: React.FC<{
  onFriendRequests: (n: number) => void;
  onOnlineCount: (n: number | null) => void;
}> = ({ onFriendRequests, onOnlineCount }) => {
  const { identity } = useSession();
  const userId = identity?.userId;
  // Guests own no friends: skip their request badge poll (the lobby
  // headcount still runs — presence is not social).
  const isGuest = identity?.isGuest === true;
  const { isConnected } = useConnectivity();
  useEffect(() => {
    if (!userId) return;
    // The badge must light up wherever you are, not only while the Friends
    // tab is open. FriendsScreen polls on the same cadence when mounted;
    // both writers publish the same number so they never fight. The lobby
    // headcount rides the same tick for the Home presence pill.
    //
    // allSettled: one failing call never masks the other. Offline ticks are
    // skipped outright; repeated failures back off 8s → 16s → 30s instead of
    // spamming a dead server every 8 seconds.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = 8000;
    const tick = async () => {
      if (cancelled) return;
      if (isConnected === false) {
        timer = setTimeout(tick, 8000);
        return;
      }
      // Backgrounded: radio + battery cost with nobody watching. Reschedule
      // unread — foreground return is at most one cadence behind, same as
      // the offline-skip path above.
      if (AppState.currentState !== 'active') {
        timer = setTimeout(tick, 8000);
        return;
      }
      const [reqSettled, countSettled] = await Promise.allSettled([
        isGuest ? Promise.resolve([] as FriendRequestItemDto[]) : api.getFriendRequests(),
        api.getOnlineCount(),
      ]);
      if (cancelled) return;
      if (!isGuest && reqSettled.status === 'fulfilled') {
        onFriendRequests(reqSettled.value.length);
      }
      if (countSettled.status === 'fulfilled') {
        onOnlineCount(countSettled.value);
        delay = 8000;
      } else {
        // Unknown, not zero: the pill shows Checking… instead of lying.
        onOnlineCount(null);
        delay = Math.min(delay * 2, 30000);
      }
      timer = setTimeout(tick, delay);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, isGuest, isConnected, onFriendRequests, onOnlineCount]);

  // Live presence count (ONLINE_HEALTH count upgrade): the server broadcasts
  // presence:count on verified connect/disconnect, so the pill updates
  // instantly instead of at the next 8s poll. The REST poll above stays as
  // backup for missed broadcasts. Handler replay (manager-owned) survives
  // transport rebuilds, so subscribe once per identity.
  useEffect(() => {
    if (!userId) return;
    const socket = socketManager.getSocket();
    const onCount = (payload: { count?: unknown }) => {
      if (typeof payload?.count === 'number') onOnlineCount(payload.count);
    };
    socket.on('presence:count', onCount as never);
    return () => {
      socket.off('presence:count', onCount as never);
    };
  }, [userId, onOnlineCount]);

  // Presence heartbeat (C1 companion): a verified, connected socket proves
  // liveness every 60s so the server-side 5-minute freshness rule only ever
  // demotes killed apps — never an idle lobby sitter. Server throttles at
  // 45s; early ticks are dropped there, never queued here (fire-and-forget
  // on a dead transport would just pile intents).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const beat = () => {
      if (cancelled) return;
      // Foreground-only: a backgrounded app SHOULD age out of the
      // server-side freshness window — foregroundRevalidate below revives it
      // on return. Pinging from background just burns radio.
      if (AppState.currentState === 'active') {
        try {
          const socket = socketManager.getSocket();
          if (socketManager.isVerified() === true && socket.connected) {
            socket.emit('presence:ping');
          }
        } catch {
          // Heartbeat is advisory — never crash the loop.
        }
      }
      timer = setTimeout(beat, 60000);
    };
    timer = setTimeout(beat, 15000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  // App-wide foreground revalidation (Phase C): every return from background
  // refreshes a dying credential and revives a dead transport on EVERY
  // screen — previously only the game screen did this, so lobbies rotted.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') socketManager.foregroundRevalidate();
    });
    return () => sub.remove();
  }, [userId]);
  return null;
};

const styles = StyleSheet.create({
  // Static boot frame: same background, no logo, no animation. Covers the
  // restoring/flag-loading windows without ever replaying the splash.
  // Deliberately light-baked: it renders before settings (and the theme)
  // resolve, under the native splash.
  bootBlank: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  bootErrorWrap: {
    justifyContent: 'center',
  },
  tabContent: {
    flex: 1,
  },
  overlayLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 30,
  },
  exitOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  exitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
});
