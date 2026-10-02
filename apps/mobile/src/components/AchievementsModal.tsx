import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../theme';
import type { AchievementsResponseDto, BadgeDto } from '../network/apiClient';
import { loadViewedAchievements, markAchievementViewed } from '../storage/achievementViews';
import {
  AchievementMedal,
  BadgeProgressBar,
  CATEGORY_META,
  CATEGORY_ORDER,
  METALS,
  categoryOf,
  tierOf,
} from './AchievementMedal';

type CatalogItem = BadgeDto & { earned: boolean; progress?: { current: number; target: number } };

/**
 * How long an earned badge keeps its NEW pill on its own. The pill is also
 * dismissed the moment the player opens that badge, so this is only the
 * fallback for badges nobody has looked at.
 */
const NEW_WINDOW_MS = 7 * 86400000;

interface AchievementsModalProps {
  visible: boolean;
  achievements: AchievementsResponseDto;
  /** Equip/unequip is a server write; the parent owns the pending flag. */
  equipping?: boolean;
  onToggleEquip: (code: string) => void;
  onClose: () => void;
}

/**
 * The achievements inventory: every badge the server ships, grouped into
 * shelves, scrollable, with the description revealed per badge on tap.
 *
 * This lives in a modal instead of the profile scroll because the catalog
 * is long (32 entries and growing) — inlining it pushed everything else
 * off-screen and buried the AI badges under three unearned ladders.
 */
