import { ballIsLoose, dist } from "../queries";
import type { Action, ActionContext, MatchPlayer } from "./types";

// Sends players to pursue a Loose Ball. When the ball has no holder, the single
// closest player on EACH team chases the ball's current position; everyone else
// keeps their normal action, preserving team shape. Each player self-assigns
// statelessly per tick ("am I my team's closest to the loose ball?"), mirroring
// Press Role Assignment's primary-presser selection. Supersedes ReceiveAction's
// named-receiver privilege once the ball is loose.
function isMyTeamsClosest(ctx: ActionContext): boolean {
	const teammates: MatchPlayer[] = [
		ctx.player,
		...ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.id !== ctx.player.id,
		),
	];
	let closest = teammates[0];
	let closestDist = dist(closest, ctx.ball);
	for (const t of teammates) {
		const d = dist(t, ctx.ball);
		// Ties broken by id so exactly one player self-assigns per tick.
		if (d < closestDist || (d === closestDist && t.id < closest.id)) {
			closest = t;
			closestDist = d;
		}
	}
	return closest.id === ctx.player.id;
}

export const LooseBallAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (!ballIsLoose(ctx)) return false;
		return isMyTeamsClosest(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		return { x: ctx.ball.x, y: ctx.ball.y };
	},
};
