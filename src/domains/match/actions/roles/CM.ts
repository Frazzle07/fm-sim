import type { ZoneConfig } from "./types";

// CMs occupy the central corridor across the middle third.
// Push forward when attacking, drop to midfield line when defending.
export const CM: ZoneConfig = {
	xMin: 0.25,
	xMax: 0.75,
	yMinDeep: 0.2,
	yMinHigh: 0.38,
	yMaxDeep: 0.55,
	yMaxHigh: 0.75,
};
