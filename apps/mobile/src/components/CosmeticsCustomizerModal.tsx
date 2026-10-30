import React from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from './OrbIcon';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { sheetSlideStyle, useSheetSlide } from './sheetAnimation';
import {
  COSMETIC_SKIN_LIST,
  useBallSkinId,
  useWallSkinId,
} from '../theme/cosmeticsCatalog';
import { api } from '../network/apiClient';

interface CosmeticsCustomizerModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenPremium?: () => void;
  onEquipBall: (skinId: string) => void;
  onEquipWall: (skinId: string) => void;
  initialCategory?: 'ball' | 'wall' | null;
  category?: 'ball' | 'wall' | null;
}

export const CosmeticsCustomizerModal: React.FC<CosmeticsCustomizerModalProps> = ({
  visible,
  onClose,
  onEquipBall,
  onEquipWall,
  initialCategory,
  category,
}) => {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const slide = useSheetSlide(visible);

  const equippedBallId = useBallSkinId();
  const equippedWallId = useWallSkinId();

  if (!visible) return null;

  const activeCategory: 'ball' | 'wall' = category ?? initialCategory ?? 'ball';
  const isBall = activeCategory === 'ball';
  const currentEquippedId = isBall ? equippedBallId : equippedWallId;

  const handleSkinTap = (skinId: string) => {
    if (isBall) {
      onEquipBall(skinId);
    } else {
      onEquipWall(skinId);
    }
    if (skinId !== 'classic') {
      void api.claimAchievement('cosmetic-custom').catch(() => {});
    }
  };

  const isClassicEquipped = currentEquippedId === 'classic';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
          <Animated.View style={[styles.card, sheetSlideStyle(slide)]}>
            {/* Grab Handle */}
            <View style={styles.handle} />

            {/* Header: Clean title + normal close X icon (no circle buttons or icons) */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {isBall ? 'Choose Ball Skin' : 'Choose Wall Skin'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <OrbIcon name="x" size={24} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Single Catalog Grid — Pure Items without Cards */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[
                isBall ? styles.ballGridContent : styles.wallGridContent,
                { paddingBottom: insets.bottom + 28 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Option 1: Classic Default */}
              <TouchableOpacity
                style={isBall ? styles.ballItemSlot : styles.wallItemSlot}
                activeOpacity={0.7}
                onPress={() => handleSkinTap('classic')}
              >
                <View
                  style={[
                    isBall ? styles.ballPreviewWrap : styles.wallPreviewWrap,
                    isClassicEquipped &&
                      (isBall ? styles.ballPreviewSelected : styles.wallPreviewSelected),
                  ]}
                >
                  {isBall ? (
                    <View style={styles.classicOrb} />
                  ) : (
                    <View style={styles.classicWallWrap}>
                      <View style={styles.classicWallBarBlue} />
                      <View style={styles.classicWallBarRed} />
                    </View>
                  )}
                </View>

                <Text
                  style={[styles.itemTitle, isClassicEquipped && styles.itemTitleSelected]}
                  numberOfLines={1}
                >
                  Classic
                </Text>
                {isClassicEquipped && <Text style={styles.equippedLabel}>Equipped</Text>}
              </TouchableOpacity>

              {/* All 16 Skins */}
              {COSMETIC_SKIN_LIST.map((skin) => {
                const isEquipped = currentEquippedId === skin.id;

                return (
                  <TouchableOpacity
                    key={skin.id}
                    style={isBall ? styles.ballItemSlot : styles.wallItemSlot}
                    activeOpacity={0.7}
                    onPress={() => handleSkinTap(skin.id)}
                  >
                    <View
                      style={[
                        isBall ? styles.ballPreviewWrap : styles.wallPreviewWrap,
                        isEquipped &&
                          (isBall ? styles.ballPreviewSelected : styles.wallPreviewSelected),
                      ]}
                    >
                      {isBall ? (
                        <Image
                          source={skin.assets.orb}
                          style={styles.orbImg}
                          resizeMode="contain"
                        />
                      ) : (
                        <Image
                          source={skin.assets.wallTray}
                          style={styles.wallImg}
                          resizeMode="contain"
                        />
                      )}
                    </View>

                    <Text
                      style={[styles.itemTitle, isEquipped && styles.itemTitleSelected]}
                      numberOfLines={1}
                    >
                      {skin.name}
                    </Text>
                    {isEquipped && <Text style={styles.equippedLabel}>Equipped</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: THEME.colors.modalBackdrop,
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      justifyContent: 'flex-end',
      maxHeight: Dimensions.get('window').height * 0.88,
    },
    card: {
      backgroundColor: THEME.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '100%',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: THEME.colors.surfaceHairline,
      alignSelf: 'center',
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    title: {
      fontFamily: THEME.fonts.bold,
      fontSize: 20,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    closeBtn: {
      padding: 4,
    },
    scrollArea: {
      maxHeight: Dimensions.get('window').height * 0.72,
    },
    // Balls: 3 columns of pure tokens without card boxes
    ballGridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      justifyContent: 'flex-start',
    },
    ballItemSlot: {
      width: '30%',
      alignItems: 'center',
      marginBottom: 16,
    },
    ballPreviewWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
      borderWidth: 2.5,
      borderColor: 'transparent',
      marginBottom: 6,
    },
    ballPreviewSelected: {
      borderColor: THEME.colors.primary,
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
    },
    orbImg: {
      width: 60,
      height: 60,
    },
    classicOrb: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#2563EB',
      borderWidth: 2,
      borderColor: '#60A5FA',
      borderBottomWidth: 3.5,
      borderBottomColor: '#1D4ED8',
    },
    // Walls: 2 columns of pure wall bars without card boxes
    wallGridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
    },
    wallItemSlot: {
      width: '47%',
      alignItems: 'center',
      marginBottom: 16,
    },
    wallPreviewWrap: {
      width: '100%',
      height: 54,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      borderWidth: 2,
      borderColor: 'transparent',
      marginBottom: 6,
    },
    wallPreviewSelected: {
      borderColor: THEME.colors.primary,
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
    },
    wallImg: {
      width: '92%',
      height: 34,
    },
    classicWallWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
    },
    classicWallBarBlue: {
      width: 44,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#2563EB',
    },
    classicWallBarRed: {
      width: 44,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#DC2626',
    },
    itemTitle: {
      fontFamily: THEME.fonts.medium,
      fontSize: 12,
      color: THEME.colors.textPrimary,
      textAlign: 'center',
    },
    itemTitleSelected: {
      fontFamily: THEME.fonts.bold,
      fontWeight: '700',
      color: THEME.colors.primary,
    },
    equippedLabel: {
      fontFamily: THEME.fonts.semiBold,
      fontSize: 10,
      fontWeight: '600',
      color: THEME.colors.primary,
      marginTop: 2,
    },
  });
