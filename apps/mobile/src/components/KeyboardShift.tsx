import React from 'react';
import { createThemedStyles } from '../theme/themedStyles';
import { KeyboardAvoidingView, Platform } from 'react-native';

/**
 * Lifts content above the on-screen keyboard.
 *
 * Android resizes the window by default, but centered layouts and bottom
 * sheets inside Modals still end up under the keyboard — `height` behavior
 * shrinks this wrapper so flex-end/centered content moves into view.
 */
export const KeyboardShift: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KeyboardAvoidingView
    style={styles.fill}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    {children}
  </KeyboardAvoidingView>
);

const styles = createThemedStyles(() => ({
  fill: { flex: 1 },
}));
