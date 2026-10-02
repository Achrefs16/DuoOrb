import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastRequest {
  id: number;
  message: string;
  action?: ToastAction;
}

const DURATION_MS = 3500;

type ToastListener = (t: ToastRequest | null) => void;
const listeners = new Set<ToastListener>();
let seq = 0;

/**
 * Tiny event-bus toast. Any layer calls `toast.show(...)`; one mounted
 * `<AppToast />` renders it bottom-above-nav for 3.5s. Queue depth is one:
 * a new toast replaces the current one and restarts the timer.
 */
export const toast = {
  show(message: string, action?: ToastAction): void {
    seq += 1;
    const req: ToastRequest = { id: seq, message, action };
    for (const fn of listeners) {
      try {
        fn(req);
      } catch {
        // A toast listener must never break the caller.
      }
    }
  },
};

export const AppToast: React.FC = () => {
  const [current, setCurrent] = useState<ToastRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onToast = (req: ToastRequest | null) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(req);
      if (req) {
        timer.current = setTimeout(() => setCurrent(null), DURATION_MS);
      }
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!current) return null;

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={styles.pill}>
        <Text style={styles.message} numberOfLines={2}>
          {current.message}
        </Text>
        {current.action && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const fn = current.action?.onPress;
              setCurrent(null);
              fn?.();
            }}
            accessibilityLabel={current.action.label}
            accessibilityRole="button"
          >
            <Text style={styles.action}>{current.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Floats above content, below nothing interactive: taps pass around it.
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 420,
    backgroundColor: THEME.colors.inverseSurface,
    borderRadius: THEME.radius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...THEME.shadows.card,
  },
  message: {
    flex: 1,
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.inverseOnSurface,
  },
  action: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: THEME.colors.onPrimary,
  },
});
