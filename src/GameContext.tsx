import { createContext, useContext } from "react";
import type { Player } from "#/domains/player/types";
import type { ScoutingAssignment } from "#/domains/scouting/types";
import type { Team } from "#/domains/team/types";
import type { ListedPlayer } from "#/domains/transfer/types";
import type { GameState } from "#/GameState";

export interface PendingAction {
	label: string;
	onConfirm: () => void;
	disabled?: boolean;
}

export interface GameContextValue {
	game: GameState;
	teamMap: Record<string, Team>;
	pendingAction: PendingAction | null;
	setPendingAction: (action: PendingAction | null) => void;
	onAdvanceDay: () => void;
	onConfirmLineup: (lineup: Player[]) => void;
	onListForSale: (playerId: string) => void;
	onBuy: (player: ListedPlayer) => void;
	onMarkInboxRead: (messageId: string) => void;
	onMarkAllInboxRead: () => void;
	onCreateAssignment: (
		assignment: Omit<ScoutingAssignment, "id" | "scoutedPlayers">,
	) => void;
	onCancelAssignment: (id: string) => void;
	onStartNegotiation: (playerId: string, offerAmount: number) => void;
	onSubmitOffer: (negotiationId: string, offerAmount: number) => void;
	onAcceptCounter: (negotiationId: string) => void;
	onWalkAway: (negotiationId: string) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
	const ctx = useContext(GameContext);
	if (!ctx) throw new Error("useGame must be used within GameContext.Provider");
	return ctx;
}
