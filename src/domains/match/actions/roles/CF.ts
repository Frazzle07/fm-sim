import type { ZoneConfig } from "./types";

// CF stays central and pushes highest — stretching the defensive line.
export const CF: ZoneConfig = {
	xMin: 0.25,
	xMax: 0.75,
	yMinDeep: 0.3,
	yMinHigh: 0.55,
	yMaxDeep: 0.65,
	yMaxHigh: 0.92,
};
