import type { ZoneConfig } from "./types";

// Right-central midfielder: occupies the right half of the central corridor.
// Push forward when attacking, drop to midfield line when defending.
export const RCM: ZoneConfig = {
	xMin: 0.5,
	xMax: 0.75,
	yMinDeep: 0.2,
	yMinHigh: 0.48,
	yMaxDeep: 0.55,
	yMaxHigh: 0.85,
	idealBallOffset: 0.05,
	driveTendency: 0.4,
	carryTendency: 0.9,
};
