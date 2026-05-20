import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { createFace } from "#/domains/player/generation";
import { ageFromDob } from "#/domains/player/generator";
import {
	type GKStats,
	isGKStats,
	type PlayerStats,
} from "#/domains/player/types";
import { FormDots, fmt, PosBadge } from "../components/shared";
import { useGame } from "../GameContext";

const personalityDescription: Record<string, string> = {
	"Model Professional":
		"Dedicated, consistent, great influence in the dressing room.",
	Determined: "Driven to improve — responds well under pressure.",
	Average: "Gets the job done without standing out.",
	Lazy: "Inconsistent effort; prone to underperforming.",
	Temperamental: "Hot-headed — can be brilliant or a liability.",
};

function attrLabel(value: number): { label: string; color: string } {
	if (value >= 18) return { label: "World Class", color: "#7c3aed" };
	if (value >= 16) return { label: "Excellent", color: "#16a34a" };
	if (value >= 14) return { label: "Good", color: "#2563eb" };
	if (value >= 12) return { label: "Decent", color: "#0891b2" };
	if (value >= 10) return { label: "Average", color: "#ca8a04" };
	if (value >= 8) return { label: "Mediocre", color: "#ea580c" };
	if (value >= 5) return { label: "Poor", color: "#dc2626" };
	return { label: "Very Poor", color: "#991b1b" };
}

function StatRow({ label, value }: { label: string; value: number }) {
	const { label: attrLbl, color } = attrLabel(value);
	return (
		<div className="flex items-center justify-between py-0.5 gap-3">
			<span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
				{label}
			</span>
			<span
				className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
				style={{
					color,
					background: `${color}18`,
					border: `1px solid ${color}33`,
				}}
			>
				{attrLbl}
			</span>
		</div>
	);
}

function AttrPanel({
	title,
	stats,
}: {
	title: string;
	stats: { label: string; value: number }[];
}) {
	return (
		<div
			className="rounded-lg p-3"
			style={{
				background: "hsl(var(--card))",
				border: "1px solid hsl(var(--border))",
			}}
		>
			<div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
				{title}
			</div>
			<div className="space-y-0.5">
				{stats.map((s) => (
					<StatRow key={s.label} label={s.label} value={s.value} />
				))}
			</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-sm font-semibold">{value}</span>
		</div>
	);
}

function formatChartDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

type Tab = "overview" | "development";

