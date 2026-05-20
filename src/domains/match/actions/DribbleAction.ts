import type { ActionContext, BallAction, BallCommand } from "./types";

const DRIBBLE_FORWARD_DEPTH = 0.15;
const DRIBBLE_LATERAL_WIDTH = 0.06;
const DRIBBLE_STEP = 0.08;
const TACKLED_RADIUS = 0.05;

export const DribbleAction: BallAction = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId !== ctx.player.id) return false;

		const attackingDir = ctx.player.isHome ? 1 : -1;
		const opponents = ctx.allPlayers.filter(
			(p) => p.isHome !== ctx.player.isHome,
		);

		const isTackled = opponents.some(
			(opp) => Math.hypot(opp.x - ctx.player.x, opp.y - ctx.player.y) < TACKLED_RADIUS,
		);
		if (isTackled) return false;

		const blockers = opponents.filter((opp) => {
			const forwardDist = (opp.y - ctx.player.y) * attackingDir;
			if (forwardDist <= 0) return false;
			const lateralDist = Math.abs(opp.x - ctx.player.x);
			if (lateralDist > DRIBBLE_LATERAL_WIDTH) return false;
			return forwardDist <= DRIBBLE_FORWARD_DEPTH;
		});

		console.debug(
			`[Dribble] canExecute for ${ctx.player.name} (${ctx.player.isHome ? "home" : "away"}, y=${ctx.player.y.toFixed(3)}): blockers=${blockers.length} ${blockers.map((o) => `${o.name} fwd=${((o.y - ctx.player.y) * attackingDir).toFixed(3)} lat=${Math.abs(o.x - ctx.player.x).toFixed(3)}`).join(", ")}`,
		);

		return blockers.length === 0;
	},

	execute(ctx: ActionContext): BallCommand {
		const attackingDir = ctx.player.isHome ? 1 : -1;
		const toY = Math.max(0, Math.min(1, ctx.player.y + DRIBBLE_STEP * attackingDir));

		return {
			type: "dribble",
			toX: ctx.player.x,
			toY,
		};
	},
};
