/**
 * Shared types for the per-tick action system.
 *
 * Each action (pass, shoot, dribble, tackle, cross) is a module that exports:
 *   canExecute(ctx) → boolean   — precondition check
 *   execute(ctx)    → ActionResult — performs the action, returns mutations
 *
 * The actionSelector evaluates the possessing-team's carrier through a
 * priority-ordered list of actions and fires the first one that passes.
 * Defending players run a separate, simpler list (press, tackle, position).
 *
 * Coordinate space: x/y in [0, 1], where y=0 is the home goal line and
 * y=1 is the away goal line. Home attacks toward y=1; away attacks toward y=0.
 */

import type { Phase, Role, SimPlayer } from "../simulator";

// ─── Pitch zones ──────────────────────────────────────────────────────────────

/**
 * Vertical thirds of the pitch relative to the *attacking* team.
 *   defensiveThird  — own half, deep
 *   middleThird     — central zone
 *   finalThird      — opponent's half, close to goal
 */
export type PitchThird = "defensiveThird" | "middleThird" | "finalThird";

/**
 * Horizontal band.
 *   wide    — within ~20% of either touchline
 *   central — the middle 60%
 */
export type PitchLane = "wide" | "central";

export interface PitchZone {
	third: PitchThird;
	lane: PitchLane;
}

/** Returns the zone for a position from the perspective of the attacking team (isHome). */
export function getZone(x: number, y: number, isHome: boolean): PitchZone {
	// y progress toward opponent's goal (0 = own goal, 1 = opponent's goal)
	const attackY = isHome ? y : 1 - y;

	const third: PitchThird =
		attackY < 0.33
			? "defensiveThird"
			: attackY < 0.66
				? "middleThird"
				: "finalThird";

	const lane: PitchLane = x < 0.2 || x > 0.8 ? "wide" : "central";

	return { third, lane };
}

// ─── Phase configuration ──────────────────────────────────────────────────────

/**
 * Optional per-phase rules passed through ActionContext.
 * Phases that need no special rules omit this entirely.
 */
export interface PhaseConfig {
	/** Restricts who the GK can short-pass to (e.g. CB/LB/RB during buildup). */
	gkReceiverRoles?: Role[];
	/** Roles whose receipt triggers a phase transition (e.g. CDM/CM ends buildup). */
	exitRoles?: Role[];
	/** Roles allowed to receive at all in this phase. Omit = no restriction. */
	receiverRoles?: Role[];
}

// ─── Context passed to every action ──────────────────────────────────────────

export interface ActionContext {
	/** The player currently holding the ball. */
	carrier: SimPlayer;
	/** All players on the pitch. */
	players: SimPlayer[];
	/** Current match phase. */
	phase: Phase;
	/** True = home team has possession. */
	homePossession: boolean;
	/** Seeded RNG — always use this, never Math.random(), so replays are deterministic. */
	rng: () => number;
	/** Optional phase-specific rules. Omit for phases with no special constraints. */
	phaseConfig?: PhaseConfig;
}

// ─── Action result ────────────────────────────────────────────────────────────

/**
 * What the simulator should do after an action fires.
 * All fields are optional — omit what you don't need to change.
 */
export interface ActionResult {
	/** Action that just ran — for debug / event logging. */
	action: ActionName;

	/** Human-readable explanation of why this action fired. Set by each action module. */
	reason?: string;

	/** If set, transfers possession to this player immediately. */
	newCarrierId?: string;

	/**
	 * Ball target position. If the ball is in flight (pass/cross/shot),
	 * set this to the destination. The simulator lerps the ball there.
	 */
	ballTarget?: { x: number; y: number };

	/**
	 * How fast the ball travels toward ballTarget per tick (0–1 fraction of pitch).
	 * Leave undefined to keep the ball glued to the carrier.
	 */
	ballSpeed?: number;

	/**
	 * Per-player movement targets to apply this tick.
	 * Only include players whose target should change.
	 */
	playerTargets?: Map<string, { x: number; y: number }>;

	/**
	 * If true, the carrier has lost the ball (tackle won, shot taken, pass away).
	 * The simulator will clear holderId and pick a new one based on newCarrierId.
	 */
	ballReleased?: boolean;

	/**
	 * Request a phase change. The simulator will honour this after applying
	 * all other mutations from the result.
	 */
	nextPhase?: Phase;
}

export type ActionName =
	| "pass"
	| "shoot"
	| "dribble"
	| "cross"
	| "tackle"
	| "press"
	| "position";

// ─── Action interface ─────────────────────────────────────────────────────────

export interface Action {
	name: ActionName;
	/** Lower = higher priority. */
	priority: number;
	canExecute: (ctx: ActionContext) => boolean;
	execute: (ctx: ActionContext) => ActionResult;
}
