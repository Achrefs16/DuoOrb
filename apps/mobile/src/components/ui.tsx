import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

/**
 * Shared shells for the two overlays that are built from the same parts.
 *
 * ChallengeToast and RoomInviteToast each declared their own absolutely
 * positioned wrapper, a white card with a hairline border and the modal
 * shadow, an Accept button and a Decline button — identical design, written
 * twice. Their padding and corner radius genuinely differ (14/16 vs 12/12), so
 * those stay caller-supplied; everything that was copy-paste is here.
 *
 * No visual change: every value below is what those files already used.
 */

/** Absolutely positioned overlay container. `top` is for the top toast. */
export const ToastOverlay: React.FC<{
  top?: number;
  bottom?: number;
  children: React.ReactNode;
}> = ({ top, bottom, children }) => (
  <View
    style={[styles.overlay, top !== undefined && { top }, bottom !== undefined && { bottom }]}
    pointerEvents="box-none"
  >
    {children}
  </View>
);

/**
 * The white toast card: hairline border, modal shadow, filled background.
 * `radius` and `padding` are per-toast because they differ.
 */
export const ToastCard: React.FC<{
  radius: number;
  padding: number;
  borderColor: string;
  style?: object;
  children: React.ReactNode;
}> = ({ radius, padding, borderColor, style, children }) => (
  <View
    style={[
      styles.card,
      { borderRadius: radius, padding, borderColor },
      style,
    ]}
  >
    {children}
  </View>
);

/**
 * Spring-in wrapper. Both toasts used the same spring (friction 9, tension
 * 70) and the same rise-and-scale-in; it was declared twice.
 */
export const ToastAnimatedCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        styles.cardFill,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/** Filled primary action inside a toast. */
export const ToastAccept: React.FC<{
  label: string;
  onPress: () => void;
  flex?: boolean;
  icon?: React.ReactNode;
}> = ({ label, onPress, flex, icon }) => (
  <TouchableOpacity
    style={[styles.accept, flex && styles.flex]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    {icon}
    <Text style={styles.acceptLabel}>{label}</Text>
  </TouchableOpacity>
);

/** Muted secondary action inside a toast. */
export const ToastDecline: React.FC<{
  label: string;
  onPress: () => void;
  compact?: boolean;
}> = ({ label, onPress, compact }) => (
  <TouchableOpacity
    style={[styles.decline, compact && styles.declineCompact]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.declineLabel, compact && styles.declineLabelCompact]}>{label}</Text>
  </TouchableOpacity>
);

/** Transient one-line notice: dark pill, no actions. */
export const ToastNotice: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.notice}>
    <Text style={styles.noticeText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    // zIndex alone does not win on Android — the wrap needs real elevation
    // so the toast paints above inputs and other elevated siblings.
    elevation: 30,
  },
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    ...THEME.shadows.modal,
  },
  cardFill: {
    width: '100%',
  },
  accept: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.brandLime,
    borderRadius: THEME.controls.radius,
    paddingVertical: THEME.controls.paddingVertical,
  },
  flex: { flex: 1 },
  acceptLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: THEME.controls.fontSize,
    fontWeight: '700',
    color: THEME.colors.onBrandLime,
  },
  decline: {
    paddingHorizontal: 18,
    paddingVertical: THEME.controls.paddingVertical,
    borderRadius: THEME.controls.radius,
    backgroundColor: THEME.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineCompact: {
    paddingHorizontal: 9,
    paddingVertical: THEME.controls.paddingVerticalCompact,
    borderRadius: THEME.controls.radiusCompact,
  },
  declineLabel: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: THEME.controls.fontSize,
    fontWeight: '600',
    color: THEME.colors.textOnMuted,
  },
  declineLabelCompact: {
    fontSize: THEME.controls.fontSizeCompact,
    color: THEME.colors.textSecondaryStrong,
  },
  notice: {
    backgroundColor: THEME.colors.inverseLabel,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noticeText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onPrimary,
  },
});
