# ADR 0003: Ball-action priority pipeline is provisional; migrate to a weighted arbiter when shooting lands

## Status
Accepted, but its **timing** is superseded by [ADR 0004](0004-ball-action-arbiter.md):
the arbiter was built before shooting landed, because pass-vs-dribble proved to be
a peer trade-off rather than a fallback (the premise below that the two are
"indistinguishable" at N=2 was wrong). The migration described here still happened
as anticipated — just one step earlier than its stated trigger.

## Context

Ball actions are selected by a lexicographic **priority pipeline**: the simulator
tries each `BallAction` in order and the first whose `canExecute` returns true
fires. Today there are two — ordered `pass → dribble`. Pass fires when a
candidate clears its Pass Score bar; dribble is the fallback when no pass is on.

This is adequate while there are only two options. The pass/dribble boundary is
already value-based (PassAction computes a continuous score and yields when
nothing clears the threshold), so at N=2 the priority pipeline and a weighted
decision are indistinguishable.

The ceiling appears at N=3. Once a **shoot** action exists, the real decision —
"a half-chance shot vs. a safe pass vs. carrying into a better position" — is
three options on one continuous expected-value scale. Boolean priority cannot
express that: the best option is not always the highest-priority one.

## Decision

Keep the priority pipeline for now and flip its order to **pass-first**
(`pass → dribble`), making dribble an explicit fallback. Do **not** build a
weighted-score arbiter yet — there is no shoot model to define
`expectedValue(shoot)`, so the third competing case is not real.

When shooting lands and genuinely competes with pass and dribble on expected
value, migrate the ball-carrier decision from a priority pipeline to a
**weighted-score arbiter**: each ball action proposes an expected value, and the
carrier picks the maximum. This migration is anticipated, not an oversight.

## Consequences

- Flipping to pass-first reverses the earlier documented stance that "Dribble is
  not a pure fallback." Dribble is now the fallback when no pass clears the bar.
  The glossary **Dribble** and **Ball Action Pipeline** entries are updated to match.
- The migration to a weighted arbiter touches the ball-decision core and every
  ball action's interface (`canExecute`/`execute` → a `score`-style method).
  Recording it here means the next person sees the priority pipeline as a known,
  intended provisional state rather than a design to be "fixed" ad hoc.
