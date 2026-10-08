import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';

import { useTranslation } from '../i18n';

export type MainTab = 'PLAY' | 'FRIENDS' | 'LEADERBOARD' | 'HISTORY' | 'PROFILE';

interface BottomNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  friendRequestsCount?: number;
}

interface TabItem {
  id: MainTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  friendRequestsCount = 0,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const tabs: TabItem[] = [
    { id: 'PLAY', label: t('nav.play'), icon: 'grid' },
    { id: 'FRIENDS', label: t('nav.friends'), icon: 'users' },
    { id: 'LEADERBOARD', label: t('nav.leaderboard'), icon: 'award' },
    { id: 'HISTORY', label: t('nav.history'), icon: 'clock' },
    { id: 'PROFILE', label: t('nav.profile'), icon: 'user' },
  ];
  // Floating pill: the container is transparent so the page background shows
  // around the bar, and the bar floats above the bottom safe-area inset.
  const bottomInset = useSafeAreaInsets().bottom;

  return (
    <View style={[styles.container, { bottom: bottomInset + 20 }]}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const showBadge = tab.id === 'FRIENDS' && friendRequestsCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onSelectTab(tab.id)}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                {tab.id === 'LEADERBOARD' ? (
                  <MaterialCommunityIcons
                    name="trophy-outline"
                    size={20}
                    color={isActive ? THEME.colors.onPrimary : THEME.colors.textMuted}
                  />
                ) : (
                  <Feather
                    name={tab.icon}
                    size={20}
                    color={isActive ? THEME.colors.onPrimary : THEME.colors.textMuted}
                  />
                )}
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {friendRequestsCount > 9 ? '9+' : friendRequestsCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  // Overlay: floats above page content instead of pushing it up, so lists
  // scroll underneath the pill. Tab screens carry matching bottom padding.
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'transparent',
    zIndex: 5,
    elevation: 5,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  iconContainerActive: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    backgroundColor: THEME.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.surfaceHairline,
  },
  badgeText: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.onPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
});
