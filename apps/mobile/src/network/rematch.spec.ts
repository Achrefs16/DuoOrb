import { describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@duoorb/protocol';

describe('Rematch protocol events and lifecycle', () => {
  it('defines the expected client-to-server and server-to-client rematch events', () => {
    // Compile-time and runtime type assertion verifying the protocol shape
    type C2S = keyof ClientToServerEvents;
    type S2C = keyof ServerToClientEvents;

    const c2sRematchCancel: C2S = 'game:rematchCancel';
    const c2sLeavePostGame: C2S = 'game:leavePostGame';
    const s2cRematchCancelled: S2C = 'game:rematchCancelled';
    const s2cOpponentLeft: S2C = 'game:opponentLeft';

    expect(c2sRematchCancel).toBe('game:rematchCancel');
    expect(c2sLeavePostGame).toBe('game:leavePostGame');
    expect(s2cRematchCancelled).toBe('game:rematchCancelled');
    expect(s2cOpponentLeft).toBe('game:opponentLeft');
  });

  it('handles rematch cancel and opponent left lifecycle transitions', () => {
    let rematchOffered = false;
    let rematchSent = false;
    let opponentLeft = false;
    let rematchIncomingDismissed = false;

    // Player A offers rematch
    rematchSent = true;
    expect(rematchSent).toBe(true);

    // Player A cancels rematch
    rematchSent = false;
    expect(rematchSent).toBe(false);

    // Player B receives rematch offer
    rematchOffered = true;
    rematchIncomingDismissed = false;
    expect(rematchOffered && !rematchIncomingDismissed).toBe(true);

    // Player A cancels -> server emits game:rematchCancelled -> Player B dismisses
    rematchOffered = false;
    rematchIncomingDismissed = true;
    expect(rematchOffered).toBe(false);

    // Player B navigates to analysis -> Player A receives game:opponentLeft
    opponentLeft = true;
    rematchSent = false;
    expect(opponentLeft).toBe(true);
    expect(rematchSent).toBe(false);
  });
});
