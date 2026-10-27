import { memo } from 'react';
import { View, type AccessibilityRole, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { THEME } from '../theme';

/**
 * One icon entry point for the whole app, backed by the @expo/vector-icons
 * library (Feather first, Material families only where Feather has no glyph).
 * No custom or hand-drawn icon art lives here.
 */
const FEATHER = `home user users user-plus cpu award star shield thumbs-up play pause play-circle flag target
crosshair globe layers zap sun moon droplet activity trending-up bar-chart-2 clock calendar wifi wifi-off cloud-off
alert-circle info check-circle check x slash chevron-down chevron-up chevron-left chevron-right chevrons-up
chevrons-left chevrons-right arrow-left arrow-right arrow-up more-vertical search settings sliders filter grid lock
log-out download external-link copy edit-2 trash-2 file-text list mail at-sign share share-2 plus-square smartphone
volume-2 rotate-ccw refresh-cw repeat shuffle`.split(/\s+/);

const MATERIAL_COMMUNITY = `account-remove robot-outline robot trophy-outline trophy crown thumb-up sword-cross
flag-checkered bullseye-arrow chart-bar timer-outline timer wall file-document-outline format-list-bulleted
plus-circle-outline message-text-outline cellphone-arrow-down undo-variant lightbulb-on-outline lightbulb-on
google-play`.split(/\s+/);

const MATERIAL = ['block', 'keyboard-arrow-down', 'more-vert'];

/** Semantic names that map onto a differently named library glyph. */
const ALIASES: Record<string, string> = { 'person-add': 'user-plus', orb: 'circle' };

export type OrbIconName = string;

export const ORB_ICON_NAMES: string[] = [
  ...FEATHER,
  ...MATERIAL_COMMUNITY,
  ...MATERIAL,
  ...Object.keys(ALIASES),
];

export interface OrbIconProps {
  name: OrbIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}

export const OrbIcon = memo(function OrbIcon({
  name,
  size = 22,
  color = THEME.colors.textPrimary,
  style,
  accessibilityRole,
  accessibilityLabel,
}: OrbIconProps) {
  const glyphName = ALIASES[name] ?? name;
  const iconStyle = accessibilityLabel ? undefined : style;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const glyph = MATERIAL_COMMUNITY.includes(glyphName) ? (
    <MaterialCommunityIcons name={glyphName as any} size={size} color={color} style={iconStyle} />
  ) : MATERIAL.includes(glyphName) ? (
    <MaterialIcons name={glyphName as any} size={size} color={color} style={iconStyle} />
  ) : (
    <Feather name={(FEATHER.includes(glyphName) || glyphName === 'circle' ? glyphName : 'circle') as any} size={size} color={color} style={iconStyle} />
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!accessibilityLabel) return glyph;
  return (
    <View
      accessible
      accessibilityRole={accessibilityRole ?? 'image'}
      accessibilityLabel={accessibilityLabel}
      style={style as StyleProp<ViewStyle>}
    >
      {glyph}
    </View>
  );
});
