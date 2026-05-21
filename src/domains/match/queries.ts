import type { XY } from "./types";

export interface Located {
	x: number;
	y: number;
}

// Returns the minimum distance from point `p` to the line segment `a`→`b`.
export function distToSegment(p: Located, a: Located, b: Located): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
	const t = Math.max(
		0,
		Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
	);
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function dist(a: Located, b: Located): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
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
