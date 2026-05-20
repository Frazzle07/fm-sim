import { addDays } from "#/domains/match/schedule";
import type { Position } from "#/domains/player/types";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import type { NegotiationRound, TransferNegotiation } from "./types";

// ---------------------------------------------------------------------------
// Cover probability
// ---------------------------------------------------------------------------

/**
 * Returns a 0–1 probability that the selling team is willing to sell based on
 * how much cover they have at the departing player's position.
 * Higher = more willing (better cover).
 */
function coverWillingnessProbability(
	team: Team,
	playerId: string,
	position: Position,
): number {
	const others = team.players.filter(
		(p) => p.id !== playerId && p.position === position,
	);
	if (others.length === 0) return 0.1; // desperate — very reluctant

	const departingPlayer = team.players.find((p) => p.id === playerId);
	if (!departingPlayer) return 0.5;

	const bestCoverCa = Math.max(...others.map((p) => p.ca));
	const caGap = departingPlayer.ca - bestCoverCa;
	const depthScore = Math.min(others.length / 3, 1); // 0–1, capped at 3 others

	// caGap: 0 = perfect cover, 50+ = poor cover
	const qualityScore = Math.max(0, 1 - caGap / 60);

	// Blend depth (40%) and quality (60%)
	return depthScore * 0.4 + qualityScore * 0.6;
}

// ---------------------------------------------------------------------------
// Asking price
// ---------------------------------------------------------------------------

/**
 * Computes the club's initial asking price for a player.
 * Reluctant clubs (low cover) add a premium.
 */
export function initialAskingPrice(
	team: Team,
	playerId: string,
	position: Position,
): number {
	const player = team.players.find((p) => p.id === playerId);
	if (!player) return 0;
	const willingness = coverWillingnessProbability(team, playerId, position);
	// Low willingness → higher premium (up to +60%)
	const premium = 1 + (1 - willingness) * 0.6;
	return Math.round(player.value * premium);
}

// ---------------------------------------------------------------------------
// Patience drain
// ---------------------------------------------------------------------------

export function patienceDrain(
	offerAmount: number,
	askingPrice: number,
): number {
	const ratio = offerAmount / askingPrice;
	if (ratio < 0.5) return 2;
	if (ratio < 0.7) return 1;
	return 0;
}

// ---------------------------------------------------------------------------
// Club response generation
// ---------------------------------------------------------------------------

const acceptMessages = [
	"After careful consideration, we've agreed to your offer.",
	"The board has accepted your bid. The player will be joining you.",
	"We're happy to do business at this price.",
];

const counterMessages = [
	(name: string, price: number) =>
		`We value ${name} highly. Our asking price is ${fmt(price)}.`,
	(name: string, price: number) =>
		`${name} is important to our squad. We won't sell for less than ${fmt(price)}.`,
	(_name: string, price: number) =>
		`The board has reviewed the offer and we expect ${fmt(price)} for the player.`,
	(name: string, price: number) =>
		`We appreciate the interest in ${name}, but ${fmt(price)} is our valuation.`,
];

const reluctantMessages = [
	(name: string, price: number) =>
		`${name} is a key player and very difficult to replace. We'd need ${fmt(price)} at minimum.`,
	(name: string, price: number) =>
		`We have no intention of selling ${name} unless the offer is exceptional — ${fmt(price)}.`,
];

const collapseMessages = [
	"We've grown tired of these negotiations. The player is no longer available.",
	"Our patience has run out. We will not sell the player to your club this season.",
	"This negotiation is over. Please do not contact us again regarding this matter.",
];

const lowOfferMessages = [
	(name: string, price: number) =>
		`That offer is frankly insulting. ${name} is worth far more — we need at least ${fmt(price)}.`,
	(_name: string, price: number) =>
		`We expected a more serious offer. Come back with at least ${fmt(price)}.`,
];

