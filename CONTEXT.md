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

## Match Simulator V2

**TickPlan**
The output of stage 1 (action selection) for a single tick. Contains two independent parts: a `Command` (the carrier's chosen action — pass, shoot, dribble, tackle) and a `positions` map (`Map<playerId, XY>`) of movement targets for all off-ball players. Stage 2 applies both without conflict — the command owns ball state, the positions map owns non-carrier player targets.

**Strict Pipeline**
The fixed stage ordering that guarantees ball and player positions are always computed from the same snapshot. Stages run in sequence with no cross-stage mutation: `selectActions → resolvePhysics → resolveState → emitFrame`. Each stage reads only from the previous stage's output.

**Positioning Pass**
Sub-step 1a of `selectActions`. Computes movement targets for all off-ball players before any carrier action fires. The carrier's pass action reads `receiver.targetX/targetY` (not current position) to aim the ball into space the receiver is already running into.

**Pass Into Space**
Default pass behaviour in v2. The ball is aimed at the receiver's `targetX/targetY` (computed during the positioning pass) rather than their current position. The receiver runs onto the ball rather than stopping to receive it. Curved runs that react to ball flight are a future feature.
