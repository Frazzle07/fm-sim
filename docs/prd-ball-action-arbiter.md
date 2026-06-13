# PRD: Ball Action Arbiter — Expected-Gain Selection for Pass vs Dribble

## Problem Statement

The ball carrier never dribbles when a pass is available. `BALL_ACTIONS` is a
**priority pipeline** (`[PassAction, DribbleAction]`) — the first action whose
`canExecute` returns true fires. Two compounding faults make this pass-everything:

1. **The score bar was never wired.** ADR 0003 assumed `PassAction.canExecute`
   declines when no pass clears a Pass Score bar, leaving dribble as the honest
   fallback. It does not: `canExecute` returns true whenever *any* teammate has a
   passing lane with fewer than two blockers (`PassAction.ts:181`). That is "is a
   pass physically possible," not "is a pass good." Pass therefore fires almost
   always and `DribbleAction` is effectively dead code.

2. **A priority pipeline cannot express a peer trade-off.** Even with the bar
   wired, a priority list can only make dribble a *fallback*. It structurally
   cannot say "a winger has acres of space ahead — drive into it *even though* a
   good sideways pass is on." For a high-value dribble to beat a high-value pass,
   both must produce a comparable number and the larger win. That is a
   weighted-score arbiter, not a priority list.

ADR 0003 deferred the arbiter until a shoot action existed, on the premise that
at N=2 pass-vs-dribble is a fallback relationship indistinguishable from
arbitration. The winger scenario disproves that premise: pass-vs-dribble is a
genuine **peer** decision. The arbiter is needed now, before shooting.

## Solution

Replace the priority pipeline with a **Ball Action Arbiter**: every eligible ball
action proposes an **Expected Gain** on one shared scale, and the carrier executes
the action with the highest gain.

1. **One common currency.** Each action proposes a **marginal expected
   progression**: `stateValue(after) − stateValue(now)`. A single shared
   `stateValue()` function is the only place the "how good is this ball state"
   judgement lives. Marginal (not absolute) so a non-progressive sideways/backward
   pass scores near zero while a carry into open space scores positive.
2. **Shared survival definition, per-action estimators.** `stateValue` discounts
   progression by a **Survival Probability** `P` = "probability the team still has
   the ball after this action resolves." One fixed *definition*; each action
   estimates it from its own failure mode (pass: lane safety + receiver openness;
   carry: nearest-defender proximity at the carry target).
3. **Extracted, testable arbiter.** Selection lives in a `chooseBallAction`
   function in `actions/`, not in the simulator — preserving the Simulator's
   "makes no decisions" principle. Each action exposes `propose(ctx) → { gain,
   command }`, computing its best move and that move's gain together (one pass).
4. **Gear stays downstream.** The arbiter decides *whether* to carry on a neutral
   (Jog-equivalent) survival estimate; the existing **Carry Gear** / **Drive
   Tendency** / **Speed Slew** apparatus then chooses *how fast*, untouched. The
   stochastic gear roll never feeds back into the pass-vs-dribble choice.
5. **Pure proposals.** `propose()` reads `ctx.playerState` but never mutates it,
   so pricing a *losing* action cannot corrupt its state. `updateState` (the gear
   dwell/roll) runs only on the arbiter's **winner**, reusing the existing
   `StatefulBallAction` machinery relocated from "first true" to "max gain."

## Domain Terms

Defined in [CONTEXT.md](../CONTEXT.md): **Ball Action Arbiter**, **State Value**,
**Expected Gain**, **Survival Probability**, and the rewritten **Ball Action
Pipeline**. This PRD is the implementation detail behind those glossary entries.
The decision to build the arbiter before shooting — and why it supersedes the
*timing* of ADR 0003 — is recorded in
[ADR 0004](adr/0004-ball-action-arbiter.md).

## User Stories

1. As a spectator, I want a winger with open space ahead to drive into it *even
   when* a safe sideways pass is available, so that carrying is a positive choice,
   not just a last resort.
2. As a spectator, I want the carrier to pass when a forward pass genuinely
   improves the team's position more than carrying would, so that selfish
   dribbling past a better option does not happen.
3. As a spectator, I want sideways and backward passes to be rare unless nothing
   else progresses the ball, so that possession looks purposeful rather than
   safe-for-safety's-sake.
4. As a developer, I want the carrier's decision to be one max-of-proposals
   comparison so that adding a shoot action later is dropping in a third proposer,
   not re-architecting the selection.
5. As a developer, I want the arbiter to be unit-testable in isolation (feed it a
   ball state, assert the chosen action) without driving a full simulator tick.

