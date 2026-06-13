# ADR 0004: Ball-action arbiter arrives before shooting; pass-vs-dribble is a peer trade-off

## Status
Accepted. Supersedes the *timing* of [ADR 0003](0003-ball-action-pipeline-is-provisional.md).

## Context

ADR 0003 kept the ball-action **priority pipeline** (pass → dribble) and deferred
the weighted-score arbiter until a **shoot** action landed, on the reasoning that
at N=2 the pass/dribble boundary is already value-based, so the pipeline and an
arbiter are "indistinguishable" — dribble is only ever a fallback for when no
pass is on.

That premise turned out to be wrong, for two reasons:

1. **The fallback was never wired.** `PassAction.canExecute` returns true whenever
   a pass is *physically possible* (a teammate with a passing lane), not when a
   pass *clears a value bar*. There is no Pass Score threshold in the gate. So
   pass fired almost always and `DribbleAction` was effectively dead code — the
   value-based boundary the ADR relied on did not exist.

2. **Pass-vs-dribble is a genuine peer decision, not a fallback.** Concrete case:
   a winger in acres of space should drive forward *even when a good sideways pass
   is available*. A priority pipeline structurally cannot express "a high-value
   dribble beats a high-value pass" — pass is first, so any pass that clears its
   bar wins. This is distinguishable from an arbiter at N=2, contradicting ADR
   0003's central claim. Dribble is sometimes the *positively correct* choice,
   not the leftover.

## Decision

Build the **weighted-score arbiter now**, at N=2, rather than waiting for shoot.

- Every eligible `BallAction` proposes an **Expected Gain** on one shared scale;
  the carrier executes the maximum. `canExecute` still gates *eligibility* (is
  the action possible at all) but no longer decides *selection*.
- The shared scale is **marginal expected progression**:
  `expectedGain = stateValue(after) − stateValue(now)`, where `stateValue()` is a
  single shared function estimating probability-weighted progression toward goal
  (depth × survival probability). Marginal, not absolute, so non-progressive
  passes score near zero and a carry into space can win.
- When shoot lands, it slots in as a third proposer with
  `expectedGain = xG − stateValue(now)`. No re-ordering, no structural change —
  which is the forward-compatibility ADR 0003 wanted, arrived at one step earlier.

## Consequences

- The migration ADR 0003 anticipated happens before its trigger. The trigger was
  miscalibrated: pass-vs-dribble was assumed to be a fallback relationship and is
  in fact a peer trade-off. Recording it here so the early arrival reads as a
  corrected premise, not an unplanned reversal.
- Both `PassAction` and `DribbleAction` change their return contract: each must
  produce an Expected Gain (via `stateValue`), not its prior ad-hoc score. The
  existing pass-scoring and carry-objective formulas become *inputs* (they
  estimate survival probability and the resulting position), not the output.
- `stateValue()` becomes load-bearing: it is the single place the "how good is
  this ball state" judgement lives, and the only thing shoot's xG must be
  commensurable with. Mis-tuning it mis-tunes every carrier decision at once —
  which is the point (one knob, not a magic constant per action pair).
- The arbiter must still inject life (the engine's house style): selection takes
  a small noise term so identical situations don't produce identical choices,
  matching PassAction score noise and movement jitter.
