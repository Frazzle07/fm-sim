---
id: "0001"
title: Unified action pipeline across all match phases
status: accepted
date: 2026-05-19
---

## Context

The buildup phase originally had its own bespoke logic in `buildup.ts`: a private `BallMode` state machine (held/inFlight), its own pass scoring, carry logic, pressing targets, and a separate `stepBuildup()` function called by the simulator in a dedicated `if (phase === "buildup")` branch. The midfield/attack phases used a separate action pipeline (`shoot → cross → pass → dribble`) with a clean `canExecute/execute` interface.

This meant carry logic (effectively dribbling) and pass selection were duplicated across two code paths, and adding new phases would require another fork.

## Decision

Eliminate `BuildupState` and `BallMode`. Buildup runs through the shared action pipeline (`passAction → dribbleAction`) with an optional `PhaseConfig` on `ActionContext` that encodes phase-specific rules:

- `gkReceiverRoles` — restricts the GK's short pass receiver pool to CB/LB/RB
- `exitRoles` — roles (CDM, CM) whose receipt causes the simulator to transition phase

Off-ball positioning (`spreadTargets`, `pressTargets`) moves to a `positioning.ts` module called alongside the pipeline, not inside actions. The simulator's `if (phase === "buildup")` branch collapses — all phases share the same per-tick action loop.

Pass action logic: forward pass first; yields to dribble if no forward receiver clears the quality threshold; recycle (sideways/backward) as last resort inside `passAction`. GK is excluded from `dribbleAction` via a hard guard in `canExecute`.

## Alternatives considered

**Keep `buildup.ts` as a separate code path.** Simpler in the short term but would require a third fork for any new phase (counter-attack, set pieces) that shares pass/dribble logic. The two code paths would drift.

**Phase-specific action lists with branching inside actions.** Actions reading `ctx.phase` directly. Rejected because it scatters phase rules into action internals and makes actions harder to reason about in isolation.

## Consequences

- Adding a new phase requires only a `PhaseConfig` and an action list — no new state machine.
- `passAction` and `dribbleAction` are now the canonical implementation of those behaviours for all phases.
- The buildup-specific `BallMode` state machine is gone; ball-in-flight is handled by the shared `ball.targetX/Y` + `actionDelay` mechanism.
- `spreadTargets` and `pressTargets` survive as off-ball positioning logic in `positioning.ts`, called by the simulator not by actions.
