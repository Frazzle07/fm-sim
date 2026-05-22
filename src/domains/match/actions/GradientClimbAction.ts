import { dist, distToSegment, nearest } from "../queries";
import type { Action, ActionContext, MatchPlayer } from "./types";

// x-bounds per winger role — each stays in their lane regardless of ball position.
const WINGER_X_BOUNDS: Record<"LW" | "RW", { xMin: number; xMax: number }> = {
	LW: { xMin: 0.0, xMax: 0.3 },
	RW: { xMin: 0.7, xMax: 1.0 },
};

// y-bounds interpolate linearly with ball depth (0=own goal, 1=opposition goal, home perspective).
// At ball.y=0 (deepest own half): conservative band.
// At ball.y=1 (deepest opposition half): full attacking band.
const WINGER_Y_MIN_DEEP = 0.25;
const WINGER_Y_MIN_HIGH = 0.45;
const WINGER_Y_MAX_DEEP = 0.55;
const WINGER_Y_MAX_HIGH = 0.92;

// 8 compass directions for gradient climb probing.
const SQRT2_OVER_2 = Math.SQRT2 / 2;
const PROBES: { dx: number; dy: number }[] = [
	{ dx: 1, dy: 0 },
	{ dx: -1, dy: 0 },
	{ dx: 0, dy: 1 },
	{ dx: 0, dy: -1 },
	{ dx: SQRT2_OVER_2, dy: SQRT2_OVER_2 },
	{ dx: -SQRT2_OVER_2, dy: SQRT2_OVER_2 },
	{ dx: SQRT2_OVER_2, dy: -SQRT2_OVER_2 },
	{ dx: -SQRT2_OVER_2, dy: -SQRT2_OVER_2 },
];

const MIN_PROBE_DIST = 0.03;
const MAX_PROBE_DIST = 0.12;
const OPENNESS_WEIGHT = 0.6;
const LANE_SAFETY_WEIGHT = 0.4;
const LANE_BLOCK_RADIUS = 0.05;

function spaceScore(
	pos: { x: number; y: number },
	opponents: MatchPlayer[],
	ball: { x: number; y: number },
): number {
	if (opponents.length === 0) return 1;
	const nearestOpp = nearest(pos, opponents);
	const openness = dist(pos, nearestOpp);
	const minLaneDist = Math.min(...opponents.map((o) => distToSegment(o, ball, pos)));
	const laneSafety = Math.min(minLaneDist / LANE_BLOCK_RADIUS, 1);
	return OPENNESS_WEIGHT * openness + LANE_SAFETY_WEIGHT * laneSafety;
}

function clampToZone(
	x: number,
	y: number,
	zone: { xMin: number; xMax: number; yMin: number; yMax: number },
): { x: number; y: number } {
	return {
		x: Math.max(zone.xMin, Math.min(zone.xMax, x)),
		y: Math.max(zone.yMin, Math.min(zone.yMax, y)),
	};
}

function isTeamInPossession(ctx: ActionContext): boolean {
	const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
	if (holderId === null) return false;
	const holder = ctx.allPlayers.find((p) => p.id === holderId);
	return holder?.isHome === ctx.player.isHome;
}

// Returns ball depth as 0→1 in the player's attacking direction.
function ballDepth(ballY: number, isHome: boolean): number {
	return isHome ? ballY : 1 - ballY;
}

// Zone y-bounds scale linearly with ball depth so the winger tracks back
// when possession is deep in their own half, and pushes forward as the ball advances.
function activeZone(
	player: MatchPlayer,
	ball: { x: number; y: number },
): { xMin: number; xMax: number; yMin: number; yMax: number } {
	const depth = ballDepth(ball.y, player.isHome);
	const yMinHome = WINGER_Y_MIN_DEEP + (WINGER_Y_MIN_HIGH - WINGER_Y_MIN_DEEP) * depth;
	const yMaxHome = WINGER_Y_MAX_DEEP + (WINGER_Y_MAX_HIGH - WINGER_Y_MAX_DEEP) * depth;
	const { xMin, xMax } = WINGER_X_BOUNDS[player.role as "LW" | "RW"];
	if (player.isHome) {
		return { xMin, xMax, yMin: yMinHome, yMax: yMaxHome };
	}
	// Away team attacks toward y=0 — flip y bounds.
	return { xMin, xMax, yMin: 1 - yMaxHome, yMax: 1 - yMinHome };
}

export const GradientClimbAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.player.role !== "LW" && ctx.player.role !== "RW") return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		if ((ctx.ballReceiverId ?? null) === ctx.player.id) return false;
		return isTeamInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const player = ctx.player;
		const opponents = ctx.allPlayers.filter((p) => p.isHome !== player.isHome);
		const zone = activeZone(player, ctx.ball);

		const currentScore = spaceScore(player, opponents, ctx.ball);
		const probeDist = MIN_PROBE_DIST + (MAX_PROBE_DIST - MIN_PROBE_DIST) * Math.min(currentScore / 0.3, 1);

		let bestScore = currentScore;
		let bestPos = { x: player.x, y: player.y };

		for (const probe of PROBES) {
			const candidate = clampToZone(
				player.x + probe.dx * probeDist,
				player.y + probe.dy * probeDist,
				zone,
			);
			const score = spaceScore(candidate, opponents, ctx.ball);
			if (score > bestScore) {
				bestScore = score;
				bestPos = candidate;
			}
		}

		return bestPos;
	},
};
