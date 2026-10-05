import React, { memo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Premium member badge (MONETIZATION.md P5.2): a small gold crown rendered
 * next to display names. Fixed 13px box — callers render it only when the
 * row's `isPremium` is true, so non-premium rows never shift and late data
 * (match seats resolve from the frozen sync list) cannot move layout.
 */

export const PREMIUM_GOLD = '#D9A62E';

const PremiumBadgeInner: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <MaterialCommunityIcons
    name="crown"
    size={size}
    color={PREMIUM_GOLD}
    accessibilityRole="image"
    accessibilityLabel="Premium member"
  />
);

export const PremiumBadge = memo(PremiumBadgeInner);
