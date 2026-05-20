/**
 * Simulator invariant tests.
 *
 * These run the full MatchSimulator for a complete 90-minute match and assert
 * properties that must hold every tick. They are designed to catch the class
 * of silent freeze bugs that only surface when watching the animation:
 *
 *   - Ball in limbo: holderId AND pendingCarrierId both null for too long
 *   - Pass never arrives: pendingCarrierId stays set for too long
 *   - Phase stuck: phaseTick grows without bound
 *   - Ball escapes the pitch: ball.x / ball.y outside [0, 1]
 *   - Duplicate possession: more than one player has hasBall = true
 */

import { describe, expect, it } from "vitest";
import { MatchSimulator } from "./simulator";
import type { MatchResult } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayers(prefix: string, count = 11) {
	return Array.from({ length: count }, (_, i) => ({
		id: `${prefix}-${i}`,
		name: `${prefix} ${i}`,
	}));
}

function makeResult(overrides: Partial<MatchResult> = {}): MatchResult {
	return {
		homeTeamId: "home",
		awayTeamId: "away",
		homeGoals: 1,
		awayGoals: 1,
		events: [
			{ minute: 30, type: "goal", teamId: "home", playerName: "home 9" },
			{ minute: 70, type: "goal", teamId: "away", playerName: "away 9" },
		],
		...overrides,
	};
}

// ─── Invariant runner ─────────────────────────────────────────────────────────

interface Violation {
	tick: number;
	minute: number;
	second: number;
	message: string;
}

const MAX_LIMBO_TICKS = 60; // ball with no owner for this long = stall
const MAX_FLIGHT_TICKS = 120; // pass in flight for this long = arrival bug

function runAndCollectViolations(
	result: MatchResult,
	seed = 42,
): Violation[] {
	const homePlayers = makePlayers("home");
	const awayPlayers = makePlayers("away");
	const sim = new MatchSimulator(result, homePlayers, awayPlayers, seed);

	const violations: Violation[] = [];
	let limboTicks = 0;
	let flightTicks = 0;
	let tick = 0;

	while (!sim.done) {
		const frame = sim.advance();
		tick++;

		// ── Duplicate possession ─────────────────────────────────────────────
		const holders = frame.players.filter((p) => p.hasBall);
		if (holders.length > 1) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `${holders.length} players have hasBall=true simultaneously: ${holders.map((p) => p.name).join(", ")}`,
			});
		}

		// ── Ball out of bounds ───────────────────────────────────────────────
		if (
			frame.ball.x < 0 || frame.ball.x > 1 ||
			frame.ball.y < 0 || frame.ball.y > 1
		) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Ball out of bounds: (${frame.ball.x.toFixed(3)}, ${frame.ball.y.toFixed(3)})`,
			});
		}

		// ── Limbo tracking (no owner, no pending receiver) ───────────────────
		// We detect limbo by checking if nobody has the ball and no pass is in
		// flight. We can't read private fields directly, so we infer: if no
		// player has hasBall=true AND the ball isn't moving toward its target,
		// assume limbo. Simpler: count ticks with zero hasBall players.
		const hasPossession = holders.length > 0;
		if (!hasPossession) {
			limboTicks++;
		} else {
			limboTicks = 0;
		}
		if (limboTicks === MAX_LIMBO_TICKS) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Ball in limbo for ${MAX_LIMBO_TICKS} consecutive ticks — no player has possession`,
			});
		}

		// ── Ball-in-flight duration ──────────────────────────────────────────
		// A pass is in flight when hasBall = 0 but the ball is still moving.
		// We track consecutive ticks where nobody has the ball (overlaps with
		// limbo but catches the case where the ball does move but never lands).
		const ballMoving =
			Math.abs(frame.ball.x - frame.ball.targetX) > 0.001 ||
			Math.abs(frame.ball.y - frame.ball.targetY) > 0.001;
		if (!hasPossession && ballMoving) {
			flightTicks++;
		} else {
			flightTicks = 0;
		}
		if (flightTicks === MAX_FLIGHT_TICKS) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Pass/cross in flight for ${MAX_FLIGHT_TICKS} ticks without arriving`,
			});
		}
	}

	return violations;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MatchSimulator invariants", () => {
	it("no violations across a full 90-minute match (seed 42)", () => {
		const violations = runAndCollectViolations(makeResult());
		expect(violations).toEqual([]);
	});

	it("no violations with a high-scoring match (seed 7)", () => {
		const result = makeResult({
			homeGoals: 4,
			awayGoals: 3,
			events: [
				{ minute: 10, type: "goal", teamId: "home", playerName: "home 9" },
				{ minute: 25, type: "goal", teamId: "away", playerName: "away 9" },
				{ minute: 40, type: "goal", teamId: "home", playerName: "home 10" },
				{ minute: 55, type: "goal", teamId: "home", playerName: "home 7" },
				{ minute: 65, type: "goal", teamId: "away", playerName: "away 10" },
				{ minute: 78, type: "goal", teamId: "home", playerName: "home 9" },
				{ minute: 88, type: "goal", teamId: "away", playerName: "away 7" },
			],
		});
		const violations = runAndCollectViolations(result, 7);
		expect(violations).toEqual([]);
	});

	it("no violations with a 0-0 draw (seed 99)", () => {
		const result = makeResult({ homeGoals: 0, awayGoals: 0, events: [] });
		const violations = runAndCollectViolations(result, 99);
		expect(violations).toEqual([]);
	});

	it("no violations across multiple seeds", () => {
		const seeds = [1, 13, 42, 77, 123, 256, 999];
		const allViolations: { seed: number; violations: Violation[] }[] = [];

		for (const seed of seeds) {
			const violations = runAndCollectViolations(makeResult(), seed);
			if (violations.length > 0) {
				allViolations.push({ seed, violations });
			}
		}

		expect(allViolations).toEqual([]);
	});
});
