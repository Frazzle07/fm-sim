import type { ActionContext, BallAction, BallCommand } from "./types";

const TACKLE_RANGE = 0.06;
// After losing the ball, a player can't immediately retackle
const DISPOSSESSED_COOLDOWN_TICKS = 60;

// Keyed on the player who was dispossessed, not the tackler
const dispossessedUntil = new Map<string, number>();

export const TackleAction: BallAction = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId === null) return false;
		const holder = ctx.allPlayers.find((p) => p.id === ctx.ballHolderId);
		if (!holder) return false;
		if (holder.isHome === ctx.player.isHome) return false;

		// Block the dispossessed player from instantly retackling
		const cooldownUntil = dispossessedUntil.get(ctx.player.id) ?? 0;
		if (ctx.tick < cooldownUntil) return false;

		const dist = Math.hypot(ctx.player.x - holder.x, ctx.player.y - holder.y);
		return dist <= TACKLE_RANGE;
	},

	execute(ctx: ActionContext): BallCommand {
		const targetId = ctx.ballHolderId ?? "";
		// Goes on the target (who will be dispossessed), not the tackler
		if (targetId) dispossessedUntil.set(targetId, ctx.tick + DISPOSSESSED_COOLDOWN_TICKS);
		return {
			type: "tackle",
			tacklerId: ctx.player.id,
			targetId,
		};
	},
};
