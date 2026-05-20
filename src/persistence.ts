import type { GameState } from "#/GameState";

const SLOT_COUNT = 3;
const key = (slot: number) => `fm-sim:save:${slot}`;

export interface SaveMeta {
	slot: number;
	teamName: string;
	teamColor: string;
	week: number;
	season: number;
	savedAt: string; // ISO date string
}

export interface SaveEntry extends SaveMeta {
	state: GameState;
}

export function saveGame(slot: number, state: GameState): void {
	const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
	const entry: SaveEntry = {
		slot,
		teamName: playerTeam?.name ?? "Unknown",
		teamColor: playerTeam?.color ?? "#000",
		week: state.week,
		season: state.season,
		savedAt: new Date().toISOString(),
		state,
	};
	localStorage.setItem(key(slot), JSON.stringify(entry));
}

export function loadGame(slot: number): GameState | null {
	const raw = localStorage.getItem(key(slot));
	if (!raw) return null;
	try {
		const entry = JSON.parse(raw) as SaveEntry;
		return entry.state;
	} catch {
		return null;
	}
}

export function getSaveMeta(slot: number): SaveMeta | null {
	const raw = localStorage.getItem(key(slot));
	if (!raw) return null;
	try {
		const entry = JSON.parse(raw) as SaveEntry;
		return {
			slot: entry.slot,
			teamName: entry.teamName,
			teamColor: entry.teamColor,
			week: entry.week,
			season: entry.season,
			savedAt: entry.savedAt,
		};
	} catch {
		return null;
	}
}

export function listSaves(): (SaveMeta | null)[] {
	return Array.from({ length: SLOT_COUNT }, (_, i) => getSaveMeta(i));
}

export function deleteSave(slot: number): void {
	localStorage.removeItem(key(slot));
}
