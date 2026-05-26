import type { MatchPhase, XY } from "../types";

export type PlayerRole =
	| "GK"
	| "LB"
	| "CB"
	| "RB"
	| "LW"
	| "CM"
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
}

export interface ActionContext {
	readonly player: MatchPlayer;
	readonly allPlayers: readonly MatchPlayer[];
	readonly ball: XY;
	readonly ballHolderId: string | null;
	readonly ballReceiverId: string | null;
	readonly phase: MatchPhase;
	readonly tick: number;
}

// Governs player movement. Returns the desired target position for this tick.
export interface Action {
	canExecute(ctx: ActionContext): boolean;
	execute(ctx: ActionContext): XY;
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
