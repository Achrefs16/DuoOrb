import React, { memo } from 'react';
import { OrbIcon } from './OrbIcon';
/**
 * Premium member badge (MONETIZATION.md P5.2): a small gold crown rendered
 * next to display names. Fixed 13px box — callers render it only when the
 * row's `isPremium` is true, so non-premium rows never shift and late data
 * (match seats resolve from the frozen sync list) cannot move layout.
 */

export const PREMIUM_GOLD = '#D9A62E';

const SIZE_MAP: Record<string, number> = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
};

const PremiumBadgeInner: React.FC<{ size?: number | 'xs' | 'sm' | 'md' | 'lg' }> = ({ size = 13 }) => {
  const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 13);
  return (
    <OrbIcon
      name="crown"
      size={pixelSize}
      color={PREMIUM_GOLD}
      accessibilityRole="image"
      accessibilityLabel="Premium member"
    />
  );
};

export const PremiumBadge = memo(PremiumBadgeInner);