function PlayerDetailPage() {
	const { playerId } = Route.useParams();
	const { game } = useGame();
	const [tab, setTab] = useState<Tab>("overview");

	const playerTeam = game.teams.find((t) =>
		t.players.some((p) => p.id === playerId),
	);
	const player = playerTeam?.players.find((p) => p.id === playerId);

	if (!player)
		return (
			<div className="text-muted-foreground text-sm">Player not found.</div>
		);

	const age = ageFromDob(player.dateOfBirth, game.currentDate);
	const gk = isGKStats(player.stats);

	const playedFixtures = game.fixtures.filter((f) => f.played && f.result);
	let appearances = 0;
	let goals = 0;
	let yellowCards = 0;
	let redCards = 0;

	for (const fixture of playedFixtures) {
		const events = fixture.result?.events ?? [];
		const involved = events.some((e) => e.playerName === player.name);
		if (involved) appearances++;
		for (const e of events) {
			if (e.playerName !== player.name) continue;
			if (e.type === "goal") goals++;
			if (e.type === "yellowCard") yellowCards++;
			if (e.type === "redCard") redCards++;
		}
	}

	const isListed = game.transferMarket.some((p) => p.id === player.id);

	const moraleLabel =
		player.morale >= 8
			? "Excellent"
			: player.morale >= 6
				? "Good"
				: player.morale >= 4
					? "Okay"
					: "Poor";

	const s = player.stats as PlayerStats;
	const gkS = player.stats as GKStats;

	const attrGroups = gk
		? [
				{
					title: "Goalkeeping",
					stats: [
						{ label: "Reflexes", value: gkS.reflexes },
						{ label: "Handling", value: gkS.handling },
						{ label: "Positioning", value: gkS.positioning },
						{ label: "Kicking", value: gkS.kicking },
						{ label: "Aerial", value: gkS.aerial },
					],
				},
				{
					title: "Mental",
					stats: [
						{ label: "Composure", value: gkS.composure },
						{ label: "Decisions", value: gkS.decisions },
						{ label: "Determination", value: gkS.determination },
					],
				},
				{
					title: "Physical",
					stats: [
						{ label: "Pace", value: gkS.pace },
						{ label: "Stamina", value: gkS.stamina },
						{ label: "Strength", value: gkS.strength },
					],
				},
			]
		: [
				{
					title: "Attacking",
					stats: [
						{ label: "Finishing", value: s.finishing },
						{ label: "Long shots", value: s.longShots },
						{ label: "Off the ball", value: s.offTheBall },
					],
				},
				{
					title: "Technical",
					stats: [
						{ label: "Passing", value: s.passing },
						{ label: "Dribbling", value: s.dribbling },
						{ label: "First touch", value: s.firstTouch },
						{ label: "Technique", value: s.technique },
					],
				},
				{
					title: "Defending",
					stats: [
						{ label: "Tackling", value: s.tackling },
						{ label: "Marking", value: s.marking },
						{ label: "Positioning", value: s.positioning },
					],
				},
				{
					title: "Mental",
					stats: [
						{ label: "Composure", value: s.composure },
						{ label: "Decisions", value: s.decisions },
						{ label: "Determination", value: s.determination },
						{ label: "Work rate", value: s.workRate },
					],
				},
				{
					title: "Physical",
					stats: [
						{ label: "Pace", value: s.pace },
						{ label: "Acceleration", value: s.acceleration },
						{ label: "Stamina", value: s.stamina },
						{ label: "Strength", value: s.strength },
					],
				},
			];

	const { svg: avatarSvg } = createFace({ seed: player.faceSeed });

	const chartData = (player.caHistory ?? []).map((snap) => ({
		date: snap.date,
		label: formatChartDate(snap.date),
		ca: Math.round(snap.ca * 10) / 10,
	}));

	const caMin = Math.max(0, Math.min(...chartData.map((d) => d.ca)) - 5);
	const caMax = Math.min(200, Math.max(...chartData.map((d) => d.ca)) + 5);
	const startCA = chartData[0]?.ca ?? player.ca;
	const endCA = chartData[chartData.length - 1]?.ca ?? player.ca;
	const caGain = endCA - startCA;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Link
					to="/squad"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Back to squad
				</Link>

				<div className="flex gap-1 border-b border-border">
					{(["overview", "development"] as Tab[]).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className="px-4 py-2 text-sm font-medium capitalize transition-colors"
							style={{
								borderBottom: tab === t ? "2px solid hsl(var(--primary))" : "2px solid transparent",
								color: tab === t ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
								background: "transparent",
								cursor: "pointer",
								marginBottom: -1,
							}}
						>
							{t.charAt(0).toUpperCase() + t.slice(1)}
						</button>
					))}
				</div>
			</div>

			{/* Header panel */}
			<div
				className="rounded-xl overflow-hidden"
				style={{
					background: "hsl(var(--card))",
					border: "1px solid hsl(var(--border))",
				}}
			>
				<div className="flex">
					{/* Photo */}
					<div
						className="flex-none w-36 flex items-start justify-center overflow-hidden pt-4"
						style={{ background: "hsl(var(--muted))" }}
					>
						<img
							src={`data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg)}`}
							alt={player.name}
							className="w-36 h-36 object-cover"
						/>
					</div>

					{/* Identity */}
					<div className="flex-1 px-5 py-4 space-y-3">
						<div>
							<div className="flex items-center gap-2 mb-0.5">
								<PosBadge pos={player.position} />
								{isListed && (
									<span
										className="text-xs font-medium px-1.5 py-0.5 rounded"
										style={{
											background: "#16a34a22",
											color: "#16a34a",
											border: "1px solid #16a34a33",
										}}
									>
										Transfer listed
									</span>
								)}
								{player.injured && (
									<span
										className="text-xs font-medium px-1.5 py-0.5 rounded"
										style={{
											background: "#dc262622",
											color: "#dc2626",
											border: "1px solid #dc262633",
										}}
									>
										Injured {player.injuryWeeks}w
									</span>
								)}
							</div>
							<h1 className="text-2xl font-bold tracking-tight">
								{player.name}
							</h1>
							<div className="text-sm text-muted-foreground mt-0.5">
								{player.position === "GK"
									? "Goalkeeper"
									: player.position === "DEF"
										? "Defender"
										: player.position === "MID"
											? "Midfielder"
											: "Forward"}{" "}
								· Age {age} · Born {player.dateOfBirth}
							</div>
						</div>

						<div className="grid grid-cols-4 gap-3">
							<div>
								<div className="text-xs text-muted-foreground mb-0.5">
									Ability
								</div>
								<div className="text-xl font-bold">{player.ca}</div>
							</div>
							<div>
								<div className="text-xs text-muted-foreground mb-0.5">
									Value
								</div>
								<div className="text-xl font-bold">{fmt(player.value)}</div>
							</div>
							<div>
								<div className="text-xs text-muted-foreground mb-0.5">Wage</div>
								<div className="text-xl font-bold">
									{fmt(player.wage)}
									<span className="text-sm font-normal text-muted-foreground">
										{" "}
										p/w
									</span>
								</div>
							</div>
							{playerTeam && (
								<div>
									<div className="text-xs text-muted-foreground mb-0.5">
										Club
									</div>
									<div className="flex items-center gap-1.5">
										<div
											className="w-3 h-3 rounded-full shrink-0"
											style={{ background: playerTeam.color }}
										/>
										<div className="text-sm font-semibold truncate">
											{playerTeam.name}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Season stats */}
					<div className="flex-none w-44 px-4 py-4 border-l border-border">
						<div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
							Season
						</div>
						<InfoRow label="Appearances" value={appearances} />
						<InfoRow label="Goals" value={goals} />
						<InfoRow
							label="Yellow cards"
							value={<span className="text-yellow-500">{yellowCards}</span>}
						/>
						<InfoRow
							label="Red cards"
							value={<span className="text-red-500">{redCards}</span>}
						/>
					</div>

					{/* Condition */}
					<div className="flex-none w-52 px-4 py-4 border-l border-border">
						<div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
							Condition
						</div>
						<div className="py-1 border-b border-border/50 mb-1">
							<div className="text-xs text-muted-foreground mb-1">Form</div>
							<FormDots form={player.form} />
						</div>
						<InfoRow label="Morale" value={moraleLabel} />
						<InfoRow label="Fitness" value={`${player.naturalFitness}/20`} />
						<div className="pt-2">
							<div className="text-xs text-muted-foreground mb-0.5">
								Personality
							</div>
							<div className="text-sm font-semibold">{player.personality}</div>
							<div className="text-xs text-muted-foreground mt-0.5 leading-snug">
								{personalityDescription[player.personality]}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Tab: Overview — attribute panels */}
			{tab === "overview" && (
				<div
					className={`grid gap-3 ${attrGroups.length === 3 ? "grid-cols-3" : "grid-cols-5"}`}
				>
					{attrGroups.map((group) => (
						<AttrPanel
							key={group.title}
							title={group.title}
							stats={group.stats}
						/>
					))}
				</div>
			)}

			{/* Tab: Development — CA growth chart */}
			{tab === "development" && (
				<div
					className="rounded-xl p-5"
					style={{
						background: "hsl(var(--card))",
						border: "1px solid hsl(var(--border))",
					}}
				>
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="text-sm font-semibold">CA Progression</div>
							<div className="text-xs text-muted-foreground mt-0.5">
								Current ability over time
							</div>
						</div>
						<div className="text-right">
							<div
								className="text-lg font-bold"
								style={{ color: caGain >= 0 ? "#16a34a" : "#dc2626" }}
							>
								{caGain >= 0 ? "+" : ""}
								{caGain.toFixed(1)} CA
							</div>
							<div className="text-xs text-muted-foreground">
								since tracking began
							</div>
						</div>
					</div>

					{chartData.length < 2 ? (
						<div
							className="flex items-center justify-center h-48 text-sm text-muted-foreground"
						>
							Not enough data yet — check back after the first training week.
						</div>
					) : (
						<ResponsiveContainer width="100%" height={240}>
							<AreaChart
								data={chartData}
								margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
							>
								<defs>
									<linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
										<stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="hsl(var(--border))"
									vertical={false}
								/>
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
									axisLine={false}
									tickLine={false}
									interval="preserveStartEnd"
								/>
								<YAxis
									domain={[caMin, caMax]}
									tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
									axisLine={false}
									tickLine={false}
									tickCount={5}
								/>
								<Tooltip
									contentStyle={{
										background: "hsl(var(--card))",
										border: "1px solid hsl(var(--border))",
										borderRadius: 8,
										fontSize: 12,
									}}
									labelStyle={{ fontWeight: 600, marginBottom: 2 }}
									formatter={(val) => [typeof val === "number" ? val.toFixed(1) : val, "CA"]}
								/>
								<ReferenceLine
									y={startCA}
									stroke="hsl(var(--muted-foreground))"
									strokeDasharray="4 4"
									strokeOpacity={0.4}
								/>
								<Area
									type="monotone"
									dataKey="ca"
									stroke="#2563eb"
									strokeWidth={2}
									fill="url(#caGrad)"
									dot={chartData.length <= 16}
									activeDot={{ r: 4, fill: "#2563eb" }}
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}

					<div className="mt-4 grid grid-cols-3 gap-3">
						<div
							className="rounded-lg p-3 text-center"
							style={{ background: "hsl(var(--muted))" }}
						>
							<div className="text-xs text-muted-foreground mb-0.5">Starting CA</div>
							<div className="text-lg font-bold">{startCA.toFixed(1)}</div>
						</div>
						<div
							className="rounded-lg p-3 text-center"
							style={{ background: "hsl(var(--muted))" }}
						>
							<div className="text-xs text-muted-foreground mb-0.5">Current CA</div>
							<div className="text-lg font-bold">{player.ca.toFixed(1)}</div>
						</div>
						<div
							className="rounded-lg p-3 text-center"
							style={{ background: "hsl(var(--muted))" }}
						>
							<div className="text-xs text-muted-foreground mb-0.5">Potential</div>
							<div className="text-lg font-bold text-muted-foreground">{player.pa}</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export const Route = createFileRoute("/_app/player/$playerId")({
	component: PlayerDetailPage,
});
