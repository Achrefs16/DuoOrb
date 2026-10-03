import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../theme';

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
  const tabs: TabItem[] = [
    { id: 'PLAY', label: 'Play', icon: 'grid' },
    { id: 'FRIENDS', label: 'Friends', icon: 'users' },
    { id: 'LEADERBOARD', label: 'Leaderboard', icon: 'award' },
    { id: 'HISTORY', label: 'History', icon: 'clock' },
    { id: 'PROFILE', label: 'Profile', icon: 'user' },
  ];
  // Extend the nav background through the bottom inset to the screen edge.
  // The root SafeAreaView stops above the system navbar zone, so that strip
  // used to show the window background (grey) under the white bar — the
  // sandwich. A negative margin paints this background over the inset area
  // instead; siblings above are unaffected.
  const bottomInset = useSafeAreaInsets().bottom;

  return (
    <View style={[styles.container, { marginBottom: -bottomInset, paddingBottom: 6 + bottomInset }]}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const showBadge = tab.id === 'FRIENDS' && friendRequestsCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              activeOpacity={0.7}
              onPress={() => onSelectTab(tab.id)}
            >
              <View style={styles.iconContainer}>
                {tab.id === 'LEADERBOARD' ? (
                  <MaterialCommunityIcons
                    name="trophy-outline"
                    size={20}
                    color={isActive ? THEME.colors.primary : THEME.colors.textMuted}
                  />
                ) : (
                  <Feather
                    name={tab.icon}
                    size={20}
                    color={isActive ? THEME.colors.primary : THEME.colors.textMuted}
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
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activePill} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceContainer,
    paddingBottom: 6,
    paddingTop: 4,
    ...THEME.shadows.card,
  },
  navBar: {
    flexDirection: 'row',
    height: 54,
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  tabButtonActive: {},
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24,
  },
  // Single line, always: at ~360px each tab owns ~72px and "Leaderboard"
  // at 11sp overflows it, wraps to two lines and breaks the 54px row.
  // 10sp fits the longest label even bolded (active state); anything
  // narrower still degrades to a graceful ellipsis, never a wrap.
  tabLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 2,
    width: '100%',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  activePill: {
    position: 'absolute',
    bottom: 0,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: THEME.colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: THEME.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.onPrimary,
  },
  badgeText: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.onPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
});
