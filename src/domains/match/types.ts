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
