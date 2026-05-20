/**
 * Core types for the V2 simulator's strict four-stage pipeline.
 *
 * Data flow per tick:
 *   TickSnapshot → selectActions → TickPlan
 *                               → resolvePhysics → resolveState → emitFrame
 *
 * Coordinate space: x/y in [0,1]. y=0 is the home goal line, y=1 is the away
 * goal line. Home attacks toward y=1; away attacks toward y=0.
 */

import type { MatchEvent, MatchResult } from "#/domains/match/types";

export type { MatchEvent, MatchResult };

// ─── Phases ───────────────────────────────────────────────────────────────────

export type Phase =
	| "kickoff"
	| "buildup"
	| "midfield"
	| "attack"
	| "chance"
	| "goal"
	| "save"
	| "counter"
	| "corner"
	| "freekick";

// ─── Player roles ─────────────────────────────────────────────────────────────

export type Role =
	| "GK"
	| "CB"
	| "LB"
	| "RB"
	| "CDM"
	| "CM"
	| "LM"
	| "RM"
	| "CAM"
	| "ST"
	| "LW"
	| "RW";

// ─── Player state ─────────────────────────────────────────────────────────────

export interface SimPlayer {
	id: string;
	name: string;
	role: Role;
	isHome: boolean;
	x: number;
	y: number;
	/** Movement target set by selectActions stage 1a (positioning pass). */
	targetX: number;
	targetY: number;
	/** Formation anchor — unique per player, used as drift anchor. */
	baseX: number;
	baseY: number;
	hasBall: boolean;
	debugAction?: string;
}

// ─── Ball state ───────────────────────────────────────────────────────────────

export interface SimBall {
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	/** Current speed in pitch-fractions per tick. 0 = ball held or at rest. */
	speed: number;
}

// ─── Tick plan ────────────────────────────────────────────────────────────────

/**
 * Output of selectActions — the explicit contract between selection and physics.
 * No mutation has occurred when this is produced; resolvePhysics reads it and
 * applies all movement in one pass.
 */
export interface TickPlan {
	/** Movement targets for every player (keyed by player id). */
	playerTargets: Map<string, { x: number; y: number; debugAction?: string }>;

	/** Ball destination. If null, ball follows the carrier. */
	ballTarget: { x: number; y: number } | null;

	/** Ball travel speed when ballTarget is set. */
	ballSpeed: number;

	/** If set, this player will receive the ball once it arrives. */
	pendingCarrierId: string | null;

	/** Phase to transition into when the ball is received (or immediately if no flight). */
	nextPhase: Phase | null;

	/** Debug label for the carrier's action. */
	carrierAction: string;
}

// ─── Frame (snapshot the renderer reads) ──────────────────────────────────────

export interface SimFrame {
	minute: number;
	second: number;
	phase: Phase;
	homePossession: boolean;
	homeScore: number;
	awayScore: number;
	players: SimPlayer[];
	ball: SimBall;
	firedEvent: MatchEvent | null;
}
