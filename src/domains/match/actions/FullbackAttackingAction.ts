import {
	attackingDepth,
	ballIsLoose,
	softClamp,
	teamIsInPossession,
} from "../queries";
import type { XY } from "../types";
import { activeZone } from "./AttackingPositionAction";
import { LB } from "./roles/LB";
import { RB } from "./roles/RB";
import type { ActionContext, MatchPlayer, StatefulAction } from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const RECOVERY_THRESHOLD_BEHIND_BALL = 0.08;
const ON_FLANK_X_THRESHOLD = 0.3;
const WINGER_ON_FLANK_X_THRESHOLD = 0.25;
const OVERLAP_RUN_AHEAD_OF_WINGER = 0.12;
const OVERLAP_MIN_GAP_AHEAD_OF_WINGER = 0.06;
const HOLD_NARROW_X = 0.18;
const PHASE_DWELL_FRAMES = 20;
const BALL_PROJECTION_TICKS = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

type FullbackPhase =
	| "recovery"
	| "hold-wide"
	| "hold-narrow"
	| "support"
	| "overlap";

interface FullbackState {
	phase: FullbackPhase | null;
	phaseAge: number;
	pendingPhase: FullbackPhase | null;
	pendingPhaseAge: number;
}

const FULLBACK_ROLES = ["LB", "RB"] as const;
type FullbackRole = (typeof FULLBACK_ROLES)[number];

function isFullback(role: string): role is FullbackRole {
	return (FULLBACK_ROLES as readonly string[]).includes(role);
}

function readState(ctx: ActionContext): FullbackState {
	const s = ctx.playerState as Partial<FullbackState>;
	return {
		phase: s.phase ?? null,
		phaseAge: s.phaseAge ?? 0,
		pendingPhase: s.pendingPhase ?? null,
		pendingPhaseAge: s.pendingPhaseAge ?? 0,
	};
}

// ─── Spatial helpers ─────────────────────────────────────────────────────────

function fullbackAttackingDepth(player: MatchPlayer): number {
	return attackingDepth(player.y, player.isHome);
}

function ballAttackingDepth(ctx: ActionContext): number {
	return attackingDepth(ctx.ball.y, ctx.player.isHome);
}

function flankWinger(ctx: ActionContext): MatchPlayer | null {
	const wingerRole = ctx.player.role === "LB" ? "LW" : "RW";
	return (
		ctx.allPlayers.find(
			(p) => p.isHome === ctx.player.isHome && p.role === wingerRole,
		) ?? null
	);
}

// ─── Phase selection ──────────────────────────────────────────────────────────

function isOutOfPositionBehindBall(ctx: ActionContext): boolean {
	if (teamIsInPossession(ctx)) return false;
	if (ballIsLoose(ctx)) return false;
	const fbDepth = fullbackAttackingDepth(ctx.player);
	const ballDepth = ballAttackingDepth(ctx);
	return fbDepth < ballDepth - RECOVERY_THRESHOLD_BEHIND_BALL;
}

function projectedBallDistanceFromFlank(ctx: ActionContext): number {
	const projectedBallX =
		ctx.ball.x + ctx.ballVelocity.x * BALL_PROJECTION_TICKS;
	if (ctx.player.role === "LB") return projectedBallX;
	return 1 - projectedBallX;
}

function ballIsOnThisFlank(ctx: ActionContext): boolean {
	return projectedBallDistanceFromFlank(ctx) < ON_FLANK_X_THRESHOLD;
}

function wingerIsOnThisFlank(winger: MatchPlayer, ctx: ActionContext): boolean {
	if (ctx.player.role === "LB") return winger.x < WINGER_ON_FLANK_X_THRESHOLD;
	return winger.x > 1 - WINGER_ON_FLANK_X_THRESHOLD;
}

