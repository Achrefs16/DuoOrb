import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { OrbIcon } from '../components/OrbIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { runWhenOnline } from '../components/NoConnection';
import { AdBanner } from '../components/AdBanner';
import { useConnectivity } from '../network/useConnectivity';
import { socketManager, useVerified } from '../network/socket';
import { DEFAULT_TIME_CONTROL, TimeControl } from '../timeControls';
import { OnlineMode } from './OnlineScreen';
import { useTranslation } from '../i18n';
import { detectWebInstallPlatform } from '../components/InstallPromptModal';
import { MiniBoardPreview } from '../components/MiniBoardPreview';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

interface HomeScreenProps {
  onOpenOnline: (clock: TimeControl, view: OnlineMode) => void;
  onOpenSetup: (kind: 'ai' | 'local') => void;
  onOpenCustomOnline: () => void;
  onOpenSettings: () => void;
  onOpenInstallPrompt?: () => void;
  onSelectBotsTab?: () => void;
  onOpenHistory?: () => void;
  /** Everyone online in the game right now. Null = unknown. */
  onlineCount: number | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenOnline,
  onOpenSetup,
  onOpenCustomOnline,
  onOpenSettings,
  onOpenInstallPrompt,
  onSelectBotsTab,
  onOpenHistory,
  onlineCount,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const navLock = useRef(0);
  const { isConnected } = useConnectivity();
  const verified = useVerified();
  const insets = useSafeAreaInsets();

