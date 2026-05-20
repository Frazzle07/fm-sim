import type { XY } from "./types";

export interface Located {
	x: number;
	y: number;
}

// Returns the element from `candidates` closest to `origin`.
// Assumes candidates list is non-empty.
export function nearest<T extends Located>(origin: XY, candidates: T[]): T {
	let best = candidates[0];
	let bestDist = Infinity;
	for (const c of candidates) {
		const d = Math.hypot(c.x - origin.x, c.y - origin.y);
		if (d < bestDist) {
			bestDist = d;
			best = c;
		}
	}
	return best;
}
