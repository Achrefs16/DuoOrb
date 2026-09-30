import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { SplashScreen, SPLASH_MIN_MS } from './src/screens/SplashScreen';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { PlayerProfileScreen } from './src/screens/PlayerProfileScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { BottomNav, MainTab } from './src/components/BottomNav';
import { ChallengeToast } from './src/components/ChallengeToast';
import { OnlineJoinGate } from './src/components/OnlineJoinGate';
import { RoomInviteToast } from './src/components/RoomInviteToast';
import { useRoomInvites } from './src/network/useRoomInvites';
import { useChallenge } from './src/network/useChallenge';
import { socketManager } from './src/network/socket';
import { SavedGameRecord } from './src/storage/gameStorage';
import {
  DEFAULT_SETTINGS,
  UserSettings,
  loadSettings,
  saveSettings,
} from './src/storage/gameStorage';
import { setSoundsMuted } from './src/audio/sounds';
import { SessionProvider, useSession } from './src/network/session';
import { flushIdentityStorage, hydrateIdentity } from './src/network/auth';
import { THEME } from './src/theme';
import { DEFAULT_TIME_CONTROL, TimeControl } from './src/timeControls';
import { api } from './src/network/apiClient';

import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

type SubScreen =
  | 'GAME'
  | 'SETUP'
  | 'PLAYER_PROFILE'
  | 'LEADERBOARD'
  | 'SETTINGS'
  | 'ONLINE'
  | 'REVIEW'
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
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const [currentTab, setCurrentTab] = useState<MainTab>('PLAY');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  const [selectedPlayer, setSelectedPlayer] = useState<{ userId: string; username: string } | null>(null);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);
  const [onlineCount, setOnlineCount] = useState<number>(0);

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
  const [identityReady, setIdentityReady] = useState(false);
  // Boot state: the splash covers font loading and identity hydration, so
  // there is never a blank frame.
  const [splashElapsed, setSplashElapsed] = useState(false);
  // In-app navigation history for the Android hardware back button. Tab
  // switches are not recorded — backing out of any main tab asks to exit.
  const stackRef = useRef<NavLoc[]>([]);
  const [exitAsk, setExitAsk] = useState(false);

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
    loadSettings().then((s) => {
      setSettings(s);
      setSoundsMuted(!s.soundEnabled);
    });
  }, []);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    void saveSettings(patch);
    if (patch.soundEnabled !== undefined) setSoundsMuted(!patch.soundEnabled);
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
    ratings?: Record<string, number>
  ) => {
    setReplayData({ initialState, history, perspectiveIdx, ratings });
    setReviewBare(false);
    navigate(currentTab, 'REVIEW');
  };

  const handleSelectGameFromHistory = (savedGame: SavedGameRecord) => {
    setReplayData({
      initialState: savedGame.initialState,
      history: savedGame.history,
      perspectiveIdx: 0,
    });
    // History/Profile replays open the bare match page (board, HUD cards,
    // step controls with speed) - no analysis panels.
    setReviewBare(true);
    navigate(currentTab, 'REVIEW');
  };

  // Splash holds until fonts and the persisted identity are hydrated, plus the
  // minimum splash time. The session layer then decides between onboarding
  // and the app; see the two render branches below.
  if (!fontsLoaded || !identityReady || !splashElapsed) {
    return (
      <SafeAreaProvider>
        <SystemChrome />
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  // One SessionProvider for the whole app. It owns the identity lifecycle:
  // `status === 'ready'` means a canonical identity is installed and `/me` has
  // been read, and only then may the authenticated UI mount.
  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <SystemChrome />
      <SessionProvider>
        <SessionGate>
          {/* Authenticated-only side effects: nothing here runs before a
              canonical identity exists. */}
          <SessionEffects onFriendRequests={setFriendRequestsCount} onOnlineCount={setOnlineCount} />
        <View style={styles.content}>
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
                  onSelectGame={handleSelectGameFromHistory}
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
                  : `local-${gameConfig.mode}-${gameConfig.type}-${gameConfig.aiDifficulty ?? 'none'}-${gameConfig.sideChoice ?? 'blue'}`
              }
              mode={gameConfig.mode}
              type={gameConfig.type}
              onlineGameId={gameConfig.onlineGameId}
              onlineSource={gameConfig.onlineSource}
              initialOnlineSnapshot={gameConfig.initialSync ?? null}
              aiDifficulty={gameConfig.aiDifficulty}
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
              initialClock={DEFAULT_TIME_CONTROL}
              onBack={goBack}
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
                  timeControl: sel.clock,
                  sideChoice: sel.side,
                  wallsEach: sel.wallsEach,
                });
              }}
            />
          )}

          {subScreen === 'PLAYER_PROFILE' && selectedPlayer && (
            <PlayerProfileScreen
              userId={selectedPlayer.userId}
              initialUsername={selectedPlayer.username}
              onBack={goBack}
              onChallenge={(p) => handleOpenChallengeSetup({ id: p.id, username: p.username })}
              onSelectGame={handleSelectGameFromHistory}
            />
          )}

          {subScreen === 'LEADERBOARD' && (
            <LeaderboardScreen
              onBack={goBack}
              onSelectPlayer={handleOpenPlayerProfile}
            />
          )}

          {subScreen === 'SETTINGS' && (
            <SettingsScreen
              settings={settings}
              onChange={updateSettings}
              onBack={goBack}
            />
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
                  challenge.cancelJoining('Could not join that match. Go back and try again.')
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
                <View style={styles.exitCard}>
                  <Text style={styles.exitTitle}>Exit DuoOrb?</Text>
                  <Text style={styles.exitSub}>Press back again to close the app.</Text>
                  <View style={styles.exitRow}>
                    <TouchableOpacity
                      style={styles.exitStay}
                      onPress={() => setExitAsk(false)}
                      accessibilityLabel="Stay in DuoOrb"
                    >
                      <Text style={styles.exitStayText}>Stay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.exitQuit}
                      onPress={() => BackHandler.exitApp()}
                      accessibilityLabel="Exit DuoOrb"
                    >
                      <Text style={styles.exitQuitText}>Exit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
        </SessionGate>
      </SessionProvider>
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
const SystemChrome: React.FC = () => (
  <>
    <NavigationBar style="light" />
    <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.background} />
  </>
);

