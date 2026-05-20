import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { sortedStandings } from "#/domains/league/standings";
import type { Fixture, MatchEventType } from "#/domains/match/types";
import { useGame } from "../GameContext";
import MatchPitch from "./MatchPitch";
import MatchPitchV2 from "./MatchPitchV2";

const eventIcon: Record<MatchEventType, string> = {
	goal: "⚽",
	yellowCard: "🟨",
	redCard: "🟥",
	substitution: "🔄",
	save: "🧤",
	injury: "🤕",
};

interface MatchResultPageProps {
	fixtureId: string;
}

export default function MatchResultPage({ fixtureId }: MatchResultPageProps) {
	const { game, teamMap } = useGame();
	const navigate = useNavigate();

	const fixture: Fixture | undefined = game.fixtures.find(
		(f) => f.id === fixtureId,
	);

	if (!fixture?.result) {
		return (
			<div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
				No result found.
			</div>
		);
	}

	const hT = teamMap[fixture.homeTeamId];
	const aT = teamMap[fixture.awayTeamId];
	const { homeGoals, awayGoals, events } = fixture.result;
	const isPlayerHome = fixture.homeTeamId === game.playerTeamId;
	const playerGoals = isPlayerHome ? homeGoals : awayGoals;
	const opponentGoals = isPlayerHome ? awayGoals : homeGoals;

	const outcome =
		playerGoals > opponentGoals
			? "win"
			: playerGoals < opponentGoals
				? "loss"
				: "draw";

	const outcomeLabel =
		outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : "Draw";
	const outcomeColor =
		outcome === "win" ? "#0e9f6e" : outcome === "loss" ? "#e02424" : "#f59e0b";

	const table = sortedStandings(game.standings);
	const otherFixtures = game.fixtures.filter(
		(f) => f.week === fixture.week && f.id !== fixture.id && f.result != null,
	);

	return (
		<div>
			{/* Top row: result card + sidebar */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 200px",
					gap: 12,
					marginBottom: 12,
					alignItems: "start",
				}}
			>
				{/* Result header */}
				<Card className="text-center">
					<CardContent className="pt-2">
						<div
							style={{
								fontSize: 13,
								fontWeight: 700,
								color: outcomeColor,
								marginBottom: 4,
								textTransform: "uppercase",
								letterSpacing: "0.06em",
							}}
						>
							{outcomeLabel}
						</div>
						<div
							style={{
								fontSize: 11,
								color: "var(--color-text-secondary)",
								marginBottom: 16,
							}}
						>
							Week {fixture.week} · Full time
						</div>

						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 24,
							}}
						>
							<div style={{ textAlign: "center", minWidth: 80 }}>
								<div
									style={{
										width: 14,
										height: 14,
										borderRadius: "50%",
										background: hT?.color,
										margin: "0 auto 6px",
									}}
								/>
								<div style={{ fontWeight: 600, fontSize: 15 }}>
									{hT?.shortName}
								</div>
							</div>

							<div
								style={{
									fontSize: 42,
									fontWeight: 700,
									padding: "0 8px",
									lineHeight: 1,
								}}
							>
								{homeGoals} – {awayGoals}
							</div>

							<div style={{ textAlign: "center", minWidth: 80 }}>
								<div
									style={{
										width: 14,
										height: 14,
										borderRadius: "50%",
										background: aT?.color,
										margin: "0 auto 6px",
									}}
								/>
								<div style={{ fontWeight: 600, fontSize: 15 }}>
									{aT?.shortName}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Sidebar */}
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{/* Other scores */}
					{otherFixtures.length > 0 && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
									Other scores
								</CardTitle>
							</CardHeader>
							<CardContent>
								{otherFixtures.map((f) => {
									const h = teamMap[f.homeTeamId];
									const a = teamMap[f.awayTeamId];
									return (
										<div
											key={f.id}
											style={{
												display: "grid",
												gridTemplateColumns: "1fr auto 1fr",
												alignItems: "center",
												gap: 4,
												padding: "4px 0",
												fontSize: 11,
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 4,
													justifyContent: "flex-end",
												}}
											>
												<span style={{ fontWeight: 500 }}>{h?.shortName}</span>
												<div
													style={{
														width: 8,
														height: 8,
														borderRadius: "50%",
														background: h?.color,
														flexShrink: 0,
													}}
												/>
											</div>
											<div
												style={{
													fontWeight: 700,
													fontSize: 12,
													padding: "0 4px",
													textAlign: "center",
												}}
											>
												{f.result?.homeGoals} – {f.result?.awayGoals}
											</div>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 4,
												}}
											>
												<div
													style={{
														width: 8,
														height: 8,
														borderRadius: "50%",
														background: a?.color,
														flexShrink: 0,
													}}
												/>
												<span style={{ fontWeight: 500 }}>{a?.shortName}</span>
											</div>
										</div>
									);
								})}
							</CardContent>
						</Card>
					)}

					{/* League table */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
								Table
							</CardTitle>
						</CardHeader>
						<CardContent>
							{table.map((s, i) => {
								const t = teamMap[s.teamId];
								const isPlayer = s.teamId === game.playerTeamId;
								return (
									<div
										key={s.teamId}
										style={{
											display: "grid",
											gridTemplateColumns: "16px 1fr auto",
											alignItems: "center",
											gap: 6,
											padding: "3px 0",
											fontSize: 11,
											fontWeight: isPlayer ? 700 : 400,
											color: isPlayer
												? "var(--color-text-primary)"
												: "var(--color-text-secondary)",
										}}
									>
										<span style={{ textAlign: "right" }}>{i + 1}</span>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 5,
											}}
										>
											<div
												style={{
													width: 7,
													height: 7,
													borderRadius: "50%",
													background: t?.color,
													flexShrink: 0,
												}}
											/>
											<span>{t?.shortName}</span>
										</div>
										<span style={{ fontWeight: isPlayer ? 700 : 600 }}>
											{s.points}
										</span>
									</div>
								);
							})}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Live pitch */}
			<Card className="mb-3">
				<CardContent className="pt-4">
					{/* <MatchPitch
						result={fixture.result}
						homeColor={hT?.color ?? "#888"}
						awayColor={aT?.color ?? "#444"}
						homeShortName={hT?.shortName ?? ""}
						awayShortName={aT?.shortName ?? ""}
					/> */}
					<MatchPitchV2
						result={fixture.result}
						homeColor={hT?.color ?? "#888"}
						awayColor={aT?.color ?? "#444"}
						homeShortName={hT?.shortName ?? ""}
						awayShortName={aT?.shortName ?? ""}
						homePlayers={hT.players}
						awayPlayers={aT.players}
					/>
				</CardContent>
			</Card>

			{/* Match events */}
			<Card className="mb-3">
				<CardHeader className="pb-2">
					<CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
						Match events
					</CardTitle>
				</CardHeader>
				<CardContent>
					{events.length === 0 ? (
						<div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
							No notable events.
						</div>
					) : (
						events.map((e) => {
							const isHome = e.teamId === fixture.homeTeamId;
							return (
								<div
									key={`${e.teamId}-${e.type}-${e.minute}`}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										padding: "7px 0",
										borderBottom:
											events.indexOf(e) < events.length - 1
												? "0.5px solid var(--color-border-tertiary)"
												: "none",
										justifyContent: isHome ? "flex-start" : "flex-end",
										fontSize: 13,
									}}
								>
									{isHome ? (
										<>
											<span
												style={{
													color: "var(--color-text-secondary)",
													minWidth: 28,
												}}
											>
												{e.minute}'
											</span>
											<span>{eventIcon[e.type]}</span>
											<span>{e.playerName}</span>
										</>
									) : (
										<>
											<span>{e.playerName}</span>
											<span>{eventIcon[e.type]}</span>
											<span
												style={{
													color: "var(--color-text-secondary)",
													minWidth: 28,
													textAlign: "right",
												}}
											>
												{e.minute}'
											</span>
										</>
									)}
								</div>
							);
						})
					)}
				</CardContent>
			</Card>

			{/* Continue button */}
			<button
				type="button"
				onClick={() => navigate({ to: "/dashboard" })}
				style={{
					width: "100%",
					padding: "12px 0",
					borderRadius: 10,
					border: "none",
					background: "var(--color-text-primary)",
					color: "var(--color-background-primary)",
					fontSize: 14,
					fontWeight: 600,
					cursor: "pointer",
				}}
			>
				Continue
			</button>
		</div>
	);
}
