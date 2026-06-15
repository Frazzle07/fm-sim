import type { ZoneConfig } from "./types";

// Wingers hold the highest wide line. Defending, they sit ahead of the
// fullback (deep band 0.25–0.55) as a counter outlet rather than collapsing
// into the backline; attacking, they push into the final third (0.55–0.90).
export const RW: ZoneConfig = {
	xMin: 0.7,
	xMax: 1.0,
	yMinDeep: 0.25,
	yMinHigh: 0.55,
	yMaxDeep: 0.55,
	yMaxHigh: 0.9,
	idealBallOffset: 0.08,
	driveTendency: 0.9,
	carryTendency: 1.0,
};
