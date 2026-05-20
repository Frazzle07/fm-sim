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

// Radius (in pitch units 0..1) within which a presser triggers a forced pass.
export const PRESSURE_RADIUS = 0.08;

// Returns the target for a presser: the ball carrier's current position.
export function pressTarget(carrier: XY): XY {
	return { x: carrier.x, y: carrier.y };
}

// Returns true if any player in `pressers` is within PRESSURE_RADIUS of `carrier`.
export function isUnderPressure(carrier: XY, pressers: XY[]): boolean {
	return pressers.some(
		(p) => Math.hypot(p.x - carrier.x, p.y - carrier.y) < PRESSURE_RADIUS,
	);
}
