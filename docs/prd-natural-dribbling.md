# PRD: Natural Dribbling — Omnidirectional Carrying, Speed Gears, and Slew

## Problem Statement

Dribbling is a one-directional fixed-step shove forward. `DribbleAction` only ever
moves the carrier up the y-axis toward the opponent goal (`toY = player.y + DRIBBLE_STEP × attackingDir`),
ignoring lateral and backward space entirely. It is also the **first** ball action
evaluated, firing whenever a forward cone is clear — so a carrier with space ahead
*always* dribbles and never considers a pass.

Two things are wrong:

1. **Direction is fixed forward.** A carrier hemmed in ahead cannot turn into open
   space to the side or behind; players only move "in one direction."
2. **Speed is constant.** Every carry moves at the same `MOVE_SPEED`. There is no
   notion of a player walking the ball in deep buildup, jogging it under mild
   pressure, or bursting (driving) past a committed defender. The carrier can never
   pull away from a presser, so beating a man by pace is impossible by construction.

## Solution

Make dribbling a **fallback** that carries the ball into the best available space at
a situation-appropriate speed.

1. **Omnidirectional, unclamped direction.** The carrier probes all 8 compass
   directions and picks the best by a **Carry Objective** (openness + forward bias).
   Unlike off-ball players, the carrier is **not** confined to its Tactical Zone — it
   goes wherever space leads.
2. **Three speed gears.** **Walk / Jog / Drive**, chosen from pressure + space, so
   "deep players walk the ball" emerges rather than being a position rule. Drive can
   exceed base speed, making "beat the man" genuinely possible.
3. **Role gates the burst.** A stochastic **Drive Tendency** per role decides how
   readily a player reaches for Drive — a winger often, a centre-back rarely. Top
   speed is the player's **Pace** (a stubbed attribute), not the role.
4. **Smooth wind-up.** Actual speed **slews** toward the chosen gear rather than
   snapping, so a Drive winds up over several ticks and a defender gets a beat to react.
5. **Pass-first pipeline.** Pass is evaluated before dribble; dribbling fires only
   when no pass clears its bar.

## Domain Terms

Defined in [CONTEXT.md](../CONTEXT.md): **Dribble**, **Carry Objective**,
**Carry Gear**, **Drive Tendency**, **Pace**, **Speed Slew**, **Ball Action Pipeline**.
This PRD is the implementation detail behind those glossary entries. The pass-first
ordering and its provisional nature are recorded in
[ADR 0003](adr/0003-ball-action-pipeline-is-provisional.md).

## User Stories

1. As a spectator, I want a carrier hemmed in ahead to turn into open space to the
   side or behind, so that dribbling looks like a player reading the pitch rather
   than charging forward blindly.
2. As a spectator, I want an unpressured carrier to drift forward by default, so that
   carrying still has a sensible attacking intent when space is everywhere.
3. As a spectator, I want defenders deep in their own half to *walk* the ball when
   unpressured, so that buildup looks composed rather than frantic.
4. As a spectator, I want a carrier to *burst* past a committed defender when space
   opens ahead, so that beating a man feels like a real, earned event.
5. As a spectator, I want centre-backs to rarely attempt that burst while wingers do
   it readily, so that role personality shows in how players carry the ball.
6. As a spectator, I want the acceleration into a burst to wind up smoothly, so that
   speed changes don't look like teleporting between gears.
7. As a spectator, I want a carrier to pass when a good pass is on and only carry when
   it isn't, so that players don't selfishly dribble past open teammates.

## Implementation Decisions

### 1. Pass-first pipeline (`simulator.ts`)

Flip `BALL_ACTIONS` from `[DribbleAction, PassAction]` to `[PassAction, DribbleAction]`.
`PassAction` already declines hopeless balls via its score bar, so dribble becomes the
honest fallback: "no pass clears the bar → carry into space." No new arbiter — see
**Out of Scope** and ADR 0003 for the deferred weighted-score migration.

### 2. Carry Objective (`DribbleAction.execute` — direction)

Probe the 8 `COMPASS_DIRS` at a `CARRY_PROBE_DISTANCE` around the carrier (reusing the
scaffold from `AttackingPositionAction`), but score with a **carry-specific** objective —
*not* `spaceScore` (which includes `laneSafety` and `depthAlignment`, both irrelevant to
a carrier):

