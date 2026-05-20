/**
 * actionSelector.ts — evaluates the priority-ordered action list each tick.
 *
 * There are two separate pipelines:
 *
 *   ATTACKING (carrier team)
 *     shoot → cross → dribble → pass
 *
 *   DEFENDING (non-possession team)
 *     tackle → press (move toward ball)
 *
 * The selector finds the best candidate player on each side, builds an
 * ActionContext, then walks the action list returning the first action
 * whose canExecute() returns true.
 *
 * The result is an ActionResult (or null if nothing fires).
 * simulator.ts applies the result each tick.
 */

import type { Phase, SimPlayer } from "../simulator";
import { crossAction } from "./cross";
import { dribbleAction } from "./dribble";
import { passAction } from "./pass";
import { shootAction } from "./shoot";
import { tackleAction } from "./tackle";
import type { Action, ActionContext, ActionResult, PhaseConfig } from "./types";
import { distPlayers } from "./util";

// ─── Action lists ─────────────────────────────────────────────────────────────

/** Actions available to the player with the ball, in priority order. */
const ATTACKING_ACTIONS: Action[] = [
	shootAction,   // priority 10 — shoot if in zone
	crossAction,   // priority 15 — cross if wide + final third
	passAction,    // priority 25 — pass if a good option exists or under pressure
	dribbleAction, // priority 28 — dribble if space ahead or no pass available
];

/** Buildup pipeline: pass to a defender/midfielder, carry if space exists. */
const BUILDUP_ACTIONS: Action[] = [
	passAction,    // pass to eligible receiver (gkReceiverRoles / receiverRoles applied via PhaseConfig)
	dribbleAction, // carry forward if no pass option scores well (GK guard prevents GK carrying)
];

export const BUILDUP_PHASE_CONFIG: PhaseConfig = {
	gkReceiverRoles: ["CB", "LB", "RB"],
	receiverRoles:   ["CB", "LB", "RB", "CDM", "CM"],
	exitRoles:       ["CDM", "CM"],
};

/** Actions available to defenders, in priority order. */
const DEFENDING_ACTIONS: Action[] = [
	tackleAction, // priority 10 — tackle if in range
	// press (move toward ball) is handled directly in getDefenderTarget below
];

// ─── Dribble-only selection (runs every tick while actionDelay > 0) ───────────

export function selectDribbleAction(
	carrier: SimPlayer,
	players: SimPlayer[],
	homePossession: boolean,
	rng: () => number,
): ActionResult | null {
	const ctx: ActionContext = { carrier, players, phase: "midfield", homePossession, rng };
	if (!dribbleAction.canExecute(ctx)) return null;
	return dribbleAction.execute(ctx);
}

// ─── Buildup selection ────────────────────────────────────────────────────────

/**
 * Run the buildup action pipeline (pass → dribble) with phase-specific rules.
 * Returns the first action that fires, or null if none match.
 */
export function selectBuildupAction(
	carrier: SimPlayer,
	players: SimPlayer[],
	homePossession: boolean,
	rng: () => number,
): ActionResult | null {
	const ctx: ActionContext = {
		carrier,
		players,
		phase: "buildup",
		homePossession,
		rng,
		phaseConfig: BUILDUP_PHASE_CONFIG,
	};
	for (const action of BUILDUP_ACTIONS) {
		if (action.canExecute(ctx)) {
			return action.execute(ctx);
		}
	}
	return null;
}

// ─── Attacking selection ─────────────────────────────────────────────────────

/**
 * Run the attacking action pipeline for the current ball carrier.
 * Returns the first action that fires, or null if none match.
 */
export function selectAttackingAction(
	carrier: SimPlayer,
	players: SimPlayer[],
	phase: Phase,
	homePossession: boolean,
	rng: () => number,
): ActionResult | null {
	const ctx: ActionContext = { carrier, players, phase, homePossession, rng };
	for (const action of ATTACKING_ACTIONS) {
		if (action.canExecute(ctx)) {
			return action.execute(ctx);
		}
	}
	return null;
}

// ─── Defending selection ──────────────────────────────────────────────────────