function candidatePhase(ctx: ActionContext, state: FullbackState): FullbackPhase {
	if (isOutOfPositionBehindBall(ctx)) return "recovery";
	if (state.phase === "recovery") return "hold-wide";

	if (ballIsLoose(ctx)) {
		return ballIsOnThisFlank(ctx) ? "support" : "hold-narrow";
	}

	if (!teamIsInPossession(ctx)) {
		return ballIsOnThisFlank(ctx) ? "hold-wide" : "hold-narrow";
	}

	if (ballIsOnThisFlank(ctx)) {
		const winger = flankWinger(ctx);
		if (winger !== null && wingerIsOnThisFlank(winger, ctx)) return "overlap";
		return "support";
	}

	return "support";
}

function selectPhase(ctx: ActionContext, state: FullbackState): FullbackPhase {
	const candidate = candidatePhase(ctx, state);

	if (candidate === "recovery") return candidate;
	if (candidate === "hold-wide") return candidate;
	if (candidate === "hold-narrow") return candidate;

	if (candidate === state.phase) return candidate;
	if (state.phase === null) return candidate;

	if (
		candidate === state.pendingPhase &&
		state.pendingPhaseAge >= PHASE_DWELL_FRAMES
	) {
		return candidate;
	}

	return state.phase;
}

// ─── Target positions per phase ───────────────────────────────────────────────

function recoveryTarget(ctx: ActionContext): XY {
	const config = ctx.player.role === "LB" ? LB : RB;
	const ownGoalY = ctx.player.isHome ? 1 : 0;
	const defensiveZoneCenterY =
		config.yMinDeep + (config.yMaxDeep - config.yMinDeep) / 2;
	const fallbackY = ctx.player.isHome
		? defensiveZoneCenterY
		: 1 - defensiveZoneCenterY;
	const fallbackX = (config.xMin + config.xMax) / 2;

	const opponents = ctx.allPlayers.filter(
		(p) => p.isHome !== ctx.player.isHome,
	);
	const flankOpponents = opponents.filter(
		(p) => p.x >= config.xMin && p.x <= config.xMax,
	);

	if (flankOpponents.length === 0) return { x: fallbackX, y: fallbackY };

	const mostAdvanced = flankOpponents.reduce((best, p) =>
		attackingDepth(p.y, ctx.player.isHome) >
		attackingDepth(best.y, ctx.player.isHome)
			? p
			: best,
	);

	const targetX = Math.max(config.xMin, Math.min(config.xMax, mostAdvanced.x));
	const targetY = (mostAdvanced.y + ownGoalY) / 2;
	return { x: targetX, y: targetY };
}

function holdWideTarget(ctx: ActionContext): XY {
	const config = ctx.player.role === "LB" ? LB : RB;
	const zone = activeZone(ctx.player, ctx.ball, config);
	const touchlineX =
		ctx.player.role === "LB" ? config.xMin + 0.05 : config.xMax - 0.05;
	const y = softClamp(ctx.ball.y, zone.yMin, zone.yMax);
	return { x: touchlineX, y };
}

function holdNarrowTarget(ctx: ActionContext): XY {
	const config = ctx.player.role === "LB" ? LB : RB;
	const zone = activeZone(ctx.player, ctx.ball, config);
	const flankEdgeX = ctx.player.role === "LB" ? config.xMin : config.xMax;
	const narrowX = ctx.player.role === "LB" ? HOLD_NARROW_X : 1 - HOLD_NARROW_X;
	const ballDistFromFlank =
		ctx.player.role === "LB" ? ctx.ball.x : 1 - ctx.ball.x;
	const t = Math.min(1, Math.max(0, ballDistFromFlank));
	const x = flankEdgeX + (narrowX - flankEdgeX) * t;
	const y = softClamp(ctx.ball.y, zone.yMin, zone.yMax);
	return { x, y };
}

const SUPPORT_AHEAD_OF_BALL = 0.06;

function supportTarget(ctx: ActionContext): XY {
	const config = ctx.player.role === "LB" ? LB : RB;
	const zone = activeZone(ctx.player, ctx.ball, config);
	const flankX =
		ctx.player.role === "LB" ? config.xMin + 0.05 : config.xMax - 0.05;
	const ballDepth = ballAttackingDepth(ctx);
	const targetDepth = ballDepth + SUPPORT_AHEAD_OF_BALL;
	const rawY = ctx.player.isHome ? 1 - targetDepth : targetDepth;
	// Hard-clamp so the fullback never overruns its zone into the opponent box.
	const y = Math.max(zone.yMin, Math.min(zone.yMax, rawY));
	return { x: flankX, y };
}

