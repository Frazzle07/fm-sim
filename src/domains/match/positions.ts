import type { XY } from "./types";

type Position = "GK" | "DEF" | "MID" | "FWD";

// Kickoff positions for the home team (y=0..1, home attacks toward y=1).
// x spreads players across pitch width (0=top, 1=bottom).
const HOME_KICKOFF: Record<Position, XY[]> = {
	GK: [{ x: 0.5, y: 0.05 }],
	DEF: [
		{ x: 0.2, y: 0.2 },
		{ x: 0.4, y: 0.2 },
		{ x: 0.6, y: 0.2 },
		{ x: 0.8, y: 0.2 },
	],
	MID: [
		{ x: 0.2, y: 0.33 },
		{ x: 0.4, y: 0.33 },
		{ x: 0.6, y: 0.33 },
		{ x: 0.8, y: 0.33 },
	],
	// FWD[0] (CF) takes the kick at the centre spot; FWD[1] (SS) spreads left.
	FWD: [
		{ x: 0.55, y: 0.49 },
		{ x: 0.35, y: 0.42 },
	],
};

// Away kickoff positions — not a pure mirror so the away striker
// waits outside the centre circle rather than on the centre spot.
const AWAY_KICKOFF: Record<Position, XY[]> = {
	GK: [{ x: 0.5, y: 0.95 }],
	DEF: [
		{ x: 0.2, y: 0.8 },
		{ x: 0.4, y: 0.8 },
		{ x: 0.6, y: 0.8 },
		{ x: 0.8, y: 0.8 },
	],
	MID: [
		{ x: 0.2, y: 0.67 },
		{ x: 0.4, y: 0.67 },
		{ x: 0.6, y: 0.67 },
		{ x: 0.8, y: 0.67 },
	],
	// FWD[0] (CF) waits outside centre circle; FWD[1] (SS) spreads left.
	FWD: [
		{ x: 0.45, y: 0.51 },
		{ x: 0.65, y: 0.58 },
	],
};

export function kickoffPosition(
	position: Position,
	slotIndex: number,
	isHome: boolean,
): XY {
	const slots = isHome ? HOME_KICKOFF[position] : AWAY_KICKOFF[position];
	return slots[slotIndex % slots.length];
}
