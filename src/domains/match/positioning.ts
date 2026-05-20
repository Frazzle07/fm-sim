/**
 * positioning.ts — off-ball movement targets for all match phases.
 *
 * Called by the simulator alongside the action pipeline, not inside actions.
 * Returns target maps that the simulator merges into player targets each tick.
 */

import type { Role, SimPlayer } from "./simulator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number): number {
	return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ─── Spread targets ───────────────────────────────────────────────────────────

/**
 * When a player has the ball during buildup, teammates spread to create outlets.
 * Defenders spread horizontally; the GK drops to the goal line.
 */
export function spreadTargets(
	holder: SimPlayer,
	teammates: SimPlayer[],
	isHome: boolean,
): Map<string, { x: number; y: number; debugAction: string }> {
	const targets = new Map<string, { x: number; y: number; debugAction: string }>();

	const gk = teammates.find((p) => p.role === "GK");
	if (gk) {
		targets.set(gk.id, { x: 0.5, y: isHome ? 0.06 : 0.94, debugAction: "support" });
	}

	const cbs = teammates.filter((p) => p.role === "CB");
	const cbBaseY = isHome ? 0.15 : 0.85;
	cbs.forEach((cb, i) => {
		if (cb.id === holder.id) return;
		const xPositions = cbs.length === 2 ? [0.33, 0.67] : [0.5];
		targets.set(cb.id, { x: xPositions[i] ?? 0.5, y: cbBaseY, debugAction: "support" });
	});

	const lb = teammates.find((p) => p.role === "LB");
	const rb = teammates.find((p) => p.role === "RB");
	const fbY = isHome ? 0.20 : 0.80;
	if (lb && lb.id !== holder.id) targets.set(lb.id, { x: 0.06, y: fbY, debugAction: "support" });
	if (rb && rb.id !== holder.id) targets.set(rb.id, { x: 0.94, y: fbY, debugAction: "support" });

	const cdm = teammates.find((p) => p.role === "CDM");
	if (cdm) {
		targets.set(cdm.id, { x: 0.5, y: isHome ? 0.55 : 0.45, debugAction: "support" });
	}

	const cms = teammates.filter((p) => p.role === "CM");
	cms.forEach((cm, i) => {
		const xPositions = [0.35, 0.65];
		targets.set(cm.id, { x: xPositions[i] ?? 0.5, y: isHome ? 0.60 : 0.40, debugAction: "support" });
	});

	const forwards = teammates.filter((p) => ["ST", "LW", "RW", "CAM"].includes(p.role));
	forwards.forEach((f, i) => {
		const xs = [0.25, 0.5, 0.75, 0.5];
		targets.set(f.id, { x: xs[i] ?? 0.5, y: isHome ? 0.75 : 0.25, debugAction: "support" });
	});

	return targets;
}

// ─── Midfield shape targets ───────────────────────────────────────────────────

/**
 * Off-ball positions for the possessing team during the midfield phase.
 *
 * Keeps a compact 4-line shape (GK → defense → midfield → forwards) so
 * players don't all drift toward the opposition goal.
 */
