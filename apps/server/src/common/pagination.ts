/**
 * Query paging that can never reach Prisma as NaN, negative, or absurd.
 * Non-numeric input falls back to the default instead of throwing a 500.
 */
export function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : def;
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, 1), max);
}

export function clampOffset(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(n)) return 0;
  return Math.max(n, 0);
}
