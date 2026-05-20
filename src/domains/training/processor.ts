import { ageFromDob, calcValue, statsFromCA } from "#/domains/player/generator";
import type { Personality, Player } from "#/domains/player/types";
import type { DayEvent, DayProcessor } from "#/GameState";

const PERSONALITY_MODIFIER: Record<Personality, number> = {
	"Model Professional": 1.5,
	Determined: 1.25,
	Average: 1.0,
	Lazy: 0.75,
	Temperamental: 0.5,
};

function ageMultiplier(age: number): number {
	if (age <= 18) return 0.7;
	if (age <= 21) return 1.0;
	if (age <= 23) return 0.5;
	if (age <= 26) return 0.2;
	return 0;
}

function declineRate(naturalFitness: number): number {
	if (naturalFitness <= 5) return 0.15;
	if (naturalFitness <= 10) return 0.1;
	if (naturalFitness <= 15) return 0.07;
	return 0.04;
}

function applyCAChange(
	player: Player,
	delta: number,
	currentDate: string,
): Player {
	const newCA = Math.min(player.pa, Math.max(1, player.ca + delta));
	if (newCA === player.ca) return player;
	const age = ageFromDob(player.dateOfBirth, currentDate);
	return {
		...player,
		ca: newCA,
		stats: statsFromCA(newCA, player.position),
		value: calcValue(newCA, age),
	};
}

function appendCAHistory(player: Player, date: string): Player {
	const history = player.caHistory ?? [];
	const last = history[history.length - 1];
	if (last?.date === date) return player;
	return { ...player, caHistory: [...history, { date, ca: player.ca }] };
}

function collectStartingXIIds(events: DayEvent[]): Set<string> {
	const ids = new Set<string>();
	for (const event of events) {
		if (event.type !== "matchPlayed") continue;
		const payload = event.payload as { startingXIIds?: string[] };
		for (const id of payload.startingXIIds ?? []) ids.add(id);
	}
	return ids;
}

function isSaturday(isoDate: string): boolean {
	return new Date(isoDate).getUTCDay() === 6;
}

export const processTraining: DayProcessor = (state, date, events) => {
	const matchDay = events.some((e) => e.type === "matchPlayed");
	const playedIds = collectStartingXIIds(events);
	const saturday = isSaturday(date);

	// Track CA deltas for the player's team on Saturdays
	const playerTeamDeltas: Record<string, number> = {};

	const updatedTeams = state.teams.map((team) => ({
		...team,
		players: team.players.map((player) => {
			const age = ageFromDob(player.dateOfBirth, date);
			const pm = PERSONALITY_MODIFIER[player.personality];
			const caBefore = player.ca;

			let updated: Player;

			if (player.injured) {
				updated = applyCAChange(player, -(player.injuryWeeks * 0.05), date);
			} else if (age >= 31) {
				updated = applyCAChange(
					player,
					-declineRate(player.naturalFitness),
					date,
				);
			} else {
				const am = ageMultiplier(age);
				if (am === 0) {
					updated = player;
				} else if (matchDay) {
					if (playedIds.has(player.id)) {
						// Jitter ±50% of base so match impact varies each week
						const jitter = 0.5 + Math.random();
						updated = applyCAChange(player, 0.15 * am * pm * jitter, date);
					} else {
						updated = player;
					}
				} else {
					// Jitter ±50% of base so training quality varies each session
					const jitter = 0.5 + Math.random();
					updated = applyCAChange(player, 0.05 * am * pm * jitter, date);
				}
			}

			if (saturday) {
				updated = appendCAHistory(updated, date);
				if (team.id === state.playerTeamId) {
					playerTeamDeltas[player.id] = updated.ca - caBefore;
				}
			}

			return updated;
		}),
	}));

	const newState = { ...state, teams: updatedTeams };

	if (saturday) {
		const playerTeam = updatedTeams.find((t) => t.id === state.playerTeamId);
		if (playerTeam) {
			events.push({
				type: "trainingWeekComplete",
				payload: {
					week: state.week,
					players: playerTeam.players,
					deltas: playerTeamDeltas,
				},
			});
		}
	}

	return newState;
};
