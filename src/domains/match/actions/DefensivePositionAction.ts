import { activeZone } from "./GradientClimbAction";
import { ROLE_ZONE_CONFIG } from "./roles";
import type { Action, ActionContext, MatchPlayer } from "./types";

const COVER_DEPTH = 0.08;

// How far into opposition half ball must be before line shifts (home perspective).
const HIGH_LINE_Y: Record<string, number> = {
	GK: 0.25,
	DEF: 0.58,
	MID: 0.75,
	FWD: 0.82,
};

function isOppositionInPossession(ctx: ActionContext): boolean {
	const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
	if (holderId === null) return false;
	const holder = ctx.allPlayers.find((p) => p.id === holderId);
	return holder?.isHome !== ctx.player.isHome;
}

function defensiveLineY(ctx: ActionContext): number {
	const { player, ball } = ctx;
	const attackingDir = player.isHome ? 1 : -1;
	const ballDepth = Math.max(0, Math.min(1, (ball.y - 0.5) * attackingDir * 2));
	const highLineHome = HIGH_LINE_Y[player.position] ?? player.baseY;
	const highLineY = player.isHome ? highLineHome : 1 - highLineHome;
	return player.baseY + ballDepth * (highLineY - player.baseY);
}

// Find the opposition player whose baseX is closest to ours and is within our zone.
function channelOpponentInZone(
	player: MatchPlayer,
	allPlayers: readonly MatchPlayer[],
	zone: { xMin: number; xMax: number; yMin: number; yMax: number },
): MatchPlayer | null {
	const opponentsInZone = allPlayers.filter(
		(p) =>
			p.isHome !== player.isHome &&
			p.x >= zone.xMin &&
			p.x <= zone.xMax &&
			p.y >= zone.yMin &&
			p.y <= zone.yMax,
	);
	if (opponentsInZone.length === 0) return null;
	return opponentsInZone.reduce((best, opp) =>
		Math.abs(opp.baseX - player.baseX) < Math.abs(best.baseX - player.baseX)
			? opp
			: best,
	);
}

export const DefensivePositionAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.player.position === "GK") return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		return isOppositionInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const player = ctx.player;
		const zoneConfig = ROLE_ZONE_CONFIG[player.role];

		if (!zoneConfig) {
			return { x: player.baseX, y: defensiveLineY(ctx) };
		}

		const zone = activeZone(player, ctx.ball, zoneConfig);
		const opponent = channelOpponentInZone(player, ctx.allPlayers, zone);

		if (!opponent) {
			return {
				x: player.baseX,
				y: Math.max(zone.yMin, Math.min(zone.yMax, defensiveLineY(ctx))),
			};
		}

		// Get goal-side of the channel opponent: track them laterally (biased
		// toward own baseX), and sit COVER_DEPTH behind them toward own goal.
		const targetX = 0.5 * opponent.x + 0.5 * player.baseX;
		const goalSideOffset = player.isHome ? -COVER_DEPTH : COVER_DEPTH;
		const targetY = opponent.y + goalSideOffset;

		return {
			x: Math.max(zone.xMin, Math.min(zone.xMax, targetX)),
			y: Math.max(zone.yMin, Math.min(zone.yMax, targetY)),
		};
	},
};