/**
 * The single mount gate.
 *
 * `restoring` -> splash (no blank frame, no premature UI).
 * `anonymous` -> onboarding, which is also where a guest account is created.
 * `ready`     -> the app, rendered only once the canonical identity exists.
 *
 * Nothing else in the tree decides whether the user is signed in, so there is
 * exactly one place where "is there a session?" is answered.
 */
const SessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useSession();
  if (status === 'restoring') return <SplashScreen />;
  // Onboarding owns account creation and the username step. It calls
  // `markOnboardingComplete` itself; nothing here needs to know.
  if (status === 'anonymous') return <OnboardingFlow onFinish={() => {}} />;
  return <>{children}</>;
};

/**
 * Runs only while a session exists. Kept out of the root component so no
 * request is ever issued with a missing or stale identity.
 */
const SessionEffects: React.FC<{
  onFriendRequests: (n: number) => void;
  onOnlineCount: (n: number) => void;
}> = ({ onFriendRequests, onOnlineCount }) => {
  const { identity } = useSession();
  const userId = identity?.userId;
  useEffect(() => {
    if (!userId) return;
    // The badge must light up wherever you are, not only while the Friends
    // tab is open. FriendsScreen polls on the same cadence when mounted;
    // both writers publish the same number so they never fight. The lobby
    // headcount rides the same tick for the Home presence pill.
    let cancelled = false;
    const fetchCount = () => {
      api.getFriendRequests()
        .then((reqs) => {
          if (!cancelled) onFriendRequests(reqs.length);
        })
        .catch(() => {});
      api.getOnlineCount()
        .then((n) => {
          if (!cancelled) onOnlineCount(n);
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, onFriendRequests, onOnlineCount]);
  return null;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: THEME.colors.background,
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
  exitCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    padding: 20,
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  exitTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    color: THEME.colors.inverseLabel,
  },
  exitSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.textSecondaryStrong,
    marginTop: 6,
    textAlign: 'center',
  },
  exitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  exitStay: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceMuted,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exitStayText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    color: THEME.colors.textOnMuted,
  },
  exitQuit: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: THEME.colors.danger,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exitQuitText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: THEME.colors.onPrimary,
  },
});
