---
name: FM-SIM Domain Glossary
description: Canonical terminology for the FM-SIM football simulation domain
---

# FM-SIM Domain Glossary

## Match Simulation

**Buildup**
A named phase of play from a goal kick (or equivalent restart) through the defensive passing sequence, until the ball reaches a midfielder. Runs through the shared action pipeline (pass → dribble) with a `PhaseConfig` that restricts GK short passes and defines exit roles. Ends when the ball is received by a CDM or CM (`exitRoles`), or when the GK plays a long ball (pass to a forward when no short option scores well).

**PhaseConfig**
Optional configuration passed through `ActionContext` that adapts the shared action pipeline to a specific phase. Fields: `gkReceiverRoles` (restricts who the GK can short-pass to), `exitRoles` (roles whose receipt triggers a phase transition). Phases that need no special rules pass no config.

**Action Pipeline**
The priority-ordered list of `Action` objects evaluated each tick for the ball carrier. Each action implements `canExecute(ctx)` and `execute(ctx)`. The first action whose `canExecute` returns true fires. Separate pipelines exist per phase (e.g. buildup uses `pass → dribble`; attack uses `shoot → cross → pass → dribble`).

**Off-ball Positioning**
Player movement targets for players not directly involved in the current action. Handled as a separate concern outside the action pipeline — a `getOffBallTargets` style function called alongside (not inside) actions. During buildup: possessing team spreads to create outlets; opposing forwards press the holder and shadow passing lanes.

**Phase**
A named stage of the match state machine. Current phases: `kickoff`, `buildup`, `midfield`, `attack`, `chance`, `goal`, `save`, `counter`, `corner`. Each phase governs player movement targets and stochastic transitions.

**Pressure Score**
A continuous value (0.0–1.0) representing how free a player is from the nearest opponent. Derived from `nearestOppDist` — higher means more space. Not a binary flag. Used as the primary weight in pass selection during buildup.

**Progression Value**
A continuous value (0.0–1.0) representing how far up the pitch a candidate receiver is, normalised to the attacking direction. A free midfielder scores higher than a free defender because their progression value is higher, not because of their role directly.

**Pass Score**
The combined attractiveness of passing to a candidate: `pressureScore × progressionValue + noise`. Pressure and progression are multiplicative — a marked midfielder scores lower than a free defender.

**Long Ball**
A goalkeeper punt that bypasses the defensive buildup entirely. Triggered probabilistically when the GK's best pass option scores below a threshold (everyone is pressed). Ends the buildup phase immediately with possession contested. Distinct from a headed duel (not yet modelled).

**Drawing the Press**
The emergent behaviour where defenders pass between each other because midfielders are marked. Not explicitly coded — arises from the pass scoring formula: marked midfielders have low pressure scores, so free defenders outscore them until the press shifts.

**Header Duel**
A contested long ball where the striker and a defender compete for possession in the air. Not yet implemented — deferred for a future phase.

## Match Simulator

**Simulator**
The tick loop owner. Advances match state one tick at a time, sequences the four stages per tick, and emits a `SimFrame`. Does not make decisions — delegates all action selection to the action pipeline.

**MatchPlayer**
A read-only, lean view of a player exposed to actions via `ActionContext`. Contains only: `id`, `name`, `position`, `isHome`, `x`, `y`. Simulator internals (jitter phases, movement frequencies) are not exposed.

**ActionContext**
The read-only snapshot passed to every action each tick. Contains: `player` (the acting player as `MatchPlayer`), `allPlayers` (all players as `MatchPlayer[]`), `ball`, `ballHolderId`, `phase`, `tick`.

**Action**
Governs movement for a single player. Implements `canExecute(ctx): boolean` and `execute(ctx): XY`. The simulator evaluates the movement action pipeline in priority order — the first action whose `canExecute` returns true fires and returns a movement target.

**BallAction**
Governs what the ball carrier does with the ball. Implements `canExecute(ctx): boolean` and `execute(ctx): BallCommand`. Evaluated against the ball action pipeline (pass → shoot → dribble) for the carrier only.

**BallCommand**
The output of a `BallAction`. A discriminated union describing what happens to the ball: `{ type: "pass", receiverId, flight }` or similar. The simulator applies the command after all movement targets are computed.

**Movement Action Pipeline**
Priority-ordered list of `Action` objects evaluated each tick for every player. First action whose `canExecute` returns true fires. Lives in `actions/` — adding a new movement behaviour means adding a new action file, not editing the simulator.

**Ball Action Pipeline**
Priority-ordered list of `BallAction` objects evaluated each tick for the ball carrier only. Ordered: dribble → pass → shoot. Dribble fires first when the carrier has open space ahead (no opponent within `DRIBBLE_SPACE_RADIUS` in the attacking direction); pass fires when a lane exists; shoot when in range. Dribble is not a pure fallback — it is a genuine first choice when space exists.

**Dribble**
A `BallAction` that moves the ball carrier forward (toward the opponent's goal) by a fixed step when open space exists ahead. The ball stays glued to the carrier — `ball.x = carrier.x, ball.y = carrier.y` throughout. Returns `{ type: "dribble", toX, toY }`. The simulator sets the carrier's movement target to `(toX, toY)`. On reaching the target, the pipeline re-evaluates normally — no special transition. `DRIBBLE_SPACE_RADIUS = 0.15` (opponent-free zone ahead required to trigger).

**Dribble Step**
The fixed forward distance a carrier moves per dribble evaluation. Small enough to re-evaluate frequently; large enough to produce visible forward progress. Tunable constant.

**Tick Stages**
The fixed sequence within each `advance()` call:
1. Compute movement targets — evaluate movement pipeline for all players
2. Compute ball command — evaluate ball action pipeline for the carrier
3. Apply movement — step each player toward their target
4. Apply ball command — update ball flight / holder
5. Advance ball flight — interpolate ball position
6. Emit frame
