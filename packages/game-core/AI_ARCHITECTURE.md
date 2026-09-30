# DuoOrb AI — Architecture Note

Status: proposed design for the strategic layer, written after auditing the
post-Phase-0/1/2/3 engine (`ai.ts`, `ai-structure.ts`). Phases 0–3 work is
preserved; this note only describes what is added on top.

## 1. Current layers (what already exists and is sufficient)

```
GameState
  → tactical read        readTacticalState()      WIN / BLOCK / ESCAPE / SHAPE
  → structural facts     ai-structure.ts          BoardStructure, WallField, RouteProfile
  → candidate generation SlotPool + root probing  (root only, walls probed once)
  → search               searchNode()             ID + TT + killers + PVS, async slices
  → evaluation           evaluateState()          progress, lead, capped structure, placement
  → selection            rankActions() + rescue
```

Already sufficient, and **not** being replaced:

- `WallField.chains / ends / extensions / bridges / turnExtensions / chainTouch`
  are exactly the primitives a "plan" is built from. They are computed and
  cached, but nothing currently reasons over *whose* plan they are.
- `RouteProfile` already carries `distance, pathCount, firstSteps, goalCells,
  nearestGoals, goalCellsNear, nearCells, openings, tightest, reach`. This is
  the route/territory data; the strategic layer reads it and adds no duplicate.
- Epoch caches (`boardOf`, `routeOf`, goal-distance field), the TT, killers,
  PVS, ply-sensitive terminals, the exact no-wall race, and rescue all stay.
- `SlotPool` stays. Its reason bitmask and bounded probe budget stay.

## 2. What is actually missing (the reported bug, diagnosed)

The symptom is "the AI advances while the opponent builds a dangerous
sequence." Four concrete mechanisms cause it:

1. **Inner nodes generate moves only.** `buildSearchCandidates()` returns pawn
   moves exclusively, so a rival's *next wall* is not in the game tree at all.
   TT/killer propagation substitutes "assume the rival repeats the wall I
   liked", which is not "assume the rival continues their plan". This is the
   single largest structural gap: at depth 3 the engine literally cannot
   represent a three-wall plan, and multiplayer depth is capped at 6.
2. **No plan object exists.** Wall candidates are ranked on the immediate
   effect of one wall (`delay`) plus generic structural bonuses. Nothing asks
   what the rival could add *next* around the same structure.
3. **Root credit is all-or-nothing.** In `rankActions()` a wall's delay is
   credited only when `emergency` (rival one step out) or `flips` (turns a lost
   race into a won one). A threat that will cost three steps in two turns earns
   **exactly zero**, so a pawn advance that scores well always wins. This is the
   precise line that produces the reported behaviour.
4. **Candidate generation is reactive.** It emits slots near rival routes and
   goal approaches. It has no notion of "interrupt this chain", "steal the slot
   they want", or "prevent that extension".

## 3. New strategic-plan layer

New module `ai-threat.ts`, computed **once per root position**, bounded, and
cached for the epoch. It adds no new board scans: it reuses `WallField`,
`RouteProfile`, and the cached goal-distance field through one new helper
(`boardWithExtraWall` / `projectedDistance`, added to `ai-structure.ts`).

Concepts — deliberately few, each one measurable:

| Concept | Meaning | Derived from |
| --- | --- | --- |
| `ThreatWall` | one slot the rival could play next against me, with the delay it would cost me | `field.extensions` near my route band, projected via `projectedDistance` |
| `bite` | the plan's two-ply cost to me: sum of the best two positive continuation delays | top-2 of the above |
| `focus` | are several continuation slots aiming at *one* chain (a plan) or scattered (noise) | chain id of each continuation slot |
| `targetsUs` | does the structure threaten my route/mobility, not merely exist | the continuation slots are near my route band |
| `urgency` | race close, or `bite` real → position is volatile | distance gap + bite |
| `multiThreat` | two or more rivals independently threatening me | per-rival list size |

A rival's continuation slots are drawn from `field.extensions` **near my route
band**, bounded to 6 per rival and 3 rivals. They are candidate *rival* moves,
not candidate *our* moves.

## 4. Data flow between layers

```
readTacticalState()      ──┐
                           ├──► StrategicRead  (root only, once)
readStrategicState()    ──┘        │
                                    ├─► collectWallSlotIdeas()   candidate priority
                                    ├─► buildRootCandidates()    counterfactual score
                                    └─► rankActions()            defensive credit
```

- **Tactical layer** stays exactly as-is: it answers "is there a win / a
  one-step block / a forced escape right now".
- **Strategic layer** answers the orthogonal question "is a plan forming
  against me that has not landed yet".
- Neither is computed per node, so leaf cost is unchanged.

## 5. Where threat analysis happens, and where it does not

- Computed **once at the root**.
- Used for candidate priority, counterfactual root scoring, and volatility.
- **Not** used in leaf evaluation. A per-leaf plan scan would multiply the most
  expensive part of the turn; the strategic question is answered at the root,
  where there is one position instead of hundreds of thousands.
- The one place it enters the tree is inner-node wall replies, and only when
  volatile (see §7), drawn from cached `field.extensions` with no BFS.

## 6. Counterfactual wall analysis

For each *kept* root wall candidate (bounded to `maxCandidateWalls`, so ≤8):

