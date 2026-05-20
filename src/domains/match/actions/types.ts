import type { MatchPhase, XY } from "../types";

export interface MatchPlayer {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
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
	readonly phase: MatchPhase;
	readonly tick: number;
}

// Governs player movement. Returns the desired target position for this tick.
export interface Action {
	canExecute(ctx: ActionContext): boolean;
	execute(ctx: ActionContext): XY;
}

export type BallCommandType = "pass";

export interface PassCommand {
	type: "pass";
	toX: number;
	toY: number;
	receiverId: string;
	durationTicks: number;
	easing: number;
}

export type BallCommand = PassCommand;

// Governs what the ball carrier does. Returns a BallCommand for this tick.
export interface BallAction {
	canExecute(ctx: ActionContext): boolean;
	execute(ctx: ActionContext): BallCommand;
}