  // Track rendered container width on Web
  const [webLayoutWidth, setWebLayoutWidth] = useState<number>(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const rootEl = document.getElementById('root');
      if (rootEl && rootEl.clientWidth > 0) {
        return rootEl.clientWidth;
      }
    }
    return 0;
  });

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTablet = winWidth >= 600 && (winWidth <= 1100 || winHeight >= winWidth);
  const maxWebWidth = isTablet ? 580 : 420;

  const { platform: webPlatform, isStandalone: webIsStandalone } = useMemo(
    () => detectWebInstallPlatform(),
    []
  );
  const showInstallPill =
    Platform.OS === 'web' && webPlatform !== 'none' && !webIsStandalone;

  const contentWidth =
    Platform.OS === 'web'
      ? webLayoutWidth ||
        (typeof document !== 'undefined'
          ? document.getElementById('root')?.clientWidth
          : 0) ||
        Math.min(winWidth, maxWebWidth)
      : winWidth;

  const rs = (n: number) => {
    if (Platform.OS === 'web') {
      if (!isTablet) {
        const scale = Math.min(1.02, Math.max(0.86, contentWidth / 400));
        return Math.round(n * scale);
      }
      const scale = Math.min(1.1, Math.max(0.95, contentWidth / 480));
      return Math.round(n * scale);
    }
    return Math.round(n * Math.min(1.12, Math.max(0.86, winWidth / 375)));
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w > 0 && Math.abs(w - webLayoutWidth) >= 1) {
        setWebLayoutWidth(w);
      }
    }
  };

  const guarded = (fn: () => void) => () => {
    const now = Date.now();
    if (now - navLock.current < 600) return;
    navLock.current = now;
    fn();
  };

  return (
    <View style={styles.screen} onLayout={handleLayout}>
      {/* Top Header Bar — Flat, unbordered Chess.com style */}
      <View style={styles.topHeader}>
        {/* Left: Online Status Pill */}
        <TouchableOpacity
          style={styles.presencePill}
          activeOpacity={verified === false ? 0.7 : 1}
          onPress={() => {
            if (isConnected === false || verified === false) {
              socketManager.retryNow();
            }
          }}
          accessibilityLabel={
            isConnected === false
              ? t('home.offlineA11y')
              : verified === false
              ? t('home.connIssueA11y')
              : onlineCount === 1
              ? t('home.playersOnlineOne', { count: 1 })
              : t('home.playersOnlineMany', { count: onlineCount ?? 0 })
          }
        >
          <View
            style={[
              styles.presenceDot,
              (isConnected === false ||
                verified === false ||
                (onlineCount ?? 0) === 0) &&
                styles.presenceDotIdle,
            ]}
          />
          <Text style={styles.presenceText}>
            {isConnected === false
              ? t('home.offline')
              : verified === false
              ? t('home.connIssue')
              : onlineCount === null
              ? t('home.checking')
              : onlineCount === 1
              ? '1 Online'
              : `${onlineCount} Online`}
          </Text>
        </TouchableOpacity>

        {/* Center: DuoOrb Brand */}
        <View style={styles.brandCenter}>
          <Image
            source={require('../../assets/logo-512.webp')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="DuoOrb"
          />
          <Text style={styles.brandTitle}>DuoOrb</Text>
        </View>

        {/* Right: Install Pill & Settings Button */}
        <View style={styles.headerRightActions}>
          {showInstallPill && (
            <TouchableOpacity
              style={styles.installPill}
              activeOpacity={0.8}
              onPress={onOpenInstallPrompt}
              accessibilityRole="button"
              accessibilityLabel="Install App"
            >
              <OrbIcon name="download" size={13} color={THEME.colors.primary} />
              <Text style={styles.installPillText}>Install</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={onOpenSettings}
            accessibilityLabel={t('home.settingsA11y')}
          >
            <OrbIcon
              name="settings"
              size={19}
              color={THEME.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Content — Clean flat list, NO cards */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BOTTOM_NAV_HEIGHT + 74 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Row 1: Play Online */}
        <TouchableOpacity
          style={styles.featureRow}
          activeOpacity={0.7}
          onPress={guarded(() =>
            runWhenOnline(() => onOpenCustomOnline())
          )}
        >
          <MiniBoardPreview preset="online1v1" size={rs(114)} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Play Online</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              Classic 3+0 vs Random
            </Text>
          </View>
        </TouchableOpacity>

        {/* Row 2: Play a Bot */}
        <TouchableOpacity
          style={styles.featureRow}
          activeOpacity={0.7}
          onPress={guarded(() => {
            if (onSelectBotsTab) {
              onSelectBotsTab();
            } else {
              onOpenSetup('ai');
            }
          })}
        >
          <MiniBoardPreview preset="botMatch" size={rs(114)} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Play a Bot</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              Martin · Friendly (800 ELO)
            </Text>
          </View>
        </TouchableOpacity>

        {/* Row 3: Play a Friend */}
        <TouchableOpacity
          style={styles.featureRow}
          activeOpacity={0.7}
          onPress={guarded(() =>
            runWhenOnline(() => onOpenOnline(DEFAULT_TIME_CONTROL, 'rooms'))
          )}
        >
          <MiniBoardPreview preset="friendsRoom" size={rs(114)} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Play a Friend</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              Create or join a private room
            </Text>
          </View>
        </TouchableOpacity>

        {/* Row 4: Pass & Play */}
        <TouchableOpacity
          style={styles.featureRow}
          activeOpacity={0.7}
          onPress={guarded(() => onOpenSetup('local'))}
        >
          <MiniBoardPreview preset="local4p" size={rs(114)} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Pass & Play</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              2–4 players on one device
            </Text>
          </View>
        </TouchableOpacity>

        {/* Integrated Ad slot */}
        <AdBanner placement="home" />
      </ScrollView>

      {/* Sticky Bottom Play Button — Seamlessly connects to BottomNav with NO line */}
      <View style={[styles.stickyCtaContainer, { bottom: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
        <TouchableOpacity
          style={styles.stickyPlayButton}
          activeOpacity={0.88}
          onPress={guarded(() =>
            runWhenOnline(() => onOpenCustomOnline())
          )}
        >
          <Text style={styles.stickyPlayButtonText}>Play</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: THEME.colors.background,
    },
    topHeader: {
      height: 52,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: THEME.colors.background,
      borderBottomWidth: 0,
      zIndex: 10,
    },
    presencePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 0,
    },
    presenceDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: THEME.colors.primary,
    },
    presenceDotIdle: {
      backgroundColor: THEME.colors.textMuted,
    },
    presenceText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11.5,
      color: THEME.colors.textSecondary,
      fontWeight: '700',
    },
    brandCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    brandLogo: {
      width: 26,
      height: 26,
      borderRadius: 7,
    },
    brandTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 17,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.3,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    installPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: THEME.colors.surfacePrimaryTint,
      borderWidth: 0,
    },
    installPillText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11,
      color: THEME.colors.primary,
      fontWeight: '700',
    },
    headerIconButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 0,
    },
    scrollArea: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      // Extra bottom padding so last row and ad clear the sticky Play button and docked BottomNav
      paddingBottom: BOTTOM_NAV_HEIGHT + 74,
      maxWidth: 580,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
    },
    // Pure flat row directly on canvas — NO CARDS, NO BORDERS, NO SHADOWS
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      paddingVertical: 4,
    },
    rowInfo: {
      flex: 1,
      paddingLeft: 16,
      justifyContent: 'center',
    },
    rowTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 17.5,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.2,
    },
    rowSubtitle: {
      fontFamily: THEME.fonts.medium,
      fontSize: 12.5,
      color: THEME.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    // Docked sticky container — zero border bottom/top so it flows into BottomNav seamlessly
    stickyCtaContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: BOTTOM_NAV_HEIGHT,
      backgroundColor: THEME.colors.background,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      zIndex: 15,
    },
    // Tactile 3D button: only solid bottom border bevel, zero drop shadow
    stickyPlayButton: {
      width: '100%',
      maxWidth: 580,
      alignSelf: 'center',
      height: 52,
      backgroundColor: THEME.colors.primary,
      borderRadius: 10,
      borderBottomWidth: 4,
      borderBottomColor: THEME.colors.primaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickyPlayButtonText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
  });
