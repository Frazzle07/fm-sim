import type { Standing } from "#/domains/league/types";
import type { Fixture } from "#/domains/match/types";
import type { Player } from "#/domains/player/types";
import type { ScoutingAssignment } from "#/domains/scouting/types";
import type { Team } from "#/domains/team/types";
import type { TransferNegotiation } from "#/domains/transfer/types";

export type DayEventType = "matchPlayed" | "trainingWeekComplete";

export interface DayEvent {
	type: DayEventType;
	payload: Record<string, unknown>;
}

export type InboxCategory = "match" | "transfer" | "league" | "general";

export interface TrainingPerformer {
	playerId: string;
	name: string;
	position: string;
	delta: number;
}

export interface TrainingReportData {
	topPerformers: TrainingPerformer[];
	bottomPerformers: TrainingPerformer[];
}

export interface InboxMessage {
	id: string;
	date: string; // ISO date string YYYY-MM-DD
	category: InboxCategory;
	title: string;
	body: string;
	read: boolean;
	fixtureId?: string;
	trainingData?: TrainingReportData;
}

export interface GameState {
	playerTeamId: string;
	week: number;
	season: number;
	currentDate: string; // ISO date string YYYY-MM-DD
	teams: Team[];
	fixtures: Fixture[];
	standings: Standing[];
	transferMarket: Player[]; // players listed for sale
	transferNegotiations: TransferNegotiation[];
	news: string[];
	inbox: InboxMessage[];
	pendingFixtureId?: string;
	pendingLineup?: Player[];
	scoutingAssignments: ScoutingAssignment[];
}

export type DayProcessor = (
	state: GameState,
	date: string,
	events: DayEvent[],
) => GameState;
