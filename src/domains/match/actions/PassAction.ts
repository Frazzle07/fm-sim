import { distToSegment, nearest } from "../queries";
import { baselineValue, clampSurvival, stateValue } from "./arbiter";
import type {
	ActionContext,
	ActionProposal,
	BallAction,
	BallCommand,
	MatchPlayer,
} from "./types";

// ─── Lead Offset ───────────────────────────────────────────────────────────
// A pass aims at the receiver's position plus a Lead Offset — a vector into open
// space. Probe 8 compass points around the receiver; score each by the openness
// at that point biased by how well it matches the receiver's run. The winning
// arc is interpolated (never snapped to a spoke) and scaled by openness, so a
// free runner gets the ball led into stride and a marked receiver collapses the
// offset toward their feet.

// Compass probe radius for locating open space around the receiver.
const PROBE_DISTANCE = 0.08;
// Cap on Lead Offset magnitude.
const MAX_LEAD = 0.12;
// How strongly the receiver's run biases probe selection vs. raw openness.
// A bias, not a gate: openness can override the run when forward is blocked.
const TRAVEL_ALIGNMENT_WEIGHT = 0.5;
// Jitter on final bearing (radians) and magnitude (fraction) to prevent the
// landing point quantising onto the 8 fixed spokes.
const LEAD_BEARING_NOISE = 0.25;
const LEAD_MAGNITUDE_NOISE = 0.15;
// Openness GAIN deadzone: a lead is only worth playing if the chosen point is
// meaningfully more open than the receiver's own feet. Below this gain the
// offset collapses to feet — so "to feet" is the common pass and a lead fires
// only when stepping into space genuinely opens the receiver up.
const LEAD_GAIN_DEADZONE = 0.03;
// Openness gain above the deadzone that earns a full-length lead; magnitude
// ramps from 0 here up to MAX_LEAD.
const LEAD_GAIN_FULL = 0.08;
// Below this travel-vector length the receiver is treated as stationary and the
// run falls back to the attacking direction.
const TRAVEL_EPSILON = 1e-4;

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

// The Pass Target: receiver position + Lead Offset, clamped to the pitch.
function leadTarget(
	receiver: MatchPlayer,
	opponents: readonly MatchPlayer[],
): { x: number; y: number } {
	// Travel direction = receiver's last-tick movement target. Stale by one tick
	// (Stage 4 runs after this), negligible at 200 ticks/min. Stationary receiver
	// falls back to the attacking direction so even a static target gets the ball
	// onto their front foot.
	let tvx = receiver.targetX - receiver.x;
	let tvy = receiver.targetY - receiver.y;
	const travelLen = Math.hypot(tvx, tvy);
	if (travelLen < TRAVEL_EPSILON) {
		tvx = 0;
		tvy = receiver.isHome ? 1 : -1;
	} else {
		tvx /= travelLen;
		tvy /= travelLen;
	}

	const scored = COMPASS_DIRS.map((dir) => {
		const px = receiver.x + dir.dx * PROBE_DISTANCE;
		const py = receiver.y + dir.dy * PROBE_DISTANCE;
		// Openness measured AT the probe point, not at the receiver's feet.
		const nearestOpp = nearest({ x: px, y: py }, opponents as MatchPlayer[]);
		const openness = Math.hypot(nearestOpp.x - px, nearestOpp.y - py);
		// Travel alignment in [0, 1]: 1 when the probe matches the run exactly.
		const dot = dir.dx * tvx + dir.dy * tvy;
		const alignment = (dot + 1) / 2;
		const score = openness * (1 + TRAVEL_ALIGNMENT_WEIGHT * alignment);
		return { dir, openness, score };
	});

	// Winning probe and its higher-scoring neighbour — interpolate the bearing
	// between them so the landing point lands anywhere on the open arc.
	let bestIdx = 0;
	for (let i = 1; i < scored.length; i++) {
		if (scored[i].score > scored[bestIdx].score) bestIdx = i;
	}
	const n = scored.length;
	const prev = scored[(bestIdx - 1 + n) % n];
	const next = scored[(bestIdx + 1) % n];
	const best = scored[bestIdx];
	const neighbour = next.score >= prev.score ? next : prev;
	const dirToNeighbour = next.score >= prev.score ? 1 : -1;

	const bestBearing = Math.atan2(best.dir.dy, best.dir.dx);
	// Weight toward the neighbour by its share of the two scores.
	const total = best.score + neighbour.score;
	const blend = total > 0 ? neighbour.score / total : 0;
	// Neighbouring spokes are 45° (π/4) apart.
	let bearing = bestBearing + dirToNeighbour * blend * (Math.PI / 4);
	bearing += (Math.random() - 0.5) * 2 * LEAD_BEARING_NOISE;

	// Magnitude scales with how much MORE open the chosen point is than the
	// receiver's own feet, capped by MAX_LEAD. The chosen probe is always the most
	// open point, so absolute openness is a poor signal — what matters is whether
	// leading the receiver actually buys space. Below the gain deadzone the offset
	// collapses to feet, so "to feet" is the common pass and a lead fires only when
	// stepping into space genuinely opens the receiver up.
	const nearestToFeet = nearest(
		{ x: receiver.x, y: receiver.y },
		opponents as MatchPlayer[],
	);
	const feetOpenness = Math.hypot(
		nearestToFeet.x - receiver.x,
		nearestToFeet.y - receiver.y,
	);
	const gain = best.openness - feetOpenness - LEAD_GAIN_DEADZONE;
	let magnitude =
		MAX_LEAD *
		Math.max(0, Math.min(gain / (LEAD_GAIN_FULL - LEAD_GAIN_DEADZONE), 1));
	magnitude *= 1 + (Math.random() - 0.5) * 2 * LEAD_MAGNITUDE_NOISE;
	magnitude = Math.max(0, Math.min(magnitude, MAX_LEAD));

	return {
		x: Math.max(0, Math.min(1, receiver.x + Math.cos(bearing) * magnitude)),
		y: Math.max(0, Math.min(1, receiver.y + Math.sin(bearing) * magnitude)),
	};
}

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

