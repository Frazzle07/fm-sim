import type { Player } from "#/domains/player/types";
import type { Team } from "#/domains/team/types";
import type { Fixture, MatchEvent, MatchResult } from "./types";

function rand(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

export function teamStrength(team: Team, startingXI?: Player[]): number {
	const allPicked =
		startingXI ??
		(() => {
			const outfield = team.players
				.filter((p) => !p.injured && p.position !== "GK")
				.sort((a, b) => b.ca - a.ca)
				.slice(0, 10);
			const gk = team.players.filter(
				(p) => p.position === "GK" && !p.injured,
			)[0];
			return gk ? [gk, ...outfield] : outfield;
		})();
	if (allPicked.length === 0) return 50;
	const avg =
		allPicked.reduce((s, p) => s + p.ca * (p.form / 7), 0) / allPicked.length;
	return avg;
}

function poissonGoals(lambda: number): number {
	const L = Math.exp(-lambda);
	let k = 0,
		p = 1;
	do {
		k++;
		p *= Math.random();
	} while (p > L);
	return k - 1;
}

function pickPlayer(players: Player[], excludeGK = false): Player {
	const eligible = players.filter(
		(p) => !p.injured && (excludeGK ? p.position !== "GK" : true),
	);
	if (eligible.length === 0) return players[0];
	return eligible[Math.floor(Math.random() * eligible.length)];
}

const INJURY_TIERS = [
	{ weeks: 1, weight: 50 },
	{ weeks: 2, weight: 25 },
	{ weeks: 3, weight: 15 },
	{ weeks: 4, weight: 7 },
	{ weeks: 8, weight: 3 },
];

function rollInjuryWeeks(): number {
	const total = INJURY_TIERS.reduce((s, t) => s + t.weight, 0);
	let r = Math.random() * total;
	for (const tier of INJURY_TIERS) {
		r -= tier.weight;
		if (r <= 0) return tier.weeks;
	}
	return INJURY_TIERS[0].weeks;
}

function generateEvents(
	homeTeam: Team,
	awayTeam: Team,
	homeGoals: number,
	awayGoals: number,
	homeXI?: Player[],
	awayXI?: Player[],
): MatchEvent[] {
	const events: MatchEvent[] = [];
	const usedMinutes = new Set<number>();

	const pickMinute = () => {
		let m: number;
		do {
			m = Math.floor(rand(1, 90));
		} while (usedMinutes.has(m));
		usedMinutes.add(m);
		return m;
	};

	const homePlayers = homeXI ?? homeTeam.players;
	const awayPlayers = awayXI ?? awayTeam.players;

	for (let i = 0; i < homeGoals; i++) {
		events.push({
			minute: pickMinute(),
			type: "goal",
			teamId: homeTeam.id,
			playerName: pickPlayer(homePlayers, true).name,
		});
	}
	for (let i = 0; i < awayGoals; i++) {
		events.push({
			minute: pickMinute(),
			type: "goal",
			teamId: awayTeam.id,
			playerName: pickPlayer(awayPlayers, true).name,
		});
	}

	const yellows = Math.floor(rand(1, 4));
	for (let i = 0; i < yellows; i++) {
		const [team, players] =
			Math.random() < 0.5 ? [homeTeam, homePlayers] : [awayTeam, awayPlayers];
		events.push({
			minute: pickMinute(),
			type: "yellowCard",
			teamId: team.id,
			playerName: pickPlayer(players).name,
		});
	}

	if (Math.random() < 0.08) {
		const [team, players] =
			Math.random() < 0.5 ? [homeTeam, homePlayers] : [awayTeam, awayPlayers];
		events.push({
			minute: pickMinute(),
			type: "redCard",
			teamId: team.id,
			playerName: pickPlayer(players).name,
		});
	}

	if (Math.random() < 0.2) {
		const [team, players] =
			Math.random() < 0.5 ? [homeTeam, homePlayers] : [awayTeam, awayPlayers];
		events.push({
			minute: pickMinute(),
			type: "injury",
			teamId: team.id,
			playerName: pickPlayer(players).name,
			detail: String(rollInjuryWeeks()),
		});
	}

	return events.sort((a, b) => a.minute - b.minute);
}

export function simulateMatch(
	_fixture: Fixture,
	home: Team,
	away: Team,
	homeXI?: Player[],
	awayXI?: Player[],
): MatchResult {
	const homeStr = teamStrength(home, homeXI) + 3; // small home advantage
	const awayStr = teamStrength(away, awayXI);
	const total = homeStr + awayStr;

	const homeXG = (homeStr / total) * rand(1.8, 3.2);
	const awayXG = (awayStr / total) * rand(1.8, 3.2);

	const homeGoals = poissonGoals(homeXG);
	const awayGoals = poissonGoals(awayXG);

	return {
		homeTeamId: home.id,
		awayTeamId: away.id,
		homeGoals,
		awayGoals,
		events: generateEvents(home, away, homeGoals, awayGoals, homeXI, awayXI),
	};
}
