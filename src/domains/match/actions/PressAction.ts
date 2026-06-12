import { dist, nearest } from "../queries";
import type { XY } from "../types";
import { activeZone } from "./AttackingPositionAction";
import { ROLE_ZONE_CONFIG } from "./roles";
import type { Action, ActionContext, MatchPlayer } from "./types";

export const PRESSURE_RADIUS = 0.08;

function shadowTarget(ctx: ActionContext, holder: MatchPlayer): XY {
	const attackingDir = holder.isHome ? 1 : -1;

	const teammates = ctx.allPlayers.filter(
		(p) => p.isHome === holder.isHome && p.id !== holder.id,
	);
	const forwardReceivers = teammates.filter(
		(p) => (p.y - holder.y) * attackingDir > 0,
	);

	if (forwardReceivers.length === 0) {
		return { x: ctx.player.baseX, y: ctx.player.baseY };
	}

	const opponents = ctx.allPlayers.filter((p) => p.isHome !== holder.isHome);
	const best = forwardReceivers.reduce(
		(best, candidate) => {
			const nearestOppDist = Math.min(
				...opponents.map((o) => dist(o, candidate)),
			);
			const pressureScore = Math.min(nearestOppDist / PRESSURE_RADIUS, 1);
			const progressionValue = holder.isHome ? candidate.y : 1 - candidate.y;
			const score = pressureScore * progressionValue;
			return score > best.score ? { receiver: candidate, score } : best;
		},
		{ receiver: forwardReceivers[0], score: -1 },
	);

	return {
		x: (holder.x + best.receiver.x) / 2,
		y: (holder.y + best.receiver.y) / 2,
	};
}

// The single closest defending player to the carrier — this player always
// engages, regardless of zone, so the ball is never left uncontested.
function nearestDefender(
	ctx: ActionContext,
	holder: MatchPlayer,
): MatchPlayer | null {
	const defenders = ctx.allPlayers.filter(
		(p) => p.isHome !== holder.isHome && p.position !== "GK",
	);
	if (defenders.length === 0) return null;
	return nearest(holder, defenders);
}

export const PressAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.player.position === "GK") return false;
		const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
		if (holderId === null) return false;
		const holder = ctx.allPlayers.find((p) => p.id === holderId);
		if (!holder) return false;
		if (ctx.player.isHome === holder.isHome) return false;

		// The closest defender always presses, even if the carrier has slipped
		// between zones — this guarantees the ball is engaged (Bug: carrier could
		// previously run through a seam with no one stepping out to challenge).
		const designated = nearestDefender(ctx, holder);
		if (designated?.id === ctx.player.id) return true;

		// Other defenders press only when the carrier is inside their zone, so the
		// team keeps its shape rather than everyone collapsing onto the ball.
		const zoneConfig = ROLE_ZONE_CONFIG[ctx.player.role];
		if (!zoneConfig) return false;
		const zone = activeZone(ctx.player, ctx.ball, zoneConfig, true);
		return (
			holder.x >= zone.xMin &&
			holder.x <= zone.xMax &&
			holder.y >= zone.yMin &&
			holder.y <= zone.yMax
		);
	},

	execute(ctx: ActionContext): XY {
		const targetId = ctx.ballHolderId ?? ctx.ballReceiverId;
		const holder = ctx.allPlayers.find((p) => p.id === targetId);
		if (!holder) return { x: ctx.player.baseX, y: ctx.player.baseY };

		// The designated nearest defender goes straight for the ball to close it down.
		const designated = nearestDefender(ctx, holder);
		if (designated?.id === ctx.player.id) {
			return { x: holder.x, y: holder.y };
		}

		// Forwards lead the press from the front; everyone else shadows passing lanes.
		const myForwards = ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.position === "FWD",
		);
		if (myForwards.length > 0) {
			const primaryPresser = nearest(holder, myForwards);
			if (ctx.player.id === primaryPresser.id) {
				return { x: holder.x, y: holder.y };
			}
		}

		return shadowTarget(ctx, holder);
	},
};
