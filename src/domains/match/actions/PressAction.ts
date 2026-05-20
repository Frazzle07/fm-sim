import type { XY } from "../types";
import type { Action, ActionContext } from "./types";

export const PRESSURE_RADIUS = 0.08;

export const PressAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		const targetId = ctx.ballHolderId ?? ctx.ballReceiverId;
		if (targetId === null) return false;
		const target = ctx.allPlayers.find((p) => p.id === targetId);
		if (!target) return false;
		// Only opposition FWDs press.
		return (
			ctx.player.isHome !== target.isHome && ctx.player.position === "FWD"
		);
	},

	execute(ctx: ActionContext): XY {
		const targetId = ctx.ballHolderId ?? ctx.ballReceiverId;
		const target = ctx.allPlayers.find((p) => p.id === targetId);
		if (!target) return { x: ctx.player.baseX, y: ctx.player.baseY };
		return { x: target.x, y: target.y };
	},
};
