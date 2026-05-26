import { activeZone } from "./GradientClimbAction";
import { ROLE_ZONE_CONFIG } from "./roles";
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
		return false;
		if (ctx.phase !== "open_play") return false;
		const role = ctx.player.role;
		if (role !== "LW" && role !== "RW" && role !== "LB" && role !== "RB")
			return false;
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
		// Clamp both x and y to the player's active zone so fullbacks don't
		// chase deep into the opponent's half when defending.
		const zoneConfig = ROLE_ZONE_CONFIG[player.role];
		const targetX = (ctx.ball.x + opponent.x) / 2;
		const targetY = (ctx.ball.y + opponent.y) / 2;
		if (!zoneConfig) return { x: targetX, y: targetY };
		const zone = activeZone(player, ctx.ball, zoneConfig);
		return {
			x: Math.max(zone.xMin, Math.min(zone.xMax, targetX)),
			y: Math.max(zone.yMin, Math.min(zone.yMax, targetY)),
		};
	},
};
