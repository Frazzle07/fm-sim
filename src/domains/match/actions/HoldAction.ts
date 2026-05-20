import type { XY } from "../types";
import type { Action, ActionContext } from "./types";

export const HoldAction: Action = {
	canExecute(_ctx: ActionContext): boolean {
		return true;
	},

	execute(ctx: ActionContext): XY {
		return { x: ctx.player.baseX, y: ctx.player.baseY };
	},
};
