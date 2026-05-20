/**
 * shoot.ts — a player attempts a shot on goal.
 *
 * Preconditions:
 *   - carrier is in the shooting zone (final third, central lane)
 *   - phase is "attack" or "chance"
 *
 * Outcome:
 *   - Shot travels toward the goal.
 *   - The simulator's existing phase transition handles goal/save — this action
 *     simply releases the ball and requests a "chance" phase if not already there,
 *     letting the existing TRANSITIONS table resolve the outcome.
 *
 * Future: accept a player `finishing` stat to influence shot accuracy / speed.
 */

import type { Action, ActionResult } from "./types";
import { isInShootingZone, opponentGoalY } from "./util";

// Ball speed for a shot — fast, travels toward goal in ~8 ticks
const SHOT_SPEED = 0.035;

// Small horizontal spread so shots aren't always dead-centre
function goalTargetX(rng: () => number): number {
	return 0.5 + (rng() - 0.5) * 0.18;
}

export const shootAction: Action = {
	name: "shoot",
	priority: 10, // highest priority — if you can shoot, shoot

	canExecute(ctx) {
		const { carrier, homePossession, phase } = ctx;
		if (phase !== "attack" && phase !== "chance") return false;
		return isInShootingZone(carrier.x, carrier.y, homePossession);
	},

	execute(ctx): ActionResult {
		const { carrier, homePossession, rng } = ctx;
		const goalY = opponentGoalY(homePossession);
		const targetX = goalTargetX(rng);

		// Attacking teammates rush the box for a rebound
		const playerTargets = new Map<string, { x: number; y: number }>();
		for (const p of ctx.players) {
			if (
				p.isHome === homePossession &&
				p.id !== carrier.id &&
				p.role !== "GK"
			) {
				const boxY = homePossession ? 0.88 : 0.12;
				playerTargets.set(p.id, {
					x: p.baseX + (rng() - 0.5) * 0.12,
					y: boxY,
				});
			}
		}

		return {
			action: "shoot",
			reason: `in shooting zone (${carrier.x.toFixed(2)}, ${carrier.y.toFixed(2)}), phase=${ctx.phase}`,
			ballTarget: { x: targetX, y: goalY },
			ballSpeed: SHOT_SPEED,
			ballReleased: true,
			nextPhase: "chance",
			playerTargets,
		};
	},
};
