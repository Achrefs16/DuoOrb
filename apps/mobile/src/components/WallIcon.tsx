import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface WallIconProps {
  size?: number;
  color?: string;
}

/**
 * Tactical wall badge icon representing remaining walls in match HUD.
 */
export const WallIcon: React.FC<WallIconProps> = ({ size = 15, color }) => {
  return <MaterialCommunityIcons name="wall" size={size} color={color} />;
};
