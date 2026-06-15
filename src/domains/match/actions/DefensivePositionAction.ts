import { activeZone } from "./AttackingPositionAction";
import { ROLE_ZONE_CONFIG, type ZoneConfig } from "./roles";
import type { Action, ActionContext } from "./types";

// How far behind the zone center to sit toward own goal when defending.
const COVER_DEPTH = 0.06;

function isOppositionInPossession(ctx: ActionContext): boolean {
	const holderId = ctx.ballHolderId ?? ctx.ballReceiverId;
	if (holderId === null) return false;
	const holder = ctx.allPlayers.find((p) => p.id === holderId);
	return holder?.isHome !== ctx.player.isHome;
}

// When defending: move toward the active zone center, shifted back toward own goal.
export const DefensivePositionAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.player.position === "GK") return false;
		if (ctx.ballHolderId === ctx.player.id) return false;
		return isOppositionInPossession(ctx);
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const { player } = ctx;
		const config = ROLE_ZONE_CONFIG[player.role] as ZoneConfig | undefined;

		if (!config) {
			return { x: player.baseX, y: player.baseY };
		}

		// The zone tracks the ball up the pitch in both phases (so the team presses
		// high when the opponent builds deep); COVER_DEPTH then shifts this player a
		// touch goal-side of the zone centre so they sit just behind the ball line.
		const zone = activeZone(player, ctx.ball, config);
		const centerX = (zone.xMin + zone.xMax) / 2;
		const centerY = (zone.yMin + zone.yMax) / 2;
		const goalSideOffset = player.isHome ? -COVER_DEPTH : COVER_DEPTH;

		return {
			x: centerX,
			y: Math.max(zone.yMin, Math.min(zone.yMax, centerY + goalSideOffset)),
		};
	},
};
