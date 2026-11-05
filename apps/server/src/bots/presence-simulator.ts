/**
 * Generates a realistic, dynamic concurrent player baseline.
 *
 * Simulates a global community across Europe, the Americas, and Asia:
 * - Oscillates smoothly across UTC hours between ~42 and ~145
 * - Adds deterministic minute-slice jitter (+-6) to look natural without erratic jumps
 * - Combined with real connected users, incrementing (+1) on login and decrementing (-1) on logout
 */
export function getSimulatedOnlineBaseline(now = Date.now()): number {
  const date = new Date(now);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;

  // Diurnal sinusoidal curve: trough at 05:00 UTC (~45), peak at 19:00 UTC (~140)
  const angle = ((hour - 5) / 24) * 2 * Math.PI;
  const base = 94 + Math.sin(angle) * 48; // oscillates roughly 46 to 142

  // Smooth deterministic noise changing every 90 seconds
  const slice = Math.floor(now / 90_000);
  const pseudoNoise = ((slice * 9301 + 49297) % 233280) / 233280;
  const jitter = (pseudoNoise - 0.5) * 12; // -6 to +6

  return Math.round(Math.max(38, Math.min(185, base + jitter)));
}

