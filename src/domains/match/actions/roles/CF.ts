import type { ZoneConfig } from "./types";

// CF holds the right-of-centre channel and pushes highest — stretching the
// defensive line. Its x-zone is kept distinct from the SS so the front two
// occupy different horizontal channels rather than stacking centrally.
export const CF: ZoneConfig = {
	xMin: 0.45,
	xMax: 0.78,
	yMinDeep: 0.42,
	yMinHigh: 0.55,
	yMaxDeep: 0.58,
	yMaxHigh: 1.0,
	idealBallOffset: 0.2,
	driveTendency: 0.7,
	carryTendency: 1.0,
};
