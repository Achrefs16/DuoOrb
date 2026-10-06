import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { useSession } from '../network/session';
import { GoogleGLogo } from './GoogleGLogo';
import { PREMIUM_GOLD } from './PremiumBadge';
import {
  getPremiumPlans,
  purchaseNeedsLink,
  purchasePlan,
  restorePremium,
  type PlanId,
  type PremiumPlan,
} from '../monetization/offers';
import { track } from '../monetization/analytics';

/**
 * DuoOrb Premium paywall (MONETIZATION.md P7.1). GuestGate-pattern bottom
 * sheet: the board never moves, one primary action, honest secondary exits.
 *
 * Entries: Settings PREMIUM card, locked bot tap, locked theme tap, and the
 * RewardSheet "Go Premium" link. Guests link Google first (P2.4) — purchases
 * never initiate on a guest identity. Without the RevenueCat key (pre-P0.5)
 * plans render with a "coming soon" buy state: no dead buttons, no fake sales.
 */

const BULLETS = [
  'No ads, anywhere',
  'Unlimited game analysis',
  'All 6 exclusive bots',
  'Midnight board theme',
  'Premium crown on your name',
];

/** Dev-only unavailability explainer (never rendered in production). */
const DEV_REASON_COPY: Record<string, string> = {
  'no-key':
    'Dev: RevenueCat key missing in this build — check EXPO_PUBLIC_REVENUECAT_ANDROID_KEY and rebuild.',
  'no-products':
    'Dev: offering duoorb_premium has no $rc_monthly / $rc_annual packages.',
  'store-error':
    'Dev: store unreachable in this build — use a dev build on a Play-enabled device (not Expo Go).',
};

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

interface PremiumSheetProps {
  visible: boolean;
  /** Where the sheet opened from (analytics + copy context). */
  entry: string;
  onClose: () => void;
  /** Purchase or restore completed — caller syncs state and dismisses. */
  onDone: () => void;
}

