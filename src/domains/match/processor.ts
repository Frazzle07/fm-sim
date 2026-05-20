import { applyResult } from "#/domains/league/standings";
import type { Player } from "#/domains/player/types";
import type { Team } from "#/domains/team/types";
import type { DayProcessor } from "#/GameState";
import { simulateMatch } from "./engine";
import type { Fixture } from "./types";

function bestXI(team: Team): Player[] {
	const outfield = team.players
		.filter((p) => !p.injured && p.position !== "GK")
		.sort((a, b) => b.ca - a.ca)
		.slice(0, 10);
	const gk = team.players.find((p) => p.position === "GK" && !p.injured);
	return gk ? [gk, ...outfield] : outfield;
}

export const processMatches: DayProcessor = (state, date, events) => {
	const todayFixtures = state.fixtures.filter(
		(f) => f.date === date && !f.played,
	);
	if (todayFixtures.length === 0) return state;

	const teamMap = Object.fromEntries(state.teams.map((t) => [t.id, t]));
	let newState = state;
	const playedFixtures: Fixture[] = [];

	for (const fixture of todayFixtures) {
		const home = teamMap[fixture.homeTeamId];
		const away = teamMap[fixture.awayTeamId];

		const isPlayerFixture = fixture.id === state.pendingFixtureId;
		const homeXI =
			isPlayerFixture && fixture.homeTeamId === state.playerTeamId
				? state.pendingLineup
				: undefined;
		const awayXI =
			isPlayerFixture && fixture.awayTeamId === state.playerTeamId
				? state.pendingLineup
				: undefined;

		const resolvedHomeXI = homeXI ?? bestXI(home);
		const resolvedAwayXI = awayXI ?? bestXI(away);
		const result = simulateMatch(
			fixture,
			home,
			away,
			resolvedHomeXI,
			resolvedAwayXI,
		);
		const played: Fixture = { ...fixture, result, played: true };
		playedFixtures.push(played);
		newState = applyResult(newState, result);

		for (const event of result.events) {
			if (event.type !== "injury") continue;
			const weeks = Number(event.detail) || 1;
			newState = {
				...newState,
				teams: newState.teams.map((t) =>
					t.id !== event.teamId
						? t
						: {
								...t,
								players: t.players.map((p) =>
									p.name !== event.playerName
										? p
										: { ...p, injured: true, injuryWeeks: weeks },
								),
							},
				),
			};
		}

		const startingXIIds = new Set([
			...resolvedHomeXI.map((p) => p.id),
			...resolvedAwayXI.map((p) => p.id),
		]);
		events.push({
			type: "matchPlayed",
			payload: { fixture: played, startingXIIds: [...startingXIIds] },
		});
	}

	const updatedFixtures = newState.fixtures.map((f) => {
		const played = playedFixtures.find((p) => p.id === f.id);
		return played ?? f;
	});

	const playedWeek = playedFixtures[0].week;
	return {
		...newState,
		fixtures: updatedFixtures,
		week: playedWeek + 1,
		pendingFixtureId: undefined,
		pendingLineup: undefined,
	};
};
