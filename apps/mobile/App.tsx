import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AIDifficulty, GameMode, GameState, RecordedAction } from '@duoorb/game-core';
import { RoomDto } from '@duoorb/protocol';
import { GameReviewScreen } from './src/screens/GameReviewScreen';
import { GameScreen } from './src/screens/GameScreen';
import { MatchSetupScreen } from './src/screens/MatchSetupScreen';
import { OnlineMode, OnlineScreen } from './src/screens/OnlineScreen';
import { SideChoice } from './src/screens/MatchSetupScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ReplayScreen } from './src/screens/ReplayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SplashScreen, SPLASH_MIN_MS } from './src/screens/SplashScreen';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { hasCompletedOnboarding } from './src/storage/onboarding';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { PlayerProfileScreen } from './src/screens/PlayerProfileScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { BottomNav, MainTab } from './src/components/BottomNav';
import { ChallengeToast } from './src/components/ChallengeToast';
import { RoomInviteToast } from './src/components/RoomInviteToast';
import { useRoomInvites } from './src/network/useRoomInvites';
import { useChallenge } from './src/network/useChallenge';
import { SavedGameRecord } from './src/storage/gameStorage';
import {
  DEFAULT_SETTINGS,
  UserSettings,
  loadSettings,
  saveSettings,
} from './src/storage/gameStorage';
import { setSoundsMuted } from './src/audio/sounds';
import { SessionProvider } from './src/network/session';
import { hydrateIdentity } from './src/network/auth';
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
  | 'REPLAY'
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
}

interface ReplayData {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx: number;
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

