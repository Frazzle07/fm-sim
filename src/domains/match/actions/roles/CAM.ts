import type { ZoneConfig } from "./types";

// CAM operates between the lines — behind the CF, ahead of the CMs.
export const CAM: ZoneConfig = {
	xMin: 0.25,
	xMax: 0.75,
	yMinDeep: 0.28,
	yMinHigh: 0.45,
	yMaxDeep: 0.6,
	yMaxHigh: 0.82,
};
