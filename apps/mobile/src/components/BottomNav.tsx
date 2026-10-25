import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';

export type MainTab = 'PLAY' | 'BOTS' | 'FRIENDS' | 'LEADERBOARD' | 'PROFILE';

export const BOTTOM_NAV_HEIGHT = 58;

interface BottomNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  friendRequestsCount?: number;
}

interface TabItem {
  id: MainTab;
  label: string;
  featherIcon?: keyof typeof Feather.glyphMap;
  mciIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  friendRequestsCount = 0,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  const tabs: TabItem[] = [
    { id: 'PLAY', label: t('nav.play') || 'Home', featherIcon: 'home' },
    { id: 'BOTS', label: 'Bots', mciIcon: 'robot-outline' },
    { id: 'FRIENDS', label: t('nav.friends') || 'Friends', featherIcon: 'users' },
    { id: 'LEADERBOARD', label: t('nav.leaderboard') || 'Leaderboard', mciIcon: 'trophy-outline' },
    { id: 'PROFILE', label: t('nav.profile') || 'Profile', featherIcon: 'user' },
  ];

  return (
    <View style={[styles.dockedBar, { paddingBottom: bottomInset, height: BOTTOM_NAV_HEIGHT + bottomInset }]}>
      <View style={styles.tabBarInner}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const showBadge = tab.id === 'FRIENDS' && friendRequestsCount > 0;
          const iconColor = isActive ? THEME.colors.primary : THEME.colors.textMuted;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onSelectTab(tab.id)}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconWrapper}>
                {tab.featherIcon ? (
                  <Feather name={tab.featherIcon} size={22} color={iconColor} />
                ) : tab.mciIcon ? (
                  <MaterialCommunityIcons name={tab.mciIcon} size={22} color={iconColor} />
                ) : null}

                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {friendRequestsCount > 9 ? '9+' : friendRequestsCount}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  { color: iconColor },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    dockedBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: THEME.colors.background,
      borderTopWidth: 0,
      justifyContent: 'center',
      zIndex: 20,
    },
    tabBarInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      maxWidth: 580,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 8,
    },
    tabButton: {
      flex: 1,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
    },
    iconWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 26,
    },
    tabLabel: {
      fontFamily: THEME.fonts.medium,
      fontSize: 10.5,
      letterSpacing: 0.1,
      marginTop: 2,
    },
    tabLabelActive: {
      fontFamily: THEME.fonts.bold,
      fontWeight: '700',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -8,
      backgroundColor: THEME.colors.danger,
      borderRadius: 9,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 3.5,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: THEME.colors.backgroundCard,
    },
    badgeText: {
      fontFamily: THEME.fonts.extraBold,
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
    },
  });
