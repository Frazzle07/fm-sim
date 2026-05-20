import type { Player } from "#/domains/player/types";
import type { DayEvent, InboxMessage, TrainingPerformer } from "#/GameState";

function trainingLabel(delta: number): string {
	if (delta >= 1.5) return "Excellent";
	if (delta >= 0.5) return "Good";
	if (delta > 0) return "Modest";
	if (delta === 0) return "No change";
	return "Declined";
}

export function generateTrainingSummary(
	events: DayEvent[],
	date: string,
): InboxMessage[] {
	const messages: InboxMessage[] = [];

	for (const event of events) {
		if (event.type !== "trainingWeekComplete") continue;

		const week = event.payload.week as number;
		const players = event.payload.players as Player[];
		const deltas = event.payload.deltas as Record<string, number>;

		const toPerformer = (p: Player): TrainingPerformer => ({
			playerId: p.id,
			name: p.name,
			position: p.position,
			delta: deltas[p.id] ?? 0,
		});

		const sorted = players
			.slice()
			.sort((a, b) => (deltas[b.id] ?? 0) - (deltas[a.id] ?? 0));

		const TOP_N = 3;
		const topPerformers = sorted
			.filter((p) => (deltas[p.id] ?? 0) > 0)
			.slice(0, TOP_N)
			.map(toPerformer);

		const bottomPerformers = sorted
			.filter((p) => (deltas[p.id] ?? 0) <= 0)
			.slice(-TOP_N)
			.reverse()
			.map(toPerformer);

		// Plain-text body used as inbox preview
		const topLines = topPerformers.map(
			(p) => `${p.name} (${p.position}) — ${trainingLabel(p.delta)} (+${p.delta.toFixed(2)} CA)`,
		);
		const bottomLines = bottomPerformers.map(
			(p) => `${p.name} (${p.position}) — ${trainingLabel(p.delta)} (${p.delta.toFixed(2)} CA)`,
		);
		const body = [
			topLines.length ? `Top: ${topLines.join(", ")}` : "",
			bottomLines.length ? `Low: ${bottomLines.join(", ")}` : "",
		]
			.filter(Boolean)
			.join(" | ");

		messages.push({
			id: `training-week-${week}`,
			date,
			category: "general",
			title: `Week ${week} Training Report`,
			body: body || "No notable changes this week.",
			read: false,
			trainingData: { topPerformers, bottomPerformers },
		});
	}

	return messages;
}
