import { distToSegment } from "../queries";
import { ROLE_ZONE_CONFIG, type ZoneConfig } from "./roles";
import type { Action, ActionContext, MatchPlayer } from "./types";

const PROBE_DISTANCE = 0.08;
const TEAMMATE_PENALTY_WEIGHT = 0.6;
const OBSTRUCTION_RADIUS = 0.08;
const DEPTH_FALLOFF_RANGE = 0.2;
// How far the ball can be from a role's ideal territory before it becomes fully passive.
const ACTIVITY_FALLOFF = 0.4;

const D = Math.SQRT1_2;
const COMPASS_DIRS: readonly { dx: number; dy: number }[] = [
	{ dx: 1, dy: 0 },
	{ dx: D, dy: D },
	{ dx: 0, dy: 1 },
	{ dx: -D, dy: D },
	{ dx: -1, dy: 0 },
	{ dx: -D, dy: -D },
	{ dx: 0, dy: -1 },
	{ dx: D, dy: -D },
];

function isTeamInPossession(ctx: ActionContext): boolean {
	const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
	if (holderId === null) return false;
	const holder = ctx.allPlayers.find((p) => p.id === holderId);
	return holder?.isHome === ctx.player.isHome;
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

// Zone y-bounds scale linearly with the team's territorial depth so the player
// tracks back when defending deep and pushes forward when attacking high.
//
// `depth` (0 = own goal, 1 = opponent goal) is *possession-aware*:
//   - In possession: depth follows the ball up the pitch — push forward as we advance.
//   - Out of possession: depth is the inverse of the opponent's advance, so the
//     further they push toward our goal, the deeper this player drops. The retreat
//     is continuous — the team's shape slides back smoothly as pressure mounts,
//     rather than snapping forward (the old bug, which pushed defenders UPfield
//     exactly when the opponent reached our box).
export function activeZone(
	player: { isHome: boolean },
	ball: { x: number; y: number },
	config: ZoneConfig,
	opponentInPossession = false,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
	const ballProgress = ballDepth(ball.y, player.isHome);
	// When the opponent carries the ball, our line should sit goal-side of it.
	// ballProgress is high when the ball is near our goal, so invert it into a
	// retreat depth that approaches 0 as the opponent advances.
	const depth = opponentInPossession ? 1 - ballProgress : ballProgress;
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

function ballDepth(ballY: number, isHome: boolean): number {
	return isHome ? 1 - ballY : ballY;
}

// 0 = ball is far from this role's territory, 1 = ball is right in it.
export function activityLevel(
	player: { isHome: boolean; y: number },
	ball: { x: number; y: number },
	config: ZoneConfig,
): number {
	const attackingBallY = player.isHome ? ball.y : 1 - ball.y;
	const idealY = attackingBallY + config.idealBallOffset;
	const playerAttackingY = player.isHome ? player.y : 1 - player.y;
	const distFromIdeal = Math.abs(playerAttackingY - idealY);
	return Math.max(0, 1 - distFromIdeal / ACTIVITY_FALLOFF);
}

function spaceScore(
	candidate: { x: number; y: number },
	player: MatchPlayer,
	ctx: ActionContext,
	config: ZoneConfig,
): number {
	const defenders = ctx.allPlayers.filter((p) => p.isHome !== player.isHome);
	const teammates = ctx.allPlayers.filter(
		(p) => p.isHome === player.isHome && p.id !== player.id,
	);

	// Openness: distance from nearest defender, softly penalised by nearest teammate
	let minDefDist = Infinity;
	for (const d of defenders) {
		const dd = Math.hypot(candidate.x - d.x, candidate.y - d.y);
		if (dd < minDefDist) minDefDist = dd;
	}

	let minMateDist = Infinity;
	for (const t of teammates) {
		const td = Math.hypot(candidate.x - t.x, candidate.y - t.y);
		if (td < minMateDist) minMateDist = td;
	}

	const openness = Math.min(minDefDist, minMateDist * TEAMMATE_PENALTY_WEIGHT);

	// Lane safety: min defender clearance from the passing lane, normalised
	const carrier =
		ctx.ballHolderId !== null
			? ctx.allPlayers.find((p) => p.id === ctx.ballHolderId)
			: null;

	let laneSafety = 1;
	if (carrier !== null && carrier !== undefined) {
		let minLaneDist = Infinity;
		for (const d of defenders) {
			const dd = distToSegment(d, carrier, candidate);
			if (dd < minLaneDist) minLaneDist = dd;
		}
		laneSafety = clamp(minLaneDist / OBSTRUCTION_RADIUS, 0, 1);
	}

	// Depth alignment: soft multiplier based on role's ideal depth relative to ball
	const attackingBallY = player.isHome ? ctx.ball.y : 1 - ctx.ball.y;
	const idealDepthAttacking = attackingBallY + config.idealBallOffset;
	const candidateAttackingY = player.isHome ? candidate.y : 1 - candidate.y;
	const depthAlignment =
		1 -
		clamp(
			Math.abs(candidateAttackingY - idealDepthAttacking) / DEPTH_FALLOFF_RANGE,
			0,
			0.5,
		);

	return openness * laneSafety * depthAlignment;
}

export const AttackingPositionAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (!(ctx.player.role in ROLE_ZONE_CONFIG)) return false;
		if (ctx.player.role === "LB" || ctx.player.role === "RB") return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		if ((ctx.ballReceiverId ?? null) === ctx.player.id) return false;
		return isTeamInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const { player } = ctx;
		const config = ROLE_ZONE_CONFIG[player.role] as ZoneConfig;
		const zone = activeZone(player, ctx.ball, config);
		const pos = { x: player.x, y: player.y };

		const activity = activityLevel(player, ctx.ball, config);

		// Low activity: ball is far from this role's territory — just track to zone center.
		if (activity < 0.2) {
			return {
				x: clamp(pos.x, zone.xMin, zone.xMax),
				y: clamp((zone.yMin + zone.yMax) / 2, zone.yMin, zone.yMax),
			};
		}

		// High activity: probe for the best space within the zone.
		let bestScore = -Infinity;
		let bestPos = pos;

		for (const dir of COMPASS_DIRS) {
			const candidate = {
				x: clamp(pos.x + dir.dx * PROBE_DISTANCE, zone.xMin, zone.xMax),
				y: clamp(pos.y + dir.dy * PROBE_DISTANCE, zone.yMin, zone.yMax),
			};
			const score = spaceScore(candidate, player, ctx, config);
			if (score > bestScore) {
				bestScore = score;
				bestPos = candidate;
			}
		}

		return bestPos;
	},
};
