import { distToSegment, nearest } from "../queries";
import type {
	ActionContext,
	BallAction,
	BallCommand,
	MatchPlayer,
} from "./types";

// Bounded [0, PROXIMITY_CAP] so a nearby teammate doesn't swamp lane/openness scores.
const PROXIMITY_CAP = 4;
const PROXIMITY_WEIGHT = 0.6;
const LANE_BLOCK_RADIUS = 0.05;
const LANE_BLOCK_PENALTY = 8;
// Opponent closer than this to the target teammate = heavily marked
const MARKING_RADIUS = 0.08;
const MARKING_PENALTY = 6;
// Reward open passing lanes: bonus proportional to how clear the path is
const LANE_SAFETY_WEIGHT = 6;
// Reward teammates who have space to receive
const OPENNESS_WEIGHT = 5;
const POSITION_BONUS: Record<MatchPlayer["position"], number> = {
	FWD: 2,
	MID: 1,
	DEF: 0,
	GK: -2,
};

// Speed factor: 1.0 = crisp pass, >1 = slower/heavier.
// Averages two uniforms (triangular, range [0,1], mean 0.5) then shifts so
// the range is [0.8, 1.8] with mean ~1.3 — passes are on average 30% slower
// than the baseline, with a tail of heavy touches that are 80% slower.
function passSpeedFactor(): number {
	return (Math.random() + Math.random()) / 2 + 0.8;
}

// Short pass (~0.15 dist) ≈ 600ms, long pass (~0.5 dist) ≈ 1400ms (at factor 1.0).
function flightDurationMs(dx: number, dy: number): number {
	const dist = Math.hypot(dx, dy);
	return Math.round((300 + dist * 2200) * passSpeedFactor());
}

function flightEasing(dx: number, dy: number): number {
	const dist = Math.hypot(dx, dy);
	return 2 + dist * 6;
}

export const PassAction: BallAction = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId !== ctx.player.id) return false;
		const teammates = ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.id !== ctx.player.id,
		);
		const opponents = ctx.allPlayers.filter(
			(p) => p.isHome !== ctx.player.isHome,
		);
		return teammates.some(
			(t) =>
				opponents.filter(
					(o) => distToSegment(o, ctx.player, t) < LANE_BLOCK_RADIUS,
				).length < 2,
		);
	},

	execute(ctx: ActionContext): BallCommand {
		const teammates = ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.id !== ctx.player.id,
		);
		const opponents = ctx.allPlayers.filter(
			(p) => p.isHome !== ctx.player.isHome,
		);

		const scored = teammates.map((t) => {
			const distToT = Math.hypot(t.x - ctx.player.x, t.y - ctx.player.y);
			// How close is the nearest opponent to the receiver (space to receive)
			const nearestOppToT = nearest(t, opponents);
			const openness = Math.hypot(nearestOppToT.x - t.x, nearestOppToT.y - t.y);
			// How clear is the passing lane (min dist of any opponent to the lane)
			const laneDistances = opponents.map((o) =>
				distToSegment(o, ctx.player, t),
			);
			const minLaneDist = Math.min(...laneDistances);
			const laneSafety = Math.min(minLaneDist / LANE_BLOCK_RADIUS, 1);

			const proximity = Math.min(PROXIMITY_WEIGHT / (distToT + 0.01), PROXIMITY_CAP);
			const markingPenalty = openness < MARKING_RADIUS ? MARKING_PENALTY : 0;
			const positionBonus = POSITION_BONUS[t.position];
			const blockers = laneDistances.filter((d) => d < LANE_BLOCK_RADIUS).length;
			const lanePenalty = blockers * LANE_BLOCK_PENALTY;
			const laneSafetyBonus = LANE_SAFETY_WEIGHT * laneSafety;
			const opennessBonus = OPENNESS_WEIGHT * Math.min(openness / MARKING_RADIUS, 1);
			const score =
				proximity +
				positionBonus +
				laneSafetyBonus +
				opennessBonus -
				markingPenalty -
				lanePenalty;
			return {
				t,
				score,
				distToT,
				openness,
				proximity,
				positionBonus,
				blockers,
			};
		});

		const ranked = scored.sort((a, b) => b.score - a.score);
		const best = ranked[0];

		const reasons: string[] = [];
		if (best.proximity >= ranked[1]?.proximity) reasons.push("closest option");
		if (best.openness >= ranked[1]?.openness)
			reasons.push("most space around them");
		if (best.positionBonus > 0)
			reasons.push(`advanced position (${best.t.position})`);

		// console.debug(
		// 	`[Pass] ${ctx.player.name} passes to ${best.t.name} (score=${best.score.toFixed(2)}, blockers=${best.blockers}) — ${reasons.join(", ") || "best overall score"}. ` +
		// 		`Others considered: ${ranked
		// 			.slice(1)
		// 			.map(
		// 				(s) =>
		// 					`${s.t.name} (${s.t.position}, score=${s.score.toFixed(2)}, blockers=${s.blockers})`,
		// 			)
		// 			.join(", ")}.`,
		// );

		const dx = best.t.x - ctx.player.x;
		const dy = best.t.y - ctx.player.y;

		return {
			type: "pass",
			toX: best.t.x,
			toY: best.t.y,
			receiverId: best.t.id,
			durationMs: flightDurationMs(dx, dy),
			easing: flightEasing(dx, dy),
		};
	},
};
