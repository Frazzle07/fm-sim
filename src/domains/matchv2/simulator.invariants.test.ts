/**
 * Invariant tests for MatchSimulatorV2.
 *
 * Same contract as the v1 suite. Every phase-1 invariant must hold every tick:
 *   - No duplicate possession (two players with hasBall=true)
 *   - Ball stays in bounds [0,1]×[0,1]
 *   - Ball never in limbo (>60 ticks with no owner and no in-flight pass)
 *   - Ball never stuck in flight (>120 ticks without arriving)
 *   - Ball always glued to carrier (the Phase 1 acceptance criterion)
 */

import { describe, expect, it } from "vitest";
import { MatchSimulatorV2 } from "./simulator";
import type { MatchResult } from "./types";

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

interface Violation {
	tick: number;
	minute: number;
	second: number;
	message: string;
}

const MAX_LIMBO_TICKS = 60;
const MAX_FLIGHT_TICKS = 120;
/** Max distance between ball and carrier centre before we flag separation (pitch-fractions). */
const MAX_BALL_CARRIER_SEPARATION = 0.015;

function runAndCollectViolations(result: MatchResult, seed = 42): Violation[] {
	const homePlayers = makePlayers("home");
	const awayPlayers = makePlayers("away");
	const sim = new MatchSimulatorV2(result, homePlayers, awayPlayers, seed);

	const violations: Violation[] = [];
	let limboTicks = 0;
	let flightTicks = 0;
	let tick = 0;

	while (!sim.done) {
		const frame = sim.advance();
		tick++;

		// Duplicate possession
		const holders = frame.players.filter((p) => p.hasBall);
		if (holders.length > 1) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `${holders.length} players have hasBall=true: ${holders.map((p) => p.name).join(", ")}`,
			});
		}

		// Ball in bounds
		if (frame.ball.x < 0 || frame.ball.x > 1 || frame.ball.y < 0 || frame.ball.y > 1) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Ball out of bounds: (${frame.ball.x.toFixed(3)}, ${frame.ball.y.toFixed(3)})`,
			});
		}

		const hasPossession = holders.length > 0;

		// Limbo
		if (!hasPossession) limboTicks++;
		else limboTicks = 0;
		if (limboTicks === MAX_LIMBO_TICKS) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Ball in limbo for ${MAX_LIMBO_TICKS} consecutive ticks`,
			});
		}

		// Flight duration
		const ballMoving =
			Math.abs(frame.ball.x - frame.ball.targetX) > 0.001 ||
			Math.abs(frame.ball.y - frame.ball.targetY) > 0.001;
		if (!hasPossession && ballMoving) flightTicks++;
		else flightTicks = 0;
		if (flightTicks === MAX_FLIGHT_TICKS) {
			violations.push({
				tick,
				minute: frame.minute,
				second: Math.floor(frame.second),
				message: `Pass/cross in flight for ${MAX_FLIGHT_TICKS} ticks without arriving`,
			});
		}

		// Phase 1 acceptance criterion: ball glued to carrier
		if (hasPossession && holders.length === 1) {
			const carrier = holders[0];
			const dist = Math.hypot(frame.ball.x - carrier.x, frame.ball.y - carrier.y);
			if (dist > MAX_BALL_CARRIER_SEPARATION) {
				violations.push({
					tick,
					minute: frame.minute,
					second: Math.floor(frame.second),
					message: `Ball separated from carrier ${carrier.name} by ${dist.toFixed(4)} (limit ${MAX_BALL_CARRIER_SEPARATION})`,
				});
			}
		}
	}

	return violations;
}

describe("MatchSimulatorV2 invariants", () => {
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
		const violations = runAndCollectViolations(
			makeResult({ homeGoals: 0, awayGoals: 0, events: [] }),
			99,
		);
		expect(violations).toEqual([]);
	});

	it("no violations across multiple seeds", () => {
		const seeds = [1, 13, 42, 77, 123, 256, 999];
		const allViolations: { seed: number; violations: Violation[] }[] = [];
		for (const seed of seeds) {
			const v = runAndCollectViolations(makeResult(), seed);
			if (v.length > 0) allViolations.push({ seed, violations: v });
		}
		expect(allViolations).toEqual([]);
	});
});
