import type { ZoneConfig } from "./types";

// Full backs stay narrower and deeper than wingers. yMinHigh is capped lower so
// they only push into attacking positions when the ball is deep in the opp half.
export const RB: ZoneConfig = {
	xMin: 0.7,
	xMax: 0.95,
	yMinDeep: 0.15,
	yMinHigh: 0.3,
	yMaxDeep: 0.45,
	yMaxHigh: 0.72,
};
