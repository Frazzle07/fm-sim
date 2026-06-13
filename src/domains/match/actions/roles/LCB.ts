import type { ZoneConfig } from "./types";

// Left-central defender: holds the left half of the central defensive corridor.
// Limited forward push even when attacking; slight overhang for wide cover.
export const LCB: ZoneConfig = {
	xMin: 0.2,
	xMax: 0.5,
	yMinDeep: 0.05,
	yMinHigh: 0.4,
	yMaxDeep: 0.3,
	yMaxHigh: 0.52,
	idealBallOffset: -0.25,
	driveTendency: 0.1,
	carryTendency: 0.4,
};