export function midfieldTargets(
	holder: SimPlayer,
	teammates: SimPlayer[],
	isHome: boolean,
): Map<string, { x: number; y: number; debugAction: string }> {
	const targets = new Map<string, { x: number; y: number; debugAction: string }>();

	const gk = teammates.find((p) => p.role === "GK");
	if (gk) {
		targets.set(gk.id, { x: 0.5, y: isHome ? 0.06 : 0.94, debugAction: "support" });
	}

	const cbs = teammates.filter((p) => p.role === "CB");
	const cbY = isHome ? 0.22 : 0.78;
	cbs.forEach((cb, i) => {
		if (cb.id === holder.id) return;
		const xs = cbs.length === 2 ? [0.35, 0.65] : [0.5];
		targets.set(cb.id, { x: xs[i] ?? 0.5, y: cbY, debugAction: "support" });
	});

	const lb = teammates.find((p) => p.role === "LB");
	const rb = teammates.find((p) => p.role === "RB");
	const fbY = isHome ? 0.30 : 0.70;
	if (lb && lb.id !== holder.id) targets.set(lb.id, { x: 0.07, y: fbY, debugAction: "support" });
	if (rb && rb.id !== holder.id) targets.set(rb.id, { x: 0.93, y: fbY, debugAction: "support" });

	const cdm = teammates.find((p) => p.role === "CDM");
	if (cdm && cdm.id !== holder.id) {
		targets.set(cdm.id, { x: 0.5, y: isHome ? 0.42 : 0.58, debugAction: "support" });
	}

	const cms = teammates.filter((p) => p.role === "CM");
	cms.forEach((cm, i) => {
		if (cm.id === holder.id) return;
		const xs = [0.33, 0.67];
		targets.set(cm.id, { x: xs[i] ?? 0.5, y: isHome ? 0.50 : 0.50, debugAction: "support" });
	});

	const lm = teammates.find((p) => p.role === "LM");
	const rm = teammates.find((p) => p.role === "RM");
	const wmY = isHome ? 0.52 : 0.48;
	if (lm && lm.id !== holder.id) targets.set(lm.id, { x: 0.08, y: wmY, debugAction: "support" });
	if (rm && rm.id !== holder.id) targets.set(rm.id, { x: 0.92, y: wmY, debugAction: "support" });

	const cam = teammates.find((p) => p.role === "CAM");
	if (cam && cam.id !== holder.id) {
		targets.set(cam.id, { x: 0.5, y: isHome ? 0.62 : 0.38, debugAction: "support" });
	}

	const sts = teammates.filter((p) => p.role === "ST");
	sts.forEach((st, i) => {
		if (st.id === holder.id) return;
		const xs = sts.length === 2 ? [0.35, 0.65] : [0.5];
		targets.set(st.id, { x: xs[i] ?? 0.5, y: isHome ? 0.72 : 0.28, debugAction: "support" });
	});

	const lw = teammates.find((p) => p.role === "LW");
	const rw = teammates.find((p) => p.role === "RW");
	const wingY = isHome ? 0.70 : 0.30;
	if (lw && lw.id !== holder.id) targets.set(lw.id, { x: 0.07, y: wingY, debugAction: "support" });
	if (rw && rw.id !== holder.id) targets.set(rw.id, { x: 0.93, y: wingY, debugAction: "support" });

	return targets;
}

// ─── Press targets ────────────────────────────────────────────────────────────

const PRESS_ROLES: Role[] = ["ST", "LW", "RW", "CAM"];


/**
 * Returns targets for the pressing team's forwards during the opponent's buildup.
 *
 * The closest forward presses the ball carrier. Each remaining forward covers
 * the nearest unguarded CB/fullback to block passing lanes. Assignments are
 * greedy by proximity so two forwards never double up on the same defender.
 */
export function pressTargets(
	holder: SimPlayer,
	pressers: SimPlayer[],
	defenders: SimPlayer[],
	isPresserHome: boolean,
): Map<string, { x: number; y: number; debugAction: string }> {
	const targets = new Map<string, { x: number; y: number; debugAction: string }>();

	const forwards = pressers.filter((p) => PRESS_ROLES.includes(p.role));
	if (forwards.length === 0) return targets;

	// Closest forward presses the ball carrier.
	const sorted = [...forwards].sort(
		(a, b) => dist(a.x, a.y, holder.x, holder.y) - dist(b.x, b.y, holder.x, holder.y),
	);

	const clampY = (y: number) =>
		isPresserHome ? Math.max(y, 0.18) : Math.min(y, 0.82);

	const [lead, ...rest] = sorted;

	if (lead) {
		targets.set(lead.id, {
			x: holder.x,
			y: clampY(holder.y),
			debugAction: "press",
		});
	}

	// Remaining forwards cover the nearest unguarded CB/fullback (greedy assignment).
	const coverTargets = defenders.filter((p) =>
		["CB", "LB", "RB"].includes(p.role) && p.id !== holder.id,
	);
	const assigned = new Set<string>();

	for (const presser of rest) {
		const nearest = [...coverTargets]
			.filter((d) => !assigned.has(d.id))
			.sort((a, b) => dist(presser.x, presser.y, a.x, a.y) - dist(presser.x, presser.y, b.x, b.y))[0];

		if (nearest) {
			assigned.add(nearest.id);
			targets.set(presser.id, {
				x: nearest.x,
				y: clampY(nearest.y),
				debugAction: "cover",
			});
		} else {
			// No unguarded defender left — support the press on the holder.
			targets.set(presser.id, {
				x: holder.x,
				y: clampY(holder.y + (isPresserHome ? 0.08 : -0.08)),
				debugAction: "press",
			});
		}
	}

	return targets;
}
