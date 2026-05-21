import { dist, nearest } from "../queries";
import type { XY } from "../types";
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
		return { x: holder.x, y: holder.y };
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

export const PressAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		const targetId = ctx.ballHolderId ?? ctx.ballReceiverId;
		if (targetId === null) return false;
		const target = ctx.allPlayers.find((p) => p.id === targetId);
		if (!target) return false;
		return ctx.player.isHome !== target.isHome && ctx.player.position === "FWD";
	},

	execute(ctx: ActionContext): XY {
		const targetId = ctx.ballHolderId ?? ctx.ballReceiverId;
		const holder = ctx.allPlayers.find((p) => p.id === targetId);
		if (!holder) return { x: ctx.player.baseX, y: ctx.player.baseY };

		const myForwards = ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.position === "FWD",
		);

		const primaryPresser = nearest(holder, myForwards);

		if (ctx.player.id === primaryPresser.id) {
			return { x: holder.x, y: holder.y };
		}

		return shadowTarget(ctx, holder);
	},
};
