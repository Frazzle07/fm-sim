import type { XY } from "../types";
import type { Action, ActionContext } from "./types";

export const PRESSURE_RADIUS = 0.08;

export const PressAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId === null) return false;
		const carrier = ctx.allPlayers.find((p) => p.id === ctx.ballHolderId);
		if (!carrier) return false;
		// Only opposition FWDs press.
		return (
			ctx.player.isHome !== carrier.isHome && ctx.player.position === "FWD"
		);
	},

	execute(ctx: ActionContext): XY {
		const carrier = ctx.allPlayers.find((p) => p.id === ctx.ballHolderId)!;
		return { x: carrier.x, y: carrier.y };
	},
};
