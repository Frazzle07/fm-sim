import { attackingDepth } from "../queries";
import type { XY } from "../types";
import type { ActionContext, ActionProposal, BallAction, MatchPlayer } from "./types";

// ─── Ball Action Arbiter ─────────────────────────────────────────────────────
// Every eligible BallAction proposes an Expected Gain on one shared scale; the
// carrier executes the proposal with the highest gain. Replaces the old
// pass-first priority pipeline. See CONTEXT.md (Ball Action Arbiter, State
// Value, Expected Gain, Survival Probability) and ADR 0004.

// Small selection noise so two near-identical situations don't always resolve to
// the same action (engine house style: mirrors PassAction score noise / movement
// jitter). Kept well below typical gain gaps so it breaks ties, not decisions.
const SELECTION_NOISE = 0.01;

function noise(): number {
	return (Math.random() - 0.5) * 2 * SELECTION_NOISE;
}

// State Value: how good a ball state is — progression toward the opponent goal
// (attackingDepth) discounted by the probability the team keeps the ball
// (Survival Probability). The single place the "how good is this" judgement
// lives. Linear in depth initially (see Constants table in the PRD).
export function stateValue(
	point: XY,
	holder: { isHome: boolean },
	survival: number,
): number {
	const depth = attackingDepth(point.y, holder.isHome);
	return depth * survival;
}

// The "now" baseline: value of the current ball state, with survival = 1 because
// possession is certain right now. Each action subtracts this to form its
// marginal Expected Gain, so all actions are compared against the same baseline.
export function baselineValue(ctx: ActionContext): number {
	return stateValue(ctx.ball, ctx.player, 1);
}

// Pick the eligible action whose proposed Expected Gain (plus a dash of noise) is
// highest. Returns null when no action is eligible (the carrier does nothing this
// tick). The baseline is computed once and threaded via ctx so every action's
// propose() subtracts the identical "now" value.
export function chooseBallAction(
	ctx: ActionContext,
	actions: readonly BallAction[],
): { action: BallAction; proposal: ActionProposal } | null {
	const eligible = actions.filter((a) => a.canExecute(ctx));
	if (eligible.length === 0) return null;

	const baseline = baselineValue(ctx);
	const ctxWithBaseline: ActionContext = { ...ctx, baseline };

	let best: { action: BallAction; proposal: ActionProposal } | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (const action of eligible) {
		const proposal = action.propose(ctxWithBaseline);
		const score = proposal.gain + noise();
		if (score > bestScore) {
			bestScore = score;
			best = { action, proposal };
		}
	}
	return best;
}

// Maps a 0–1 retention probability through a sanity clamp. Estimators feed their
// own failure-mode math in; this just keeps P a probability.
export function clampSurvival(p: number): number {
	return Math.max(0, Math.min(1, p));
}

// Re-exported helper so action estimators share the same nearest-defender notion.
export function nearestDefenderDistance(
	point: XY,
	opponents: readonly MatchPlayer[],
): number {
	let min = Number.POSITIVE_INFINITY;
	for (const opp of opponents) {
		const d = Math.hypot(opp.x - point.x, opp.y - point.y);
		if (d < min) min = d;
	}
	return min;
}
