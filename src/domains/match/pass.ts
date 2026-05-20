import { nearest } from "./queries";
import type { XY } from "./types";

export interface Locatable {
	id: string;
	x: number;
	y: number;
}

// Returns the least-marked teammate: the one whose nearest opponent is furthest away.
export function leastMarked<T extends Locatable>(
	teammates: T[],
	opponents: Locatable[],
): T {
	return teammates.reduce((best, t) => {
		const nearestOpp = nearest(t, opponents);
		const distToOpp = Math.hypot(nearestOpp.x - t.x, nearestOpp.y - t.y);
		const nearestOppBest = nearest(best, opponents);
		const bestDistToOpp = Math.hypot(
			nearestOppBest.x - best.x,
			nearestOppBest.y - best.y,
		);
		return distToOpp > bestDistToOpp ? t : best;
	});
}

// Computes the number of ticks a ball flight should take given the distance.
export function flightDuration(from: XY, to: XY): number {
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	return Math.max(10, Math.round(dist * 400));
}

// Easing exponent for ball flight: faster over longer distances.
export function flightEasing(from: XY, to: XY): number {
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	return 2 + dist * 6;
}
