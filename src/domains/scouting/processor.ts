import { ageFromDob } from "#/domains/player/generator";
import type { DayProcessor } from "#/GameState";
import { paEstimate } from "./paEstimate";
import type { ScoutedPlayer, ScoutingAssignment } from "./types";

function meetsAssignmentCriteria(
	assignment: ScoutingAssignment,
	player: { position: string; dateOfBirth: string; wage: number },
	currentDate: string,
): boolean {
	if (assignment.position !== null && player.position !== assignment.position)
		return false;
	const age = ageFromDob(player.dateOfBirth, currentDate);
	if (assignment.minAge !== null && age < assignment.minAge) return false;
	if (assignment.maxAge !== null && age > assignment.maxAge) return false;
	if (assignment.maxWage !== null && player.wage > assignment.maxWage)
		return false;
	return true;
}

function upsertScoutedPlayer(
	existing: ScoutedPlayer[],
	playerId: string,
	truePa: number,
): ScoutedPlayer[] {
	const idx = existing.findIndex((s) => s.playerId === playerId);
	const sightings = idx === -1 ? 1 : existing[idx].sightings + 1;
	const estimate = paEstimate(truePa, sightings);
	const updated: ScoutedPlayer = {
		playerId,
		sightings,
		paEstimateLow: estimate.low,
		paEstimateHigh: estimate.high,
	};
	if (idx === -1) return [...existing, updated];
	return existing.map((s, i) => (i === idx ? updated : s));
}

export const processScouting: DayProcessor = (state, date, _events) => {
	if (!state.scoutingAssignments || state.scoutingAssignments.length === 0)
		return state;

	const todayFixtures = state.fixtures.filter(
		(f) => f.date === date && f.played,
	);
	if (todayFixtures.length === 0) return state;

	const teamMap = Object.fromEntries(state.teams.map((t) => [t.id, t]));

	const updatedAssignments = state.scoutingAssignments.map(
		(assignment, assignmentIndex) => {
			// Each scout picks one fixture independently via round-robin by assignment index
			const fixture = todayFixtures[assignmentIndex % todayFixtures.length];

			const homeTeam = teamMap[fixture.homeTeamId];
			const awayTeam = teamMap[fixture.awayTeamId];
			if (!homeTeam || !awayTeam) return assignment;

			const players = [...homeTeam.players, ...awayTeam.players];
			if (players.length === 0) return assignment;

			let scoutedPlayers = assignment.scoutedPlayers;
			for (const player of players) {
				if (!meetsAssignmentCriteria(assignment, player, date)) continue;
				scoutedPlayers = upsertScoutedPlayer(
					scoutedPlayers,
					player.id,
					player.pa,
				);
			}

			return { ...assignment, scoutedPlayers };
		},
	);

	return { ...state, scoutingAssignments: updatedAssignments };
};
