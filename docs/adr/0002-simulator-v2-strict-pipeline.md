# ADR 0002 — Simulator V2: Strict Tick Pipeline

## Status
Accepted

## Context
The v1 simulator (`simulator.ts`) has a recurring bug where the ball carrier visually separates from the ball. The root cause is that `advance()` mutates ball position, player position, possession state, and phase all within a single function — in an order that varies depending on which branch executes. Adding new features (dribbling, tackling) kept breaking existing sync because each addition had to reason about what had and hadn't been mutated at its insertion point.

## Decision
V2 (`src/domains/matchv2/`) uses a strict four-stage pipeline per tick:

1. **selectActions** — reads a snapshot, produces a `TickPlan` (no mutation)
2. **resolvePhysics** — applies ball and player movement from the `TickPlan`
3. **resolveState** — updates `holderId`, possession, and phase from resolved positions
4. **emitFrame** — snapshots everything into a `SimFrame`

No stage mutates data that a previous stage has already read. Ball and player positions are always computed from the same pre-tick snapshot.

Stage 1 runs in two sub-steps: positioning pass (1a) then carrier action (1b). This allows pass actions to aim at a receiver's movement target rather than their current position, enabling natural "pass into space" behaviour without any receiver lookahead.

V2 lives in a separate `src/domains/matchv2/` directory and takes a `MatchResult` as input from the existing match domain. The existing engine, processor, types, and schedule are unchanged.

## Alternatives considered
- **Fix mutation order in v1 in-place**: The ordering fix alone doesn't prevent future regressions — any new feature added mid-function can reintroduce the problem. The pipeline makes the constraint structural and enforced by type boundaries.
- **Entity-component system**: More flexible but significantly more infrastructure for a simulation that has a fixed set of 22 players and a single ball. Overkill at this stage.

## Build phases and acceptance criteria

Features are built and verified one at a time. Each phase has a specific visual failure mode catchable immediately in the match pitch renderer.

### Phase 1 — Strict pipeline skeleton + carrier movement
Build the four-stage pipeline with a single action: the carrier holds the ball and dribbles toward goal.

**Done when:** Ball stays glued to carrier at all times. No visual separation between carrier dot and ball dot across an entire 90-minute replay.

### Phase 2 — Pass
Add pass action. Ball flies to receiver's `targetX/targetY` (positioning-pass target, not current position).

**Done when:** Ball travels in a smooth arc to where the receiver is running. Receiver picks it up cleanly. No ghost possession (two players showing `hasBall`). No ball teleporting to receiver before flight completes.

### Phase 3 — Off-ball positioning
Add positioning pass (stage 1a). Non-carriers move to sensible spread/channel positions. Defenders press the carrier.

**Done when:** Possessing team fans out visibly. Defenders close down the carrier rather than staying in their base positions. No players bunching on the same spot.

### Phase 4 — Phase transitions
Wire up the phase state machine. Buildup → midfield → attack → chance fires in sequence. Forced events (goals, cards) override stochastic transitions at the correct minute.

**Done when:** A full 90-minute replay with pre-computed goals plays out with goals appearing at the correct minutes. Phase label in the scoreboard changes coherently.

### Phase 5 — Dribble
Add dribble action. Carrier advances toward goal when no pass option scores above threshold.

**Done when:** Carrier visibly moves forward when surrounded (no open teammates). Nearest defender closes down and can trigger a tackle.

### Phase 6 — Shoot and cross
Add shoot and cross actions. Shot fires when carrier is in the final third. Ball travels to goal. Goal/save resolves and feeds back into phase state machine.

**Done when:** Shots visibly travel toward goal. Goals increment the scoreboard. Save transitions to buildup with keeper holding the ball.

## Consequences
- Each new feature slots into a defined stage rather than being inserted at an arbitrary point in a god function.
- The `TickPlan` type is the explicit contract between selection and physics — testable in isolation.
- Receiver reactions to ball flight (curved runs reacting to a pass being played) are deferred; passers aim at receiver target position computed before the pass fires.
- `MatchPitchV2.tsx` continues to point at v1 until Phase 4 acceptance criteria are met, at which point a single import swap ships v2.