  const [gameConfig, setGameConfig] = useState<ActiveGameConfig>({
    mode: '2p',
    type: 'ai',
    aiDifficulty: 'normal',
  });
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
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
  // Boot state: the splash covers font loading, identity hydration and the
  // onboarding check, so there is never a blank frame.
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
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
    if (!identityReady) return;
    let cancelled = false;
    hasCompletedOnboarding().then((done) => {
      if (!cancelled) setOnboarded(done);
    });
    return () => {
      cancelled = true;
    };
  }, [identityReady]);

  useEffect(() => {
    hydrateIdentity().finally(() => setIdentityReady(true));
  }, []);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setSoundsMuted(!s.soundEnabled);
    });

    // Check pending friend requests count on mount
    api.getFriendRequests()
      .then((reqs) => setFriendRequestsCount(reqs.length))
      .catch(() => {});
  }, []);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    void saveSettings(patch);
    if (patch.soundEnabled !== undefined) setSoundsMuted(!patch.soundEnabled);
  };

  const handleStartGame = (config: ActiveGameConfig) => {
    setGameConfig(config);
    navigate(currentTab, 'GAME');
  };

  // Global friend-challenge line: toast overlay works from any tab, and
  // accepting drops both players straight into the game.
  const challenge = useChallenge({
    onGameStart: (gameId, mode, clock) => {
      handleStartGame({ mode, type: 'online', onlineGameId: gameId, timeControl: clock });
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
        navigate(currentTab, 'ONLINE');
        return;
      }
      if (gameConfig.onlineSource === 'custom') {
        // Custom Online Match closes back to its configuration page.
        handleOpenSetup('online');
        return;
      }
      // Quick Match closes to the home page.
      navigate('PLAY', null);
      return;
    }
    handleOpenSetup(gameConfig.type);
  };

  // New Game from the result modal: re-queue the same online match type
  // (quick or custom) with a new opponent; AI/local return to setup.
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
      navigate(currentTab, 'ONLINE');
    } else {
      handleOpenSetup(gameConfig.type);
    }
  };

  const handleOpenPlayerProfile = (player: { userId: string; username: string }) => {
    setSelectedPlayer(player);
    navigate(currentTab, 'PLAYER_PROFILE');
  };

  const handleChallengePlayer = (player: { id: string; username: string }) => {
    handleOpenOnline(DEFAULT_TIME_CONTROL, 'rooms', player.username);
  };

  const handleOpenReview = (initialState: GameState, history: RecordedAction[], perspectiveIdx = 0) => {
    setReplayData({ initialState, history, perspectiveIdx });
    navigate(currentTab, 'REVIEW');
  };

  const handleSelectGameFromHistory = (savedGame: SavedGameRecord) => {
    setReplayData({
      initialState: savedGame.initialState,
      history: savedGame.history,
      perspectiveIdx: 0,
    });
    navigate(currentTab, 'REPLAY');
  };

  // Splash holds until fonts, identity and the onboarding check are all
  // ready AND the minimum time has elapsed.
  if (!fontsLoaded || !identityReady || !splashElapsed || onboarded === null) {
    return (
      <SafeAreaProvider>
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  // First launch on this device: Welcome -> Choose Username.
  if (!onboarded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.background} />
          <SessionProvider>
            <OnboardingFlow onFinish={() => setOnboarded(true)} />
          </SessionProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.background} />
      <SessionProvider>
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
                />
              )}

              {currentTab === 'PROFILE' && (
                <ProfileScreen
                  onOpenSettings={() => navigate(currentTab, 'SETTINGS')}
                  onSelectGame={handleSelectGameFromHistory}
                />
              )}
            </View>
          )}

          {/* Subscreens */}
          {subScreen === 'GAME' && (
            <GameScreen
              key={
                gameConfig.type === 'online'
                  ? `online-${gameConfig.onlineGameId ?? 'lobby'}`
                  : `local-${gameConfig.mode}-${gameConfig.type}-${gameConfig.aiDifficulty ?? 'none'}-${gameConfig.sideChoice ?? 'blue'}`
              }
              mode={gameConfig.mode}
              type={gameConfig.type}
              onlineGameId={gameConfig.onlineGameId}
              onlineSource={gameConfig.onlineSource}
              aiDifficulty={gameConfig.aiDifficulty}
              timeControl={gameConfig.timeControl}
              sideChoice={gameConfig.sideChoice}
              wallsEach={gameConfig.wallsEach}
              incrementEnabled={settings.incrementEnabled}
              autoFlip={settings.autoFlip}
              premoveEnabled={settings.premoveEnabled}
              extendedQueue={settings.extendedQueue}
              testThink={settings.testThink}
              onHome={handleCloseMatch}
              onNewGame={handleNewGameAfter}
              onRematchAccepted={(newGameId) =>
                handleStartGame({
                  mode: gameConfig.mode,
                  type: 'online',
                  onlineGameId: newGameId,
                  onlineSource: gameConfig.onlineSource,
                  wallsEach: gameConfig.wallsEach,
                  timeControl: gameConfig.timeControl,
                })
              }
              onAnalyze={handleOpenReview}
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
                  navigate('FRIENDS', null);
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
              key={`${onlineEntry.clock.id}-${onlineEntry.view}-${onlineEntry.inviteName ?? ''}-${onlineEntry.autoMatch?.mode ?? ''}-${onlineEntry.autoMatch?.wallsEach ?? ''}-${onlineEntry.autoRoom?.mode ?? ''}-${onlineEntry.autoRoom?.wallsEach ?? ''}`}
              initialClock={onlineEntry.clock}
              initialView={onlineEntry.view}
              inviteName={onlineEntry.inviteName}
              autoMatch={onlineEntry.autoMatch}
              autoRoom={onlineEntry.autoRoom}
              initialRoom={onlineEntry.initialRoom}
              onBack={goBack}
              onStartOnlineGame={(gameId, mode, clock, source, room) => {
                handleStartGame({
                  mode,
                  type: 'online',
                  onlineGameId: gameId,
                  onlineSource: source,
                  room,
                  wallsEach: room?.wallsEach,
                  timeControl: clock,
                });
              }}
            />
          )}

          {subScreen === 'REPLAY' && replayData && (
            <ReplayScreen
              initialState={replayData.initialState}
              history={replayData.history}
              perspectiveIdx={replayData.perspectiveIdx}
              onBack={goBack}
              onAnalyze={() => navigate(currentTab, 'REVIEW')}
            />
          )}

          {subScreen === 'REVIEW' && replayData && (
            <GameReviewScreen
              initialState={replayData.initialState}
              history={replayData.history}
              perspectiveIdx={replayData.perspectiveIdx}
              onBack={goBack}
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
              onAccept={() => challenge.respond(true)}
              onDecline={() => challenge.respond(false)}
              onCancelWaiting={challenge.cancelWaiting}
            />
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
      </SessionProvider>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  exitTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    color: '#0F172A',
  },
  exitSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    alignItems: 'center',
  },
  exitStayText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    color: '#475569',
  },
  exitQuit: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    alignItems: 'center',
  },
  exitQuitText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
