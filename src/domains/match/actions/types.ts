import type { MatchPhase, XY } from "../types";

export type PlayerRole =
	| "GK"
	| "LB"
	| "LCB"
	| "RCB"
	| "RB"
	| "LW"
	| "LCM"
	| "RCM"
	| "CDM"
	| "RW"
	| "CAM"
	| "CF"
	| "SS";

export interface MatchPlayer {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
	role: PlayerRole;
	isHome: boolean;
	baseX: number;
	baseY: number;
	x: number;
	y: number;
	// The movement target this player is currently steering toward. Set by the
	// previous tick's Stage 4; one tick stale when read during Stage 3 (pass
	// command). Used by PassAction's Lead Offset to read the receiver's run.
	targetX: number;
	targetY: number;
	// Pace stub: the player's top movement speed, as a multiplier on base
	// MOVE_SPEED. Currently a single shared constant for every player (so
	// non-carrier behaviour is unchanged); the seam for a future per-player Pace
	// attribute wired through PlayerStats + the generator. Read only by the
	// carrier's slewed Carry speed for now. See the **Pace** glossary entry.
	maxSpeed: number;
}

// Read-only view of an in-flight pass, exposed to actions via ActionContext.
export interface BallFlightInfo {
	// Passer origin — the start of the flight line.
	readonly fromX: number;
	readonly fromY: number;
	// Pass Target — the landing point the ball is travelling to.
	readonly toX: number;
	readonly toY: number;
	readonly receiverId: string;
}

export interface ActionContext {
	readonly player: MatchPlayer;
	readonly allPlayers: readonly MatchPlayer[];
	readonly ball: XY;
	// Change in ball position over the last tick (dx, dy in pitch units).
	readonly ballVelocity: XY;
	readonly ballHolderId: string | null;
	readonly ballReceiverId: string | null;
	// The in-flight pass, if any. Carries the Pass Target (to) and passer origin
	// (from) so ReceiveAction can run onto the landing point or come short up the
	// flight line. Null when no ball is in flight.
	readonly ballFlight: BallFlightInfo | null;
	readonly phase: MatchPhase;
	readonly tick: number;
	// Per-player state bag owned by StatefulActions. Actions read their own slice
	// by key; the simulator stores the returned state opaquely after each tick.
	readonly playerState: Readonly<Record<string, unknown>>;
	// The "now" baseline for the Ball Action Arbiter: stateValue of the current
	// ball state, with survival = 1 (possession is certain right now). Computed
	// once by the arbiter and threaded here so every action subtracts the *same*
	// baseline to form its marginal Expected Gain. Undefined outside arbitration
	// (movement actions never read it).
	readonly baseline?: number;
}

// Governs player movement. Returns the desired target position for this tick.
export interface Action {
	canExecute(ctx: ActionContext): boolean;
	execute(ctx: ActionContext): XY;
}

// Extension for actions that need per-player state across ticks (e.g. hysteresis,
// phase dwell). The simulator calls updateState each tick to get the next state,
// stores it opaquely in the player record, and passes it back via ctx.playerState.
export interface StatefulAction extends Action {
	readonly stateKey: string;
	updateState(
		ctx: ActionContext,
		currentState: Record<string, unknown>,
	): Record<string, unknown>;
	executeStateful(ctx: ActionContext): XY;
	speedMultiplier?(ctx: ActionContext): number;
}

export type BallCommandType = "pass" | "dribble";

export interface PassCommand {
	type: "pass";
	toX: number;
	toY: number;
	receiverId: string;
	durationMs: number;
	easing: number;
}

export interface DribbleCommand {
	type: "dribble";
	toX: number;
	toY: number;
	// The chosen Carry Gear target speed multiplier (× base MOVE_SPEED). The
	// simulator slews the carrier's currentSpeedMultiplier toward this rather than
	// applying it directly, so a Drive winds up over several ticks (Speed Slew).
	speedMultiplier: number;
}

// Emitted by a defending player's TackleAction. The simulator resolves success/fail.
export interface TackleCommand {
	type: "tackle";
	tacklerId: string;
	targetId: string;
}

export type BallCommand = PassCommand | DribbleCommand | TackleCommand;

// What a BallAction proposes to the Ball Action Arbiter: the move it would make
// if it won, paired with that move's Expected Gain on the shared State Value
// scale. Computed together in one pass — no separate scoring step.
export interface ActionProposal {
	// Expected Gain: stateValue(after) − baseline (the "now" value, survival = 1).
	gain: number;
	// The move this action would make if it wins the arbitration.
	command: BallCommand;
}

// Governs what the ball carrier does. Each eligible action proposes an Expected
// Gain; the Ball Action Arbiter executes the proposal with the highest gain.
export interface BallAction {
	// Eligibility only — is this action possible at all this tick? It no longer
	// decides *which* action runs; the arbiter does, by comparing gains.
	canExecute(ctx: ActionContext): boolean;
	// Pure: reads ctx (including ctx.playerState) but never advances it. Computes
	// the action's best move once and returns that move's command and gain.
	propose(ctx: ActionContext): ActionProposal;
}

// Extension for ball actions that carry per-player state across ticks (e.g. the
// dribbler's Carry Gear + dwell window). Mirrors StatefulAction for movement:
// the simulator calls updateState each tick to get the next state, stores it
// opaquely in the player's actionState, and passes it back via ctx.playerState.
// Only the arbiter's *winner* runs updateState, so the gear roll stays strictly
// downstream of selection (propose() prices the carry on a neutral estimate).
export interface StatefulBallAction extends BallAction {
	readonly stateKey: string;
	updateState(
		ctx: ActionContext,
		currentState: Record<string, unknown>,
	): Record<string, unknown>;
}
