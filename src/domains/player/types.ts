export interface PlayerStats {
	// Attacking
	finishing: number;
	longShots: number;
	offTheBall: number;
	// Technical
	passing: number;
	dribbling: number;
	firstTouch: number;
	technique: number;
	// Defending
	tackling: number;
	marking: number;
	positioning: number;
	// Mental
	composure: number;
	decisions: number;
	determination: number;
	workRate: number;
	// Physical
	pace: number;
	acceleration: number;
	stamina: number;
	strength: number;
}

export interface GKStats {
	reflexes: number;
	handling: number;
	positioning: number;
	kicking: number;
	aerial: number;
	// Mental
	composure: number;
	decisions: number;
	determination: number;
	// Physical
	pace: number;
	stamina: number;
	strength: number;
}

export type Position = "GK" | "DEF" | "MID" | "FWD";

export type Personality =
	| "Model Professional"
	| "Determined"
	| "Average"
	| "Lazy"
	| "Temperamental";

export interface CASnapshot {
	date: string; // ISO date string YYYY-MM-DD
	ca: number;
}

export interface Player {
	id: string;
	name: string;
	dateOfBirth: string; // ISO date string YYYY-MM-DD
	position: Position;
	stats: PlayerStats | GKStats;
	ca: number; // current ability 1–200
	pa: number; // potential ability 1–200 (hidden from UI)
	personality: Personality;
	naturalFitness: number; // 1–20
	wage: number; // weekly £
	value: number; // transfer value £
	form: number; // 0–10, recent performance
	injured: boolean;
	injuryWeeks: number;
	morale: number; // 0–10
	faceSeed: number; // seed for procedural face generation
	caHistory: CASnapshot[]; // weekly CA snapshots, oldest first
}

export function isGKStats(stats: PlayerStats | GKStats): stats is GKStats {
	return "reflexes" in stats;
}
