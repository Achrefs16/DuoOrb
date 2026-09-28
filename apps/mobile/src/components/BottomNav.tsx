import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';

export type MainTab = 'PLAY' | 'FRIENDS' | 'HISTORY' | 'PROFILE';

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
    { id: 'HISTORY', label: 'History', icon: 'clock' },
    { id: 'PROFILE', label: 'Profile', icon: 'user' },
  ];

  return (
    <View style={styles.container}>
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
                <Feather
                  name={tab.icon}
                  size={20}
                  color={isActive ? THEME.colors.primary : THEME.colors.textMuted}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {friendRequestsCount > 9 ? '9+' : friendRequestsCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
  tabLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 2,
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
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
