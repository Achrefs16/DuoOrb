import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { LEGAL_DOCS, LEGAL_DEVELOPER, type LegalKind } from '../legal-content';
import { LEGAL_CONTACT_EMAIL, LEGAL_URLS, openLegalUrl } from '../legal';

interface LegalScreenProps {
  kind: LegalKind;
  onBack: () => void;
}

/**
 * Native in-app legal reader (offline-capable).
 *
 * Play requires the policy to be reachable INSIDE the app, not only in an
 * external browser. Settings opens this screen; the "Open web version"
 * button exposes the canonical https:// URL (same text) for sharing and
 * for the Play Console listing.
 */
export const LegalScreen: React.FC<LegalScreenProps> = ({ kind, onBack }) => {
  const doc = LEGAL_DOCS[kind];
  const webUrl =
    kind === 'privacy' ? LEGAL_URLS.privacy : kind === 'terms' ? LEGAL_URLS.terms : LEGAL_URLS.deleteAccount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={THEME.colors.slate[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{doc.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>
          {doc.updated} · {LEGAL_DEVELOPER}
        </Text>
        <Text style={styles.intro}>{doc.intro}</Text>

        {doc.sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.paragraph}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.webCard}>
          <Text style={styles.webTitle}>Web version (Play listing URL)</Text>
          <Text style={styles.webUrl} numberOfLines={2}>
            {webUrl}
          </Text>
          <TouchableOpacity
            style={styles.webButton}
            onPress={() => void openLegalUrl(webUrl)}
            accessibilityLabel="Open web version"
          >
            <Feather name="external-link" size={14} color={THEME.colors.onPrimary} />
            <Text style={styles.webButtonText}>Open web version</Text>
          </TouchableOpacity>
          <Text style={styles.supportText}>Support: {LEGAL_CONTACT_EMAIL}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: THEME.fonts.bold, fontSize: 17, fontWeight: '700', color: THEME.colors.onSurface },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  updated: { fontFamily: THEME.fonts.medium, fontSize: 12, color: THEME.colors.textMuted, marginBottom: 8 },
  intro: { fontFamily: THEME.fonts.regular, fontSize: 14, lineHeight: 20, color: THEME.colors.textPrimary, marginBottom: 8 },
  section: { marginTop: 16 },
  heading: { fontFamily: THEME.fonts.bold, fontSize: 15, color: THEME.colors.textPrimary, marginBottom: 4 },
  paragraph: { fontFamily: THEME.fonts.regular, fontSize: 13.5, lineHeight: 19, color: THEME.colors.textSecondary },
  webCard: {
    marginTop: 24,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    padding: 14,
  },
  webTitle: { fontFamily: THEME.fonts.bold, fontSize: 13, color: THEME.colors.textPrimary },
  webUrl: { fontFamily: THEME.fonts.regular, fontSize: 11, color: THEME.colors.textMuted, marginTop: 4 },
  webButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
  },
  webButtonText: { fontFamily: THEME.fonts.bold, fontSize: 13, color: THEME.colors.onPrimary },
  supportText: { fontFamily: THEME.fonts.regular, fontSize: 11, color: THEME.colors.textMuted, marginTop: 10, textAlign: 'center' },
});