export const PremiumSheet: React.FC<PremiumSheetProps> = ({
  visible,
  entry,
  onClose,
  onDone,
}) => {
  const { identity, signInWithGoogle } = useSession();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [canBuy, setCanBuy] = useState(false);
  const [buyReason, setBuyReason] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selected, setSelected] = useState<PlanId>('yearly');
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    if (!visible) return;
    track('paywall_viewed', { entry });
    let cancelled = false;
    // All state lands inside the promise continuation (never synchronously
    // in the effect body): no cascading renders, stale opens can't overwrite
    // newer ones after a quick close/reopen.
    void getPremiumPlans().then((res) => {
      if (cancelled) return;
      setPlans(res.plans);
      setCanBuy(res.purchaseAvailable);
      setBuyReason(res.purchaseAvailable ? null : (res.reason ?? 'store-error'));
      if (res.plans.some((p) => p.id === 'yearly')) setSelected('yearly');
      else if (res.plans.length > 0) setSelected(res.plans[0].id);
      setError(null);
      setShowLink(false);
      setLoadingPlans(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, entry]);

  const activePlan = plans.find((p) => p.id === selected) ?? plans[0];
  // Derived, not state: the moment the session flips to linked, the link
  // card vanishes and buy is one tap — no watcher effect needed.
  const linked = identity != null && !identity.isGuest;

  // Closing resets the sheet to its pristine state (loaders, errors, link
  // card): reopening always starts clean without an open-time effect.
  const handleClose = () => {
    setLoadingPlans(true);
    setError(null);
    setBuyReason(null);
    setShowLink(false);
    setLinking(false);
    setLinkError(null);
    onClose();
  };

  const handleBuy = async () => {
    if (!activePlan || buying) return;
    if (purchaseNeedsLink()) {
      setShowLink(true);
      return;
    }
    setBuying(true);
    setError(null);
    track('plan_selected', { plan: activePlan.id, entry });
    const res = await purchasePlan(activePlan);
    setBuying(false);
    if (res.status === 'done') {
      track('trial_started', { plan: activePlan.id });
      onDone();
    } else if (res.status === 'needs-link') {
      setShowLink(true);
    } else if (res.status === 'error') {
      setError(res.message);
    }
    // 'cancelled' closes silently — no scolding for changing one's mind.
  };

  const handleRestore = async () => {
    if (restoring) return;
    if (purchaseNeedsLink()) {
      setShowLink(true);
      return;
    }
    setRestoring(true);
    setError(null);
    const res = await restorePremium();
    setRestoring(false);
    if (res.status === 'done') onDone();
    else if (res.status === 'error') setError(res.message);
  };

  const handleLink = async () => {
    setLinking(true);
    setLinkError(null);
    try {
      await signInWithGoogle();
      // Identity flips via session effect → the watcher above closes the card.
    } catch {
      setLinkError('Sign-in failed — check your connection and try again.');
      setLinking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="crown" size={22} color={PREMIUM_GOLD} />
            <Text style={styles.title}>DuoOrb Premium</Text>
          </View>

          <View style={styles.bullets}>
            {BULLETS.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <Feather name="check" size={14} color={THEME.colors.primary} />
                <Text style={styles.bullet}>{b}</Text>
              </View>
            ))}
          </View>

          {loadingPlans ? (
            <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
          ) : (
            <View style={styles.plans}>
              {plans.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planRow, selected === p.id && styles.planRowActive]}
                  onPress={() => setSelected(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title}, ${p.priceLine}`}
                >
                  <View style={styles.planMeta}>
                    <Text style={styles.planTitle}>
                      {p.title}
                      {p.featured ? ' · Best value' : ''}
                    </Text>
                    <Text style={styles.planPrice}>{p.priceLine}</Text>
                    {p.trialLine ? (
                      <Text style={styles.planTrial}>{p.trialLine}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.radio,
                      selected === p.id && styles.radioActive,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Play-compliant disclosure: price, period, renewal, trial terms,
              cancel path, and the app-works-without statement — all visible
              with no extra taps. */}
          {activePlan && (
            <Text style={styles.disclosure}>
              {activePlan.trialLine
                ? `${activePlan.trialLine}. Renews automatically until cancelled. `
                : `${activePlan.priceLine}, renews automatically until cancelled. `}
              Cancel anytime in Settings. DuoOrb works fully without Premium.
            </Text>
          )}

          {showLink && !linked ? (
            <View style={styles.linkCard}>
              <Text style={styles.linkTitle}>Keep Premium on every device</Text>
              <Text style={styles.linkCopy}>
                Save with Google first — purchases attach to your account, and
                guests lose them on reinstall.
              </Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleLink}
                disabled={linking}
                accessibilityRole="button"
                accessibilityLabel="Save with Google"
              >
                {linking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <GoogleGLogo size={16} />
                    <Text style={styles.linkButtonText}>Save with Google</Text>
                  </>
                )}
              </TouchableOpacity>
              {linkError && <Text style={styles.error}>{linkError}</Text>}
                <TouchableOpacity onPress={() => setShowLink(false)} disabled={linking}>
                  <Text style={styles.later}>Back</Text>
                </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.buyButton,
                  (buying || !canBuy || !activePlan) && styles.buyButtonBusy,
                ]}
                onPress={handleBuy}
                disabled={buying || !activePlan}
                accessibilityRole="button"
                accessibilityLabel={canBuy ? 'Subscribe to Premium' : 'Premium coming soon'}
              >
                {buying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buyText}>
                    {canBuy ? 'Continue' : 'Available soon'}
                  </Text>
                )}
              </TouchableOpacity>
              {isDevBuild() && !loadingPlans && !canBuy && buyReason && (
                <Text style={styles.devHint}>
                  {DEV_REASON_COPY[buyReason] ?? DEV_REASON_COPY['store-error']}
                </Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.rowLinks}>
                <TouchableOpacity onPress={handleRestore} disabled={restoring}>
                  <Text style={styles.link}>
                    {restoring ? 'Restoring…' : 'Restore purchase'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClose} disabled={buying || restoring}>
                  <Text style={styles.later}>Not now</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  bullets: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  plans: {
    gap: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  planRowActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surfaceContainerLowest,
  },
  planMeta: {
    flex: 1,
    gap: 1,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  planTrial: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.colors.surfaceHairline,
  },
  radioActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },
  disclosure: {
    fontSize: 11,
    lineHeight: 15,
    color: THEME.colors.textMuted,
  },
  linkCard: {
    gap: 8,
    alignItems: 'center',
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  linkCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buyButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyButtonBusy: {
    opacity: 0.75,
  },
  buyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  devHint: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  rowLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    paddingVertical: 6,
  },
  later: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    paddingVertical: 6,
  },
});
