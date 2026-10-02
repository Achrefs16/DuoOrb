import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../theme';
import { COPY } from '../network/errors';
import { useConnectivity, useSocketStatus } from '../network/useConnectivity';
import { getLastServerErrorAt, subscribeServerErrors } from '../network/apiClient';

const SERVER_WINDOW_MS = 60000;

/**
 * One global connectivity bar, rendered once above the tabs. Never blocks
 * taps, never navigates:
 * - amber while the device is offline (or the socket is mid-reconnect),
 * - red for 60s after the last server-side (5xx) failure, then auto-hides,
 * - nothing otherwise. Unknown-at-boot renders nothing (no boot flash).
 */
export const ConnectivityBanner: React.FC = () => {
  const { isConnected } = useConnectivity();
  const socketStatus = useSocketStatus();
  // True while inside the 60s window after a server-side failure. Driven by
  // subscription + timeout only — never a clock read in render.
  const [serverRecent, setServerRecent] = useState(() => getLastServerErrorAt() > 0);

  useEffect(() => subscribeServerErrors(() => setServerRecent(true)), []);

  useEffect(() => {
    if (!serverRecent) return;
    const t = setTimeout(() => setServerRecent(false), SERVER_WINDOW_MS);
    return () => clearTimeout(t);
  }, [serverRecent]);

  if (isConnected === false || socketStatus === 'reconnecting') {
    return (
      <View
        style={[styles.bar, styles.amber]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.text}>{COPY.offlineBanner}</Text>
      </View>
    );
  }

  if (serverRecent) {
    return (
      <View
        style={[styles.bar, styles.red]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.text}>{COPY.serverBanner}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  amber: {
    backgroundColor: THEME.colors.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.warning,
  },
  red: {
    backgroundColor: THEME.colors.errorContainer,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.error,
  },
  text: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
});
