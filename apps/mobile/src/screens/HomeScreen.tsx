import React, { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { DEFAULT_TIME_CONTROL, TimeControl } from '../timeControls';
import { OnlineMode } from './OnlineScreen';

interface HomeScreenProps {
  onOpenOnline: (clock: TimeControl, view: OnlineMode) => void;
  onOpenSetup: (kind: 'ai' | 'local') => void;
  onOpenCustomOnline: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenOnline,
  onOpenSetup,
  onOpenCustomOnline,
  onOpenSettings,
}) => {
  const navLock = useRef(0);

  const guarded = (fn: () => void) => () => {
    const now = Date.now();
    if (now - navLock.current < 600) return;
    navLock.current = now;
    fn();
  };

  return (
    <View style={styles.screen}>
      {/* Stitch Fixed Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandGroup}>
          <View style={styles.dualOrbsPill}>
            <View style={[styles.miniOrb, { backgroundColor: THEME.colors.primary }]} />
            <View style={[styles.miniOrb, { backgroundColor: THEME.colors.secondary }]} />
          </View>
          <View style={styles.brandTitles}>
            <Text style={styles.brandTitle}>DuoOrb</Text>
            <Text style={styles.brandSubtitle}>TACTICAL GRID</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={onOpenSettings}
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={18} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtle Announcement / Tactical Banner */}
        <View style={styles.adBanner}>
          <Feather name="shield" size={14} color={THEME.colors.textMuted} />
          <Text style={styles.adBannerText}>COMPETITIVE TURN-BASED GRID STRATEGY</Text>
        </View>

        {/* Hero Quick Match Action — starts directly with defaults. */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.quickMatchButton}
            activeOpacity={0.88}
            onPress={guarded(() => onOpenOnline(DEFAULT_TIME_CONTROL, 'quick'))}
          >
            <Feather name="play" size={20} color="#FFFFFF" />
            <Text style={styles.quickMatchText}>Quick Match</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Cards List */}
        <View style={styles.modeCardsList}>
          {/* Custom Online Match Card */}
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.75}
            onPress={guarded(() => onOpenCustomOnline())}
          >
            <View style={styles.modeCardLeft}>
              <View style={styles.modeIconCircle}>
                <Feather name="settings" size={20} color={THEME.colors.textPrimary} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeCardTitle}>Custom Online Match</Text>
                <Text style={styles.modeCardDesc}>Classic, Rush, Race with custom rules</Text>
              </View>
            </View>
            <View style={styles.modeCardRight}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>CUSTOM</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Vs AI Card */}
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.75}
            onPress={guarded(() => onOpenSetup('ai'))}
          >
            <View style={styles.modeCardLeft}>
              <View style={styles.modeIconCircle}>
                <Feather name="cpu" size={20} color={THEME.colors.textPrimary} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeCardTitle}>Vs AI</Text>
                <Text style={styles.modeCardDesc}>1v1, Race, Rush Center</Text>
              </View>
            </View>
            <View style={styles.modeCardRight}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>SOLO</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Local Pass & Play Card */}
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.75}
            onPress={guarded(() => onOpenSetup('local'))}
          >
            <View style={styles.modeCardLeft}>
              <View style={styles.modeIconCircle}>
                <Feather name="smartphone" size={20} color={THEME.colors.textPrimary} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeCardTitle}>Local</Text>
                <Text style={styles.modeCardDesc}>Pass & play on one device</Text>
              </View>
            </View>
            <View style={styles.modeCardRight}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>PASS & PLAY</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Private Rooms Card */}
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.75}
            onPress={guarded(() => onOpenOnline(DEFAULT_TIME_CONTROL, 'rooms'))}
          >
            <View style={styles.modeCardLeft}>
              <View style={styles.modeIconCircle}>
                <Feather name="unlock" size={20} color={THEME.colors.textPrimary} />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeCardTitle}>Private Rooms</Text>
                <Text style={styles.modeCardDesc}>Create or join custom lobby</Text>
              </View>
            </View>
            <View style={styles.modeCardRight}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>WITH FRIENDS</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Objectives & Rules Section */}
        <View style={styles.rulesSection}>
          <View style={styles.rulesSectionHeader}>
            <View style={styles.rulesHeaderTitleRow}>
              <Feather name="book" size={16} color={THEME.colors.primary} />
              <Text style={styles.rulesSectionTitle}>Objectives & Rules</Text>
            </View>
            <Text style={styles.rulesSectionSub}>Swipe for modes</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rulesCarousel}
          >
            {/* Mode 1: Classic (9×9) */}
            <View style={styles.ruleCard}>
              <View style={styles.ruleMiniIcon}>
                <View style={[styles.microOrb, { backgroundColor: THEME.colors.primary }]} />
                <View style={styles.microWallBar} />
                <View style={[styles.microOrb, { backgroundColor: THEME.colors.secondary }]} />
              </View>
              <View style={styles.ruleCardInfo}>
                <View style={styles.ruleCardTitleRow}>
                  <Text style={styles.ruleCardTitle}>Classic (9×9)</Text>
                  <View style={styles.ruleTag}>
                    <Text style={styles.ruleTagText}>STANDARD</Text>
                  </View>
                </View>
                <Text style={styles.ruleCardDesc} numberOfLines={3}>
                  Reach the opposing baseline to win. Place tactile barriers each turn to impede movement. Complete enclosure is forbidden.
                </Text>
              </View>
            </View>

            {/* Mode 2: Race Mode */}
            <View style={styles.ruleCard}>
              <View style={styles.ruleMiniIcon}>
                <View style={styles.microRow}>
                  <View style={[styles.microOrb, { backgroundColor: THEME.colors.primary }]} />
                  <Feather name="zap" size={12} color={THEME.colors.primary} />
                </View>
                <Feather name="clock" size={14} color={THEME.colors.textMuted} />
                <View style={[styles.microOrb, { backgroundColor: THEME.colors.secondary }]} />
              </View>
              <View style={styles.ruleCardInfo}>
                <View style={styles.ruleCardTitleRow}>
                  <Text style={styles.ruleCardTitle}>Race Mode</Text>
                  <View style={styles.ruleTag}>
                    <Text style={styles.ruleTagText}>SPEED</Text>
                  </View>
                </View>
                <Text style={styles.ruleCardDesc} numberOfLines={3}>
                  First orb to navigate the maze and cross the opposing baseline wins. Limited wall pool and blitz turn timers test pathfinding speed.
                </Text>
              </View>
            </View>

            {/* Mode 3: Rush Center */}
            <View style={styles.ruleCard}>
              <View style={styles.ruleMiniIcon}>
                <View style={[styles.microOrb, { backgroundColor: THEME.colors.primary }]} />
                <View style={styles.nexusTargetBox}>
                  <View style={styles.nexusInnerDot} />
                </View>
                <View style={[styles.microOrb, { backgroundColor: THEME.colors.secondary }]} />
              </View>
              <View style={styles.ruleCardInfo}>
                <View style={styles.ruleCardTitleRow}>
                  <Text style={styles.ruleCardTitle}>Rush Center</Text>
                  <View style={styles.ruleTag}>
                    <Text style={styles.ruleTagText}>NEXUS</Text>
                  </View>
                </View>
                <Text style={styles.ruleCardDesc} numberOfLines={3}>
                  Be the first to secure the center 3x3 nexus zone and hold position, or advance past barriers into the opponent's core territory.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  dualOrbsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniOrb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
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
    paddingBottom: 28,
    maxWidth: 480,
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
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  quickMatchButton: {
    flex: 1,
    height: 52,
    backgroundColor: THEME.colors.tertiary,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: THEME.colors.tertiary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  quickMatchText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modeCardsList: {
    width: '100%',
    gap: 8,
  },
  modeCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  modeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextContainer: {
    flex: 1,
  },
  modeCardTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  modeCardDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
    fontWeight: '400',
  },
  modeCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  badgeText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  rulesSection: {
    marginTop: 4,
    gap: 8,
  },
  rulesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  rulesHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rulesSectionTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  rulesSectionSub: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  rulesCarousel: {
    gap: 10,
    paddingVertical: 4,
  },
  ruleCard: {
    width: 280,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  ruleMiniIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainerHigh,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  microOrb: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  microWallBar: {
    width: 20,
    height: 3,
    backgroundColor: 'rgba(67, 70, 85, 0.4)',
    borderRadius: 1.5,
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nexusTargetBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nexusInnerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.primary,
  },
  ruleCardInfo: {
    flex: 1,
    gap: 3,
  },
  ruleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleCardTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  ruleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfaceContainerHigh,
  },
  ruleTagText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  ruleCardDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    lineHeight: 15,
  },
});
