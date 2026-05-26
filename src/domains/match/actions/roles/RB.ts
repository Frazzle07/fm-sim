import type { ZoneConfig } from "./types";

// Full backs stay narrower and deeper than wingers. yMaxHigh is capped at 0.55
// so they hold the midfield line and don't push into the attacking third.
export const RB: ZoneConfig = {
	xMin: 0.7,
	xMax: 1.0,
	yMinDeep: 0.05,
	yMinHigh: 0.22,
	yMaxDeep: 0.35,
	yMaxHigh: 0.65,
};
