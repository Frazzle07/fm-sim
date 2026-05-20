# ADR 0001: Action Pipeline Architecture for Match Simulator

## Status
Accepted

## Context

The `MatchSimulator` was a monolithic tick loop that mixed sequencing, decision-making, and physics in a single `advance()` method. `launchPass` — which selects a pass target and computes ball flight — lived directly on the simulator class, making it impossible to add or change actions without editing the simulator itself.

The core problem: the simulator was both an orchestrator (sequencing what happens) and a decision-maker (deciding what action to take). These are different concerns.

## Decision

Split the match simulator into two layers:

**Simulator** — pure sequencer. Owns the tick loop and match state. Does not decide what actions to take. Each tick it: computes movement targets, computes a ball command, applies movement, applies the ball command, advances ball flight, emits a frame.

**Actions** — self-contained decision units in `src/domains/match/actions/`. Two kinds:
- `Action` — governs player movement. Implements `canExecute(ctx)` and `execute(ctx): XY`.
- `BallAction` — governs what the ball carrier does. Implements `canExecute(ctx)` and `execute(ctx): BallCommand`.

Both receive an `ActionContext` — a lean, read-only snapshot of match state (`player`, `allPlayers`, `ball`, `ballHolderId`, `phase`, `tick`). The context uses `MatchPlayer` (not the internal `LivePlayer`) so simulator internals (jitter phases, move frequencies) are never exposed to action logic.

Actions are evaluated in priority order. Adding a new behaviour means adding a new action file — the simulator is never touched.

## Alternatives Considered

**Keep launchPass on the simulator.** Simple in the short term but doesn't scale — every new action (shoot, dribble, tackle) would add more methods and branching to the simulator. The simulator would grow to own the logic for every situation on the pitch.

**Single unified pipeline (movement + ball in one action type).** Simpler interface but conflates two different concerns — every movement action would need to handle the ball-carrier case, and every ball action would need a movement fallback. Keeping them separate means each is responsible for exactly one thing.

## Consequences

- Adding a new action (e.g. shooting) requires only a new file in `actions/` — no changes to `simulator.ts`.
- The simulator's `advance()` is a fixed, readable sequence of six named stages.
- `ActionContext` is the stable contract between the simulator and all actions. Changes to simulator internals do not affect action code.
- `movement.ts` and the old `pass.ts` are dissolved — their logic moves into the relevant action files where it belongs.