/**
 * Run the defending action pipeline for a single defending player.
 * The "carrier" in ctx is the defender; the actual ball carrier is read
 * from ctx.players via hasBall.
 */
export function selectDefendingAction(
	defender: SimPlayer,
	players: SimPlayer[],
	phase: Phase,
	homePossession: boolean,
	rng: () => number,
): ActionResult | null {
	const ctx: ActionContext = {
		carrier: defender,
		players,
		phase,
		homePossession,
		rng,
	};
	for (const action of DEFENDING_ACTIONS) {
		if (action.canExecute(ctx)) {
			return action.execute(ctx);
		}
	}
	return null;
}

// ─── Defender positioning (press / track) ────────────────────────────────────

// How close a defender must be to a receiver to shadow them instead of tracking ball
const SHADOW_RANGE = 0.3;

/**
 * Returns the movement target for a defending player when no tackle fires.
 *
 * - Primary presser: charges directly at the ball carrier.
 * - Nearby defenders: shadow the closest attacker (cut off passing lanes).
 * - Deep defenders: compact toward the ball, maintaining defensive shape.
 */
export function getDefenderTarget(
	defender: SimPlayer,
	ballCarrier: SimPlayer | null,
	ballX: number,
	ballY: number,
	isClosestDefender: boolean,
	tick: number,
	_rng: () => number,
	allPlayers: SimPlayer[],
	homePossession: boolean,
): { x: number; y: number; debugAction: string } {
	const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));

	if (!ballCarrier) {
		const pull = 0.07;
		return {
			x: clamp(defender.baseX + (ballX - defender.baseX) * pull),
			y: clamp(defender.baseY + (ballY - defender.baseY) * pull),
			debugAction: "shape",
		};
	}

	if (isClosestDefender) {
		// Primary presser — sprint at the carrier
		const pressPull = 0.18;
		return {
			x: clamp(defender.x + (ballCarrier.x - defender.x) * pressPull),
			y: clamp(defender.y + (ballCarrier.y - defender.y) * pressPull),
			debugAction: "press",
		};
	}

	// Find the nearest attacking teammate to shadow (cut off the passing lane)
	const attackers = allPlayers.filter(
		(p) => p.isHome === homePossession && p.role !== "GK" && !p.hasBall,
	);
	let shadowTarget: SimPlayer | null = null;
	let shadowDist = SHADOW_RANGE;
	for (const att of attackers) {
		const d = distPlayers(defender, att);
		if (d < shadowDist) {
			shadowDist = d;
			shadowTarget = att;
		}
	}

	if (shadowTarget) {
		// Step toward the attacker to mark them — midpoint between defender and attacker
		const markPull = 0.12;
		return {
			x: clamp(defender.x + (shadowTarget.x - defender.x) * markPull),
			y: clamp(defender.y + (shadowTarget.y - defender.y) * markPull),
			debugAction: "cover",
		};
	}

	// No nearby attacker — compact toward the ball in defensive shape
	const shapePull = 0.06;
	const jitterX = Math.sin(tick * 0.05 + defender.id.charCodeAt(0)) * 0.01;
	const jitterY = Math.cos(tick * 0.04 + defender.id.charCodeAt(1)) * 0.01;
	return {
		x: clamp(defender.baseX + (ballX - defender.baseX) * shapePull + jitterX),
		y: clamp(defender.baseY + (ballY - defender.baseY) * shapePull + jitterY),
		debugAction: "shape",
	};
}

// ─── Find closest defender to ball ───────────────────────────────────────────

export function findClosestDefender(
	players: SimPlayer[],
	homePossession: boolean,
	ballX: number,
	ballY: number,
): SimPlayer | null {
	const defenders = players.filter(
		(p) => p.isHome !== homePossession && p.role !== "GK",
	);
	if (defenders.length === 0) return null;

	const fakeBall = {
		id: "_ball",
		name: "",
		role: "CM" as const,
		isHome: false,
		x: ballX,
		y: ballY,
		targetX: ballX,
		targetY: ballY,
		baseX: ballX,
		baseY: ballY,
		hasBall: false,
	};
	defenders.sort((a, b) => distPlayers(a, fakeBall) - distPlayers(b, fakeBall));
	return defenders[0] ?? null;
}
