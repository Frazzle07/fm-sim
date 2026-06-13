import type { ZoneConfig } from "./types";

// Left-central midfielder: occupies the left half of the central corridor.
// Push forward when attacking, drop to midfield line when defending.
export const LCM: ZoneConfig = {
	xMin: 0.25,
	xMax: 0.5,
	yMinDeep: 0.2,
	yMinHigh: 0.48,
	yMaxDeep: 0.55,
	yMaxHigh: 0.85,
	idealBallOffset: 0.05,
	driveTendency: 0.4,
	carryTendency: 0.9,
};
