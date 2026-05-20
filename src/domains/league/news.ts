import type { Fixture } from "#/domains/match/types";
import type { Team } from "#/domains/team/types";
import type { DayEvent } from "#/GameState";

export function generateNews(
	events: DayEvent[],
	teamMap: Record<string, Team>,
): string[] {
	return events.flatMap((event) => {
		if (event.type === "matchPlayed") {
			const f = event.payload.fixture as Fixture;
			if (!f.result) return [];
			const h = teamMap[f.homeTeamId]?.shortName ?? "?";
			const a = teamMap[f.awayTeamId]?.shortName ?? "?";
			const { homeGoals, awayGoals } = f.result;
			const suffix =
				homeGoals > awayGoals
					? `${h} win!`
					: awayGoals > homeGoals
						? `${a} win!`
						: "Draw!";
			return [
				`Week ${f.week}: ${h} ${homeGoals} - ${awayGoals} ${a} — ${suffix}`,
			];
		}
		return [];
	});
}
