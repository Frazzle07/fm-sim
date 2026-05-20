import type { Fixture } from "#/domains/match/types";
import type { Team } from "#/domains/team/types";
import type { DayEvent, InboxMessage } from "#/GameState";

export function generateInboxMessages(
	events: DayEvent[],
	teamMap: Record<string, Team>,
	playerTeamId: string,
	date: string,
): InboxMessage[] {
	const messages: InboxMessage[] = [];

	for (const event of events) {
		if (event.type === "matchPlayed") {
			const f = event.payload.fixture as Fixture;
			if (!f.result) continue;

			const isPlayerMatch =
				f.homeTeamId === playerTeamId || f.awayTeamId === playerTeamId;

			if (!isPlayerMatch) continue;

			const isHome = f.homeTeamId === playerTeamId;
			const opponent = teamMap[isHome ? f.awayTeamId : f.homeTeamId];
			const playerGoals = isHome ? f.result.homeGoals : f.result.awayGoals;
			const oppGoals = isHome ? f.result.awayGoals : f.result.homeGoals;

			let outcome: string;
			let outcomeDetail: string;
			if (playerGoals > oppGoals) {
				outcome = "Victory";
				outcomeDetail = `You won ${playerGoals}–${oppGoals}`;
			} else if (playerGoals < oppGoals) {
				outcome = "Defeat";
				outcomeDetail = `You lost ${playerGoals}–${oppGoals}`;
			} else {
				outcome = "Draw";
				outcomeDetail = `You drew ${playerGoals}–${oppGoals}`;
			}

			const venue = isHome ? "at home" : "away";
			const oppName = opponent?.name ?? "Unknown";

			const goals = f.result.events
				.filter((e) => e.type === "goal")
				.map((e) => `${e.minute}' ${e.playerName}`)
				.join(", ");

			const body = goals
				? `${outcomeDetail} ${venue} vs ${oppName}. Goals: ${goals}.`
				: `${outcomeDetail} ${venue} vs ${oppName}. No goals scored.`;

			messages.push({
				id: `match-${f.id}`,
				date,
				category: "match",
				title: `Week ${f.week}: ${outcome} vs ${oppName}`,
				body,
				read: false,
				fixtureId: f.id,
			});
		}
	}

	return messages;
}
