import type { ZoneConfig } from "./types";

// CBs hold a tight zone — limited forward push even when attacking.
// xMin/xMax covers the central corridor with slight overhang for wide cover.
export const CB: ZoneConfig = {
	xMin: 0.2,
	xMax: 0.8,
	yMinDeep: 0.05,
	yMinHigh: 0.17,
	yMaxDeep: 0.3,
	yMaxHigh: 0.42,
};