// ─── Survival Probability (pass estimator) ───────────────────────────────────
// P = probability the team still has the ball after the pass resolves, derived
// from the same laneSafety + openness terms the receiver scoring already
// computes. Calibrated to the shared meaning in CONTEXT.md (Survival
// Probability): a clear lane + open receiver ≈ 0.9, tight marking ≈ 0.3.
const PASS_SURVIVAL_FLOOR = 0.15;
const PASS_SURVIVAL_SPAN = 0.8;
// Openness (distance from receiver to nearest opponent) at which the receiver is
// considered fully free for survival purposes.
const OPENNESS_FREE = 0.12;
// Relative weights of lane clearness vs receiver openness in the survival blend.
const LANE_SURVIVAL_WEIGHT = 0.6;
const OPENNESS_SURVIVAL_WEIGHT = 0.4;

// Map a receiver's lane safety (0–1) and openness (pitch units) to retention P.
function passSurvival(laneSafety: number, openness: number): number {
	const opennessTerm = Math.min(openness / OPENNESS_FREE, 1);
	const safety =
		LANE_SURVIVAL_WEIGHT * laneSafety + OPENNESS_SURVIVAL_WEIGHT * opennessTerm;
	return clampSurvival(PASS_SURVIVAL_FLOOR + PASS_SURVIVAL_SPAN * safety);
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

	propose(ctx: ActionContext): ActionProposal {
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

			const proximity = Math.min(
				PROXIMITY_WEIGHT / (distToT + 0.01),
				PROXIMITY_CAP,
			);
			const markingPenalty = openness < MARKING_RADIUS ? MARKING_PENALTY : 0;
			const positionBonus = POSITION_BONUS[t.position];
			const blockers = laneDistances.filter(
				(d) => d < LANE_BLOCK_RADIUS,
			).length;
			const lanePenalty = blockers * LANE_BLOCK_PENALTY;
			const laneSafetyBonus = LANE_SAFETY_WEIGHT * laneSafety;
			const opennessBonus =
				OPENNESS_WEIGHT * Math.min(openness / MARKING_RADIUS, 2);
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
				laneSafety,
				proximity,
				positionBonus,
				blockers,
			};
		});

		// Best receiver still chosen by the existing scoring — that selection is the
		// pass geometry, unchanged. The score now feeds the proposal as an *input*
		// (via laneSafety + openness → Survival Probability), not as the output.
		const ranked = scored.sort((a, b) => b.score - a.score);
		const best = ranked[0];

		// Aim at a point in space (receiver + Lead Offset), not the receiver's feet.
		const target = leadTarget(best.t, opponents);

		const dx = target.x - ctx.player.x;
		const dy = target.y - ctx.player.y;

		const command: BallCommand = {
			type: "pass",
			toX: target.x,
			toY: target.y,
			receiverId: best.t.id,
			durationMs: flightDurationMs(dx, dy),
			easing: flightEasing(dx, dy),
		};

		// Expected Gain: the resulting state is the Pass Target held by the receiver,
		// discounted by the chance the pass reaches a friendly receiver. Marginal
		// against the arbiter's "now" baseline, so a non-progressive pass scores ~0.
		const survival = passSurvival(best.laneSafety, best.openness);
		const after = stateValue(target, best.t, survival);
		const baseline = ctx.baseline ?? baselineValue(ctx);
		return { gain: after - baseline, command };
	},
};
