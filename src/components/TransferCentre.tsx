import { useNavigate } from "@tanstack/react-router";
import type { TransferNegotiation } from "#/domains/transfer/types";
import type { GameState } from "#/GameState";
import { fmt } from "./shared";

interface TransferCentreProps {
	game: GameState;
	onWalkAway: (negotiationId: string) => void;
}

const STATUS_LABELS: Record<TransferNegotiation["status"], string> = {
	negotiating: "In Progress",
	accepted: "Completed",
	rejected: "Withdrawn",
	collapsed: "Collapsed",
};

const STATUS_COLORS: Record<TransferNegotiation["status"], string> = {
	negotiating: "#1a56db",
	accepted: "#0e9f6e",
	rejected: "#6b7280",
	collapsed: "#e02424",
};

function PatienceDots({ patience }: { patience: number }) {
	return (
		<span className="inline-flex gap-1 items-center">
			{Array.from({ length: 3 }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed positional dots
					key={i}
					className="inline-block w-2.5 h-2.5 rounded-full"
					style={{
						background:
							i < patience ? "#e02424" : "var(--color-border-tertiary)",
					}}
				/>
			))}
		</span>
	);
}

export default function TransferCentre({
	game,
	onWalkAway,
}: TransferCentreProps) {
	const navigate = useNavigate();
	const negotiations = game.transferNegotiations;

	const active = negotiations.filter((n) => n.status === "negotiating");
	const inactive = negotiations.filter((n) => n.status !== "negotiating");

	if (negotiations.length === 0) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Transfer Centre</h2>
					<button
						type="button"
						onClick={() => navigate({ to: "/player-search" })}
						className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground cursor-pointer border-none"
					>
						Search Players
					</button>
				</div>
				<div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
					No active negotiations. Use Player Search to approach a club.
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold">Transfer Centre</h2>
				<button
					type="button"
					onClick={() => navigate({ to: "/player-search" })}
					className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground cursor-pointer border-none"
				>
					Search Players
				</button>
			</div>

			{active.length > 0 && (
				<section className="space-y-2">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Active Negotiations
					</h3>
					<div className="space-y-2">
						{active.map((neg) => (
							<NegotiationCard
								key={neg.id}
								neg={neg}
								onOpen={() =>
									navigate({
										to: "/transfers/negotiate/$playerId",
										params: { playerId: neg.playerId },
									})
								}
								onWalkAway={() => onWalkAway(neg.id)}
							/>
						))}
					</div>
				</section>
			)}

			{inactive.length > 0 && (
				<section className="space-y-2">
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Recent Activity
					</h3>
					<div className="space-y-2">
						{inactive.map((neg) => (
							<NegotiationCard
								key={neg.id}
								neg={neg}
								onOpen={undefined}
								onWalkAway={undefined}
							/>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function NegotiationCard({
	neg,
	onOpen,
	onWalkAway,
}: {
	neg: TransferNegotiation;
	onOpen: (() => void) | undefined;
	onWalkAway: (() => void) | undefined;
}) {
	const lastRound = neg.rounds[neg.rounds.length - 1];
	const lastOffer = lastRound?.offerAmount;
	const lastCounter = lastRound?.counterAmount;

	return (
		<div className="rounded-lg border border-border p-3 flex items-center gap-4">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="font-medium text-sm truncate">{neg.playerName}</span>
					<span className="text-xs text-muted-foreground">
						from {neg.sellingTeamName}
					</span>
					<span
						className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
						style={{
							background: `${STATUS_COLORS[neg.status]}22`,
							color: STATUS_COLORS[neg.status],
						}}
					>
						{STATUS_LABELS[neg.status]}
					</span>
				</div>
				<div className="flex items-center gap-3 mt-1 flex-wrap">
					{lastOffer != null && (
						<span className="text-xs text-muted-foreground">
							Last offer:{" "}
							<span className="text-foreground font-medium">
								{fmt(lastOffer)}
							</span>
						</span>
					)}
					{lastCounter != null && (
						<span className="text-xs text-muted-foreground">
							Their price:{" "}
							<span className="text-foreground font-medium">
								{fmt(lastCounter)}
							</span>
						</span>
					)}
					{neg.status === "negotiating" && (
						<span className="text-xs text-muted-foreground flex items-center gap-1">
							Patience: <PatienceDots patience={neg.patience} />
						</span>
					)}
					{neg.status === "accepted" && lastOffer != null && (
						<span className="text-xs text-muted-foreground">
							Signed for{" "}
							<span className="text-green-600 font-medium">
								{fmt(lastOffer)}
							</span>
						</span>
					)}
				</div>
			</div>

			{onOpen && (
				<div className="flex items-center gap-2 shrink-0">
					<button
						type="button"
						onClick={onOpen}
						className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground border-none cursor-pointer whitespace-nowrap"
					>
						View
					</button>
					<button
						type="button"
						onClick={onWalkAway}
						className="text-xs px-2.5 py-1 rounded border border-border cursor-pointer bg-transparent text-muted-foreground hover:text-foreground whitespace-nowrap"
					>
						Walk Away
					</button>
				</div>
			)}
		</div>
	);
}
