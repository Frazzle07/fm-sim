import { dist, distToSegment, nearest } from "../queries";
import { ROLE_ZONE_CONFIG, type ZoneConfig } from "./roles";
import type { Action, ActionContext, MatchPlayer } from "./types";

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
const OPENNESS_WEIGHT = 0.4;
const LANE_SAFETY_WEIGHT = 0.2;
const DEPTH_ALIGNMENT_WEIGHT = 0.4;
const LANE_BLOCK_RADIUS = 0.05;
// Openness is capped so a lone winger in space can't drown out depth alignment.
const OPENNESS_CAP = 0.15;
// Vertical distance at which depth alignment score falls to zero.
const DEPTH_ALIGNMENT_MAX = 0.2;
// Full backs must stay at least this far from their flank winger.
const FB_WINGER_MIN_SEP = 0.18;
// Weight of the separation penalty in spaceScore for full backs.
const FB_SEPARATION_WEIGHT = 0.35;

// Maps each full back role to its corresponding winger role on the same flank.
const FB_WINGER_PAIR: Partial<Record<string, string>> = { LB: "LW", RB: "RW" };

function spaceScore(
	pos: { x: number; y: number },
	opponents: MatchPlayer[],
	ball: { x: number; y: number },
	flankWinger: MatchPlayer | null = null,
): number {
	if (opponents.length === 0 && flankWinger === null) return 1;
	let openness = 1;
	let laneSafety = 1;
	if (opponents.length > 0) {
		const nearestOpp = nearest(pos, opponents);
		openness = Math.min(dist(pos, nearestOpp), OPENNESS_CAP) / OPENNESS_CAP;
		const minLaneDist = Math.min(
			...opponents.map((o) => distToSegment(o, ball, pos)),
		);
		laneSafety = Math.min(minLaneDist / LANE_BLOCK_RADIUS, 1);
	}
	const depthAlignment = Math.max(
		0,
		1 - Math.abs(pos.y - ball.y) / DEPTH_ALIGNMENT_MAX,
	);
	const base =
		OPENNESS_WEIGHT * openness +
		LANE_SAFETY_WEIGHT * laneSafety +
		DEPTH_ALIGNMENT_WEIGHT * depthAlignment;

	if (flankWinger === null) return base;
	// Penalize positions too close to the flank winger so FB and winger
	// don't crowd the same channel. Penalty fades to zero at FB_WINGER_MIN_SEP.
	const sep = dist(pos, flankWinger);
	const separationScore = Math.min(sep / FB_WINGER_MIN_SEP, 1);
	return (1 - FB_SEPARATION_WEIGHT) * base + FB_SEPARATION_WEIGHT * separationScore;
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

// Zone y-bounds scale linearly with ball depth so the player tracks back
// when possession is deep in their own half, and pushes forward as the ball advances.
export function activeZone(
	player: { isHome: boolean },
	ball: { x: number; y: number },
	config: ZoneConfig,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
	const depth = ballDepth(ball.y, player.isHome);
	const yMinHome =
		config.yMinDeep + (config.yMinHigh - config.yMinDeep) * depth;
	const yMaxHome =
		config.yMaxDeep + (config.yMaxHigh - config.yMaxDeep) * depth;
	if (player.isHome) {
		return {
			xMin: config.xMin,
			xMax: config.xMax,
			yMin: yMinHome,
			yMax: yMaxHome,
		};
	}
	// Away team attacks toward y=0 — flip y bounds.
	return {
		xMin: config.xMin,
		xMax: config.xMax,
		yMin: 1 - yMaxHome,
		yMax: 1 - yMinHome,
	};
}

export const GradientClimbAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (!(ctx.player.role in ROLE_ZONE_CONFIG)) return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		if ((ctx.ballReceiverId ?? null) === ctx.player.id) return false;
		return isTeamInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const player = ctx.player;
		const config = ROLE_ZONE_CONFIG[player.role] as ZoneConfig;
		const opponents = ctx.allPlayers.filter((p) => p.isHome !== player.isHome);
		const zone = activeZone(player, ctx.ball, config);

		const wingerRole = FB_WINGER_PAIR[player.role] ?? null;
		const flankWinger = wingerRole
			? (ctx.allPlayers.find(
					(p) => p.isHome === player.isHome && p.role === wingerRole,
				) ?? null)
			: null;

		const currentScore = spaceScore(player, opponents, ctx.ball, flankWinger);
		const probeDist =
			MIN_PROBE_DIST +
			(MAX_PROBE_DIST - MIN_PROBE_DIST) * Math.min(currentScore / 0.3, 1);

		let bestScore = currentScore;
		let bestPos = { x: player.x, y: player.y };

		for (const probe of PROBES) {
			const candidate = clampToZone(
				player.x + probe.dx * probeDist,
				player.y + probe.dy * probeDist,
				zone,
			);
			const score = spaceScore(candidate, opponents, ctx.ball, flankWinger);
			if (score > bestScore) {
				bestScore = score;
				bestPos = candidate;
			}
		}

		return bestPos;
	},
};