```
carryScore(candidate) = openness(candidate) × (1 + FORWARD_BIAS_WEIGHT × forwardProgress(candidate))
```

- **`openness(candidate)`** — distance to the nearest *defender* at the candidate point
  (reuse `nearest()`), measured at the candidate, not the carrier's feet.
- **`forwardProgress(candidate)`** — how much nearer the opponent goal the candidate is
  than the carrier's current position, in the attacking direction (positive = forward).

Candidates are **not clamped to a Tactical Zone** — the carrier may probe and move
anywhere on the pitch. Candidates are still clamped to the pitch bounds `[0, 1]`.

Behavioural outcomes:
- Space everywhere → forward-most open candidate wins → carry forward.
- Forward blocked, flank open → openness dominates → carry sideways/back into space.

Direction is omnidirectional (all 8, including backward). An explicit "away from marker"
term is **omitted initially** — expected to emerge from openness; add only if carriers
are observed running toward markers.

### 3. Carry Gear (`DribbleAction` — speed selection)

Select a target gear each tick from the carrier's situation:

- **Walk** (`WALK_SPEED ≈ 0.5`) — nearest defender beyond `CARRY_THREAT_RADIUS` (no
  pressure: deep buildup, unpressured probing).
- **Jog** (`JOG_SPEED ≈ 1.0`) — a defender within the threat radius but not close, **or**
  the Drive roll did not fire.
- **Drive** (`DRIVE_SPEED > 1.0`) — a defender is **close** (within `CARRY_DRIVE_RADIUS`)
  **and** the chosen carry direction is open ahead, **and** the **Drive Tendency** roll
  fires.

Each gear is a *centre*: apply a small ± `GEAR_JITTER` around the selected value
(house style — named constant plus noise). Player-to-player speed differences come from
**Pace**, not from this jitter.

**Drive Tendency (stochastic, role-gated).** When the situation invites a Drive
(close defender + open space ahead), roll against the role's `driveTendency` (0–1) — a
new field on `ZoneConfig`. High for wide attackers (`LW`/`RW` ~0.9), low for
centre-backs (`LCB`/`RCB` ~0.1). On success the gear is Drive; on failure it stays Jog.

**Dwell (anti-flicker).** Because the roll is per-tick, the chosen gear **commits for
`GEAR_DWELL_TICKS`** before re-rolling — held in the carrier's per-player state. While
dwelling, the gear is not recomputed. This stabilises the *choice*; **Speed Slew**
(below) smooths the *execution*.

### 4. Speed Slew (`simulator.ts` Stage 5 — carrier only)

Add a `currentSpeedMultiplier` field to the live player. Each tick, move it toward the
target gear multiplier by at most `SLEW_RATE` (a capped step), rather than assigning the
target directly:

```
current += clamp(target − current, −SLEW_RATE, +SLEW_RATE)
```

Stage 5 then moves the player `MOVE_SPEED × current` (× `maxSpeed` once Pace is real).
A Drive therefore winds up over several ticks. **Carrier-only for now** — off-ball
players (pressers, etc.) continue to snap; a full acceleration model is out of scope.

The `SLEW_RATE` is a **stubbed constant**, to be driven later by a per-player
**Acceleration** attribute (Pace = top speed; Acceleration = how fast you reach it).

### 5. State & speed plumbing (`DribbleCommand` / simulator)

Keep dribble as a **single `BallAction`** (no movement/ball split). The carrier's gear
state lives in the player's `actionState` bag, read/written by `DribbleAction` via
`ctx.playerState` (the simulator already exposes this). The chosen target gear rides on
the `DribbleCommand`:

```ts
interface DribbleCommand {
  type: "dribble";
  toX: number;
  toY: number;
  speedMultiplier: number;   // target gear; simulator slews currentSpeedMultiplier toward it
}
```

The simulator already special-cases the dribbler in Stage 3 (sets `targetX/targetY`); it
additionally records the command's `speedMultiplier` as the slew target for that player.
Because `DribbleAction` now needs to persist gear/dwell state, the simulator must let the
ball action read and write the carrier's `actionState` slice — mirror the `StatefulAction`
state handling already used for movement actions in Stage 4.

### Pace stub (`MatchPlayer`)

