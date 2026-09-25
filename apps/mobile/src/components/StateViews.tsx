import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading…' }) => {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="small" color={THEME.colors.textPrimary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyOrbRing}>
        <View style={styles.emptyOrbDot} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.emptyButton} activeOpacity={0.8} onPress={onAction}>
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to load.',
  onRetry,
}) => {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorTitle}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} activeOpacity={0.8} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 56,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOrbRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: THEME.colors.boardBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyOrbDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.boardBorder,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDescription: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: THEME.colors.textPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    ...THEME.shadows.card,
  },
  emptyButtonText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorTitle: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    color: THEME.colors.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: THEME.radius.md,
  },
  retryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
