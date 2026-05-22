import type { XY } from "../types";
import type { Action, ActionContext } from "./types";

// When the ball is deep in the opposition half, where each role targets.
// Home values (y=0..1, home attacks toward y=1); away is mirrored.
const HIGH_LINE_Y: Record<string, number> = {
	GK:  0.25, // keeper creeps to edge of own box
	DEF: 0.58, // back line pushed past halfway
	MID: 0.75, // midfield well into the opposition half
	FWD: 0.82, // forwards stay high
};

export const HoldAction: Action = {
	canExecute(_ctx: ActionContext): boolean {
		return true;
	},

	execute(ctx: ActionContext): XY {
		const { player, ball } = ctx;
		const attackingDir = player.isHome ? 1 : -1;

		// 0 when ball is at halfway, 1 when ball is at the opposition goal line.
		const ballDepth = Math.max(0, Math.min(1, (ball.y - 0.5) * attackingDir * 2));

		// High-line target for this role (mirror for away team).
		const highLineHome = HIGH_LINE_Y[player.position] ?? player.baseY;
		const highLineY = player.isHome ? highLineHome : 1 - highLineHome;

		// Interpolate between baseY (ball in own half) and highLineY (ball deep in opp half).
		const targetY = player.baseY + ballDepth * (highLineY - player.baseY);

		return { x: player.baseX, y: targetY };
	},
};
