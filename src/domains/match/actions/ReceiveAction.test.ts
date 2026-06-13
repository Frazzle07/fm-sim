import { describe, expect, it } from "vitest";
import { ReceiveAction } from "./ReceiveAction";
import type { ActionContext, BallFlightInfo, MatchPlayer } from "./types";

function player(over: Partial<MatchPlayer>): MatchPlayer {
	return {
		id: "p",
		name: "P",
		position: "MID",
		role: "LCM",
		isHome: true,
		baseX: 0.5,
		baseY: 0.5,
		x: 0.5,
		y: 0.5,
		targetX: 0.5,
		targetY: 0.5,
		...over,
	};
}

function ctx(
	receiver: MatchPlayer,
	flight: BallFlightInfo | null,
	others: MatchPlayer[] = [],
): ActionContext {
	return {
		player: receiver,
		allPlayers: [receiver, ...others],
		ball: { x: 0, y: 0 },
		ballVelocity: { x: 0, y: 0 },
		ballHolderId: null,
		ballReceiverId: flight?.receiverId ?? null,
		ballFlight: flight,
		phase: "open_play",
		tick: 100,
		playerState: {},
	};
}

describe("ReceiveAction", () => {
	it("runs the named receiver onto the Pass Target", () => {
		const receiver = player({ id: "r", x: 0.4, y: 0.5 });
		const flight: BallFlightInfo = {
			fromX: 0.2,
			fromY: 0.5,
			toX: 0.6,
			toY: 0.5,
			receiverId: "r",
		};
		expect(ReceiveAction.canExecute(ctx(receiver, flight))).toBe(true);
		const target = ReceiveAction.execute(ctx(receiver, flight));
		expect(target).toEqual({ x: 0.6, y: 0.5 });
	});

	it("does not execute for a player who is not the named receiver", () => {
		const bystander = player({ id: "other" });
		const flight: BallFlightInfo = {
			fromX: 0.2,
			fromY: 0.5,
			toX: 0.6,
			toY: 0.5,
			receiverId: "r",
		};
		expect(ReceiveAction.canExecute(ctx(bystander, flight))).toBe(false);
	});

	// Regression: a defender sitting right on the Pass Target must NOT pull the
	// receiver short of it. The old "come short" branch moved the receiver ~35%
	// back up the flight line here, while the ball still flew the full distance —
	// stranding the receiver behind the ball. The receiver must always run to the
	// actual landing point so receiver and ball meet.
	it("runs to the Pass Target even when a defender is on the landing point", () => {
		const receiver = player({ id: "r", isHome: true, x: 0.4, y: 0.5 });
		const defenderOnTarget = player({
			id: "d",
			isHome: false,
			x: 0.6,
			y: 0.5,
		});
		const flight: BallFlightInfo = {
			fromX: 0.2,
			fromY: 0.5,
			toX: 0.6,
			toY: 0.5,
			receiverId: "r",
		};
		const target = ReceiveAction.execute(
			ctx(receiver, flight, [defenderOnTarget]),
		);
		expect(target).toEqual({ x: 0.6, y: 0.5 });
	});
});
