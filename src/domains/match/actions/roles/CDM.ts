import type { ZoneConfig } from "./types";

// CDM screens in front of the back four — minimal forward push.
export const CDM: ZoneConfig = {
	xMin: 0.18,
	xMax: 0.81,
	yMinDeep: 0.11,
	yMinHigh: 0.35,
	yMaxDeep: 0.38,
	yMaxHigh: 0.60,
	idealBallOffset: -0.1,
};
