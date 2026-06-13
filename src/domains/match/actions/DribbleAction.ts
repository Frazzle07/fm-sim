import { attackingDepth } from "../queries";
import { baselineValue, clampSurvival, stateValue } from "./arbiter";
import { ROLE_ZONE_CONFIG } from "./roles";
import type {
	ActionContext,
	ActionProposal,
	BallCommand,
	MatchPlayer,
	StatefulBallAction,
} from "./types";

// A defender this close to the carrier counts as a tackle attempt; the carrier
// can't simply carry away from it (TackleAction resolves the duel instead).
const TACKLED_RADIUS = 0.05;

// Carry Objective: how far around the carrier we probe each compass direction.
const CARRY_PROBE_DISTANCE = 0.08;
// Backward penalty: a candidate that retreats toward the carrier's own goal has
// its State-Value score multiplied by this. Over the short carry probe the depth
// lost by stepping back is tiny next to the openness gained behind the play, so
// pure State Value still picks the retreat. This penalty makes backward a rare
// escape valve — chosen only when forward and sideways are badly blocked and
// backward is far safer. Sideways candidates (forwardProgress ≈ 0) are untouched.
const BACKWARD_PENALTY = 0.3;

// Carry Gear pressure radii (nearest-defender distance to the carrier).
// Beyond CARRY_THREAT_RADIUS: no pressure → Walk.
const CARRY_THREAT_RADIUS = 0.15;
// Within CARRY_DRIVE_RADIUS: close enough that a Drive becomes *available* (still
// gated by the Drive Tendency roll and open space ahead).
const CARRY_DRIVE_RADIUS = 0.08;

// Gear centres (× base MOVE_SPEED). Each is a centre, not a fixed value —
// GEAR_JITTER is applied around it. Player-to-player differences come from Pace.
const WALK_SPEED = 0.5;
const JOG_SPEED = 1.0;
const DRIVE_SPEED = 1.4;
const GEAR_JITTER = 0.08;

// Ticks a chosen gear commits before re-rolling, so the gear choice doesn't
// flicker tick-to-tick (Speed Slew separately smooths the *execution*).
const GEAR_DWELL_TICKS = 30;

type Gear = "walk" | "jog" | "drive";

interface CarryState {
	gear: Gear;
	dwellUntilTick: number;
}

const GEAR_CENTRE: Record<Gear, number> = {
	walk: WALK_SPEED,
	jog: JOG_SPEED,
	drive: DRIVE_SPEED,
};

const STATE_KEY = "dribble";

function attackingDir(player: { isHome: boolean }): number {
	return player.isHome ? 1 : -1;
}

function opponentsOf(ctx: ActionContext): MatchPlayer[] {
	return ctx.allPlayers.filter((p) => p.isHome !== ctx.player.isHome);
}

// Distance from a point to the nearest defender. The carry's "openness" is
// measured at the candidate point, not the carrier's feet.
function nearestDefenderDist(
	point: { x: number; y: number },
	opponents: MatchPlayer[],
): number {
	let min = Infinity;
	for (const opp of opponents) {
		const d = Math.hypot(opp.x - point.x, opp.y - point.y);
		if (d < min) min = d;
	}
	return min;
}

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