function fmt(amount: number): string {
	if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}m`;
	if (amount >= 1_000) return `£${(amount / 1_000).toFixed(0)}k`;
	return `£${amount}`;
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export function generateClubResponse(
	negotiation: TransferNegotiation,
	offerAmount: number,
	playerName: string,
	willingness: number,
): {
	message: string;
	counter: number | null;
	accepted: boolean;
	collapsed: boolean;
} {
	const ratio = offerAmount / negotiation.currentAskingPrice;
	const drain = patienceDrain(offerAmount, negotiation.currentAskingPrice);
	const newPatience = negotiation.patience - drain;

	if (newPatience <= 0 && drain > 0) {
		return {
			message: pick(collapseMessages),
			counter: null,
			accepted: false,
			collapsed: true,
		};
	}

	// Accept if offer meets or exceeds asking price, modified by willingness
	const acceptThreshold = 0.92 + (1 - willingness) * 0.08; // 0.92–1.0
	if (ratio >= acceptThreshold) {
		return {
			message: pick(acceptMessages),
			counter: null,
			accepted: true,
			collapsed: false,
		};
	}

	// Generate counter
	// Asking price softens slightly each round if offer is reasonable (ratio ≥ 0.7)
	let newAskingPrice = negotiation.currentAskingPrice;
	if (ratio >= 0.7) {
		const softenFactor = 0.97 - (1 - willingness) * 0.04; // 0.93–0.97
		newAskingPrice = Math.round(newAskingPrice * softenFactor);
	}

	let message: string;
	if (drain === 2) {
		const msgFn = pick(lowOfferMessages);
		message = msgFn(playerName, newAskingPrice);
	} else if (willingness < 0.35) {
		const msgFn = pick(reluctantMessages);
		message = msgFn(playerName, newAskingPrice);
	} else {
		const msgFn = pick(counterMessages);
		message = msgFn(playerName, newAskingPrice);
	}

	return {
		message,
		counter: newAskingPrice,
		accepted: false,
		collapsed: false,
	};
}

// ---------------------------------------------------------------------------
// Start a negotiation
// ---------------------------------------------------------------------------

export function startNegotiation(
	state: GameState,
	playerId: string,
	offerAmount: number,
): GameState {
	const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
	if (!playerTeam) return state;
	if ((playerTeam.budget ?? 0) < offerAmount) return state;

	const sellingTeam = state.teams.find((t) =>
		t.players.some((p) => p.id === playerId),
	);
	if (!sellingTeam || sellingTeam.id === state.playerTeamId) return state;

	const player = sellingTeam.players.find((p) => p.id === playerId);
	if (!player) return state;

	// Check if there's a collapsed negotiation and apply re-approach probability
	const prior = state.transferNegotiations.find(
		(n) => n.playerId === playerId && n.status === "collapsed",
	);
	if (prior) {
		const rounds = prior.rounds.length;
		const reapproachChance = Math.max(0.2, 1 - rounds * 0.25);
		if (Math.random() > reapproachChance) {
			// Club refuses contact — return state unchanged (caller should handle messaging)
			return state;
		}
	}

	const askingPrice = initialAskingPrice(
		sellingTeam,
		playerId,
		player.position,
	);

	const negotiation: TransferNegotiation = {
		id: `neg-${playerId}-${Date.now()}`,
		playerId,
		playerName: player.name,
		sellingTeamId: sellingTeam.id,
		sellingTeamName: sellingTeam.name,
		buyingTeamId: state.playerTeamId,
		status: "negotiating",
		patience: 3,
		rounds: [],
		currentAskingPrice: askingPrice,
		responseDueDate: addDays(state.currentDate, 1),
		cleanupDate: null,
		playerResponseDeadline: null,
	};

	// Store the offer amount as a pending round (club responds via processor)
	const pendingRound: NegotiationRound = {
		date: state.currentDate,
		offerAmount,
		counterAmount: null,
		clubMessage: "",
		initiatedBy: "player",
	};

	return {
		...state,
		transferNegotiations: [
			...state.transferNegotiations.filter(
				(n) => !(n.playerId === playerId && n.status === "collapsed"),
			),
			{ ...negotiation, rounds: [pendingRound] },
		],
	};
}

// ---------------------------------------------------------------------------
// Player submits a new offer on an existing negotiation
// ---------------------------------------------------------------------------

export function submitOffer(
	state: GameState,
	negotiationId: string,
	offerAmount: number,
): GameState {
	const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
	if (!playerTeam) return state;
	if ((playerTeam.budget ?? 0) < offerAmount) return state;

	const neg = state.transferNegotiations.find((n) => n.id === negotiationId);
	if (!neg || neg.status !== "negotiating") return state;

	const pendingRound: NegotiationRound = {
		date: state.currentDate,
		offerAmount,
		counterAmount: null,
		clubMessage: "",
		initiatedBy: "player",
	};

	const updated: TransferNegotiation = {
		...neg,
		rounds: [...neg.rounds, pendingRound],
		responseDueDate: addDays(state.currentDate, 1),
		playerResponseDeadline: null,
	};

	return {
		...state,
		transferNegotiations: state.transferNegotiations.map((n) =>
			n.id === negotiationId ? updated : n,
		),
	};
}

// ---------------------------------------------------------------------------
// Player walks away
// ---------------------------------------------------------------------------

export function walkAway(state: GameState, negotiationId: string): GameState {
	return {
		...state,
		transferNegotiations: state.transferNegotiations.map((n) =>
			n.id === negotiationId && n.status === "negotiating"
				? {
						...n,
						status: "rejected" as const,
						cleanupDate: addDays(state.currentDate, 7),
					}
				: n,
		),
	};
}

// ---------------------------------------------------------------------------
// Player accepts the club's counter-offer price
// ---------------------------------------------------------------------------

export function acceptCounter(
	state: GameState,
	negotiationId: string,
): GameState {
	const neg = state.transferNegotiations.find((n) => n.id === negotiationId);
	if (!neg || neg.status !== "negotiating") return state;

	const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
	if (!playerTeam || playerTeam.budget < neg.currentAskingPrice) return state;

	const sellingTeam = state.teams.find((t) => t.id === neg.sellingTeamId);
	const player = sellingTeam?.players.find((p) => p.id === neg.playerId);
	if (!player) return state;

	// Execute the transfer
	const updatedTeams = state.teams.map((team) => {
		if (team.id === neg.sellingTeamId) {
			return {
				...team,
				players: team.players.filter((p) => p.id !== neg.playerId),
				budget: team.budget + neg.currentAskingPrice,
			};
		}
		if (team.id === neg.buyingTeamId) {
			return {
				...team,
				players: [...team.players, player],
				budget: team.budget - neg.currentAskingPrice,
			};
		}
		return team;
	});

	const updatedNeg: TransferNegotiation = {
		...neg,
		status: "accepted",
		cleanupDate: addDays(state.currentDate, 7),
	};

	return {
		...state,
		teams: updatedTeams,
		transferNegotiations: state.transferNegotiations.map((n) =>
			n.id === negotiationId ? updatedNeg : n,
		),
		transferMarket: state.transferMarket.filter((p) => p.id !== neg.playerId),
	};
}

// ---------------------------------------------------------------------------
// advanceDay processor — resolves pending club responses
// ---------------------------------------------------------------------------

export function processNegotiations(
	state: GameState,
	date: string,
): { state: GameState; counterOffers: TransferNegotiation[] } {
	let newState = state;

	// Clean up old completed/collapsed negotiations
	newState = {
		...newState,
		transferNegotiations: newState.transferNegotiations.filter(
			(n) => !(n.cleanupDate && n.cleanupDate <= date),
		),
	};

	const negotiations = newState.transferNegotiations.map((neg) => {
		if (neg.status !== "negotiating") return neg;

		// Silence withdrawal — player hasn't responded within 3 days
		if (neg.playerResponseDeadline && neg.playerResponseDeadline <= date) {
			return {
				...neg,
				status: "collapsed" as const,
				cleanupDate: addDays(date, 7),
				playerResponseDeadline: null,
			};
		}

		// Not yet due for a club response
		if (!neg.responseDueDate || neg.responseDueDate > date) return neg;

		// Find the latest pending round (no clubMessage yet)
		const lastRound = neg.rounds[neg.rounds.length - 1];
		if (
			!lastRound ||
			lastRound.clubMessage !== "" ||
			lastRound.initiatedBy !== "player"
		) {
			return neg;
		}

		const sellingTeam = newState.teams.find((t) => t.id === neg.sellingTeamId);
		if (!sellingTeam) return neg;

		const player = sellingTeam.players.find((p) => p.id === neg.playerId);
		if (!player) return neg;

		const willingness = coverWillingnessProbability(
			sellingTeam,
			neg.playerId,
			player.position,
		);

		const drain = patienceDrain(lastRound.offerAmount, neg.currentAskingPrice);
		const newPatience = neg.patience - drain;

		const response = generateClubResponse(
			neg,
			lastRound.offerAmount,
			neg.playerName,
			willingness,
		);

		const updatedRound: NegotiationRound = {
			...lastRound,
			counterAmount: response.counter,
			clubMessage: response.message,
		};

		if (response.collapsed || newPatience <= 0) {
			return {
				...neg,
				patience: 0,
				status: "collapsed" as const,
				rounds: [...neg.rounds.slice(0, -1), updatedRound],
				responseDueDate: null,
				cleanupDate: addDays(date, 7),
			};
		}

		if (response.accepted) {
			// Execute transfer inline
			return {
				...neg,
				patience: newPatience,
				status: "accepted" as const,
				rounds: [...neg.rounds.slice(0, -1), updatedRound],
				responseDueDate: null,
				cleanupDate: addDays(date, 7),
			};
		}

		return {
			...neg,
			patience: newPatience,
			currentAskingPrice: response.counter ?? neg.currentAskingPrice,
			rounds: [...neg.rounds.slice(0, -1), updatedRound],
			responseDueDate: null,
			// Player has 3 days to respond
			playerResponseDeadline: addDays(date, 3),
		};
	});

	// For accepted negotiations, also execute the actual transfer
	const acceptedNow = negotiations.filter(
		(n) =>
			n.status === "accepted" &&
			state.transferNegotiations.find((o) => o.id === n.id)?.status ===
				"negotiating",
	);

	let teams = newState.teams;
	for (const neg of acceptedNow) {
		const sellingTeam = teams.find((t) => t.id === neg.sellingTeamId);
		const player = sellingTeam?.players.find((p) => p.id === neg.playerId);
		if (!player) continue;
		const amount = neg.rounds[neg.rounds.length - 1].offerAmount;
		teams = teams.map((team) => {
			if (team.id === neg.sellingTeamId) {
				return {
					...team,
					players: team.players.filter((p) => p.id !== neg.playerId),
					budget: team.budget + amount,
				};
			}
			if (team.id === neg.buyingTeamId) {
				return {
					...team,
					players: [...team.players, player],
					budget: team.budget - amount,
				};
			}
			return team;
		});
	}

	// Detect negotiations that just received a counter-offer this tick
	const counterOffers = negotiations.filter((neg) => {
		if (neg.status !== "negotiating") return false;
		const before = state.transferNegotiations.find((n) => n.id === neg.id);
		return (
			before && !before.playerResponseDeadline && neg.playerResponseDeadline
		);
	});

	return {
		state: {
			...newState,
			teams,
			transferNegotiations: negotiations,
			transferMarket: newState.transferMarket.filter(
				(p) => !acceptedNow.some((n) => n.playerId === p.id),
			),
		},
		counterOffers,
	};
}
