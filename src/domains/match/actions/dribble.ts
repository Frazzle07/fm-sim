/**
 * dribble.ts — a player carries the ball forward under pressure.
 *
 * Preconditions:
 *   - carrier has the ball
 *   - a defender is within pressing range (otherwise just pass)
 *   - carrier is not in their own defensive third (no pointless dribbling backwards)
 *
 * The dribble action moves the carrier toward their positional target while
 * keeping the ball attached. It does NOT release the ball — the carrier stays
 * as holder. The simulator continues lerping the ball to the carrier's position.
 *
 * A dribble can be dispossessed by tackle.ts on the defending side.
 *
 * Future: use a player `dribbling` stat to determine success chance when tackled.
 */

import type { Action, ActionContext, ActionResult } from "./types";
import { dist, distPlayers } from "./util";

const DRIBBLE_STRIDE = 0.025;

// Space threshold: above this, run forward freely; below, shield and wait
const SPACE_AHEAD_THRESHOLD = 0.25;

function nearestDefenderDist(ctx: ActionContext): number {
	const { carrier, players, homePossession } = ctx;
	const defenders = players.filter((p) => p.isHome !== homePossession);
	if (defenders.length === 0) return 1;
	return Math.min(...defenders.map((d) => distPlayers(carrier, d)));
}

/** Nearest opponent distance to a point 0.15 ahead of the carrier, capped at 1. */
function spaceAhead(ctx: ActionContext): number {
	const { carrier, players, homePossession } = ctx;
	const attackDir = homePossession ? 1 : -1;
	const probeX = carrier.x;
	const probeY = Math.max(0.05, Math.min(0.95, carrier.y + 0.15 * attackDir));
	const opponents = players.filter((p) => p.isHome !== homePossession);
	if (opponents.length === 0) return 1;
	const nearest = Math.min(...opponents.map((o) => dist(probeX, probeY, o.x, o.y)));
	return Math.min(1, nearest);
}

export const dribbleAction: Action = {
	name: "dribble",
	priority: 28, // after shoot/cross/pass — guaranteed fallback

	canExecute(ctx) {
		if (ctx.carrier.role === "GK") return false;
		return true;
	},

	execute(ctx): ActionResult {
		const { carrier, homePossession, rng } = ctx;
		const ahead = spaceAhead(ctx);
		const nearDef = nearestDefenderDist(ctx);
		const hasSpace = ahead > SPACE_AHEAD_THRESHOLD;
		const underPressure = nearDef < 0.15;

		// When pressed tight with no space, slow down and shield — tiny shuffle
		// to stay unpredictable rather than planting completely still.
		const strideScale = hasSpace ? 1 : underPressure ? 0.3 : 0.6;
		const stride = (homePossession ? DRIBBLE_STRIDE : -DRIBBLE_STRIDE) * strideScale;
		const jitterX = (rng() - 0.5) * (hasSpace ? 0.02 : 0.008);

		const playerTargets = new Map<string, { x: number; y: number }>();
		playerTargets.set(carrier.id, {
			x: Math.max(0.05, Math.min(0.95, carrier.x + jitterX)),
			y: Math.max(0.05, Math.min(0.95, carrier.y + stride)),
		});

		// Teammates spread into support positions ahead of the carrier
		const supportY = homePossession
			? Math.min(0.95, carrier.y + 0.12)
			: Math.max(0.05, carrier.y - 0.12);
		for (const p of ctx.players) {
			if (p.isHome === homePossession && p.id !== carrier.id && p.role !== "GK") {
				playerTargets.set(p.id, { x: p.baseX, y: supportY });
			}
		}

		const reason = hasSpace
			? `space ahead=${ahead.toFixed(2)}, running forward`
			: underPressure
				? `no space + under pressure (def=${nearDef.toFixed(2)}), shielding`
				: `limited space ahead=${ahead.toFixed(2)}, slow carry`;

		return {
			action: "dribble",
			reason,
			playerTargets,
		};
	},
};
