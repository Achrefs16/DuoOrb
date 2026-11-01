import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, useStyles, type Theme } from '../theme';
import { OrbIcon } from './OrbIcon';
import {
  openStoreUpdate,
  type AppVersionConfig,
  type VersionGateStatus,
} from '../network/versionGate';

export interface UpdateModalProps {
  visible: boolean;
  status: VersionGateStatus;
  config: AppVersionConfig | null;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  status,
  config,
  onDismiss,
}) => {
  const theme = useTheme();
  const styles = useStyles(() => createStyles(theme));
  const isForced = status === 'forced';

  // Smooth entry animation (scale + opacity)
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(animValue, {
        toValue: 1,
        damping: 18,
        stiffness: 220,
        useNativeDriver: true,
      }).start();
    } else {
      animValue.setValue(0);
    }
  }, [visible, animValue]);

  // Trap Android hardware back button during forced update
  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      if (isForced) {
        // Trapped: user cannot exit forced update modal
        return true;
      }
      onDismiss();
      return true;
    };

    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => sub.remove();
  }, [visible, isForced, onDismiss]);

  if (!visible || status === 'none' || !config) {
    return null;
  }

  const handleUpdatePress = () => {
    openStoreUpdate(config.storeUrl, config.webStoreUrl);
  };

  const title = isForced
    ? 'Update Required'
    : config.title || "What's New in DuoOrb";

  const description = isForced
    ? config.forceMessage ||
      'A critical update is required to continue playing DuoOrb online.'
    : config.message ||
      `Version ${config.latestVersion} is now available with new improvements!`;

  const releaseNotes = config.releaseNotes?.slice(0, 4) || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={isForced ? () => {} : onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: animValue,
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header Icon / Badge */}
          <View
            style={[
              styles.iconBubble,
              isForced ? styles.forcedIconBubble : styles.optionalIconBubble,
            ]}
          >
            <OrbIcon
              name={isForced ? 'alert-circle' : 'refresh-cw'}
              size={30}
              color={isForced ? theme.colors.secondary : theme.colors.primary}
            />
          </View>

          {/* Pill Badge */}
          <View
            style={[
              styles.pillBadge,
              isForced ? styles.forcedPillBadge : styles.optionalPillBadge,
            ]}
          >
            <Text
              style={[
                styles.pillBadgeText,
                isForced ? styles.forcedPillText : styles.optionalPillText,
              ]}
            >
              {isForced ? 'CRITICAL UPDATE' : `VERSION ${config.latestVersion}`}
            </Text>
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {/* Feature Highlights / Notes (if available) */}
          {releaseNotes.length > 0 && (
            <View style={styles.notesContainer}>
              {releaseNotes.map((note, index) => (
                <View key={index} style={styles.noteRow}>
                  <View style={styles.noteDot}>
                    <OrbIcon
                      name="check"
                      size={12}
                      color={
                        isForced ? theme.colors.secondary : theme.colors.primary
                      }
                    />
                  </View>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Primary Action Button (Tactile 3D Green) */}
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={handleUpdatePress}
            accessibilityRole="button"
            accessibilityLabel="Update on Google Play"
          >
            <OrbIcon name="google-play" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Update on Google Play</Text>
          </TouchableOpacity>

          {/* Secondary Action: Remind Me Later (Optional Mode Only) */}
          {!isForced && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.7}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Remind me later"
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.secondaryBtnText}>Remind Me Later</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

function createStyles(theme: Theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.modalBackdrop,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      maxWidth: 390,
      backgroundColor: theme.colors.background,
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 20,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceHairline,
      // Shadow / elevation
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.45 : 0.18,
      shadowRadius: 20,
      elevation: 12,
    },
    iconBubble: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    optionalIconBubble: {
      backgroundColor: theme.colors.surfacePrimaryTint,
      borderWidth: 1.5,
      borderColor: theme.colors.surfacePrimaryTintBorder,
    },
    forcedIconBubble: {
      backgroundColor: theme.colors.secondaryContainer,
      borderWidth: 1.5,
      borderColor: theme.colors.secondaryBorder,
    },
    pillBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 10,
    },
    optionalPillBadge: {
      backgroundColor: theme.colors.surfacePrimaryTint,
    },
    forcedPillBadge: {
      backgroundColor: theme.colors.secondaryContainer,
    },
    pillBadgeText: {
      fontFamily: theme.fonts.bold,
      fontSize: 11,
      letterSpacing: 0.8,
    },
    optionalPillText: {
      color: theme.colors.primary,
    },
    forcedPillText: {
      color: theme.colors.secondary,
    },
    title: {
      fontFamily: theme.fonts.bold,
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.2,
    },
    description: {
      fontFamily: theme.fonts.medium,
      fontSize: 13.5,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    notesContainer: {
      width: '100%',
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceHairline,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 18,
      gap: 8,
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    noteDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.surfaceHairline,
    },
    noteText: {
      flex: 1,
      fontFamily: theme.fonts.medium,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textPrimary,
    },
    // DuoOrb Signature Tactile 3D Button
    primaryBtn: {
      width: '100%',
      height: 52,
      backgroundColor: theme.colors.primary,
      borderBottomWidth: 3.5,
      borderBottomColor: theme.colors.primaryBevel,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 6,
    },
    primaryBtnText: {
      fontFamily: theme.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    secondaryBtn: {
      width: '100%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      fontFamily: theme.fonts.semiBold,
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });
}

