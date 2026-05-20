export interface XY {
	x: number;
	y: number;
}

export interface SimPlayer {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
	isHome: boolean;
	x: number;
	y: number;
}

export type MatchPhase =
	| "kickoff"
	| "open_play"
	| "free_kick"
	| "goal_kick"
	| "corner"
	| "goal"
	| "halftime";

export interface SimFrame {
	tick: number;
	minute: number;
	phase: MatchPhase;
	players: SimPlayer[];
}
