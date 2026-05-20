import type { MovementAction, MovingPlayer } from "./movement";
import { holdPosition } from "./movement";
import { kickoffPosition } from "./positions";
import { nearest } from "./queries";
import type { MatchPhase, SimFrame, XY } from "./types";

export interface PlayerSeed {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
}

const TICKS_PER_MINUTE = 10;
const TOTAL_MINUTES = 90;
const TOTAL_TICKS = TOTAL_MINUTES * TICKS_PER_MINUTE;

// Max distance a player moves toward their target per tick (pitch units 0..1).
const MOVE_SPEED = 0.02;
// Amplitude of sinusoidal micro-drift applied on top of the moved position.
const JITTER_RADIUS = 0.0008;

interface LivePlayer extends MovingPlayer {
	name: string;
	targetX: number;
	targetY: number;
	// Per-player phase/frequency for independent sinusoidal micro-drift.
	phaseX: number;
	phaseY: number;
	freqX: number;
	freqY: number;
}

// Maps each match phase to the movement action that governs player targets.
const PHASE_MOVEMENT: Record<MatchPhase, MovementAction> = {
	kickoff: holdPosition,
	open_play: holdPosition,
	free_kick: holdPosition,
	goal_kick: holdPosition,
	corner: holdPosition,
	goal: holdPosition,
	halftime: holdPosition,
};

interface BallFlight {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	receiverId: string;
	startTick: number;
	durationTicks: number;
	easing: number;
}

export class MatchSimulator {
	private tick = 0;
	private players: LivePlayer[];
	private phase: MatchPhase = "kickoff";
	private ball: XY = { x: 0.5, y: 0.5 };
	private ballHolderId: string | null = null;
	private ballFlight: BallFlight | null = null;

	get done(): boolean {
		return this.tick >= TOTAL_TICKS;
	}

	constructor(homePlayers: PlayerSeed[], awayPlayers: PlayerSeed[]) {
		this.players = [
			...this.initialiseSide(homePlayers, true),
			...this.initialiseSide(awayPlayers, false),
		];
		// Home FWD[0] (the kicker) starts with the ball at the centre spot.
		const kicker = this.players.find((p) => p.isHome && p.position === "FWD");
		if (kicker) this.ballHolderId = kicker.id;
	}

	private initialiseSide(seeds: PlayerSeed[], isHome: boolean): LivePlayer[] {
		const counters: Record<string, number> = {};
		return seeds.map((seed) => {
			const pos = seed.position;
			const slotIndex = counters[pos] ?? 0;
			counters[pos] = slotIndex + 1;

			const { x, y } = kickoffPosition(pos, slotIndex, isHome);
			return {
				...seed,
				isHome,
				x,
				y,
				baseX: x,
				baseY: y,
				targetX: x,
				targetY: y,
				phaseX: Math.random() * Math.PI * 2,
				phaseY: Math.random() * Math.PI * 2,
				freqX: 0.04 + Math.random() * 0.03,
				freqY: 0.04 + Math.random() * 0.03,
			};
		});
	}

	advance(): SimFrame {
		this.tick++;

		// On the very first tick the kicker passes to their nearest teammate.
		if (this.tick === 60 && this.ballHolderId !== null) {
			const holder = this.players.find((p) => p.id === this.ballHolderId);
			if (holder) {
				const teammates = this.players.filter(
					(p) => p.isHome === holder.isHome && p.id !== holder.id,
				);
				const target = nearest(holder, teammates);
				const dist = Math.hypot(target.x - holder.x, target.y - holder.y);
				this.ballFlight = {
					fromX: holder.x,
					fromY: holder.y,
					toX: target.x,
					toY: target.y,
					receiverId: target.id,
					startTick: this.tick,
					durationTicks: Math.max(10, Math.round(dist * 400)),
					easing: 2 + dist * 6,
				};
				this.ballHolderId = null;
			}
		}

		// Advance ball in flight.
		if (this.ballFlight !== null) {
			const {
				fromX,
				fromY,
				toX,
				toY,
				receiverId,
				startTick,
				durationTicks,
				easing,
			} = this.ballFlight;
			const elapsed = this.tick - startTick;
			const t = Math.min(elapsed / durationTicks, 1);
			const eased = 1 - (1 - t) ** easing;
			this.ball = {
				x: fromX + (toX - fromX) * eased,
				y: fromY + (toY - fromY) * eased,
			};
			if (t >= 1) {
				this.ballHolderId = receiverId;
				this.ballFlight = null;
			}
		}

		const movementAction = PHASE_MOVEMENT[this.phase];

		for (const p of this.players) {
			// 1. Phase action sets the desired target.
			const target = movementAction(p);
			p.targetX = target.x;
			p.targetY = target.y;

			// 2. Move toward target at MOVE_SPEED per tick.
			const dx = p.targetX - p.x;
			const dy = p.targetY - p.y;
			const dist = Math.hypot(dx, dy);
			if (dist > MOVE_SPEED) {
				p.x += (dx / dist) * MOVE_SPEED;
				p.y += (dy / dist) * MOVE_SPEED;
			} else {
				p.x = p.targetX;
				p.y = p.targetY;
			}

			// 3. Micro-jitter: sinusoidal drift on top of the moved position.
			p.x = Math.max(
				0,
				Math.min(
					1,
					p.x + Math.sin(this.tick * p.freqX + p.phaseX) * JITTER_RADIUS,
				),
			);
			p.y = Math.max(
				0,
				Math.min(
					1,
					p.y + Math.cos(this.tick * p.freqY + p.phaseY) * JITTER_RADIUS,
				),
			);
		}

		return {
			tick: this.tick,
			minute: Math.floor(this.tick / TICKS_PER_MINUTE),
			phase: this.phase,
			ball: { ...this.ball },
			players: this.players.map(
				({
					baseX: _bx,
					baseY: _by,
					targetX: _tx,
					targetY: _ty,
					phaseX: _px,
					phaseY: _py,
					freqX: _fx,
					freqY: _fy,
					...rest
				}) => ({ ...rest, hasBall: rest.id === this.ballHolderId }),
			),
		};
	}
}