```
biteBefore  = plan bite with the board as it is
biteAfter   = plan bite recomputed with our candidate wall on the board
suppression = biteBefore - biteAfter
```

This is the "weak now but dangerous later" test, in both directions:

- a wall with `delay = 0` but `suppression > 0` is a real **preventer**, and
  earns credit;
- a rival structure whose `bite` we cannot reduce is *harmless* if our race
  advantage already converts the game, and is ignored by the urgency gate.

Only the top-2 continuation slots per rival are re-projected per candidate, so
the extra cost is bounded by `maxCandidateWalls × 2 × rivals`, not by the
candidate pool.

## 7. Search changes

Preserved untouched: iterative deepening, TT, TT-best-move ordering, killers,
PVS, ply-sensitive terminals, exact no-wall race, rescue, determinism.

Additions, both gated on volatility so quiet positions cost exactly what they
cost today:

1. **Inner-node plan replies.** When the node's mover has walls and the node is
   volatile (`own.tightest <= 2`, or a chain lies within the mover's route
   band), the node also considers up to `INNER_PLAN_WALLS` (=2) slots from the
   already-cached `field.extensions` near its route. No legality BFS, no route
   recomputation: both lists are cached, so this is array filtering only. This
   is what lets the tree contain "the rival continues the chain".
2. **Selective depth.** `StrategicRead.urgent` raises the root depth request by
   one ply, mirroring the existing `tactical.extraDepth` mechanism. Volatile
   positions get the extra ply; quiet ones do not pay for it.

## 8. Candidate generation changes

`SlotPool` and its probe budget are kept. Two new reasons are added to the
existing bitmask, which is what makes generation *prioritize* rather than
enumerate:

- `SLOT_RIVAL_PLAN` — a slot the threatening rival wants next. Placing it steals
  the plan. Highest priority.
- `SLOT_PREVENT` — a slot adjacent to a threatening chain that is not itself a
  desired continuation, i.e. it plugs the structure's remaining gaps.

Both are only populated when a threat is real, so a quiet root generates
exactly the same pool it does today.

## 9. Evaluation changes

The evaluator keeps its four questions but stops double-counting:

| Question | Terms | Where |
| --- | --- | --- |
| Who is winning the race? | `progress`, `lead` | leaf |
| Who has the better routes? | `pathCount` **or** `firstSteps` — currently both, via `weights.pathways` twice; collapsed to one | leaf |
| Who has the stronger wall/territory position? | `wallAdvantage`, `mobility`, `tightness` | leaf |
| Who has the more dangerous developing plan? | `bite`, `focus`, `suppression` | **root only** |

The route/territory block stays soft-capped below one step
(`STRUCTURE_CAP_SHARE`), so structure can order two walls but never outvote a
real step. The plan credit is separately capped and separately gated, so it
cannot be earned five times over by correlated measurements.

## 10. Race conversion

- Existing: `rivalsDisarmed` cut, exact no-wall race, `racing && delay === 0`
  zeroes structure credit, wins scored at the terminal value.
- Added: a decisive-lead test (`own.distance + 1 < nearest rival distance`)
  sets `raceDecided`, which **suppresses defensive plan credit** and keeps
  advancing. Walls stop being the resource; the engine converts.
- Offensive plan credit is *not* suppressed: converting efficiently still means
  not wasting the wall you are about to place.

## 11. Multiplayer

Max-n architecture is unchanged. The strategic layer is seat-aware:

- threats are computed per active rival, bounded to 3, and the highest-scoring
  one becomes `primary`;
- `multiThreat` is set when two or more rivals threaten us independently, which
  raises urgency — a wall that helps rival A by helping rival B is filtered by
  the existing `selfCost` term, which measures *our* damage only;
- center modes (`4p`, `center2`, `center3`) route through the single centre
  square, so the route band is short and the threat set is naturally small;
- race modes get the existing `tightness × 0.6` tuning.

## 12. Caching

- `boardWithExtraWall` / `projectedDistance` are added to `ai-structure.ts` and
  cached per epoch alongside the existing board, route and goal-field caches.
  One hypothetical board per (base wall set, extra slot).
- The strategic read is memoised per root state object, so repeated calls in one
  turn cost nothing.
- No new scan runs per node. Leaf evaluation is byte-for-byte the same work as
  before.

## 13. Production budget vs. experimental ceiling

These are two different things and the code keeps them separate:

- **Ceiling** — `getBestActionAsync(..., { maxDepth })` runs to a depth with no
  clock. This is the measurement harness and stays exactly as it is.
- **Production** — a new mode/profile-aware budget object the app passes in.
  The old `timeBudgetMs` on a profile is not reused as-is, because 120 ms was
  never a measured figure; it was a leftover.

Budget shape: a per-mode time cap and a per-mode depth cap, with the depth cap
the binding constraint in multiplayer (where branching is 4–7× head-to-head).
The concrete numbers are set from measurement on the development machine and
are explicitly provisional pending real-device confirmation — this note does not
claim device numbers it cannot produce.

## 14. Determinism

Unchanged guarantee: same `state + profile + seed` ⇒ same action. The strategic
layer introduces no randomness: continuation slots are collected in a fixed
order from cached arrays, ties break on packed slot id, and `positionSeed()`
still derives the RNG stream from the position. A different seed may change
jitter on `easy`/`normal` only.
