-- Backfill profiles for users that never got one.
--
-- A profile write was previously attempted for ids that had no matching
-- `users` row (presence upserts, and the pre-fix gateway trusted a
-- client-asserted id). Those inserts violated profiles_userId_fkey and were
-- lost, so the user was left in `users` with no `profiles` row at all.
--
-- Every name surface then fell back to the generated placeholder
-- `player_<first 6 of id>`, which is why the same player appeared as
-- "player_u_udhs" in a match and in history while the friend list — which
-- left-joins the profile and so returned null — was unaffected.
--
-- This repairs the rows. It does not invent a chosen handle: the username
-- stays the deterministic `player_<id prefix>` placeholder, which is unique
-- by construction, and the player picks a real handle in Settings afterwards.

INSERT INTO "profiles" ("id", "userId", "username", "displayName", "isOnline", "isPlaying", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  'player_' || left(u."id", 6),
  'Player',
  false,
  false,
  now(),
  now()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "profiles" p WHERE p."userId" = u."id"
)
ON CONFLICT ("userId") DO NOTHING;
