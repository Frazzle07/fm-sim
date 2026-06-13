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
}

// Emitted by a defending player's TackleAction. The simulator resolves success/fail.
export interface TackleCommand {
	type: "tackle";
	tacklerId: string;
	targetId: string;
}

export type BallCommand = PassCommand | DribbleCommand | TackleCommand;

// Governs what the ball carrier does. Returns a BallCommand for this tick.
export interface BallAction {
	canExecute(ctx: ActionContext): boolean;
	execute(ctx: ActionContext): BallCommand;
}