## Implementation Decisions

### 1. `BallAction` interface — `propose()` replaces `execute()` (`actions/types.ts`)

Both `BallAction` and `StatefulBallAction` change their selection contract:

```ts
export interface ActionProposal {
  gain: number;            // Expected Gain: stateValue(after) − stateValue(now)
  command: BallCommand;    // the move this action would make if it wins
}

export interface BallAction {
  canExecute(ctx: ActionContext): boolean;   // eligibility only — NOT selection
  propose(ctx: ActionContext): ActionProposal;
}
```

- `canExecute` keeps its current job of **eligibility** (is this action possible
  at all — e.g. is there any legal pass target). It no longer decides *which*
  action runs.
- `propose()` is **pure**: it may read `ctx.playerState` but must not advance it.
  It computes the action's best move once and returns both that move's `command`
  and its `gain`. No more separate `execute()` — the command is produced at
  propose time and reused by the winner.
- `StatefulBallAction` keeps `stateKey` + `updateState`; only its winner runs
  `updateState` (see §4).

### 2. `stateValue()` + arbiter (`actions/arbiter.ts` — new file)

A single shared function and the selection loop:

```ts
// How good is a ball state: progression toward goal × survival probability.
function stateValue(point: XY, holder: MatchPlayer, survival: number): number {
  const depth = attackingDepth(point.y, holder.isHome); // 0 own goal → 1 opp goal
  return depth * survival;
}

function chooseBallAction(ctx, actions): ActionProposal | null {
  const eligible = actions.filter((a) => a.canExecute(ctx));
  if (eligible.length === 0) return null;
  const proposals = eligible.map((a) => a.propose(ctx));
  // House style: small selection noise so identical situations don't tie identically.
  return argmax(proposals, (p) => p.gain + noise());
}
```

- `stateValue` is **the** load-bearing knob — mis-tuning it mis-tunes every carrier
  decision at once (by design: one knob, not a magic constant per action pair).
- The **"now" baseline** (`stateValue(ctx.ball, currentHolder, 1)` — possession is
  certain *right now*) is computed once and subtracted by each action to form its
  marginal gain. Decide in build whether the baseline lives in the arbiter (passed
  to each `propose`) or each action recomputes it; prefer arbiter-computed and
  threaded via `ctx` to guarantee all actions subtract the *same* baseline.
- Selection noise mirrors PassAction score noise / movement jitter (engine house
  style). Keep it small relative to typical gain differences.

### 3. Per-action proposals

**`PassAction.propose`** (`PassAction.ts`):
- Reuse the existing per-teammate scoring to find the best receiver and the Lead
  Offset / Pass Target (unchanged — the geometry stays).
- Derive **Survival Probability** from the existing `laneSafety` and receiver
  `openness` terms, calibrated to mean P(pass reaches a friendly receiver). The
  current unitless `score` becomes an *input* to P, not the output.
- `after` = the **Pass Target** position, held by the receiver. `gain =
  stateValue(target, receiver, P) − baseline`.
- `canExecute` keeps its current "is a legal pass possible" gate (a non-progressive
  pass is now *eligible* but simply proposes a low/near-zero gain — the arbiter,
  not the gate, declines it).

**`DribbleAction.propose`** (`DribbleAction.ts`):
- Reuse `bestCarryCandidate(ctx)` for the carry target (unchanged geometry).
- **Survival Probability** from nearest-defender proximity at the carry target,
  using a **neutral Jog-equivalent** retention estimate — no gear has been rolled
  at propose time (see §4). Calibrate to the same "we still have the ball" meaning
  as the pass estimator.
- `after` = the carry candidate position, still held by the carrier. `gain =
  stateValue(candidate, ctx.player, P) − baseline`.
- The `command` carries `speedMultiplier` as today — but its *value* is set by the
  downstream gear machinery on the winner, not at propose time. At propose time use
  a placeholder/neutral multiplier; the winner's `updateState` + execute path sets
  the real gear (see §4).

### 4. Winner-only stateful execution (`simulator.ts` Stage 3)

Replace the "first `canExecute` true" loop with:

1. `const winner = chooseBallAction(ctx, BALL_ACTIONS)`.
2. If `winner` is a `StatefulBallAction`'s proposal, run the **existing**
   `updateState → store → re-propose-with-state` machinery (simulator.ts:228-233)
   **only on the winning action**, so the Carry Gear/dwell advances exactly once
   per tick and only when dribble actually fires.
