import type { ZoneConfig } from "./types";

// CDM screens in front of the back four — minimal forward push.
export const CDM: ZoneConfig = {
	xMin: 0.25,
	xMax: 0.75,
	yMinDeep: 0.15,
	yMinHigh: 0.25,
	yMaxDeep: 0.42,
	yMaxHigh: 0.55,
};
