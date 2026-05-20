import type { GameState } from "#/GameState";
import type { TransferOffer } from "./types";

export function listPlayerForSale(
	state: GameState,
	playerId: string,
	teamId: string,
): GameState {
	const team = state.teams.find((t) => t.id === teamId);
	const player = team?.players.find((p) => p.id === playerId);
	if (!player || state.transferMarket.find((p) => p.id === playerId))
		return state;
	return { ...state, transferMarket: [...state.transferMarket, player] };
}

export function processTransfer(
	state: GameState,
	offer: TransferOffer,
	accept: boolean,
): GameState {
	if (!accept) return state;
	const teams = state.teams.map((team) => {
		if (team.id === offer.fromTeamId) {
			return {
				...team,
				players: team.players.filter((p) => p.id !== offer.playerId),
				budget: team.budget + offer.amount,
			};
		}
		if (team.id === offer.toTeamId) {
			const player = state.teams
				.find((t) => t.id === offer.fromTeamId)
				?.players.find((p) => p.id === offer.playerId);
			return player
				? {
						...team,
						players: [...team.players, player],
						budget: team.budget - offer.amount,
					}
				: team;
		}
		return team;
	});
	return {
		...state,
		teams,
		transferMarket: state.transferMarket.filter((p) => p.id !== offer.playerId),
	};
}