// Carry Objective: pick the best of the 8 compass directions for the carrier.
// Unlike off-ball Space Score, this omits laneSafety/depthAlignment and is *not*
// clamped to a Tactical Zone — the carrier may probe anywhere on the pitch
// (candidates are still clamped to the pitch bounds [0, 1]).
//
// Candidates are scored by their projected State Value (attackingDepth ×
// carry Survival Probability) — the *same* currency the Ball Action Arbiter
// uses to compare the carry against a pass. Scoring on State Value rather than
// raw openness is what stops carriers retreating into space: a backward
// candidate is more open (its survival is higher) but sits at lower
// attackingDepth, so it only wins when the openness it buys genuinely outweighs
// the depth it surrenders — e.g. when forward is walled off under pressure. A
// wide-open backward step no longer beats a tighter forward one purely on space.
function bestCarryCandidate(ctx: ActionContext): {
	x: number;
	y: number;
	openness: number;
	forwardProgress: number;
} {
	const { player } = ctx;
	const opponents = opponentsOf(ctx);
	const dir = attackingDir(player);

	let best = {
		x: player.x,
		y: player.y,
		openness: 0,
		forwardProgress: 0,
		score: -Infinity,
	};

	for (const d of COMPASS_DIRS) {
		const cx = Math.max(0, Math.min(1, player.x + d.dx * CARRY_PROBE_DISTANCE));
		const cy = Math.max(0, Math.min(1, player.y + d.dy * CARRY_PROBE_DISTANCE));
		const candidate = { x: cx, y: cy };
		const openness = nearestDefenderDist(candidate, opponents);
		// Positive = candidate is nearer the opponent goal than the carrier.
		const forwardProgress = (cy - player.y) * dir;
		// Projected State Value at the candidate: deeper *and* more open scores
		// higher. A backward candidate is heavily penalised on top of the depth it
		// already loses, so the carrier retreats only as a last resort.
		const directionFactor = forwardProgress < 0 ? BACKWARD_PENALTY : 1;
		const score =
			attackingDepth(cy, player.isHome) * carrySurvival(openness) * directionFactor;
		if (score > best.score) {
			best = { x: cx, y: cy, openness, forwardProgress, score };
		}
	}

	return {
		x: best.x,
		y: best.y,
		openness: best.openness,
		forwardProgress: best.forwardProgress,
	};
}

function readState(ctx: ActionContext): CarryState | null {
	const s = ctx.playerState as Partial<CarryState>;
	if (typeof s.gear === "string" && typeof s.dwellUntilTick === "number") {
		return { gear: s.gear, dwellUntilTick: s.dwellUntilTick };
	}
	return null;
}

// Pick the target gear from the carrier's current situation. Drive is gated by
// proximity (a close defender), open space ahead (the chosen carry direction
// makes forward progress and is open), and a stochastic Drive Tendency roll
// keyed to the role.
function chooseGear(ctx: ActionContext): Gear {
	const opponents = opponentsOf(ctx);
	const nearest = nearestDefenderDist(
		{ x: ctx.player.x, y: ctx.player.y },
		opponents,
	);

	// No pressure: walk the ball (deep buildup, unpressured probing).
	if (nearest > CARRY_THREAT_RADIUS) return "walk";

	// A close defender makes Drive *available* — but only if there's open space
	// ahead and the role-gated roll fires. Otherwise jog.
	if (nearest <= CARRY_DRIVE_RADIUS) {
		const best = bestCarryCandidate(ctx);
		const openAhead = best.forwardProgress > 0 && best.openness > nearest;
		if (openAhead && Math.random() < driveTendencyOf(ctx)) {
			return "drive";
		}
	}

	return "jog";
}

function driveTendencyOf(ctx: ActionContext): number {
	return ROLE_ZONE_CONFIG[ctx.player.role]?.driveTendency ?? 0;
}

// Carry Tendency multiplier on the carry's Expected Gain. Roles with no config
// (the GK) default low so goalkeepers distribute by passing, carrying only when
// no pass clears the bar in the arbiter.
const DEFAULT_CARRY_TENDENCY = 0.05;
function carryTendencyOf(ctx: ActionContext): number {
	return ROLE_ZONE_CONFIG[ctx.player.role]?.carryTendency ?? DEFAULT_CARRY_TENDENCY;
}

