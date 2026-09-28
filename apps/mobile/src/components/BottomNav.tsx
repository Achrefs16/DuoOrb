import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { MeshGradient } from './MeshGradient';

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

const TABS: TabItem[] = [
  { id: 'PLAY', label: 'Play', icon: 'grid' },
  { id: 'FRIENDS', label: 'Friends', icon: 'users' },
  { id: 'HISTORY', label: 'History', icon: 'clock' },
  { id: 'PROFILE', label: 'Profile', icon: 'user' },
];

/** Nav bar height, excluding the safe-area inset applied by the parent. */
const BAR_HEIGHT = 64;
/** The mesh field is taller than the bar so the gradient has room to breathe. */
const MESH_HEIGHT = 96;
/** "10% white" glass, per the spec. */
const GLASS_TINT = 'rgba(255, 255, 255, 0.10)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.55)';
/** Top inner highlight: the "border reflection" on the glass. */
const GLASS_SHEEN = 'rgba(255, 255, 255, 0.45)';

/**
 * Floating glass navigation bar over a mesh gradient.
 *
 * Structure: the mesh sits behind everything as an absolutely positioned
 * field, the glass bar floats above it with horizontal insets so the gradient
 * shows through on both sides, and the safe-area inset is applied to the
 * wrapper so the bar never sits under the home indicator.
 *
 * The blur uses the native Dimezis implementation on Android, which is the one
 * prop that decides whether this bar looks like glass or like flat plastic —
 * see the note on the BlurView below.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  friendRequestsCount = 0,
}) => {
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <MeshGradient height={MESH_HEIGHT} fadeToAppBackground={THEME.colors.background} />

      <View style={styles.barArea} pointerEvents="box-none">
        <View style={styles.shadowLayer} pointerEvents="none" />
        <View style={styles.glass}>
          {/* Blur layer: the actual frosted glass.

              `blurMethod` is the load-bearing prop here. expo-blur DEFAULTS it
              to 'none' on Android, which renders a plain translucent view with
              no blur at all — the exact opposite of a glass bar. Passing the
              Dimezis method explicitly is what actually blurs; the
              ...Sdk31Plus variant degrades to 'none' below Android 12 rather
              than stuttering, and the tint above keeps the bar separated
              from the mesh even when that happens. */}
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={20}
            tint="light"
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={4}
          />
          {/* 10% white tint over the blur. */}
          <View style={styles.tint} pointerEvents="none" />
          {/* Ultra-thin crisp border + top sheen (the "reflection"). */}
          <View style={styles.border} pointerEvents="none" />
          <View style={styles.sheen} pointerEvents="none" />

          <View style={styles.navBar}>
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              const showBadge = tab.id === 'FRIENDS' && friendRequestsCount > 0;

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tabButton}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={tab.label}
                  onPress={() => onSelectTab(tab.id)}
                >
                  {isActive && (
                    <View style={styles.activeGlow} pointerEvents="none" />
                  )}
                  <View style={styles.iconContainer}>
                    <Feather
                      name={tab.icon}
                      size={21}
                      color={isActive ? '#FFFFFF' : 'rgba(31, 41, 55, 0.62)'}
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    // No background: the mesh is the background. No bottom padding either —
    // the app's SafeAreaView already owns the home-indicator inset
    // (App.tsx, edges={['top','bottom']}), and adding it here too would stack
    // the two and leave the bar floating too high.
  },
  barArea: {
    paddingHorizontal: 16,
  },
  // A dedicated shadow layer sits BEHIND the glass. The glass itself needs
  // `overflow: hidden` to clip the blur and tint to its rounded corners, and
  // that clips a shadow applied to the same view — so the lift lives here
  // instead, inset only horizontally to match the bar.
  shadowLayer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 6,
    height: BAR_HEIGHT,
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
  glass: {
    height: BAR_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GLASS_TINT,
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: GLASS_BORDER,
  },
  // A short bright band along the top inner edge reads as a light catching a
  // curved glass surface. Two stops: solid at the very top, gone by 40%.
  sheen: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: GLASS_SHEEN,
  },
  navBar: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  // Soft primary bloom behind the active icon; keeps the white glyph readable
  // without a solid filled chip, which would kill the glass effect.
  activeGlow: {
    position: 'absolute',
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.30)',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 26,
  },
  tabLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(31, 41, 55, 0.58)',
    marginTop: 3,
  },
  tabLabelActive: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
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
