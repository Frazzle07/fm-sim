import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ageFromDob } from "#/domains/player/generator";
import type { GameState } from "#/GameState";
import { fmt, PosBadge } from "./shared";
import { Input } from "./ui/input";

interface NegotiationThreadProps {
	game: GameState;
	playerId: string;
	onSubmitOffer: (negotiationId: string, amount: number) => void;
	onAcceptCounter: (negotiationId: string) => void;
	onWalkAway: (negotiationId: string) => void;
}

function PatienceDots({
	patience,
	max = 3,
}: {
	patience: number;
	max?: number;
}) {
	return (
		<span className="inline-flex gap-1.5 items-center">
			{Array.from({ length: max }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed positional dots
					key={i}
					className="inline-block w-3 h-3 rounded-full transition-colors"
					style={{
						background:
							i < patience ? "#e02424" : "var(--color-border-tertiary)",
					}}
				/>
			))}
		</span>
	);
}

export default function NegotiationThread({
	game,
	playerId,
	onSubmitOffer,
	onAcceptCounter,
	onWalkAway,
}: NegotiationThreadProps) {
	const navigate = useNavigate();
	const [offerInput, setOfferInput] = useState("");
	const [offerError, setOfferError] = useState("");

	const neg = game.transferNegotiations.find((n) => n.playerId === playerId);
	const playerTeam = game.teams.find((t) => t.id === game.playerTeamId);
	const sellingTeam = neg
		? game.teams.find((t) => t.id === neg.sellingTeamId)
		: null;
	const player =
		sellingTeam?.players.find((p) => p.id === playerId) ??
		game.teams.flatMap((t) => t.players).find((p) => p.id === playerId);

	if (!neg || !player) {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={() => navigate({ to: "/transfers" })}
					className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
				>
					<ArrowLeft className="h-4 w-4" /> Back to Transfer Centre
				</button>
				<p className="text-sm text-muted-foreground">Negotiation not found.</p>
			</div>
		);
	}

	const isActive = neg.status === "negotiating";
	const awaitingClub = isActive && neg.responseDueDate !== null;
	const awaitingPlayer =
		isActive && neg.responseDueDate === null && neg.rounds.length > 0;

	function handleSubmit() {
		const amount =
			Number.parseFloat(offerInput.replace(/[^0-9.]/g, "")) * 1_000_000;
		if (Number.isNaN(amount) || amount <= 0) {
			setOfferError("Enter a valid amount in millions (e.g. 3.5).");
			return;
		}
		if (amount > (playerTeam?.budget ?? 0)) {
			setOfferError("Offer exceeds your budget.");
			return;
		}
		onSubmitOffer(neg.id, amount);
		setOfferInput("");
		setOfferError("");
	}

	const age = ageFromDob(player.dateOfBirth, game.currentDate);

	return (
		<div className="space-y-5 max-w-2xl">
			{/* Back link */}
			<button
				type="button"
				onClick={() => navigate({ to: "/transfers" })}
				className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
			>
				<ArrowLeft className="h-4 w-4" /> Transfer Centre
			</button>

			{/* Player summary */}
			<div className="rounded-lg border border-border p-4 flex items-start gap-4">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-semibold text-base">{player.name}</span>
						<PosBadge pos={player.position} />
						<span className="text-sm text-muted-foreground">
							{age}y · {neg.sellingTeamName}
						</span>
					</div>
					<div className="flex items-center gap-4 mt-1 text-sm">
						<span className="text-muted-foreground">
							CA{" "}
							<span className="text-foreground font-medium">{player.ca}</span>
						</span>
						<span className="text-muted-foreground">
							Value{" "}
							<span className="text-foreground font-medium">
								{fmt(player.value)}
							</span>
						</span>
						<span className="text-muted-foreground">
							Wage{" "}
							<span className="text-foreground font-medium">
								{fmt(player.wage)}/wk
							</span>
						</span>
					</div>
				</div>
				<div className="text-right text-xs text-muted-foreground">
					<div>Your budget</div>
					<div className="text-foreground font-semibold text-sm">
						{fmt(playerTeam?.budget ?? 0)}
					</div>
				</div>
			</div>

			{/* Status bar */}
			{isActive && (
				<div className="rounded-lg border border-border p-3 flex items-center gap-4 bg-muted/30">
					<div className="flex-1 text-sm">
						<span className="text-muted-foreground">Their asking price: </span>
						<span className="font-semibold">{fmt(neg.currentAskingPrice)}</span>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<span className="text-muted-foreground text-xs">Club patience</span>
						<PatienceDots patience={neg.patience} />
					</div>
				</div>
			)}

			{/* Conversation thread */}
			<div className="space-y-3">
				{neg.rounds.map((round, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rounds are ordered positional entries
					<div key={`round-${i}`} className="space-y-2">
						{/* Player offer */}
						<div className="flex justify-end">
							<div className="max-w-sm rounded-lg rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm">
								<div className="text-xs opacity-70 mb-1">
									Your offer · {round.date}
								</div>
								<div className="font-semibold">{fmt(round.offerAmount)}</div>
							</div>
						</div>

						{/* Club response */}
						{round.clubMessage ? (
							<div className="flex justify-start">
								<div className="max-w-sm rounded-lg rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-sm">
									<div className="text-xs text-muted-foreground mb-1">
										{neg.sellingTeamName}
									</div>
									<div className="text-foreground">{round.clubMessage}</div>
									{round.counterAmount !== null && (
										<div className="mt-1.5 font-semibold">
											{fmt(round.counterAmount)}
										</div>
									)}
								</div>
							</div>
						) : awaitingClub && i === neg.rounds.length - 1 ? (
							<div className="flex justify-start">
								<div className="max-w-sm rounded-lg rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-sm text-muted-foreground italic">
									Awaiting response from {neg.sellingTeamName}… (advance a day)
								</div>
							</div>
						) : null}
					</div>
				))}

				{neg.status === "accepted" && (
					<div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-300 text-center font-medium">
						Transfer complete — {player.name} has joined your squad.
					</div>
				)}

				{neg.status === "collapsed" && (
					<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300 text-center font-medium">
						Negotiations have collapsed.
					</div>
				)}

				{neg.status === "rejected" && (
					<div className="rounded-lg border border-border p-3 text-sm text-muted-foreground text-center">
						You withdrew from negotiations.
					</div>
				)}
			</div>

			{/* Action area */}
			{awaitingPlayer && (
				<div className="rounded-lg border border-border p-4 space-y-3">
					<div className="text-sm font-medium">
						Make a new offer or accept their price
					</div>

					{/* Accept counter */}
					{neg.currentAskingPrice <= (playerTeam?.budget ?? 0) && (
						<button
							type="button"
							onClick={() => onAcceptCounter(neg.id)}
							className="w-full text-sm px-3 py-2 rounded bg-green-600 text-white border-none cursor-pointer font-medium"
						>
							Accept {fmt(neg.currentAskingPrice)} (their asking price)
						</button>
					)}

					{/* New offer */}
					<div className="space-y-1.5">
						<div className="flex gap-2">
							<Input
								value={offerInput}
								onChange={(e) => {
									setOfferInput(e.target.value);
									setOfferError("");
								}}
								placeholder="Offer amount (£m, e.g. 3.5)"
								className="h-9 text-sm flex-1"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSubmit();
								}}
							/>
							<button
								type="button"
								onClick={handleSubmit}
								className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground border-none cursor-pointer whitespace-nowrap"
							>
								Submit Offer
							</button>
						</div>
						{offerError && <p className="text-xs text-red-500">{offerError}</p>}
					</div>

					{/* Walk away */}
					<button
						type="button"
						onClick={() => onWalkAway(neg.id)}
						className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 underline"
					>
						Walk away from this negotiation
					</button>
				</div>
			)}

			{awaitingClub && (
				<p className="text-xs text-muted-foreground text-center">
					Advance a day to receive the club's response.
				</p>
			)}
		</div>
	);
}
