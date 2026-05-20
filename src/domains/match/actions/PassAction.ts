import { nearest } from "../queries";
import { PRESSURE_RADIUS } from "./PressAction";
import type { ActionContext, BallAction, BallCommand, MatchPlayer } from "./types";

const PROXIMITY_WEIGHT = 2;
const OPENNESS_WEIGHT = 3;
const POSITION_BONUS: Record<MatchPlayer["position"], number> = {
	FWD: 2,
	MID: 1,
	DEF: 0,
	GK: -2,
};

// Short pass (~0.15 dist) ≈ 600ms, long pass (~0.5 dist) ≈ 1400ms.
function flightDurationMs(dx: number, dy: number): number {
	const dist = Math.hypot(dx, dy);
	return Math.round(300 + dist * 2200);
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

		const scored = teammates.map((t) => {
			const distToT = Math.hypot(t.x - ctx.player.x, t.y - ctx.player.y);
			const nearestOpp = nearest(t, opponents);
			const openness = Math.hypot(nearestOpp.x - t.x, nearestOpp.y - t.y);
			const proximity = PROXIMITY_WEIGHT / (distToT + 0.01);
			const opennessScore = OPENNESS_WEIGHT * openness;
			const positionBonus = POSITION_BONUS[t.position];
			const score = proximity + opennessScore + positionBonus;
			return { t, score, distToT, openness, proximity, positionBonus };
		});

		const ranked = scored.sort((a, b) => b.score - a.score);
		const best = ranked[0];

		const reasons: string[] = [];
		if (best.proximity >= ranked[1]?.proximity) reasons.push("closest option");
		if (best.openness >= ranked[1]?.openness) reasons.push("most space around them");
		if (best.positionBonus > 0) reasons.push(`advanced position (${best.t.position})`);

		console.debug(
			`[Pass] ${ctx.player.name} passes to ${best.t.name} — ${reasons.join(", ") || "best overall score"}. ` +
			`Others considered: ${ranked.slice(1).map((s) => `${s.t.name} (${s.t.position})`).join(", ")}.`,
		);

		const dx = best.t.x - ctx.player.x;
		const dy = best.t.y - ctx.player.y;

		return {
			type: "pass",
			toX: best.t.x,
			toY: best.t.y,
			receiverId: best.t.id,
			durationMs: flightDurationMs(dx, dy),
			easing: flightEasing(dx, dy),
		};
	},
};
