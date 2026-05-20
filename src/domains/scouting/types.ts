import type { Position } from "#/domains/player/types";

export interface ScoutedPlayer {
	playerId: string;
	sightings: number;
	paEstimateLow: number;
	paEstimateHigh: number;
}

export interface ScoutingAssignment {
	id: string;
	position: Position | null; // null means any position
	minAge: number | null;
	maxAge: number | null;
	maxWage: number | null;
	scoutedPlayers: ScoutedPlayer[];
}
