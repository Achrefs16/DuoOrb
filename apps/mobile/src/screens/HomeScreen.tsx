import React, { useRef, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { THEME, useStyles } from '../theme';
import { runWhenOnline } from '../components/NoConnection';
import { AdBanner } from '../components/AdBanner';
import { toast } from '../components/AppToast';
import { useConnectivity } from '../network/useConnectivity';
import { socketManager, useVerified } from '../network/socket';
import { DEFAULT_TIME_CONTROL, TimeControl } from '../timeControls';
import { OnlineMode } from './OnlineScreen';
import { useTranslation } from '../i18n';

interface HomeScreenProps {
  onOpenOnline: (clock: TimeControl, view: OnlineMode) => void;
  onOpenSetup: (kind: 'ai' | 'local') => void;
  onOpenCustomOnline: () => void;
  onOpenSettings: () => void;
  /** Everyone online in the game right now (friends and strangers). Null =
   * unknown (never fetched or last fetch failed): the pill says Checking…
   * instead of claiming nobody is online. */
  onlineCount: number | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenOnline,
  onOpenSetup,
  onOpenCustomOnline,
  onOpenSettings,
  onlineCount,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const navLock = useRef(0);
  const { isConnected } = useConnectivity();
  // Verified (not transport) health (ONLINE_HEALTH Phase B): a connected but
  // unverified socket is the ghost state — the pill says so and offers the
  // retry instead of a healthy-looking count.
  const verified = useVerified();

  // Track the actual rendered container width on Web
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

  // On Web, derive actual width from the real container (#root) rather than the desktop monitor window.
  // On Native Mobile, winWidth is the physical phone screen width.
  const contentWidth = Platform.OS === 'web'
    ? (webLayoutWidth || (typeof document !== 'undefined' ? document.getElementById('root')?.clientWidth : 0) || Math.min(winWidth, maxWebWidth))
    : winWidth;

  const rs = (n: number) => {
    if (Platform.OS === 'web') {
      if (!isTablet) {
        // Desktop PC / mobile web phone container:
        // Base width matches standard modern phone dimensions (~400px).
        // Preserves phone proportions (scale ~1.0) and dynamically adapts as container width changes.
        const scale = Math.min(1.02, Math.max(0.86, contentWidth / 400));
        return Math.round(n * scale);
      }
      // Tablet view: allow comfortable scaling up to 1.10
      const scale = Math.min(1.10, Math.max(0.95, contentWidth / 480));
      return Math.round(n * scale);
    }
    // Native Mobile APK (100% untouched)
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
      {/* Stitch Fixed Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandGroup}>
          <Image
            source={require('../../assets/logo-512.webp')}
            style={[styles.brandLogo, { width: rs(30), height: rs(30) }]}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="DuoOrb"
          />
          <View style={styles.brandTitles}>
            <Text style={[styles.brandTitle, { fontSize: rs(17) }]}>DuoOrb</Text>
            <Text style={[styles.brandSubtitle, { fontSize: rs(9) }]}>{t('home.tagline')}</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerIconButton, { width: rs(36), height: rs(36) }]}
            activeOpacity={0.7}
            onPress={onOpenSettings}
            accessibilityLabel={t('home.settingsA11y')}
          >
            <Feather name="settings" size={rs(18)} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, { paddingHorizontal: rs(16), gap: rs(12) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ad slot (MONETIZATION.md P6, O1): reserved 56px for eligible free
            users so the CTA below never shifts when the creative arrives.
            Premium / first session / no fill renders nothing here. */}
        <AdBanner placement="home" />

        {/* Lobby presence: who is online right now, above the play
            button. Tappable when degraded — the ghost state (connected but
            unverified) and dead transports both offer an explicit retry
            instead of a healthy-looking number. */}
        <TouchableOpacity
          style={[styles.presencePill, { paddingHorizontal: rs(12), paddingVertical: rs(7) }]}
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
              { width: rs(8), height: rs(8), borderRadius: rs(4) },
              (isConnected === false || verified === false || (onlineCount ?? 0) === 0) &&
                styles.presenceDotIdle,
            ]}
          />
          <Text style={[styles.presenceText, { fontSize: rs(12) }]}>
            {isConnected === false
              ? t('home.offline')
              : verified === false
              ? t('home.connIssue')
              : onlineCount === null
              ? t('home.checking')
              : onlineCount === 1
              ? t('home.playersOnlineOne', { count: 1 })
              : onlineCount > 1
              ? t('home.playersOnlineMany', { count: onlineCount })
              : t('home.noPlayers')}
          </Text>
        </TouchableOpacity>

        {/* Hero card: framed Quick Match action. Online only: offline taps
            get the dialog instead of a dead screen. */}
        <View style={[styles.heroCard, { minHeight: rs(148) }]}>
          <Text style={[styles.heroTitle, { fontSize: rs(20) }]}>{t('home.quickMatch')}</Text>
          <Text style={[styles.heroDesc, { fontSize: rs(12) }]}>{t('home.quickMatchDesc')}</Text>
          <TouchableOpacity
            style={[styles.quickMatchButton, { height: rs(52) }]}
            activeOpacity={0.88}
            onPress={guarded(() => runWhenOnline(() => onOpenOnline(DEFAULT_TIME_CONTROL, 'quick')))}
          >
            <Feather name="play" size={rs(20)} color={THEME.colors.primary} />
            <Text style={[styles.quickMatchText, { fontSize: rs(16) }]}>{t('home.play')}</Text>
          </TouchableOpacity>
        </View>

        {/* Modes section header */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { fontSize: rs(11) }]}>{t('home.modes')}</Text>
        </View>

        {/* Mode Grid (2x2) */}
        <View style={styles.modeGrid}>
          <View style={styles.modeGridRow}>
            {/* Custom Online Match Tile */}
            <TouchableOpacity
              style={[styles.modeCard, { paddingVertical: rs(14), paddingHorizontal: rs(14) }]}
              activeOpacity={0.75}
              onPress={guarded(() => runWhenOnline(() => onOpenCustomOnline()))}
            >
              <View style={[styles.modeIconCircle, { width: rs(32), height: rs(32) }]}>
                <Feather name="settings" size={rs(15)} color={THEME.colors.textPrimary} />
              </View>
              <Text style={[styles.modeCardTitle, { fontSize: rs(14) }]}>{t('home.customMatch')}</Text>
              <Text style={[styles.modeCardDesc, { fontSize: rs(11) }]} numberOfLines={2}>{t('home.customMatchDesc')}</Text>
            </TouchableOpacity>

            {/* Vs AI Tile */}
            <TouchableOpacity
              style={[styles.modeCard, { paddingVertical: rs(14), paddingHorizontal: rs(14) }]}
              activeOpacity={0.75}
              onPress={guarded(() => onOpenSetup('ai'))}
            >
              <View style={[styles.modeIconCircle, { width: rs(32), height: rs(32) }]}>
                <Feather name="cpu" size={rs(15)} color={THEME.colors.textPrimary} />
              </View>
              <Text style={[styles.modeCardTitle, { fontSize: rs(14) }]}>{t('home.vsAi')}</Text>
              <Text style={[styles.modeCardDesc, { fontSize: rs(11) }]} numberOfLines={2}>{t('home.vsAiDesc')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modeGridRow}>
            {/* Local Pass & Play Tile */}
            <TouchableOpacity
              style={[styles.modeCard, { paddingVertical: rs(14), paddingHorizontal: rs(14) }]}
              activeOpacity={0.75}
              onPress={guarded(() => onOpenSetup('local'))}
            >
              <View style={[styles.modeIconCircle, { width: rs(32), height: rs(32) }]}>
                <Feather name="smartphone" size={rs(15)} color={THEME.colors.textPrimary} />
              </View>
              <Text style={[styles.modeCardTitle, { fontSize: rs(14) }]}>{t('home.local')}</Text>
              <Text style={[styles.modeCardDesc, { fontSize: rs(11) }]} numberOfLines={2}>{t('home.localDesc')}</Text>
            </TouchableOpacity>

            {/* Private Rooms Tile */}
            <TouchableOpacity
              style={[styles.modeCard, { paddingVertical: rs(14), paddingHorizontal: rs(14) }]}
              activeOpacity={0.75}
              onPress={guarded(() => runWhenOnline(() => onOpenOnline(DEFAULT_TIME_CONTROL, 'rooms')))}
            >
              <View style={[styles.modeIconCircle, { width: rs(32), height: rs(32) }]}>
                <Feather name="unlock" size={rs(15)} color={THEME.colors.textPrimary} />
              </View>
              <Text style={[styles.modeCardTitle, { fontSize: rs(14) }]}>{t('home.rooms')}</Text>
              <Text style={[styles.modeCardDesc, { fontSize: rs(11) }]} numberOfLines={2}>{t('home.roomsDesc')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Journey teaser */}
        <View style={styles.journeyCard}>
          <View style={styles.journeyThumb}>
            <Svg width={34} height={34} viewBox="0 0 48 48">
              <Path
                d="M8 40 C 18 36 10 26 22 22 S 38 18 40 8"
                fill="none"
                stroke={THEME.colors.textMuted}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="0.5 6"
              />
              <Circle cx={8} cy={40} r={3.5} fill="none" stroke={THEME.colors.textMuted} strokeWidth={2} />
              <Circle cx={40} cy={8} r={4.5} fill={THEME.colors.primary} />
            </Svg>
            <View style={styles.journeyLock}>
              <Feather name="lock" size={10} color={THEME.colors.textMuted} />
            </View>
          </View>
          <View style={styles.journeyMeta}>
            <Text style={[styles.journeyTitle, { fontSize: rs(16) }]}>{t('home.journey')}</Text>
            <Text style={[styles.journeyDesc, { fontSize: rs(11) }]} numberOfLines={2}>
              {t('home.journeyDesc')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.journeyButton}
            activeOpacity={0.75}
            onPress={() => toast.show(t('home.journeySoon'))}
            accessibilityRole="button"
            accessibilityLabel={t('home.journeyA11y')}
          >
            <Text style={[styles.journeyButtonText, { fontSize: rs(13) }]}>{t('home.start')}</Text>
            <Feather name="arrow-right" size={rs(14)} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  brandTitles: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.onSurface,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 84 : 120, // Clears the floating nav overlay.
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  adBanner: {
    width: '100%',
    height: 48,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.surfaceContainer,
    backgroundColor: THEME.colors.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adBannerText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  heroCard: {
    width: '100%',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 16,
    padding: 14,
  },
  heroTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  heroDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  quickMatchButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  quickMatchText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.playerGreenBright,
  },
  presenceDotIdle: {
    backgroundColor: THEME.colors.textMuted,
  },
  presenceText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: -6,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
  },
  modeGrid: {
    width: '100%',
    gap: 8,
  },
  modeGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    aspectRatio: 1.25,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    ...THEME.shadows.card,
  },
  modeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -8,
  },
  modeCardTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    // Absorbs the square's leftover space here, so the gap lives between
    // the icon and the text — not pooled under it — on every tile.
    marginTop: 'auto',
  },
  modeCardDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    fontWeight: '400',
    marginTop: -4,
  },
  journeyCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...THEME.shadows.card,
  },
  journeyThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyLock: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyMeta: {
    flex: 1,
    gap: 1,
  },
  journeyTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  journeyDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    lineHeight: 15,
  },
  journeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surfaceContainerLowest,
  },
  journeyButtonText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
});
