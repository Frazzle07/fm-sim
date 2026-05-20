import { kickoffPosition } from "./positions";
import type { MatchPhase, SimFrame, SimPlayer } from "./types";

export interface PlayerSeed {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
}

// Ticks per simulated minute (controls animation speed vs. game time).
const TICKS_PER_MINUTE = 10;
const TOTAL_MINUTES = 90;
const TOTAL_TICKS = TOTAL_MINUTES * TICKS_PER_MINUTE;

// How far a player can drift from their base position (pitch units 0..1).
const JITTER_RADIUS = 0.0008;

interface LivePlayer extends SimPlayer {
	baseX: number;
	baseY: number;
	// Phase offsets for smooth sinusoidal drift, unique per player.
	phaseX: number;
	phaseY: number;
	freqX: number;
	freqY: number;
}

export class MatchSimulator {
	private tick = 0;
	private players: LivePlayer[];
	private phase: MatchPhase = "kickoff";

	get done(): boolean {
		return this.tick >= TOTAL_TICKS;
	}

	constructor(homePlayers: PlayerSeed[], awayPlayers: PlayerSeed[]) {
		this.players = [
			...this.initSide(homePlayers, true),
			...this.initSide(awayPlayers, false),
		];
	}

	private initSide(seeds: PlayerSeed[], isHome: boolean): LivePlayer[] {
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
				// Random phase and frequency per player so drift looks organic.
				phaseX: Math.random() * Math.PI * 2,
				phaseY: Math.random() * Math.PI * 2,
				freqX: 0.04 + Math.random() * 0.03,
				freqY: 0.04 + Math.random() * 0.03,
			};
		});
	}

	advance(): SimFrame {
		this.tick++;

		if (this.phase === "kickoff") {
			for (const p of this.players) {
				// Sinusoidal drift around base position — each axis independent.
				const dx = Math.sin(this.tick * p.freqX + p.phaseX) * JITTER_RADIUS;
				const dy = Math.cos(this.tick * p.freqY + p.phaseY) * JITTER_RADIUS;

				p.x = Math.max(0, Math.min(1, p.baseX + dx));
				p.y = Math.max(0, Math.min(1, p.baseY + dy));
			}
		}

		return {
			tick: this.tick,
			minute: Math.floor(this.tick / TICKS_PER_MINUTE),
			phase: "kickoff",
			players: this.players.map(
				({
					baseX: _bx,
					baseY: _by,
					phaseX: _px,
					phaseY: _py,
					freqX: _fx,
					freqY: _fy,
					...rest
				}) => rest,
			),
		};
	}
}