// ─── Survival Probability (carry estimator) ──────────────────────────────────
// P = probability the team still has the ball after carrying to the candidate,
// from nearest-defender proximity at the carry target. Neutral Jog-equivalent:
// no gear has been rolled at propose time, so this never reflects a Drive's
// higher retention — the gear roll stays downstream of selection (CONTEXT.md
// Survival Probability). Calibrated to the shared meaning: open space ≈ 0.9, a
// defender at CARRY_DRIVE_RADIUS ≈ 0.4.
const CARRY_SURVIVAL_FLOOR = 0.2;
const CARRY_SURVIVAL_SPAN = 0.75;
// Defender distance at the carry target beyond which the carrier is fully safe.
const CARRY_SAFE_DISTANCE = 0.18;

function carrySurvival(defenderDist: number): number {
	const safety = Math.min(defenderDist / CARRY_SAFE_DISTANCE, 1);
	return clampSurvival(CARRY_SURVIVAL_FLOOR + CARRY_SURVIVAL_SPAN * safety);
}

// Neutral placeholder gear used to price the carry at propose time before the
// arbiter has picked a winner (only the winner rolls its real Carry Gear).
const NEUTRAL_SPEED = JOG_SPEED;

export const DribbleAction: StatefulBallAction = {
	stateKey: STATE_KEY,

	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId !== ctx.player.id) return false;

		// A defender within tackling range is contesting the ball — let
		// TackleAction resolve the duel rather than carrying straight through them.
		const opponents = opponentsOf(ctx);
		const isTackled = opponents.some(
			(opp) =>
				Math.hypot(opp.x - ctx.player.x, opp.y - ctx.player.y) < TACKLED_RADIUS,
		);
		return !isTackled;
	},

	updateState(
		ctx: ActionContext,
		currentState: Record<string, unknown>,
	): Record<string, unknown> {
		const state = currentState as Partial<CarryState>;
		const committed =
			typeof state.gear === "string" &&
			typeof state.dwellUntilTick === "number"
				? (state as CarryState)
				: null;

		// While dwelling, hold the committed gear (anti-flicker).
		if (committed !== null && ctx.tick < committed.dwellUntilTick) {
			return { ...committed };
		}

		// Dwell elapsed (or no prior state): re-roll the gear and commit it.
		const gear = chooseGear(ctx);
		return { gear, dwellUntilTick: ctx.tick + GEAR_DWELL_TICKS };
	},

	propose(ctx: ActionContext): ActionProposal {
		const best = bestCarryCandidate(ctx);

		// Survival is always the neutral Jog estimate — independent of any gear —
		// so the gain that feeds the arbiter never moves with the stochastic gear
		// roll. Measured at the carry candidate, where the carrier would arrive.
		const opponents = opponentsOf(ctx);
		const defenderDist = nearestDefenderDist(best, opponents);
		const survival = carrySurvival(defenderDist);

		const after = stateValue(best, ctx.player, survival);
		const baseline = ctx.baseline ?? baselineValue(ctx);
		// Carry Tendency scales the role's willingness to carry at all: a low value
		// (default for the GK) shrinks the gain so any half-decent pass wins the
		// arbiter, leaving the carry as a last resort. Only discounts a positive
		// gain — it should never turn a losing carry into a *better*-looking one.
		const rawGain = after - baseline;
		const gain = rawGain > 0 ? rawGain * carryTendencyOf(ctx) : rawGain;

		// Speed: only the arbiter's winner has had its Carry Gear rolled and stored
		// by the time propose() runs (the simulator advances state on the winner
		// before re-proposing). So read the committed gear from ctx.playerState if
		// present; otherwise price the move on the neutral Jog speed. Either way the
		// gear does not affect `gain` above.
		const state = readState(ctx);
		const centre = state ? GEAR_CENTRE[state.gear] : NEUTRAL_SPEED;
		const jitter = (Math.random() * 2 - 1) * GEAR_JITTER;
		const speedMultiplier = Math.max(0.1, centre + jitter);

		return {
			gain,
			command: {
				type: "dribble",
				toX: best.x,
				toY: best.y,
				speedMultiplier,
			} satisfies BallCommand,
		};
	},
};
