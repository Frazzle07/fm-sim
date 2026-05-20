import type { XY } from "./types";

export interface MovingPlayer {
	id: string;
	position: "GK" | "DEF" | "MID" | "FWD";
	isHome: boolean;
	baseX: number;
	baseY: number;
	x: number;
	y: number;
}

// A movement action takes a player and returns their desired target position.
export type MovementAction = (player: MovingPlayer) => XY;

// Players hold their assigned base position.
export const holdPosition: MovementAction = (p) => ({ x: p.baseX, y: p.baseY });
