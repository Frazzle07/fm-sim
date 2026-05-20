import { generateInboxMessages } from "#/domains/league/inbox";
import { generateNews } from "#/domains/league/news";
import { initStandings } from "#/domains/league/standings";
import { processMatches } from "#/domains/match/processor";
import {
	addDays,
	generateFixtures,
	seasonStartDate,
} from "#/domains/match/schedule";
import { processScouting } from "#/domains/scouting/processor";
import { generateLeague } from "#/domains/team/generator";
import type { Team } from "#/domains/team/types";
import { processTraining } from "#/domains/training/processor";
import { generateTrainingSummary } from "#/domains/training/summary";
import { processNegotiations } from "#/domains/transfer/negotiation";
import type { DayEvent, DayProcessor, GameState } from "#/GameState";

const processors: DayProcessor[] = [
	processMatches,
	processTraining,
	processScouting,
	// processTransfers,  — add here when AI transfers are implemented
];

export function createNewGame(playerTeamIndex = 0): GameState {
	const teams = generateLeague();
	const fixtures = generateFixtures(teams.map((t) => t.id));
	return {
		playerTeamId: teams[playerTeamIndex].id,
		week: 1,
		season: 1,
		currentDate: seasonStartDate(),
		teams,
		fixtures,
		standings: initStandings(teams),
		transferMarket: [],
		transferNegotiations: [],
		scoutingAssignments: [],
		news: ["Welcome to your first season! Good luck, manager."],
		inbox: [
			{
				id: "welcome",
				date: seasonStartDate(),
				category: "general",
				title: "Welcome, manager!",
				body: "Your first season begins. Check the schedule for your opening fixture and keep an eye on the transfer market to strengthen your squad.",
				read: false,
			},
		],
	};
}

export function advanceDay(state: GameState): {
	state: GameState;
	events: DayEvent[];
} {
	const nextDate = addDays(state.currentDate, 1);
	const events: DayEvent[] = [];
	let newState = { ...state, currentDate: nextDate };

	for (const processor of processors) {
		newState = processor(newState, nextDate, events);
	}

	// Process transfer negotiations (different signature — not a DayProcessor)
	const { state: negState, counterOffers } = processNegotiations(
		newState,
		nextDate,
	);
	newState = negState;

	const teamMap = Object.fromEntries(newState.teams.map((t) => [t.id, t]));
	const news = generateNews(events, teamMap);
	const newMessages = [
		...generateInboxMessages(events, teamMap, newState.playerTeamId, nextDate),
		...generateTrainingSummary(events, nextDate),
		...counterOffers.map((neg) => ({
			id: `counter-${neg.id}-${nextDate}`,
			date: nextDate,
			category: "transfer" as const,
			title: `Counter-offer: ${neg.playerName}`,
			body: `${teamMap[neg.sellingTeamId]?.name ?? "The club"} has come back with a counter-offer for ${neg.playerName}. Go to Transfers to respond.`,
			read: false,
		})),
	];
	if (news.length > 0 || newMessages.length > 0) {
		newState = {
			...newState,
			news: [...news, ...state.news].slice(0, 20),
			inbox: [...newMessages, ...state.inbox].slice(0, 50),
		};
	}

	return { state: newState, events };
}

export function markInboxRead(state: GameState, messageId: string): GameState {
	return {
		...state,
		inbox: state.inbox.map((m) =>
			m.id === messageId ? { ...m, read: true } : m,
		),
	};
}

export function markAllInboxRead(state: GameState): GameState {
	return {
		...state,
		inbox: state.inbox.map((m) => ({ ...m, read: true })),
	};
}

export function getTeam(state: GameState, id: string): Team | undefined {
	return state.teams.find((t) => t.id === id);
}

export function setPendingLineup(
	state: GameState,
	fixtureId: string,
	lineup: import("#/domains/player/types").Player[],
): GameState {
	return { ...state, pendingFixtureId: fixtureId, pendingLineup: lineup };
}

export function clearPendingLineup(state: GameState): GameState {
	const { pendingFixtureId: _f, pendingLineup: _l, ...rest } = state;
	return rest;
}

export function getNextPlayerFixture(state: GameState) {
	const nextDate = addDays(state.currentDate, 1);
	return (
		state.fixtures.find(
			(f) =>
				!f.played &&
				f.date === nextDate &&
				(f.homeTeamId === state.playerTeamId ||
					f.awayTeamId === state.playerTeamId),
		) ?? null
	);
}

// Re-export domain functions so callers have a single entry point into game logic
export { sortedStandings } from "#/domains/league/standings";
export { listPlayerForSale, processTransfer } from "#/domains/transfer/market";
export {
	acceptCounter,
	startNegotiation,
	submitOffer,
	walkAway,
} from "#/domains/transfer/negotiation";