export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  visible,
  achievements,
  equipping = false,
  onToggleEquip,
  onClose,
}) => {
  const [openCode, setOpenCode] = useState<string | null>(null);
  // Codes already opened on this device: their NEW pill is spent.
  const [viewed, setViewed] = useState<string[]>([]);

  // Re-read each time the sheet opens so a badge viewed in a previous
  // session does not come back with its pill.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadViewedAchievements().then((codes) => {
      if (!cancelled) setViewed(codes);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const catalog = achievements.catalog;
  const earnedCount = useMemo(() => catalog.filter((c) => c.earned).length, [catalog]);

  const equippedCodes = useMemo(
    () => new Set(achievements.equipped.map((b) => b.code)),
    [achievements.equipped]
  );

  const sections = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: catalog.filter((c: CatalogItem) => categoryOf(c.category) === cat),
      })).filter((s) => s.items.length > 0),
    [catalog]
  );

  const earnedAtOf = (code: string) =>
    achievements.earned.find((e) => e.code === code)?.earnedAt;

  /** Opening a badge spends its NEW pill, for good. */
  const handleToggle = useCallback((code: string) => {
    setOpenCode((prev) => (prev === code ? null : code));
    setViewed((prev) => (prev.includes(code) ? prev : [...prev, code]));
    void markAchievementViewed(code);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheetOverlay} edges={['top', 'bottom']}>
        <View style={styles.sheetCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Achievements</Text>
            <Text style={styles.headerCount}>
              {earnedCount}/{catalog.length}
            </Text>
            <TouchableOpacity
              style={styles.sheetClose}
              onPress={onClose}
              accessibilityLabel="Close achievements"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section) => {
              const meta = CATEGORY_META[section.cat];
              const got = section.items.filter((i) => i.earned).length;
              return (
                <View key={section.cat} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Feather name={meta.icon} size={13} color={THEME.colors.textSecondaryStrong} />
                    <Text style={styles.sectionTitle}>{meta.title}</Text>
                    <Text style={styles.sectionCount}>
                      {got}/{section.items.length}
                    </Text>
                  </View>

                  {section.items.map((badge) => {
                    const open = openCode === badge.code;
                    const isEquipped = equippedCodes.has(badge.code);
                    const earnedAt = earnedAtOf(badge.code);
                    const isNew =
                      !!earnedAt &&
                      !viewed.includes(badge.code) &&
                      Date.now() - new Date(earnedAt).getTime() < NEW_WINDOW_MS;
                    return (
                      <View
                        key={badge.code}
                        style={[styles.rowCard, open && styles.rowCardOpen]}
                      >
                        <TouchableOpacity
                          style={styles.rowHead}
                          activeOpacity={0.7}
                          onPress={() => handleToggle(badge.code)}
                          accessibilityLabel={`${badge.name}: details`}
                          accessibilityState={{ expanded: open }}
                        >
                          <AchievementMedal
                            icon={badge.icon}
                            tier={badge.tier}
                            size={40}
                            locked={!badge.earned}
                          />
                          <View style={styles.rowMeta}>
                            <View style={styles.rowTitleLine}>
                              <Text style={[styles.rowName, !badge.earned && styles.rowNameLocked]}>
                                {badge.name}
                              </Text>
                              {isNew && (
                                <View style={styles.newPill}>
                                  <Text style={styles.newPillText}>NEW</Text>
                                </View>
                              )}
                              {isEquipped && (
                                <View style={styles.equippedPill}>
                                  <Text style={styles.equippedPillText}>EQUIPPED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.rowTier}>
                              {badge.comingSoon
                                ? 'COMING SOON'
                                : badge.earned
                                ? `EARNED ${
                                    earnedAt
                                      ? new Date(earnedAt).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })
                                      : ''
                                  }`
                                : METALS[tierOf(badge.tier)].label}
                            </Text>
                          </View>
                          <Feather
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={THEME.colors.textMuted}
                          />
                        </TouchableOpacity>

                        {open && (
                          <View style={styles.detail}>
                            <Text style={styles.detailDesc}>{badge.description}</Text>
                            <Text style={styles.detailReq}>{badge.requirement}</Text>
                            <Text style={styles.detailMeta}>
                              {badge.comingSoon
                                ? 'Not awarded yet — unlocks with a bigger player base.'
                                : `Owned by ${achievements.owners[badge.code] ?? 0} player${
                                    (achievements.owners[badge.code] ?? 0) === 1 ? '' : 's'
                                  }`}
                            </Text>
                            {!badge.earned && !badge.comingSoon && badge.progress && (
                              <BadgeProgressBar progress={badge.progress} tier={badge.tier} />
                            )}
                            {badge.earned && !badge.comingSoon && (
                              <TouchableOpacity
                                style={[styles.equipBtn, isEquipped && styles.equipBtnActive]}
                                activeOpacity={0.8}
                                disabled={equipping}
                                onPress={() => onToggleEquip(badge.code)}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={[styles.equipText, isEquipped && styles.equipTextActive]}
                                >
                                  {isEquipped ? 'Unequip' : 'Equip'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.footnote}>
              Three earned badges can be equipped and appear on your profile.
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: THEME.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    maxHeight: '88%',
    ...THEME.shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    flex: 1,
  },
  headerCount: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondaryStrong,
    fontVariant: ['tabular-nums'],
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsScroll: {
    flexGrow: 0,
  },
  resultsContent: {
    paddingBottom: 4,
  },
  section: {
    marginBottom: 18,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondaryStrong,
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionCount: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainerLow,
    marginBottom: 6,
    overflow: 'hidden',
  },
  rowCardOpen: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowMeta: {
    flex: 1,
    gap: 3,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rowName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  rowNameLocked: {
    color: THEME.colors.textSecondary,
  },
  rowTier: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  newPill: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newPillText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.onPrimary,
    letterSpacing: 0.5,
  },
  equippedPill: {
    backgroundColor: THEME.colors.tertiaryLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: THEME.colors.tertiaryBorder,
  },
  equippedPillText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.5,
  },
  detail: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceContainer,
    gap: 6,
  },
  detailDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: THEME.colors.onSurfaceVariant,
  },
  detailReq: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  detailMeta: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  equipBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  equipBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  equipText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  equipTextActive: {
    color: THEME.colors.onPrimary,
  },
  footnote: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});