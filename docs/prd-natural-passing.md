# PRD: Natural Passing — Lead Offsets, Loose Balls, and Contested Arrival

## Problem Statement

Passes are played dead to feet. `PassAction` aims the ball at the receiver's exact current position (`toX = best.t.x, toY = best.t.y`), and the simulator then **pins the receiver in place** (`recv.targetX = recv.x`) so they freeze and wait for the ball to arrive. On flight completion (`t >= 1`) possession is handed to the named receiver automatically.

The result looks unnatural: the ball never goes into space, receivers never run onto a pass, and the outcome of a pass is effectively guaranteed the moment it's played — nothing is contested once the ball is travelling to a stationary target.

## Solution

Make a pass aim at a point in *space*, not at a player's feet, and let the receiver run onto it. A pass becomes:

1. **A Pass Target** = receiver position + a **Lead Offset** played into open space (ahead of a runner, or to the side/short of a marked receiver).
2. **A Loose Ball** on arrival — the ball travels to the Target and rests there with no holder.
3. **A contest** — both teams pursue the loose ball; whoever wins the foot-race collects it. The existing in-flight interception check now resolves a genuine race because the receiver is no longer pinned and is actively moving onto the ball.

The same mechanism produces a pass to feet (offset collapses to zero), a ball into stride (forward lead), and a lay-off to the open side (lateral lead) — the situation and the available space decide which.

## User Stories

1. As a spectator, I want to see the ball played into space ahead of a running player, so that passing looks like real football rather than a static drill where everyone waits for the ball.
2. As a spectator, I want to see a ball laid into the space *beside or behind* a receiver who has a defender in front of them, so that passes avoid feeding the defender.
3. As a spectator, I want passes to feet only when the receiver is hemmed in, so that "to feet" is a deliberate choice and not the default.
4. As a spectator, I want a ball played into space to be genuinely contestable — sometimes a defender reaches it first — so that no pass feels guaranteed.
5. As a spectator, I want the receiver to run onto the ball and occasionally a *different* teammate to collect a ball meant for someone else, so that movement looks fluid and the loose ball feels live.
6. As a spectator, I want identical situations to produce slightly different passes, so that the game never looks like it's snapping to a grid.

## Domain Terms

Defined in [CONTEXT.md](../CONTEXT.md): **Pass Target**, **Lead Offset**, **Contested Arrival**, **Loose Ball**, **ReceiveAction**, **LooseBallAction**. This PRD is the implementation detail behind those glossary entries.

## Implementation Decisions

### 1. Lead Offset (in `PassAction.execute`)

For the selected receiver, compute a Pass Target = `receiver.position + leadOffset` rather than returning the receiver's position directly.

**Probe to locate the open region.** Cast 8 compass points around the receiver at `PROBE_DISTANCE`, mirroring `AttackingPositionAction`'s scaffold. Score each probe:

```
probeScore = openness(probePoint) × travelAlignment(probeBearing)
```

