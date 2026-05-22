import type { Action, ActionContext, MatchPlayer } from "./types";

function isOppositionInPossession(ctx: ActionContext): boolean {
	const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
	if (holderId === null) return false;
	const holder = ctx.allPlayers.find((p) => p.id === holderId);
	return holder?.isHome !== ctx.player.isHome;
}

// Find the opposition player in the same channel (closest baseX to ours).
function channelOpponent(
	player: MatchPlayer,
	allPlayers: readonly MatchPlayer[],
): MatchPlayer | null {
	const opponents = allPlayers.filter((p) => p.isHome !== player.isHome);
	if (opponents.length === 0) return null;
	return opponents.reduce((best, opp) => {
		const bestDx = Math.abs(best.baseX - player.baseX);
		const oppDx = Math.abs(opp.baseX - player.baseX);
		return oppDx < bestDx ? opp : best;
	});
}

export const ChannelCoverAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.player.role !== "LW" && ctx.player.role !== "RW") return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		return isOppositionInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const player = ctx.player;
		const opponent = channelOpponent(player, ctx.allPlayers);

		if (!opponent) {
			return { x: player.baseX, y: player.baseY };
		}

		// Position at midpoint between ball and the channel opponent —
		// sitting in the passing lane to block the route into the channel.
		return {
			x: (ctx.ball.x + opponent.x) / 2,
			y: (ctx.ball.y + opponent.y) / 2,
		};
	},
};
