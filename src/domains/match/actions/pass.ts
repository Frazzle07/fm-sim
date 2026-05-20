/**
 * pass.ts — a player plays the ball to a teammate.
 *
 * Pass selection scores all teammates on:
 *   +forwardProgress — reward passes toward the opponent's goal
 *   +openSpace       — prefer receivers who are away from defenders
 *   -distance        — slight preference for shorter, safer passes
 *   +noise           — small random variation to avoid determinism
 *
 * A "recycle" pass sideways or backward is used when no forward option
 * scores well enough — models teams recycling possession to reset.
 *
 * Off-ball teammates move into channels (not just their base) so receivers
 * are already running into space when the ball arrives.
 */

import type { Action, ActionContext, ActionResult } from "./types";
import { dist, distPlayers, forwardProgress, openSpaceScore } from "./util";

const PASS_SPEED = 0.020;

// Minimum open-space score for a forward pass to be preferred over recycling
const FORWARD_PASS_THRESHOLD = 0.3;

// How close a defender must be to the carrier to trigger a first-time pass
const PRESSURE_RANGE = 0.12;

function eligibleReceivers(ctx: ActionContext) {
	const { carrier, players, homePossession, phaseConfig } = ctx;
	const isGK = carrier.role === "GK";
	const allowedRoles = isGK
		? (phaseConfig?.gkReceiverRoles ?? null)
		: (phaseConfig?.receiverRoles ?? null);

	return players.filter((p) => {
		if (p.isHome !== homePossession) return false;
		if (p.id === carrier.id) return false;
		if (p.role === "GK") return false;
		if (allowedRoles && !allowedRoles.includes(p.role)) return false;
		return true;
	});
}

function scoreReceivers(ctx: ActionContext) {
	const { carrier, players, homePossession, rng } = ctx;
	const teammates = eligibleReceivers(ctx);
	const opponents = players.filter((p) => p.isHome !== homePossession);

	if (teammates.length === 0) return [];

	return teammates.map((t) => {
		const d = dist(carrier.x, carrier.y, t.x, t.y);
		const fp = forwardProgress(carrier, t, homePossession);
		const open = openSpaceScore(t, opponents);
		const noise = (rng() - 0.5) * 0.25;
		// Weight long passes more heavily against shorter options
		const distPenalty = d > 0.4 ? d * 1.5 : d * 0.8;
		const score = fp * 1.2 + open * 1.8 - distPenalty + noise;
		return { player: t, score, isForward: fp > 0, open };
	});
}

function nearestOpponentDist(ctx: ActionContext): number {
	const { carrier, players, homePossession } = ctx;
	const opponents = players.filter((p) => p.isHome !== homePossession);
	if (opponents.length === 0) return 1;
	return Math.min(...opponents.map((o) => distPlayers(carrier, o)));
}

/** Returns target channel positions so off-ball players run into space. */
function channelTargets(
	ctx: ActionContext,
	receiverId: string,
): Map<string, { x: number; y: number }> {
	const { carrier, players, homePossession, rng } = ctx;
	const targets = new Map<string, { x: number; y: number }>();
	const attackDir = homePossession ? 1 : -1;

	// Spread supporting players into three channels (left, centre, right)
	const channels = [0.2, 0.5, 0.8];
	const supportersToAssign = players.filter(
		(p) =>
			p.isHome === homePossession &&
			p.id !== carrier.id &&
			p.id !== receiverId &&
			p.role !== "GK",
	);

	supportersToAssign.forEach((p, i) => {
		const channelX = channels[i % channels.length] ?? p.baseX;
		// Push forward of carrier's current position, varying depth per player
		const depthOffset = (0.08 + (i % 3) * 0.06) * attackDir;
		const targetY = Math.max(0.05, Math.min(0.95, carrier.y + depthOffset));
		// Mix between channel and base position — closer to base for defensive players
		const isDefensive = p.role === "CB" || p.role === "LB" || p.role === "RB" || p.role === "GK";
		const channelBlend = isDefensive ? 0.15 : 0.55;
		targets.set(p.id, {
			x: p.baseX + (channelX - p.baseX) * channelBlend + (rng() - 0.5) * 0.04,
			y: targetY,
		});
	});

	return targets;
}

export const passAction: Action = {
	name: "pass",
	priority: 25, // after shoot/cross, before dribble

	canExecute(ctx) {
		const underPressure = nearestOpponentDist(ctx) < PRESSURE_RANGE;
		if (underPressure) {
			return eligibleReceivers(ctx).length > 0;
		}
		const scored = scoreReceivers(ctx);
		return scored.length > 0 && scored.some((s) => s.score >= FORWARD_PASS_THRESHOLD);
	},

	execute(ctx): ActionResult {
		const scored = scoreReceivers(ctx);
		if (scored.length === 0) return { action: "pass" };

		scored.sort((a, b) => b.score - a.score);
		const best = scored[0];
		if (!best) return { action: "pass" };

		const underPressure = nearestOpponentDist(ctx) < PRESSURE_RANGE;
		// Under pressure, pick the most open receiver regardless of direction;
		// otherwise take the highest overall scorer.
		const receiver = underPressure
			? (scored.slice().sort((a, b) => b.open - a.open)[0]?.player ?? best.player)
			: best.player;

		const playerTargets = channelTargets(ctx, receiver.id);

		const exitRoles = ctx.phaseConfig?.exitRoles;
		const triggersExit = exitRoles ? exitRoles.includes(receiver.role) : false;
		const reason = underPressure
			? `under pressure (${nearestOpponentDist(ctx).toFixed(2)}), passing to ${receiver.name} (${receiver.role})`
			: `best scored receiver ${receiver.name} (${receiver.role}), score=${best.score.toFixed(2)}`;

		return {
			action: "pass",
			reason,
			newCarrierId: receiver.id,
			ballTarget: { x: receiver.x, y: receiver.y },
			ballSpeed: PASS_SPEED,
			ballReleased: true,
			playerTargets,
			...(triggersExit && { nextPhase: "midfield" }),
		};
	},
};
