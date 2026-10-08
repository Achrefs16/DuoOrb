import React, { useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { sheetSlideStyle, useSheetSlide } from './sheetAnimation';
import {
  LANGUAGES,
  setLanguage,
  useLanguage,
  useTranslation,
  type Language,
  type LanguageCode,
} from '../i18n';

interface LanguageSelectModalProps {
  visible: boolean;
  onClose: () => void;
  isFirstLaunch?: boolean;
  onConfirm?: (chosenCode: LanguageCode) => void;
}

export const LanguageSelectModal: React.FC<LanguageSelectModalProps> = ({
  visible,
  onClose,
  isFirstLaunch = false,
  onConfirm,
}) => {
  const styles = useStyles(createStyles);
  const currentCode = useLanguage();
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState<LanguageCode>(currentCode);
  const slide = useSheetSlide(visible);

  const handleSelect = async (code: LanguageCode) => {
    setSelectedCode(code);
    if (!isFirstLaunch) {
      await setLanguage(code);
      onClose();
    }
  };

  const handleContinue = async () => {
    await setLanguage(selectedCode);
    if (onConfirm) {
      onConfirm(selectedCode);
    } else {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={isFirstLaunch ? undefined : onClose}
          disabled={isFirstLaunch}
        />
        <Animated.View style={[styles.sheet, sheetSlideStyle(slide, 56)]}>
          <SafeAreaView edges={['bottom']} style={styles.sheetContent}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  {isFirstLaunch ? t('language.title') : t('language.sheetTitle')}
                </Text>
                <Text style={styles.subtitle}>
                  {t('language.subtitle')}
                </Text>
              </View>
              {!isFirstLaunch && (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('common.cancel')}
                >
                  <Feather name="x" size={18} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listBody}
              showsVerticalScrollIndicator={false}
            >
              {LANGUAGES.map((lang: Language) => {
                const isSelected = isFirstLaunch
                  ? selectedCode === lang.code
                  : currentCode === lang.code;

                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langRow,
                      isSelected && styles.langRowSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => void handleSelect(lang.code)}
                  >
                    <Text style={styles.flag}>{lang.flag}</Text>

                    <View style={styles.langMeta}>
                      <Text style={[styles.nativeName, isSelected && styles.nameSelected]}>
                        {lang.nativeName}
                      </Text>
                      {lang.englishName !== lang.nativeName && (
                        <Text style={styles.englishName}>{lang.englishName}</Text>
                      )}
                    </View>

                    {isSelected ? (
                      <View style={styles.checkCircle}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.radioOutline} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.noteBox}>
                <Feather name="info" size={13} color={THEME.colors.textMuted} />
                <Text style={styles.noteText}>
                  {t('language.restartNote')}
                </Text>
              </View>
            </ScrollView>

            {isFirstLaunch && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  activeOpacity={0.85}
                  onPress={() => void handleContinue()}
                >
                  <Text style={styles.continueBtnText}>{t('common.continue')}</Text>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    sheet: {
      backgroundColor: THEME.colors.backgroundCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      maxHeight: '88%',
      ...THEME.shadows.modal,
    },
    sheetContent: {
      paddingBottom: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: THEME.colors.outlineVariant,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 18,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    subtitle: {
      fontFamily: THEME.fonts.regular,
      fontSize: 12,
      color: THEME.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: THEME.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      maxHeight: 390,
      paddingHorizontal: 16,
    },
    listBody: {
      paddingVertical: 6,
      gap: 6,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    langRowSelected: {
      borderColor: THEME.colors.primary,
      backgroundColor: THEME.colors.surfacePrimaryTint,
    },
    flag: {
      fontSize: 24,
      marginRight: 12,
    },
    langMeta: {
      flex: 1,
      justifyContent: 'center',
    },
    nativeName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    nameSelected: {
      color: THEME.colors.primary,
    },
    englishName: {
      fontFamily: THEME.fonts.medium,
      fontSize: 11,
      color: THEME.colors.textSecondary,
      marginTop: 1,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: THEME.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOutline: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: THEME.colors.outlineVariant,
    },
    noteBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 8,
    },
    noteText: {
      fontFamily: THEME.fonts.regular,
      fontSize: 11,
      color: THEME.colors.textMuted,
      flex: 1,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    continueBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: THEME.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    continueBtnText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      color: '#FFFFFF',
    },
  });
