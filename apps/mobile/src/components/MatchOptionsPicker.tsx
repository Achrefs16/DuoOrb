import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, useStyles } from '../theme';
import {
  NO_TIMER_CONTROL,
  TimeControl,
  getTimeControl,
} from '../timeControls';

export type MatchModeChoice = 'classic' | 'center' | 'race';
export type PlayerCountChoice = 2 | 3 | 4;
export type WallsChoice = 10 | 15 | 99;

export interface OptionTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
  styles: any;
}

export const OptionTile: React.FC<OptionTileProps> = ({
  label,
  selected,
  onPress,
  fullWidth,
  styles,
}) => (
  <TouchableOpacity
    style={[
      styles.unifiedTile,
      fullWidth && styles.unifiedTileFull,
      selected ? styles.unifiedTileSelected : styles.unifiedTileUnselected,
    ]}
    activeOpacity={0.75}
    onPress={onPress}
  >
    <Text
      style={[
        styles.unifiedTileText,
        selected ? styles.unifiedTileTextSelected : styles.unifiedTileTextUnselected,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export interface MatchOptionsPickerProps {
  mode: MatchModeChoice;
  onModeChange: (mode: MatchModeChoice) => void;
  playerCount: PlayerCountChoice;
  onPlayerCountChange: (count: PlayerCountChoice) => void;
  walls: WallsChoice;
  onWallsChange: (walls: WallsChoice) => void;
  clock: TimeControl;
  onClockChange: (clock: TimeControl) => void;
  style?: object;
}

export const MatchOptionsPicker: React.FC<MatchOptionsPickerProps> = ({
  mode,
  onModeChange,
  playerCount,
  onPlayerCountChange,
  walls,
  onWallsChange,
  clock,
  onClockChange,
  style,
}) => {
  const styles = useStyles(createStyles);

  return (
    <View style={[styles.container, style]}>
      {/* 1. Match Mode */}
      <View style={styles.optionsSection}>
        <View style={styles.optionCatHeader}>
          <MaterialCommunityIcons
            name="sword-cross"
            size={18}
            color="#3B82F6"
          />
          <Text style={styles.optionCatTitle}>Match Mode</Text>
        </View>
        <View style={styles.threeColGrid}>
          {(
            [
              { id: 'classic', label: 'Classic 1v1' },
              { id: 'center', label: 'Center Rush' },
              { id: 'race', label: 'Race' },
            ] as const
          ).map((m) => (
            <OptionTile
              key={m.id}
              label={m.label}
              selected={mode === m.id}
              onPress={() => onModeChange(m.id)}
              styles={styles}
            />
          ))}
        </View>
      </View>

      {/* 2. Player Count (when mode is not classic) */}
      {mode !== 'classic' && (
        <View style={styles.optionsSection}>
          <View style={styles.optionCatHeader}>
            <Feather name="users" size={17} color="#3B82F6" />
            <Text style={styles.optionCatTitle}>Player Count</Text>
          </View>
          <View style={styles.threeColGrid}>
            {([2, 3, 4] as const).map((cnt) => (
              <OptionTile
                key={cnt}
                label={`${cnt} Players`}
                selected={playerCount === cnt}
                onPress={() => onPlayerCountChange(cnt)}
                styles={styles}
              />
            ))}
          </View>
        </View>
      )}

      {/* 3. Walls */}
      <View style={styles.optionsSection}>
        <View style={styles.optionCatHeader}>
          <MaterialCommunityIcons
            name="wall"
            size={18}
            color="#A855F7"
          />
          <Text style={styles.optionCatTitle}>Walls</Text>
        </View>
        <View style={styles.threeColGrid}>
          {(
            [
              { val: 10, label: '10 Walls' },
              { val: 15, label: '15 Walls' },
              { val: 99, label: 'Unlimited' },
            ] as const
          ).map((w) => (
            <OptionTile
              key={w.val}
              label={w.label}
              selected={walls === w.val}
              onPress={() => onWallsChange(w.val)}
              styles={styles}
            />
          ))}
        </View>
      </View>

      {/* 4. Time Controls */}
      {/* Bullet */}
      <View style={styles.optionsSection}>
        <View style={styles.optionCatHeader}>
          <Feather name="zap" size={15} color="#EAB308" />
          <Text style={styles.optionCatTitle}>Bullet</Text>
        </View>
        <View style={styles.twoColGrid}>
          <OptionTile
            label="1 min"
            selected={clock.id === 'bullet-1-0'}
            onPress={() => onClockChange(getTimeControl('bullet-1-0'))}
            styles={styles}
          />
          <OptionTile
            label="1 + 1"
            selected={clock.id === 'bullet-1-1'}
            onPress={() => onClockChange(getTimeControl('bullet-1-1'))}
            styles={styles}
          />
        </View>
      </View>

      {/* Rapid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionCatHeader}>
          <Feather name="clock" size={15} color={THEME.colors.primary} />
          <Text style={styles.optionCatTitle}>Rapid</Text>
        </View>
        <View style={styles.twoColGrid}>
          <OptionTile
            label="3 min"
            selected={clock.id === 'rapid-3-0'}
            onPress={() => onClockChange(getTimeControl('rapid-3-0'))}
            styles={styles}
          />
          <OptionTile
            label="5 min"
            selected={clock.id === 'rapid-5-0'}
            onPress={() => onClockChange(getTimeControl('rapid-5-0'))}
            styles={styles}
          />
        </View>
      </View>

      {/* No Timer at the bottom */}
      <OptionTile
        fullWidth
        label="No Timer"
        selected={clock.id === 'no-timer'}
        onPress={() => onClockChange(NO_TIMER_CONTROL)}
        styles={styles}
      />
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      gap: 10,
      width: '100%',
    },
    optionsSection: {
      gap: 6,
    },
    optionCatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    optionCatTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 12.5,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    twoColGrid: {
      flexDirection: 'row',
      gap: 6,
    },
    threeColGrid: {
      flexDirection: 'row',
      gap: 6,
    },
    unifiedTile: {
      flex: 1,
      minHeight: 38,
      height: 38,
      borderRadius: 8,
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    unifiedTileFull: {
      flex: 0,
      width: '100%',
      minHeight: 40,
      height: 40,
      marginBottom: 2,
    },
    unifiedTileUnselected: {
      backgroundColor: THEME.colors.surfaceMuted,
      borderColor: 'transparent',
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
    },
    unifiedTileSelected: {
      backgroundColor: THEME.colors.surfaceMuted,
      borderColor: THEME.colors.primary,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.primaryBevel,
    },
    unifiedTileText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      textAlign: 'center',
      color: THEME.colors.textPrimary,
    },
    unifiedTileTextUnselected: {
      color: THEME.colors.textPrimary,
      fontWeight: '700',
    },
    unifiedTileTextSelected: {
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
  });
