import type { MatchResult } from "#/domains/match/types";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import type { Standing } from "./types";

export function initStandings(teams: Team[]): Standing[] {
	return teams.map((t) => ({
		teamId: t.id,
		played: 0,
		won: 0,
		drawn: 0,
		lost: 0,
		goalsFor: 0,
		goalsAgainst: 0,
		points: 0,
	}));
}

export function applyResult(state: GameState, result: MatchResult): GameState {
	const standings = state.standings.map((s) => {
		if (s.teamId !== result.homeTeamId && s.teamId !== result.awayTeamId)
			return s;
		const isHome = s.teamId === result.homeTeamId;
		const gf = isHome ? result.homeGoals : result.awayGoals;
		const ga = isHome ? result.awayGoals : result.homeGoals;
		const won = gf > ga,
			drawn = gf === ga,
			lost = gf < ga;
		return {
			...s,
			played: s.played + 1,
			won: s.won + (won ? 1 : 0),
			drawn: s.drawn + (drawn ? 1 : 0),
			lost: s.lost + (lost ? 1 : 0),
			goalsFor: s.goalsFor + gf,
			goalsAgainst: s.goalsAgainst + ga,
			points: s.points + (won ? 3 : drawn ? 1 : 0),
		};
	});
	return { ...state, standings };
}

export function sortedStandings(standings: Standing[]): Standing[] {
	return [...standings].sort(
		(a, b) =>
			b.points - a.points ||
			b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
			b.goalsFor - a.goalsFor,
	);
}
