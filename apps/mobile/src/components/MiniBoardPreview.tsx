import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type MiniBoardPreset =
  | 'online1v1'
  | 'botMatch'
  | 'friendsRoom'
  | 'local4p'
  | 'historyReview';

interface MiniBoardPreviewProps {
  preset: MiniBoardPreset;
  size?: number;
}

const PRESET_IMAGES: Record<MiniBoardPreset, ImageSourcePropType> = {
  online1v1: require('../../assets/boards/board_online.png'),
  botMatch: require('../../assets/boards/board_bot.png'),
  friendsRoom: require('../../assets/boards/board_friends.png'),
  local4p: require('../../assets/boards/board_passplay.png'),
  historyReview: require('../../assets/boards/board_bot.png'),
};

export const MiniBoardPreview: React.FC<MiniBoardPreviewProps> = ({
  preset,
  size = 112,
}) => {
  const source = PRESET_IMAGES[preset];

  return (
    <View style={[styles.frameContainer, { width: size, height: size }]}>
      {/* Board Image */}
      <Image
        source={source}
        style={styles.boardImage}
        resizeMode="cover"
        accessibilityRole="image"
      />

      {/* Diagonal Glossy Glass Reflection */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.48)',
          'rgba(255, 255, 255, 0.18)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(0, 0, 0, 0.04)',
        ]}
        locations={[0, 0.28, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.95 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top-Edge Specular Glass Lip Highlight */}
      <View style={styles.specularTopLine} pointerEvents="none" />

      {/* Inner Bevel Ring (Light top/left highlight, subtle bottom/right depth) */}
      <View style={styles.innerBevelRing} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  frameContainer: {
    padding: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E8E5DC',
    // 3D tactile frame border matching the Tactical 3D board theme:
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderRightColor: '#D0CCC0',
    borderBottomColor: '#B8B3A4',
    borderBottomWidth: 3, // 3D bevel depth
  },
  boardImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  specularTopLine: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  innerBevelRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    borderLeftColor: 'rgba(255, 255, 255, 0.40)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    borderBottomColor: 'rgba(0, 0, 0, 0.14)',
  },
});