function overlapTarget(ctx: ActionContext, winger: MatchPlayer): XY {
	const config = ctx.player.role === "LB" ? LB : RB;
	const zone = activeZone(ctx.player, ctx.ball, config);
	const touchlineX =
		ctx.player.role === "LB" ? config.xMin + 0.03 : config.xMax - 0.03;
	const wingerDepth = attackingDepth(winger.y, ctx.player.isHome);
	const gapAheadOfWinger = Math.max(
		OVERLAP_RUN_AHEAD_OF_WINGER,
		OVERLAP_MIN_GAP_AHEAD_OF_WINGER,
	);
	const aheadOfWinger = wingerDepth + gapAheadOfWinger;
	const rawY = ctx.player.isHome ? 1 - aheadOfWinger : aheadOfWinger;
	// Hard-clamp so an overlap chasing the (now higher) winger can't run the
	// fullback past its zone ceiling and into the opponent box.
	const y = Math.max(zone.yMin, Math.min(zone.yMax, rawY));
	return { x: touchlineX, y };
}

function targetForPhase(ctx: ActionContext, phase: FullbackPhase): XY {
	if (phase === "recovery") return recoveryTarget(ctx);
	if (phase === "hold-wide") return holdWideTarget(ctx);
	if (phase === "hold-narrow") return holdNarrowTarget(ctx);
	if (phase === "overlap") {
		const winger = flankWinger(ctx);
		if (winger !== null) return overlapTarget(ctx, winger);
	}
	return supportTarget(ctx);
}

// ─── Action ───────────────────────────────────────────────────────────────────

export const FullbackAttackingAction: StatefulAction = {
	stateKey: "fullback",

	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (!isFullback(ctx.player.role)) return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		if ((ctx.ballReceiverId ?? null) === ctx.player.id) return false;
		// Only drive attacking runs when we have (or are contesting) the ball.
		// When the opposition is in possession, defer to DefensivePositionAction
		// so the fullback retreats goal-side instead of holding a high line.
		if (!teamIsInPossession(ctx) && !ballIsLoose(ctx)) return false;
		return true;
	},

	// Called by the simulator before execute. Advances the dwell clock and returns
	// the updated state to be stored on the player for the next tick.
	updateState(
		ctx: ActionContext,
		current: Record<string, unknown>,
	): Record<string, unknown> {
		const state = current as Partial<FullbackState>;
		const prev: FullbackState = {
			phase: state.phase ?? null,
			phaseAge: state.phaseAge ?? 0,
			pendingPhase: state.pendingPhase ?? null,
			pendingPhaseAge: state.pendingPhaseAge ?? 0,
		};

		// Step 1: compute candidate from last tick's committed state.
		const candidate = candidatePhase(ctx, prev);

		// Step 2: advance the pending-phase dwell clock.
		const pendingPhase = candidate;
		const pendingPhaseAge =
			candidate === prev.pendingPhase ? prev.pendingPhaseAge + 1 : 0;

		// Step 3: decide whether to commit.
		const stateWithPending: FullbackState = {
			...prev,
			pendingPhase,
			pendingPhaseAge,
		};
		const committed = selectPhase(ctx, stateWithPending);
		const phaseAge =
			committed === prev.phase ? prev.phaseAge + 1 : 0;

		return { phase: committed, phaseAge, pendingPhase, pendingPhaseAge };
	},

	executeStateful(ctx: ActionContext): XY {
		const state = readState(ctx);
		// State was already updated this tick by the simulator before calling this.
		const phase = state.phase ?? candidatePhase(ctx, state);
		return targetForPhase(ctx, phase);
	},

	// Fallback for the generic Action interface.
	execute(ctx: ActionContext): XY {
		const state = readState(ctx);
		const phase = selectPhase(ctx, state);
		return targetForPhase(ctx, phase);
	},

	speedMultiplier(ctx: ActionContext): number {
		const state = readState(ctx);
		return state.phase === "recovery" ? 1.6 : 1;
	},
};
