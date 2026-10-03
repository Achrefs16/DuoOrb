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
  /** Optional leading visual (e.g. an achievement medal). Same render tree. */
  icon?: React.ReactNode;
}

const DURATION_MS = 3500;
/** Backlog depth: achievements earned together are celebrated in order, and
 * a session toast can no longer erase an achievement toast mid-read. */
const QUEUE_DEPTH = 4;

type ToastListener = (t: ToastRequest | null) => void;
const listeners = new Set<ToastListener>();
let seq = 0;

/**
 * Tiny event-bus toast. Any layer calls `toast.show(...)`; one mounted
 * `<AppToast />` renders them bottom-above-nav for 3.5s each, first in first
 * out (depth 4 — overflow drops the oldest queued, never the one on
 * screen). A new toast no longer replaces the current one mid-read.
 */
export const toast = {
  show(message: string, action?: ToastAction, icon?: React.ReactNode): void {
    seq += 1;
    const req: ToastRequest = { id: seq, message, action, icon };
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
  const queue = useRef<ToastRequest[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  useEffect(() => {
    const showNext = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const next = queue.current.shift() ?? null;
      setCurrent(next);
      if (next) {
        timer.current = setTimeout(() => {
          timer.current = null;
          showNext();
        }, DURATION_MS);
      }
    };
    advanceRef.current = showNext;
    const onToast = (req: ToastRequest | null) => {
      if (!req) return;
      queue.current.push(req);
      while (queue.current.length > QUEUE_DEPTH) queue.current.shift();
      // Idle: start the chain. Busy: the running timer advances it.
      if (!timer.current && !current) showNext();
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (timer.current) clearTimeout(timer.current);
    };
    // `current` read once for the idle check; the queue ref owns the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={styles.pill}>
        {current.icon != null && <View style={styles.iconWrap}>{current.icon}</View>}
        <Text style={styles.message} numberOfLines={2}>
          {current.message}
        </Text>
        {current.action && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const fn = current.action?.onPress;
              // Dismissing early advances the queue now — the next toast
              // must not wait out the remainder of this one's timer.
              advanceRef.current();
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
  iconWrap: {
    marginLeft: -4,
    alignItems: 'center',
    justifyContent: 'center',
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
