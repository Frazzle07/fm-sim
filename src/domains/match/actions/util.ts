/** Shared spatial helpers used across action modules. */

import type { SimPlayer } from "../simulator";

export function dist(ax: number, ay: number, bx: number, by: number): number {
	return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function distPlayers(a: SimPlayer, b: SimPlayer): number {
	return dist(a.x, a.y, b.x, b.y);
}

/**
 * How far toward the opponent's goal the receiver is compared to the passer.
 * Returns a value roughly in [-1, 1]. Positive = forward pass.
 */
export function forwardProgress(
	from: SimPlayer,
	to: SimPlayer,
	isHome: boolean,
): number {
	const delta = to.y - from.y;
	return isHome ? delta : -delta;
}

/**
 * How much open space a player has — distance to their nearest opponent, capped at 1.
 */
export function openSpaceScore(
	player: SimPlayer,
	opponents: SimPlayer[],
): number {
	if (opponents.length === 0) return 1;
	const nearest = Math.min(...opponents.map((o) => distPlayers(player, o)));
	return Math.min(1, nearest);
}

/**
 * Returns the y-coordinate of the opponent's goal for the given team.
 * Home attacks toward y=1; away attacks toward y=0.
 */
export function opponentGoalY(isHome: boolean): number {
	return isHome ? 1.0 : 0.0;
}

/**
 * Returns the y-coordinate of the own goal for the given team.
 */
export function ownGoalY(isHome: boolean): number {
	return isHome ? 0.0 : 1.0;
}

/**
 * Distance from a position to the opponent's goal centre.
 * Goal centre is at x=0.5, y=opponentGoalY.
 */
export function distToGoal(x: number, y: number, isHome: boolean): number {
	return dist(x, y, 0.5, opponentGoalY(isHome));
}

/**
 * True if the position is in the shooting zone:
 *   - within ~25% of the opponent's goal line (final third, deep)
 *   - within the central lane (x 0.2–0.8)
 */
export function isInShootingZone(
	x: number,
	y: number,
	isHome: boolean,
): boolean {
	const attackY = isHome ? y : 1 - y;
	return attackY > 0.72 && x > 0.18 && x < 0.82;
}

/**
 * True if the position is in a wide crossing zone:
 *   - in the final third (attack)
 *   - close to the touchlines (x < 0.22 or x > 0.78)
 */
export function isInCrossingZone(
	x: number,
	y: number,
	isHome: boolean,
): boolean {
	const attackY = isHome ? y : 1 - y;
	return attackY > 0.65 && (x < 0.22 || x > 0.78);
}
