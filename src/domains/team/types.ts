import type { Player } from "#/domains/player/types";

export interface Team {
	id: string;
	name: string;
	shortName: string;
	color: string;
	players: Player[];
	budget: number;
	reputation: number; // 1-100, affects AI transfers
}
