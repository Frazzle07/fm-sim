# PRD: AttackingPositionAction — Off-Ball Attacking Movement

## Problem Statement

The current `GradientClimbAction` moves every off-ball attacking player to the centroid of their tactical zone — a single fixed point, regardless of where defenders are, where teammates are, or where the ball is. Attackers stand in predictable positions that defenders can easily mark, passing options don't materialise dynamically, and the pitch looks static rather than contested.

## Solution

Replace `GradientClimbAction` with `AttackingPositionAction`: a space-finding behaviour where off-ball attackers probe nearby positions each tick, score them by how good a passing option they'd make, and move toward the best one. Players hold position when already well-placed, producing purposeful movement rather than constant shuffling.

## User Stories

1. As a spectator, I want to see attacking players move into space during open play, so that the game looks like real football rather than a static passing drill.
2. As a spectator, I want to see attackers spread across the pitch width rather than clustering together, so that the team uses the full pitch intelligently.
3. As a spectator, I want to see strikers stay high and make runs in behind, while midfielders drop into pockets to offer short options, so that each role behaves distinctly.
4. As a spectator, I want to see a player hold their position when they've found good space, so that movement looks purposeful rather than frantic.
5. As a spectator, I want to see pass selection improve as attackers find space — better-positioned receivers appearing as the ball carrier looks for options — so that off-ball movement has a visible effect on how the ball is played.

## Implementation Decisions

### Replace `GradientClimbAction` with `AttackingPositionAction`

- Fires for all outfield players on the possessing team who are not the ball carrier and not the current ball receiver.
- Each tick, probes 8 compass directions at a fixed distance (`PROBE_DISTANCE`). Moves toward the probe position with the highest Space Score.
- If the player's current Space Score exceeds `HOLD_THRESHOLD`, they hold their current position — no movement target change. Only climb when score drops below the threshold.
- All probe positions are clamped to the player's active Tactical Zone before scoring.

### Space Score

Multiplicative combination of three components. All three must be non-zero for a position to score well:

```
spaceScore = openness × laneSafety × depthAlignment
```

**Openness**
Distance from the candidate position to the nearest defender, softly penalised by proximity to the nearest teammate:

```
openness = min(distToNearestDefender, distToNearestTeammate × TEAMMATE_PENALTY_WEIGHT)
```

`TEAMMATE_PENALTY_WEIGHT < 1.0` so teammates repel less strongly than defenders — attackers spread out naturally but a teammate doesn't fully block a position.

**Lane Safety**
Geometric clearance of the passing lane from the ball carrier to the candidate position. Uses `distToSegment(defender.pos, carrier.pos, candidate.pos)` for each defender. Lane safety is the minimum distance across all defenders, normalised against an `OBSTRUCTION_RADIUS`:

```
laneSafety = clamp(minDistToLane / OBSTRUCTION_RADIUS, 0, 1)
```

A defender within `OBSTRUCTION_RADIUS` of the lane scores near zero. Interceptability (defender reach + ball travel time) is out of scope.

**Depth Alignment**
Soft multiplier that peaks when the candidate position is at the role's preferred depth relative to the ball, and falls off as distance from that ideal increases:

```
idealDepth = ball.y + idealBallOffset  (in attacking direction)
depthAlignment = 1 - clamp(|candidate.y - idealDepth| / DEPTH_FALLOFF_RANGE, 0, 0.5)
```

`idealBallOffset` is role-specific (positive = ahead of ball, negative = behind). This is a soft bias — the climb can move anywhere within the Tactical Zone if space genuinely scores higher at a different depth.

### Hold Behaviour

If `spaceScore(player.currentPosition) >= HOLD_THRESHOLD`, the player returns their current position as the movement target. Prevents constant shuffling when already well-placed.

### Tactical Zone unchanged

Active zone scaling (`yMinDeep`/`yMinHigh` interpolation with ball depth) continues to handle the broad "push forward when ball is high, drop when ball is deep" behaviour. `AttackingPositionAction` operates within these bounds.

### No simulator changes

`AttackingPositionAction` implements the existing `Action` interface (`canExecute(ctx): boolean`, `execute(ctx): XY`). `ActionContext` requires no new fields.

### Pipeline position

Replaces `GradientClimbAction` at the same position in the movement action pipeline.

## Constants (starting values — tune visually)

| Constant | Starting value | Purpose |
|---|---|---|
| `PROBE_DISTANCE` | 0.08 | Fixed probe step size |
| `HOLD_THRESHOLD` | 0.6 | Space score above which player holds position |
| `TEAMMATE_PENALTY_WEIGHT` | 0.6 | How strongly teammates repel vs. defenders |
| `OBSTRUCTION_RADIUS` | 0.08 | Defender distance from lane that counts as blocked |
| `DEPTH_FALLOFF_RANGE` | 0.2 | Depth range over which alignment multiplier falls from 1.0 to 0.5 |

## Testing Decisions

Good tests verify observable positional outcomes, not score arithmetic.

### `canExecute` tests
- Returns `false` for the ball carrier
- Returns `false` for the current ball receiver
- Returns `false` when the opposing team has possession
- Returns `false` outside `open_play` phase

### `execute` tests
- A player with a defender directly beside them moves away from that defender
- Two attackers starting in the same position end up in different positions after several ticks (teammate repulsion works)
- A CF (positive `idealBallOffset`) targets a position ahead of the ball when space is equal in all directions
- A CDM (negative `idealBallOffset`) targets a position behind the ball when space is equal in all directions
- A player with a blocked passing lane to position A moves to position B instead, even if B is slightly less open
- A player whose current position scores above `HOLD_THRESHOLD` returns their current position unchanged
- All returned targets remain within the active Tactical Zone bounds

### Feedback loop

Visual inspection is the primary acceptance criterion — run the match visualiser and verify:
- Attackers spread across the pitch width
- Strikers hold high positions and make runs in behind
- Midfielders drop into pockets between defensive lines
- Players settle and hold position when well-placed rather than shuffling constantly
- Pass options visibly improve as attackers find space

Headless aggregate metrics (average attacker spread, average openness score, pass option count per tick) are deferred until visual testing reveals what specifically to measure.

## Out of Scope

- **Interceptability modelling** — lane safety uses geometry only, not defender reach + ball travel time
- **Explicit run-awareness in ball carrier** — carrier picks best-scoring receiver each tick; no timing logic to wait for a run to complete
- **Phase-aware depth switching** — explicit logic for "ball is deep, CF drops to help"; zone scaling is expected to be sufficient, revisit if not
- **Adaptive probe scaling** — fixed probe distance first; scaling probe by current openness is a follow-up tuning step
- **Aggregate/headless metrics** — deferred until visual testing reveals what to measure
- **Lofted through balls / header duels** — 2D lane model does not account for height
