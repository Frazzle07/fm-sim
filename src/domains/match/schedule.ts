import type { Fixture } from "./types";

// Season starts June 25 — first match day is the following Saturday (June 28)
const SEASON_START = "2026-06-25";

export function seasonStartDate(): string {
	return SEASON_START;
}

export function addDays(isoDate: string, days: number): string {
	const d = new Date(isoDate);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function matchDayForWeek(week: number): string {
	// Week 1 plays on June 28 (first Saturday), then every 7 days
	return addDays(SEASON_START, 3 + (week - 1) * 7);
}

export function generateFixtures(teamIds: string[]): Fixture[] {
	const fixtures: Fixture[] = [];
	let fixtureId = 1;
	const n = teamIds.length;
	const rounds = (n - 1) * 2;
	const ids = [...teamIds];

	for (let round = 0; round < rounds; round++) {
		const week = round + 1;
		const date = matchDayForWeek(week);
		for (let i = 0; i < n / 2; i++) {
			const home = round < n - 1 ? ids[i] : ids[n - 1];
			const away = round < n - 1 ? ids[n - 1 - i] : ids[i];
			const [h, a] = round % 2 === 0 ? [home, away] : [away, home];
			fixtures.push({
				id: String(fixtureId++),
				week,
				date,
				homeTeamId: h,
				awayTeamId: a,
				played: false,
			});
		}
		// biome-ignore lint/style/noNonNullAssertion: array is non-empty at this point
		ids.splice(1, 0, ids.pop()!);
	}

	return fixtures;
}
