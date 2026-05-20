import { nearest } from "../queries";
import { PRESSURE_RADIUS } from "./PressAction";
import type { ActionContext, BallAction, BallCommand } from "./types";

function flightDuration(dx: number, dy: number): number {
	const dist = Math.hypot(dx, dy);
	return Math.max(10, Math.round(dist * 400));
}

function flightEasing(dx: number, dy: number): number {
	const dist = Math.hypot(dx, dy);
	return 2 + dist * 6;
}

export const PassAction: BallAction = {
	canExecute(ctx: ActionContext): boolean {
		if (ctx.phase !== "open_play") return false;
		if (ctx.ballHolderId !== ctx.player.id) return false;
		const pressers = ctx.allPlayers.filter(
			(p) => p.isHome !== ctx.player.isHome && p.position === "FWD",
		);
		return pressers.some(
			(p) =>
				Math.hypot(p.x - ctx.player.x, p.y - ctx.player.y) < PRESSURE_RADIUS,
		);
	},

	execute(ctx: ActionContext): BallCommand {
		const teammates = ctx.allPlayers.filter(
			(p) => p.isHome === ctx.player.isHome && p.id !== ctx.player.id,
		);
		const opponents = ctx.allPlayers.filter(
			(p) => p.isHome !== ctx.player.isHome,
		);

		// Pick the least-marked teammate: the one whose nearest opponent is furthest away.
		const target = teammates.reduce((best, t) => {
			const nearestOpp = nearest(t, opponents);
			const d = Math.hypot(nearestOpp.x - t.x, nearestOpp.y - t.y);
			const nearestOppBest = nearest(best, opponents);
			const dBest = Math.hypot(
				nearestOppBest.x - best.x,
				nearestOppBest.y - best.y,
			);
			return d > dBest ? t : best;
		});

		const dx = target.x - ctx.player.x;
		const dy = target.y - ctx.player.y;

		return {
			type: "pass",
			toX: target.x,
			toY: target.y,
			receiverId: target.id,
			durationTicks: flightDuration(dx, dy),
			easing: flightEasing(dx, dy),
		};
	},
};
