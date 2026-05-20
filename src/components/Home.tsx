import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { InboxMessage, TrainingPerformer } from "#/GameState";
import { useGame } from "../GameContext";

function formatDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

const CATEGORY_COLORS: Record<InboxMessage["category"], string> = {
	match: "#1a56db",
	transfer: "#0e9f6e",
	league: "#9333ea",
	general: "#6b7280",
};

const CATEGORY_LABELS: Record<InboxMessage["category"], string> = {
	match: "Match",
	transfer: "Transfer",
	league: "League",
	general: "News",
};

function PerformerRow({ p, positive }: { p: TrainingPerformer; positive: boolean }) {
	const color = positive ? "#16a34a" : "#dc2626";
	const sign = p.delta > 0 ? "+" : "";
	return (
		<Link
			to="/player/$playerId"
			params={{ playerId: p.playerId }}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "6px 10px",
				borderRadius: 7,
				background: `${color}10`,
				border: `1px solid ${color}30`,
				textDecoration: "none",
				color: "inherit",
			}}
		>
			<span style={{ fontSize: 13 }}>
				<span style={{ fontWeight: 600 }}>{p.name}</span>{" "}
				<span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
					{p.position}
				</span>
			</span>
			<span
				style={{
					fontSize: 12,
					fontWeight: 700,
					color,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{sign}{p.delta.toFixed(2)} CA
			</span>
		</Link>
	);
}

function TrainingReportBody({
	topPerformers,
	bottomPerformers,
}: {
	topPerformers: TrainingPerformer[];
	bottomPerformers: TrainingPerformer[];
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
			{topPerformers.length > 0 && (
				<div>
					<div
						style={{
							fontSize: 11,
							fontWeight: 700,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "#16a34a",
							marginBottom: 6,
						}}
					>
						Top performers
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{topPerformers.map((p) => (
							<PerformerRow key={p.playerId} p={p} positive={true} />
						))}
					</div>
				</div>
			)}
			{bottomPerformers.length > 0 && (
				<div>
					<div
						style={{
							fontSize: 11,
							fontWeight: 700,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "#dc2626",
							marginBottom: 6,
						}}
					>
						Underperformers / declines
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{bottomPerformers.map((p) => (
							<PerformerRow key={p.playerId} p={p} positive={false} />
						))}
					</div>
				</div>
			)}
			{topPerformers.length === 0 && bottomPerformers.length === 0 && (
				<div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
					No notable changes this week.
				</div>
			)}
		</div>
	);
}

export default function Home() {
	const { game, onMarkInboxRead, onMarkAllInboxRead } = useGame();
	const [selectedId, setSelectedId] = useState<string | null>(
		game.inbox[0]?.id ?? null,
	);

	const unreadCount = game.inbox.filter((m) => !m.read).length;
	const selected = game.inbox.find((m) => m.id === selectedId) ?? null;

	function handleSelect(msg: InboxMessage) {
		setSelectedId(msg.id);
		if (!msg.read) onMarkInboxRead(msg.id);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 12,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ fontSize: 13, fontWeight: 600 }}>Inbox</span>
					{unreadCount > 0 && (
						<span
							style={{
								fontSize: 11,
								fontWeight: 600,
								background: "#1a56db",
								color: "#fff",
								borderRadius: 10,
								padding: "1px 7px",
							}}
						>
							{unreadCount}
						</span>
					)}
				</div>
				{unreadCount > 0 && (
					<button
						type="button"
						onClick={onMarkAllInboxRead}
						style={{
							fontSize: 11,
							color: "var(--color-text-secondary)",
							background: "transparent",
							border: "none",
							cursor: "pointer",
							padding: 0,
						}}
					>
						Mark all read
					</button>
				)}
			</div>

			{/* Two-column layout */}
			{game.inbox.length === 0 ? (
				<div
					style={{
						fontSize: 13,
						color: "var(--color-text-secondary)",
						padding: "12px 0",
					}}
				>
					No messages yet.
				</div>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "260px 1fr",
						gap: 12,
						flex: 1,
						minHeight: 0,
					}}
				>
					{/* Message list */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 4,
							overflowY: "auto",
						}}
					>
						{game.inbox.map((msg) => {
							const isSelected = msg.id === selectedId;
							return (
								<button
									type="button"
									key={msg.id}
									onClick={() => handleSelect(msg)}
									style={{
										display: "flex",
										alignItems: "flex-start",
										gap: 8,
										padding: "9px 10px",
										border: isSelected
											? "0.5px solid var(--color-border-secondary)"
											: "0.5px solid var(--color-border-tertiary)",
										borderRadius: 9,
										background: isSelected
											? "var(--color-background-secondary)"
											: msg.read
												? "var(--color-background-primary)"
												: "var(--color-background-secondary)",
										cursor: "pointer",
										textAlign: "left",
										width: "100%",
										flexShrink: 0,
									}}
								>
									<div
										style={{
											width: 6,
											height: 6,
											borderRadius: "50%",
											background: msg.read
												? "transparent"
												: CATEGORY_COLORS[msg.category],
											flexShrink: 0,
											marginTop: 4,
										}}
									/>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 5,
												marginBottom: 2,
											}}
										>
											<span
												style={{
													fontSize: 10,
													fontWeight: 500,
													color: CATEGORY_COLORS[msg.category],
												}}
											>
												{CATEGORY_LABELS[msg.category]}
											</span>
											<span
												style={{
													fontSize: 10,
													color: "var(--color-text-secondary)",
												}}
											>
												{formatDate(msg.date)}
											</span>
										</div>
										<div
											style={{
												fontSize: 12,
												fontWeight: msg.read ? 400 : 600,
												marginBottom: 2,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{msg.title}
										</div>
										<div
											style={{
												fontSize: 11,
												color: "var(--color-text-secondary)",
												overflow: "hidden",
												display: "-webkit-box",
												WebkitLineClamp: 1,
												WebkitBoxOrient: "vertical",
											}}
										>
											{msg.body}
										</div>
									</div>
								</button>
							);
						})}
					</div>

					{/* Full message */}
					<div
						style={{
							border: "0.5px solid var(--color-border-tertiary)",
							borderRadius: 10,
							padding: "16px 18px",
							overflowY: "auto",
						}}
					>
						{selected ? (
							<>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										marginBottom: 10,
									}}
								>
									<span
										style={{
											fontSize: 11,
											fontWeight: 500,
											color: CATEGORY_COLORS[selected.category],
										}}
									>
										{CATEGORY_LABELS[selected.category]}
									</span>
									<span
										style={{
											fontSize: 11,
											color: "var(--color-text-secondary)",
										}}
									>
										{formatDate(selected.date)}
									</span>
								</div>
								<div
									style={{
										fontSize: 14,
										fontWeight: 600,
										marginBottom: 12,
										lineHeight: 1.4,
									}}
								>
									{selected.title}
								</div>
								{selected.trainingData ? (
									<TrainingReportBody
										topPerformers={selected.trainingData.topPerformers}
										bottomPerformers={selected.trainingData.bottomPerformers}
									/>
								) : (
									<div
										style={{
											fontSize: 13,
											color: "var(--color-text-secondary)",
											lineHeight: 1.6,
											whiteSpace: "pre-wrap",
										}}
									>
										{selected.body}
									</div>
								)}
							</>
						) : (
							<div
								style={{
									fontSize: 13,
									color: "var(--color-text-secondary)",
								}}
							>
								Select a message to read it.
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
