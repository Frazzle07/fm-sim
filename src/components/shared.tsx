import { useState } from "react";
import type { Player, Position } from "#/domains/player/types";

export const fmt = (n: number): string =>
	n >= 1e6
		? `£${(n / 1e6).toFixed(1)}m`
		: n >= 1e3
			? `£${(n / 1e3).toFixed(0)}k`
			: `£${n}`;

export function PosBadge({ pos }: { pos: Position }) {
	const colors: Record<Position, string> = {
		GK: "#9061f9",
		DEF: "#0e9f6e",
		MID: "#1a56db",
		FWD: "#e02424",
	};
	return (
		<span
			style={{
				background: `${colors[pos]}22`,
				color: colors[pos],
				border: `1px solid ${colors[pos]}44`,
				borderRadius: 4,
				padding: "1px 6px",
				fontSize: 11,
				fontWeight: 500,
			}}
		>
			{pos}
		</span>
	);
}

export interface BadgeSpec {
	label: string;
	color: string;
}

export function PlayerBadgeStack({ badges }: { badges: BadgeSpec[] }) {
	const [hovered, setHovered] = useState<number | null>(null);
	if (badges.length === 0) return null;

	return (
		<span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
			{badges.map((badge, i) => (
				<button
					type="button"
					key={badge.label}
					onMouseEnter={() => setHovered(i)}
					onMouseLeave={() => setHovered(null)}
					style={{
						position: "relative",
						display: "inline-flex",
						background: "none",
						border: "none",
						padding: 0,
						cursor: "default",
					}}
				>
					<span
						style={{
							width: 10,
							height: 10,
							borderRadius: "50%",
							background: badge.color,
							display: "inline-block",
						}}
					/>
					{hovered === i && (
						<span
							style={{
								position: "absolute",
								bottom: "calc(100% + 5px)",
								left: "50%",
								transform: "translateX(-50%)",
								background: "var(--color-background-primary)",
								color: badge.color,
								border: `1px solid ${badge.color}66`,
								borderRadius: 4,
								padding: "2px 7px",
								fontSize: 11,
								fontWeight: 500,
								whiteSpace: "nowrap",
								pointerEvents: "none",
								zIndex: 20,
								boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
							}}
						>
							{badge.label}
						</span>
					)}
				</button>
			))}
		</span>
	);
}

export function getPlayerBadges(player: Player): BadgeSpec[] {
	const badges: BadgeSpec[] = [];
	if (player.injured) {
		const weeks = player.injuryWeeks > 0 ? ` ${player.injuryWeeks}w` : "";
		badges.push({ label: `Injured${weeks}`, color: "#e02424" });
	}

	return badges;
}

export function FormDots({ form }: { form: number }) {
	return (
		<span style={{ display: "inline-flex", gap: 3 }}>
			{Array.from({ length: 10 }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: dots are fixed positional elements
					key={i}
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: i < form ? "#0e9f6e" : "var(--color-border-tertiary)",
					}}
				/>
			))}
		</span>
	);
}
