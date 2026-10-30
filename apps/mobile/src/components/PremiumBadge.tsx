import React, { memo } from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';

const DIAMOND_IMG = require('../../assets/dimand.png');

/**
 * Premium member badge: small diamond image rendered next to display names
 * (matching chess.com diamond membership). Callers render it when `isPremium`
 * is true.
 */
export const PREMIUM_GOLD = '#D9A62E';

const SIZE_MAP: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
};

export interface PremiumBadgeProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ImageStyle>;
}

const PremiumBadgeInner: React.FC<PremiumBadgeProps> = ({ size = 16, style }) => {
  const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 16);
  return (
    <Image
      source={DIAMOND_IMG}
      style={[
        {
          width: pixelSize,
          height: pixelSize,
        },
        style,
      ]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Premium member"
    />
  );
};

export const PremiumBadge = memo(PremiumBadgeInner);
