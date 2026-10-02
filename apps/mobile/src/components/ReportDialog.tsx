import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { api } from '../network/apiClient';

export const REPORT_REASONS = [
  { code: 'harassment', label: 'Harassment or bullying' },
  { code: 'hate', label: 'Hate speech' },
  { code: 'sexual_content', label: 'Sexual content' },
  { code: 'cheating', label: 'Cheating / unfair play' },
  { code: 'spam', label: 'Spam' },
  { code: 'impersonation', label: 'Impersonation' },
  { code: 'other', label: 'Something else' },
] as const;

interface ReportDialogProps {
  visible: boolean;
  targetUsername: string;
  onClose: () => void;
  onSubmitted?: () => void;
  targetUserId: string;
  gameId?: string;
}

/**
 * In-app UGC report form (Play UGC policy).
 *
 * Opened from PlayerProfile (⋯ menu), History opponents and Friend rows.
 * Submits to POST /api/reports; the server rate-limits (10/day) and queues
 * for human review. Reporters get a confirmation, never the outcome.
 */
export const ReportDialog: React.FC<ReportDialogProps> = ({
  visible,
  targetUsername,
  onClose,
  onSubmitted,
  targetUserId,
  gameId,
}) => {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    setError(null);
    setDone(false);
    setSending(false);
    onClose();
  };

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.submitReport({ targetUserId, reason, details: details.trim() || undefined, gameId });
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Report @{targetUsername}</Text>
            <TouchableOpacity onPress={close} accessibilityLabel="Close report">
              <Feather name="x" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {done ? (
            <>
              <Feather name="check-circle" size={32} color={THEME.colors.success} />
              <Text style={styles.doneTitle}>Report sent</Text>
              <Text style={styles.doneText}>
                Thanks — our team will review this player. You will not see the outcome, but
                blocking them hides them from you immediately.
              </Text>
              <TouchableOpacity style={styles.primary} onPress={close}>
                <Text style={styles.primaryText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>What happened?</Text>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.code;
                return (
                  <TouchableOpacity
                    key={r.code}
                    style={[styles.reason, active && styles.reasonActive]}
                    onPress={() => setReason(r.code)}
                    accessibilityLabel={r.label}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={[styles.label, { marginTop: 12 }]}>Details (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="What did they do? Name, bio, avatar…"
                placeholderTextColor={THEME.colors.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primary, (!reason || sending) && styles.disabled]}
                disabled={!reason || sending}
                onPress={() => void submit()}
              >
                <Text style={styles.primaryText}>{sending ? 'Sending…' : 'Send report'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancel} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: THEME.colors.backgroundCard, borderRadius: THEME.radius.lg, padding: 18, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: THEME.fonts.bold, fontSize: 16, color: THEME.colors.textPrimary },
  label: { fontFamily: THEME.fonts.semiBold, fontSize: 13, color: THEME.colors.textPrimary, marginBottom: 8 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: THEME.radius.md, borderWidth: 1, borderColor: THEME.colors.outlineVariant, marginBottom: 6 },
  reasonActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primaryLight },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: THEME.colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: THEME.colors.primary },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: THEME.colors.primary },
  reasonText: { fontFamily: THEME.fonts.medium, fontSize: 13, color: THEME.colors.textPrimary },
  reasonTextActive: { fontFamily: THEME.fonts.bold },
  input: { minHeight: 72, textAlignVertical: 'top', backgroundColor: THEME.colors.surfaceMuted, borderRadius: THEME.radius.md, borderWidth: 1, borderColor: THEME.colors.outlineVariant, padding: 10, fontSize: 13, color: THEME.colors.textPrimary },
  error: { fontFamily: THEME.fonts.medium, fontSize: 12, color: THEME.colors.danger, marginTop: 8 },
  primary: { marginTop: 12, backgroundColor: THEME.colors.primary, paddingVertical: 12, borderRadius: THEME.radius.md, alignItems: 'center' },
  primaryText: { fontFamily: THEME.fonts.bold, fontSize: 14, color: THEME.colors.onPrimary },
  cancel: { marginTop: 4, paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontFamily: THEME.fonts.semiBold, fontSize: 13, color: THEME.colors.textSecondary },
  disabled: { opacity: 0.45 },
  doneTitle: { fontFamily: THEME.fonts.bold, fontSize: 16, color: THEME.colors.textPrimary, textAlign: 'center', marginTop: 8 },
  doneText: { fontFamily: THEME.fonts.regular, fontSize: 13, lineHeight: 18, color: THEME.colors.textSecondary, textAlign: 'center', marginTop: 6 },
});
