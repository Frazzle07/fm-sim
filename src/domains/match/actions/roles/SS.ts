import type { ZoneConfig } from "./types";

// SS (second striker) holds the left-of-centre channel and sits a touch deeper
// than CF. Its x-zone is kept distinct from the CF so the front two occupy
// different horizontal channels rather than stacking centrally.
export const SS: ZoneConfig = {
	xMin: 0.22,
	xMax: 0.55,
	yMinDeep: 0.41,
	yMinHigh: 0.55,
	yMaxDeep: 0.6,
	yMaxHigh: 0.95,
	idealBallOffset: 0.12,
	driveTendency: 0.7,
	carryTendency: 1.0,
};