Add `maxSpeed: number` to `MatchPlayer`, defaulting to a single shared constant for every
player so non-carrier behaviour is unchanged. This is the seam for the future **Pace**
attribute (wired through `PlayerStats` + generator later). For this change, only the
carrier's slewed speed reads it.

## Constants (starting values — tune visually)

| Constant | Starting value | Purpose |
|---|---|---|
| `CARRY_PROBE_DISTANCE` | 0.08 | Compass probe radius for carry direction |
| `FORWARD_BIAS_WEIGHT` | moderate | How strongly forward progress biases direction vs. raw openness |
| `CARRY_THREAT_RADIUS` | ~0.15 | Nearest-defender distance below which the carrier leaves Walk |
| `CARRY_DRIVE_RADIUS` | ~0.08 | Defender proximity that makes a Drive *available* (still gated by the roll) |
| `WALK_SPEED` | 0.5 | Walk gear centre (× base move speed) |
| `JOG_SPEED` | 1.0 | Jog gear centre |
| `DRIVE_SPEED` | 1.4 | Drive gear centre (>1.0 so the carrier can pull away) |
| `GEAR_JITTER` | small | ± noise around each gear centre |
| `GEAR_DWELL_TICKS` | ~30 | Ticks a chosen gear commits before re-rolling |
| `SLEW_RATE` | small | Max change in speed multiplier per tick (stub for Acceleration attribute) |
| `driveTendency` (per role) | LW/RW ~0.9, CF/CAM ~0.7, CM ~0.4, FB ~0.3, CB ~0.1 | Likelihood of engaging Drive |
| `maxSpeed` (per player) | shared constant | Pace stub — top speed ceiling |

## Testing Decisions

Verify observable positional/speed/possession outcomes, not internal arithmetic.

### Carry Objective (direction)
- A carrier with open space ahead and no pressure gets a target ahead (forward carry).
- A carrier blocked ahead but with an open flank gets a target to the side/back, *not* forward.
- The carry target may lie **outside** the carrier's Tactical Zone (not clamped).
- A carrier surrounded on all probes still picks the least-bad (most-open) direction.

### Carry Gear (speed)
- Unpressured carrier (no defender within threat radius) moves at ≈ Walk.
- Carrier with a nearby-but-not-close defender moves at ≈ Jog.
- A `LW`/`RW` with a close defender and open space ahead reaches Drive far more often
  than an `LCB`/`RCB` in the identical situation (Drive Tendency).
- The selected gear does not flicker tick-to-tick within the dwell window.
- Two identical situations produce slightly different realised speeds (gear jitter).

### Speed Slew
- On engaging Drive, the carrier's speed rises over several ticks rather than jumping —
  `currentSpeedMultiplier` approaches the target gear gradually, bounded by `SLEW_RATE`.
- Off-ball players' speeds are unaffected (still snap).

### Pass-first
- With a strong pass available, the carrier passes rather than dribbles.
- With no pass clearing the bar, the carrier dribbles (fallback).

### Feedback loop

Visual inspection is the primary acceptance criterion — run the match visualiser and verify:
- Carriers turn into space in any direction, not just forward.
- Defenders walk the ball out in unpressured deep buildup.
- Wingers burst past committed defenders; centre-backs almost never do.
- The burst winds up smoothly (no teleport between gears).
- Players pass when a good pass is on and only carry when it isn't.

## Out of Scope

- **Real Pace attribute** — `maxSpeed` is stubbed to a shared constant; wiring through
  `PlayerStats` and the generator (and into pressing/recovery, i.e. *all* movement) is deferred.
- **Real Acceleration attribute** — `SLEW_RATE` is a stubbed constant; a per-player
  acceleration attribute driving the slew rate is deferred.
- **Slew on off-ball movement** — only the carrier slews; pressers and positional movers
  still snap. A full velocity/acceleration model for all players is deferred.
- **Weighted-score ball arbiter** — the pass-first priority pipeline is provisional;
  migrating to expected-value arbitration (pass vs shoot vs dribble) awaits a shoot action.
  See ADR 0003.
- **"Away from marker" direction term** — omitted initially on the expectation it emerges
  from openness; add only if carriers run toward markers.
- **Shielding / turning cost** — no penalty for reversing direction or turning under
  pressure; the carrier changes direction freely.
- **Ball physics while carrying** — the ball stays glued to the carrier as today; no
  touch-distance or knock-ahead modelling.
