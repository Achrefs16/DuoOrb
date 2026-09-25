import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
  Platform,
} from 'react-native';
import { FONTS } from '../theme';

export type TextWeight = 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold';

export interface AppTextProps extends RNTextProps {
  weight?: TextWeight;
}

export function resolveManropeFont(weight?: string | number | TextWeight): string {
  if (!weight) return FONTS.regular;
  const w = String(weight).toLowerCase();
  if (w === '800' || w === '900' || w === 'extrabold' || w === 'heavy') {
    return FONTS.extraBold;
  }
  if (w === '700' || w === 'bold') {
    return FONTS.bold;
  }
  if (w === '600' || w === 'semibold') {
    return FONTS.semiBold;
  }
  if (w === '500' || w === 'medium') {
    return FONTS.medium;
  }
  return FONTS.regular;
}

/**
 * Universal DuoOrb Text component backed by Manrope.
 * Automatically resolves font family based on fontWeight, or explicit weight prop.
 */
export const AppText: React.FC<AppTextProps> = ({ style, weight, children, ...rest }) => {
  const flattened = (StyleSheet.flatten(style) || {}) as TextStyle;
  const targetWeight = weight || flattened.fontWeight;
  const resolvedFont = flattened.fontFamily || resolveManropeFont(targetWeight);

  // On Android, keeping both fontFamily with embedded weight and fontWeight can cause fallback to Roboto.
  // We keep fontWeight on iOS/Web or clean it up if needed.
  const resolvedStyle: TextStyle = {
    fontFamily: resolvedFont,
    ...flattened,
    // Ensure fontFamily is not overridden back to system
    ...(flattened.fontFamily ? {} : { fontFamily: resolvedFont }),
  };

  if (Platform.OS === 'android' && !flattened.fontFamily) {
    // When using custom Expo font on Android, remove conflicting fontWeight string
    delete resolvedStyle.fontWeight;
  }

  return (
    <RNText {...rest} style={resolvedStyle}>
      {children}
    </RNText>
  );
};

export default AppText;