- **`openness(probePoint)`** — distance from the probe point to the nearest opponent (reuse the existing `nearest()` helper, measured *at the probe point*, not at the receiver's feet).
- **`travelAlignment(probeBearing)`** — how closely the probe bearing matches the receiver's intended travel direction. A bias, not a gate: it lets openness override the run when forward is blocked.

**Travel direction** = the receiver's **last-tick** movement target (`receiver.targetX/targetY`). Stage 3 (ball command) runs before Stage 4 (movement targets), so this tick's target isn't available yet; one tick of staleness is negligible at 200 ticks/min. **Fallback when the receiver was stationary** (no usable travel vector): use the **attacking direction** (lead forward toward the opponent goal) so even a static receiver gets the ball onto their front foot.

**Continuous landing point — never snap to the 8 spokes:**
- **Bearing** — interpolate between the winning probe and its higher-scoring neighbour, weighted by score, so the target lands anywhere on the open arc.
- **Magnitude** — scale with the openness at the chosen point, capped by `MAX_LEAD`. A wide-open channel earns a long lead; a tightly-marked receiver collapses the offset toward zero (a pass to feet).
- **Noise** — add a small random jitter to bearing and magnitude, consistent with existing engine jitter (`PassAction` score noise, per-player `phaseX/freqX`).

**Behavioural outcomes (acceptance shapes):**
- Receiver running into open space ahead → forward probe wins on both terms → ball led into stride.
- Receiver with a defender goal-side → forward probe loses on openness → side/short pocket wins, *against* the travel vector, away from the marker.
- Receiver hemmed in on all sides → all probes low → offset collapses to feet.

A forward lead is **never gated to zero purely because a defender is goal-side** — it is still attempted when the space ahead scores open (the receiver is favoured to win the race for it). Resolution of that race is deferred to flight (Contested Arrival).

### 2. Light favouredness filter (Contested Arrival, selection side)

`PassAction` keeps selecting *which* teammate to pass to using the existing scoring. It applies only a **light** filter to avoid hopeless balls — it does not try to perfectly solve the foot-race at selection time. The genuine contest is resolved in flight by the existing interception machinery.

### 3. Loose Ball (simulator)

Replace "hand possession to the named receiver on `t >= 1`" with a **loose-ball state**:
- The ball interpolates in flight to the Pass Target as today.
- On flight completion the ball **rests at (or rolls near) the Target with `ballHolderId = null`** — it does not auto-transfer to the receiver.
- Possession transfers **on proximity**: the first player within the existing collection radius becomes the holder.
- The existing in-flight interception radius check is retained and now governs collection for both the resting ball and the in-flight ball — one "nearest player collects" rule covering led balls, overhit balls, and deflections.
- The existing `if (this.ballHolderId !== null)` guards mean the dribble/pass branch idles safely while the ball is loose; confirm phase/minute/frame emission tolerate an extended null-holder stretch.

### 4. `ReceiveAction` (new movement action)

- Fires only for the player whose id equals `ctx.ballReceiverId` while a ball is **in flight** (a named receiver exists).
- **Highest priority** in `MOVEMENT_ACTIONS`, above `LooseBallAction` and everything else, so it wins while the ball is inbound.
- Default: target the **Pass Target** (the landing point) and run to claim the space.
- **Exception** — when a defender is closing on the Pass Target, target a point **up the flight line toward the passer** (come short) to take the ball earlier and shrink the defender's interception window. This concerns contestation *of the target only*; a receiver marked on their own body is already handled by a shrunken Lead Offset at pass time, not here.
- **Replaces the simulator's receiver-pinning** (`recv.targetX = recv.x` and the receiver-skip in Stage 4 are removed).

### 5. `LooseBallAction` (new movement action)

- Fires when the ball has no holder (loose-ball state).
- The **single closest player on each team** targets the ball's current position; everyone else runs their normal action (shape preserved). Self-assigned statelessly per tick — "am I my team's closest to the loose ball?" — mirroring **Press Role Assignment**'s primary-presser selection.
- Collection on proximity (existing radius).
- **Supersedes `ReceiveAction`'s named-receiver privilege once the ball is loose** — the named receiver holds no special status; a marginally-closer teammate (or opponent) collects instead, even though the pass was aimed elsewhere.
- Priority: below `ReceiveAction`, above the positional/defensive actions.

### Pipeline position

```
MOVEMENT_ACTIONS: [
  ReceiveAction,        // new — highest; fires for named receiver during flight
  LooseBallAction,      // new — fires for closest player each team when ball is loose
  PressAction,
  FullbackAttackingAction,
  AttackingPositionAction,
  DefensivePositionAction,
  HoldAction,
]
BALL_ACTIONS: [DribbleAction, PassAction]   // unchanged
```

## Constants (starting values — tune visually)

| Constant | Starting value | Purpose |
|---|---|---|
| `PROBE_DISTANCE` | 0.08 | Compass probe radius for locating open space around the receiver |
| `MAX_LEAD` | 0.12 | Cap on Lead Offset magnitude |
| `TRAVEL_ALIGNMENT_WEIGHT` | moderate | How strongly the receiver's run biases probe selection vs. raw openness |
| `LEAD_NOISE` | small | Jitter on final bearing/magnitude to prevent quantisation |
| `RECEIVE_COME_SHORT_RADIUS` | 0.08 | Defender-near-Target distance that triggers ReceiveAction's come-short exception |
| `LOOSE_BALL_COLLECT_RADIUS` | (reuse interception radius) | Proximity at which a player collects a loose ball |

## Testing Decisions

Verify observable positional/possession outcomes, not score arithmetic.

### Lead Offset (`PassAction`)
- A receiver moving forward into open space gets a Pass Target ahead of their current position (forward lead).
- A receiver with a defender directly goal-side gets a Pass Target offset to the side/short — *not* their feet and *not* toward the defender.
- A receiver surrounded by opponents on all probes gets a Pass Target at (≈) their feet (offset collapses).
- A stationary receiver (no travel vector) gets a Pass Target biased in the attacking direction.
- Two identical board states produce *different* Pass Targets across runs (noise / continuity — no snapping to 8 fixed points).

### `ReceiveAction`
- `canExecute` true only for `ctx.ballReceiverId` while a flight exists; false otherwise.
- Receiver runs toward the Pass Target by default.
- With a defender near the Target, the receiver's target moves up the flight line toward the passer (comes short).

### Loose Ball + `LooseBallAction`
- After flight completes, `ballHolderId` is null and the ball rests at the Target until a player reaches it (no auto-transfer to the receiver).
- The closest player of each team moves toward a loose ball; others keep their normal action.
- A defender closer to the resting ball than the named receiver collects it.
- Possession transfers on proximity, not on a fixed timer.

### Feedback loop

Visual inspection is the primary acceptance criterion — run the match visualiser and verify:
- Balls are played into space ahead of runners, not to feet.
- Balls are laid to the side/behind receivers who are fronted by a defender.
- Receivers visibly run onto the ball; the motion is fluid (no freeze-and-wait).
- Loose balls are genuinely contested — defenders sometimes win them.
- Passes don't visibly snap to a grid of fixed offsets.

## Out of Scope

- **Defender pursuit beyond one per team** — second-ball scrambles / multiple chasers deserve their own design; this ships one pursuer per side.
- **Multi-radius probing** — radius comes from openness-scaled magnitude plus noise; a fixed-radius-then-scale single pass is sufficient first.
- **Reordering tick stages** — Lead Offset uses last-tick travel rather than reordering Stage 3/4; revisit only if staleness proves visible.
- **Receiver-marking handled in flight** — a tightly-marked receiver is handled by a shrunken Lead Offset at pass time, not by ReceiveAction.
- **Lofted balls / header duels** — the 2D model has no height; aerial contests remain deferred (see CONTEXT.md "Header Duel").
- **Ball physics (deceleration, roll)** — the loose ball rests/rolls near the Target; full rolling physics is out of scope.
