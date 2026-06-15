import type { ZoneConfig } from "./types";

// Right-central defender: holds the right half of the central defensive corridor.
// Limited forward push even when attacking; slight overhang for wide cover.
export const RCB: ZoneConfig = {
	xMin: 0.5,
	xMax: 0.8,
	yMinDeep: 0.05,
	yMinHigh: 0.4,
	yMaxDeep: 0.3,
	yMaxHigh: 0.52,
	idealBallOffset: -0.25,
	driveTendency: 0.1,
	// Pass-first out of defence: a low carry tendency makes any half-decent pass
	// outscore a carry in the arbiter, so the CB only dribbles into obvious open
	// space ahead rather than carrying the ball up the pitch.
	carryTendency: 0.2,
};
