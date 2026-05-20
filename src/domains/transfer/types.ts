import type { Player } from "#/domains/player/types";

export interface TransferOffer {
	id: string;
	playerId: string;
	fromTeamId: string;
	toTeamId: string;
	amount: number;
	status: "pending" | "accepted" | "rejected";
}

export type ListedPlayer = Player & { teamId: string; teamName: string };

export type NegotiationStatus =
	| "negotiating"
	| "accepted"
	| "rejected"
	| "collapsed";

export interface NegotiationRound {
	date: string; // ISO date YYYY-MM-DD
	offerAmount: number;
	counterAmount: number | null; // null if club accepted/rejected outright
	clubMessage: string;
	initiatedBy: "player" | "club";
}

export interface TransferNegotiation {
	id: string;
	playerId: string;
	playerName: string;
	sellingTeamId: string;
	sellingTeamName: string;
	buyingTeamId: string;
	status: NegotiationStatus;
	patience: number; // 0–3, collapses at 0
	rounds: NegotiationRound[];
	currentAskingPrice: number; // club's current demanded price
	/** ISO date when the club will respond (null = awaiting player action) */
	responseDueDate: string | null;
	/** ISO date when a completed/collapsed negotiation should be cleaned up */
	cleanupDate: string | null;
	/** How many days player has had to respond to last counter (for silence withdrawal) */
	playerResponseDeadline: string | null;
}
