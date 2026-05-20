/**
 * cross.ts — a wide player delivers a ball into the box.
 *
 * Preconditions:
 *   - carrier is in the crossing zone (wide + final third)
 *   - there is at least one forward in the box to aim at
 *
 * Outcome:
 *   - Ball is played to the best-positioned forward in the box.
 *   - Forwards make runs toward the ball's landing zone.
 *   - Phase transitions to "chance" if a forward receives it cleanly.
 *
 * The target is picked by finding the forward furthest into the box
 * with the most separation from defenders (a "free header" model).
 */

import type { SimPlayer } from "../simulator";
import type { Action, ActionResult } from "./types";
import { distPlayers, isInCrossingZone, opponentGoalY } from "./util";

// Ball travel speed for a cross — slightly slower than a shot, looping arc feel
const CROSS_SPEED = 0.018;

function findCrossTarget(
	players: SimPlayer[],
	homePossession: boolean,
	rng: () => number,
): SimPlayer | null {
	const forwards = players.filter(
		(p) =>
			p.isHome === homePossession && ["ST", "LW", "RW", "CAM"].includes(p.role),
	);
	const opponents = players.filter((p) => p.isHome !== homePossession);

	if (forwards.length === 0) return null;

	const boxY = homePossession ? 0.85 : 0.15;
	const inBox = forwards.filter((f) => {
		const attackY = homePossession ? f.y : 1 - f.y;
		return attackY > 0.72;
	});
	const pool = inBox.length > 0 ? inBox : forwards;

	const scored = pool.map((f) => {
		const nearestOpp = Math.min(...opponents.map((o) => distPlayers(f, o)), 1);
		const depthBonus = homePossession ? f.y - boxY : boxY - f.y;
		const noise = (rng() - 0.5) * 0.15;
		return { player: f, score: nearestOpp * 1.5 + depthBonus + noise };
	});

	scored.sort((a, b) => b.score - a.score);
	return scored[0]?.player ?? null;
}

export const crossAction: Action = {
	name: "cross",
	priority: 15, // after shoot, before dribble/pass

	canExecute(ctx) {
		const { carrier, homePossession, players } = ctx;
		if (!isInCrossingZone(carrier.x, carrier.y, homePossession)) return false;

		// Need a forward to aim at
		const forwards = players.filter(
			(p) =>
				p.isHome === homePossession &&
				["ST", "LW", "RW", "CAM"].includes(p.role),
		);
		return forwards.length > 0;
	},

	execute(ctx): ActionResult {
		const { homePossession, players, rng } = ctx;
		const target = findCrossTarget(players, homePossession, rng);

		const goalY = opponentGoalY(homePossession);
		// Aim for the 6-yard box area
		const landX = 0.5 + (rng() - 0.5) * 0.2;
		const landY = homePossession ? goalY - 0.08 : goalY + 0.08;

		const playerTargets = new Map<string, { x: number; y: number }>();

		// Forwards make runs into the box
		const forwards = players.filter(
			(p) =>
				p.isHome === homePossession &&
				["ST", "LW", "RW", "CAM"].includes(p.role),
		);
		forwards.forEach((f, i) => {
			const runX = 0.35 + i * 0.15 + (rng() - 0.5) * 0.08;
			playerTargets.set(f.id, { x: Math.min(0.9, runX), y: landY });
		});

		return {
			action: "cross",
			reason: target
				? `wide + final third, crossing to ${target.name} (${target.role})`
				: "wide + final third, blind cross (no forward in box)",
			newCarrierId: target?.id,
			ballTarget: { x: landX, y: landY },
			ballSpeed: CROSS_SPEED,
			ballReleased: true,
			nextPhase: target ? "chance" : "attack",
			playerTargets,
		};
	},
};