3. Apply `winner.command` exactly as Stage 3 does today (pass → set `ballFlight`;
   dribble → set `targetX/targetY` + `speedMultiplier` as the slew target).

Because gear is rolled only on the winner, and `propose()` priced the carry on a
neutral estimate, the gear roll is strictly downstream of selection — it can never
flicker the pass-vs-dribble decision. `BALL_ACTIONS` stays `[PassAction,
DribbleAction]` but **order no longer matters** (it's a set, not a priority list).

### 5. Shoot forward-compatibility (no code now)

When shoot lands it implements the same interface: `ShootAction.propose` returns
`{ gain: xG − baseline, command: { type: "shoot", ... } }`. No arbiter change, no
re-ordering. This is the whole reason for building the arbiter now rather than a
narrower fallback fix.

## Constants (starting values — tune visually)

| Constant | Starting value | Purpose |
|---|---|---|
| selection `noise` amplitude | small (≪ typical gain gap) | Break ties / vary identical situations (house style) |
| pass `P` calibration | tune so a clear lane + open receiver ≈ 0.9, tight marking ≈ 0.3 | Map lane safety + openness → retention probability |
| carry `P` calibration | tune so open space ≈ 0.9, defender at `CARRY_DRIVE_RADIUS` ≈ 0.4 | Map nearest-defender proximity → retention probability (Jog-neutral) |
| `stateValue` depth curve | linear in `attackingDepth` initially | Progression value; revisit if mid-third passing is over/under-valued |

No new gear/speed constants — §3 of [prd-natural-dribbling](prd-natural-dribbling.md)
owns those and they are untouched.

## Testing Decisions

Verify observable selection outcomes, not internal arithmetic.

### Arbiter selection
- **Winger in space (the motivating case):** carrier with open space ahead *and* a
  safe sideways pass available → arbiter selects **dribble** (carry gain >
  non-progressive pass gain).
- **Forward pass on:** carrier with a free, advanced teammate ahead and no carry
  space → arbiter selects **pass** (forward pass gain > blocked carry gain).
- **Nothing progresses:** carrier hemmed in, only a backward pass available → the
  least-bad option wins; assert it does not crash and picks a real action.
- **Tie-break variation:** two near-identical situations do not always select the
  same action (selection noise).

### Marginal-gain behaviour
- A purely sideways pass (no depth change) proposes a gain near zero.
- A pass that retreats to a deeper teammate proposes a negative gain and loses to
  any forward option.

### Survival commensurability
- A risky pass (tight lane) and a risky carry (defender close) that lead to the
  *same* resulting depth propose *similar* gains — the two `P` estimators are
  calibrated to the same meaning.

### Purity / state
- Calling `propose()` on `DribbleAction` does **not** advance the carrier's Carry
  Gear state (dwell tick unchanged) when dribble is *not* selected.
- When dribble **is** selected, the gear dwell/roll advances exactly once for that
  tick (no double advance, no skipped advance) — existing dribbling tests still pass.

### Regression
- All existing PassAction / DribbleAction behavioural tests pass (Lead Offset,
  Carry Objective, gears, slew) — this change touches *selection*, not geometry or
  speed.

### Feedback loop

Visual inspection is the primary acceptance criterion — run the match visualiser
and verify:
- Wingers with space drive forward rather than recycling possession sideways.
- Sideways/backward passing drops noticeably versus the pass-first build.
- Players still pass when a forward pass is the better option (no selfish carrying).
- No regression in carry feel (gears, wind-up) or pass feel (lead into space).

## Out of Scope

- **Shoot action** — the third proposer is the *reason* for the arbiter but is not
  built here. `propose()` is shaped to accept it without change. See ADR 0004 §5.
- **Gear feeding the survival estimate** — the carry's `P` uses a neutral
  Jog-equivalent estimate; pricing a Drive's higher retention into the gain
  (entangling the gear roll with selection) is deliberately rejected. See
  [CONTEXT.md](../CONTEXT.md) **State Value** and grilling decision Q6.
- **Non-linear / learned `stateValue`** — depth × survival, linear in depth, is the
  starting model. A richer pitch-value surface (xT grid, zone weights) is deferred.
- **Off-ball influence on gain** — an action's gain ignores how it changes *future*
  off-ball options (e.g. a pass that unlocks a runner). Single-step marginal value
  only; multi-step lookahead is deferred.
- **Tackle/loose-ball actions** — the arbiter governs the *carrier's* ball actions
  only. `TackleAction` and loose-ball pursuit are unchanged.
```
