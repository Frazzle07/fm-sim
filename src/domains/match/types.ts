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
	hasBall: boolean;
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
	ball: XY;
}

export type MatchEventType =
	| "goal"
	| "yellowCard"
	| "redCard"
	| "substitution"
	| "save"
	| "injury";

export interface MatchEvent {
	minute: number;
	type: MatchEventType;
	teamId: string;
	playerName: string;
	detail?: string;
}

export interface MatchResult {
	homeTeamId: string;
	awayTeamId: string;
	homeGoals: number;
	awayGoals: number;
	events: MatchEvent[];
}

export interface Fixture {
	id: string;
	week: number;
	date: string; // ISO date string YYYY-MM-DD
	homeTeamId: string;
	awayTeamId: string;
	result?: MatchResult;
	played: boolean;
}
