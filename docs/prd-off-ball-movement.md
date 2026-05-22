# PRD: Off-Ball Movement — Attacking Space-Finding and Defensive Man-Marking

## Problem Statement

All players except the ball carrier and active pressers are completely static during open play. This makes the simulation look unnatural — attackers stand frozen waiting to receive, defenders never react to attacking runs, and the game reduces to a passing puzzle between fixed positions rather than a dynamic contest for space.

## Solution

Introduce two new off-ball movement behaviours that fire as movement actions within the existing action pipeline:

1. **Attacking space-finding** — off-ball attackers gradient-climb toward positions with more space (away from defenders, in open passing lanes), making themselves available as passing options and pulling the defensive shape apart.
2. **Defensive man-marking** — defending DEFs and MIDs track the nearest available attacker, producing compact defensive shape that responds to attacking runs. Surplus defenders drop into a covering position between the ball and their own goal.

Both behaviours are stateless, recalculated per tick, and implemented as new action files — no simulator changes required.

## User Stories

1. As a spectator watching the match visualisation, I want to see attacking players move into space during build-up play, so that the game looks like real football rather than a static passing drill.
2. As a spectator, I want to see wide attackers drift toward the touchline to stretch the defence, so that the pitch feels like it's being used intelligently.
3. As a spectator, I want to see strikers check runs and create separation from defenders, so that through-ball opportunities feel earned.
4. As a spectator, I want to see midfielders shift into open pockets of space between defenders, so that possession play looks purposeful.
5. As a spectator, I want to see defenders track attackers as they move, so that the defensive shape looks reactive and organised.
6. As a spectator, I want to see a back four compact and shift as a unit when the ball moves, so that the defensive line behaves like a real defence.
7. As a spectator, I want to see surplus defenders drop into a covering position between the ball and goal, so that the team doesn't leave gaps behind the defensive line.
8. As a spectator, I want to see attacking movement slow and settle when a player finds good space, so that runs look purposeful rather than frantic.
9. As a spectator, I want to see attackers take larger strides when they have open space and smaller probing steps when tightly marked, so that movement looks physically natural.
10. As a spectator, I want to see players stay in their positional zones (forwards staying high, defenders staying back) even while moving for space, so that tactical shape is preserved.
11. As a spectator, I want to see the pass selection in `PassAction` benefit from attacking runs — better-positioned, more open receivers appearing as attackers move — so that off-ball movement has a visible effect on how the ball is played.
12. As a spectator, I want to see man-marking defenders respond to the ball changing hands, re-assigning to new attackers immediately, so that defensive transitions look sharp.

## Implementation Decisions

### New action: `SpaceAction` (attacking off-ball movement)

- Fires for FWD and MID players on the possessing team, when they are not the ball carrier and not the designated receiver of a ball in flight.
- Each tick, probes 8 compass directions. Probe distance scales with the player's current space score: `currentOpenness * PROBE_SCALE`, clamped to `[MIN_PROBE, MAX_PROBE]`. A player in open space takes larger strides; a tightly marked player probes cautiously.
- Space score for a candidate position = `openness` (distance to nearest defender from that position) + `laneSafety` (clearance of the passing lane from ball holder to that position, using the existing `distToSegment` utility).
- Player moves toward the highest-scoring probe that remains inside their tactical zone.
- Tactical zone is a hard rectangular bound derived from `baseX`/`baseY` plus role-specific radii. FWDs: wide lateral range, generous forward depth. MIDs: moderate in both dimensions.
- Inserted before `HoldAction` in the movement action pipeline.

### New action: `MarkAction` (defensive man-marking)

- Fires for DEF and MID players on the non-possessing team (when the opponent has the ball or it is in flight toward an opponent).
- Each tick, runs a greedy nearest-pair assignment: collect all attacking outfield opponents and all defending outfield players, rank all pairs by distance, claim the closest pair, remove both from consideration, repeat until one pool is exhausted.
- Each defending player independently runs this full assignment and reads off their own slot — stateless, no shared state, no simulator changes. Same pattern as press role assignment in `PressAction`.
- Assigned defenders move toward their assigned attacker at standard `MOVE_SPEED`.
- Unassigned defenders (surplus after all attackers are claimed) move to a covering position: `x` tracks the ball laterally, `y` holds at `baseY` (defensive line depth).
- Inserted after `PressAction` and before `HoldAction` in the movement action pipeline.

### No simulator changes

Both actions fit entirely within the existing `Action` interface (`canExecute(ctx): boolean`, `execute(ctx): XY`). `ActionContext` requires no new fields — all necessary information (`allPlayers`, `ball`, `ballHolderId`, `ballReceiverId`, `phase`, `player`) is already present.

### Existing `PressAction` unchanged

`PressAction` continues to handle FWD pressing for the defending team. `MarkAction` handles DEF and MID marking. The two actions are position-gated and do not overlap.

### Coordinate system

- x: 0..1 left to right
- y: 0..1, home team attacks toward y=1, away team attacks toward y=0
- `attackingDir` = `isHome ? 1 : -1` (already established convention in `DribbleAction` and `PressAction`)

## Testing Decisions

Good tests for this feature verify **observable positional outcomes**, not implementation details like probe counts or score arithmetic.

### What makes a good test

- Set up a minimal player configuration (e.g. one attacker, two defenders) with known positions.
- Call the action's `execute(ctx)` directly and assert on the returned `XY` target.
- Assert directional intent: "the attacker moved away from the defender" or "the defender moved toward their assigned attacker" — not exact coordinates.
- Use `canExecute` tests to verify the action only fires in the right conditions (correct team possession, correct position type, not the carrier, not the receiver).

### Modules to test

- `SpaceAction` — verify it fires only for the possessing team's FWDs/MIDs; verify the returned target moves away from a nearby defender; verify the target stays within the tactical zone bounds; verify a player already in good space takes a larger step than a tightly marked player.
- `MarkAction` — verify assignment is conflict-free (no two defenders assigned the same attacker); verify surplus defenders return a covering position with `x ≈ ball.x` and `y ≈ baseY`; verify the action fires only for the non-possessing team's DEFs/MIDs.

### Prior art

See `src/domains/match/engine.test.ts` for the existing test pattern — plain TypeScript, no React, direct function calls with constructed inputs.

## Out of Scope

- **Lofted through balls** — defenders blocking passing lanes in 2D will not model height. Through balls that clear a defensive line are a separate future increment.
- **Soft elastic bounds** (pull-to-base penalty replacing hard tactical zone clamp) — the hard zone is the first increment; elastic pull is a follow-up tuning step.
- **AI transfer activity** — no change to how teams buy or sell players.
- **Phase-specific off-ball shape** — both actions fire during `open_play` only. Set pieces, corners, and free kicks are out of scope.
- **MID pressing** — `PressAction` remains FWD-only. Extending pressing to midfielders is a separate concern.

## Further Notes

- The emergent behaviour goal: attackers pull defenders around, opening lanes that `PassAction` will naturally exploit because `openness` and `laneSafety` scores improve for receivers who have found space. No changes to `PassAction` are needed — the improved positions flow through automatically.
- Tactical zone widths and probe scale constants will need visual tuning once the actions are running. Start conservative (narrow zones, small probes) and widen.
- Future increment: replace hard tactical zone clamp with a soft elastic pull toward `baseX`/`baseY` — penalise the space score by distance from base. This allows players to stretch further when space genuinely demands it.
- The greedy assignment in `MarkAction` is O(n²) over at most ~8 players — negligible at 200 ticks/minute.
