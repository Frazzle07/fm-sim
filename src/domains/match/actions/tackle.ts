/**
 * tackle.ts — a defending player attempts to win the ball.
 *
 * This action is evaluated on DEFENDING players (not the carrier).
 * The actionSelector calls it with the nearest defender as the "carrier"
 * in a separate defending pass, passing the actual ball carrier via ctx.
 *
 * Preconditions:
 *   - defending player is within tackling range of the ball carrier
 *   - match is not in a set-piece phase
 *
 * Outcome:
 *   - 50% base success rate (future: scale by tackling vs dribbling stats)
 *   - On success: possession switches, new carrier is the tackler
 *   - On failure: carrier keeps the ball, small knockback to tackler
 *
 * The simulator's phase transition then handles whether a counter or midfield
 * phase follows a successful tackle.
 */

import type { SimPlayer } from "../simulator";
import type { Action, ActionResult } from "./types";
import { distPlayers } from "./util";

// Must be within this distance to attempt a tackle
const TACKLE_RANGE = 0.07;

// Base probability of winning the tackle (0–1)
const BASE_SUCCESS_RATE = 0.45;

/** Find the actual ball carrier from the players list. */
function findCarrier(
	players: SimPlayer[],
	homePossession: boolean,
): SimPlayer | null {
	return players.find((p) => p.isHome === homePossession && p.hasBall) ?? null;
}

export const tackleAction: Action = {
	name: "tackle",
	priority: 10, // top priority for defenders

	canExecute(ctx) {
		const { carrier: defender, players, homePossession, phase } = ctx;
		if (phase === "kickoff" || phase === "goal" || phase === "buildup")
			return false;

		// "carrier" here is the defender being evaluated by the defending selector
		const ballCarrier = findCarrier(players, homePossession);
		if (!ballCarrier) return false;

		return distPlayers(defender, ballCarrier) <= TACKLE_RANGE;
	},

	execute(ctx): ActionResult {
		const { carrier: defender, players, homePossession, rng } = ctx;
		const ballCarrier = findCarrier(players, homePossession);
		if (!ballCarrier) return { action: "tackle" };

		const success = rng() < BASE_SUCCESS_RATE;

		const dist = distPlayers(defender, ballCarrier);

		if (success) {
			const playerTargets = new Map<string, { x: number; y: number }>();
			playerTargets.set(defender.id, { x: defender.x, y: defender.y });

			return {
				action: "tackle",
				reason: `won tackle on ${ballCarrier.name} (dist=${dist.toFixed(2)})`,
				newCarrierId: defender.id,
				ballTarget: { x: defender.x, y: defender.y },
				ballReleased: true,
				nextPhase: "counter",
				playerTargets,
			};
		}

		const knockbackY = !homePossession ? 0.04 : -0.04;
		const playerTargets = new Map<string, { x: number; y: number }>();
		playerTargets.set(defender.id, {
			x: defender.x + (rng() - 0.5) * 0.05,
			y: Math.max(0.02, Math.min(0.98, defender.y + knockbackY)),
		});

		return {
			action: "tackle",
			reason: `failed tackle on ${ballCarrier.name} (dist=${dist.toFixed(2)}), knocked back`,
			playerTargets,
		};
	},
};
