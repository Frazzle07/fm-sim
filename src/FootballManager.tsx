import { Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { SidebarProvider } from "#/components/ui/sidebar";
import type { Player } from "#/domains/player/types";
import type { ScoutingAssignment } from "#/domains/scouting/types";
import type { Team } from "#/domains/team/types";
import type { ListedPlayer } from "#/domains/transfer/types";
import {
	acceptCounter,
	advanceDay,
	clearPendingLineup,
	getNextPlayerFixture,
	listPlayerForSale,
	markAllInboxRead,
	markInboxRead,
	processTransfer,
	setPendingLineup,
	startNegotiation,
	submitOffer,
	walkAway,
} from "#/game";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import { GameContext, type PendingAction } from "./GameContext";
import { useGameStore } from "./GameProvider";

export default function FootballManager() {
	const { game, updateGame, setGame } = useGameStore();
	const navigate = useNavigate();
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(
		null,
	);

	const teamMap = useMemo<Record<string, Team>>(
		() => Object.fromEntries((game?.teams ?? []).map((t) => [t.id, t])),
		[game?.teams],
	);

	const handleAdvanceDay = useCallback(() => {
		if (!game) return;

		if (pendingAction) {
			pendingAction.onConfirm();
			return;
		}

		const nextFixture = getNextPlayerFixture(game);
		if (nextFixture) {
			updateGame((g) => ({
				...g,
				currentDate: nextFixture.date,
				pendingFixtureId: nextFixture.id,
			}));
			navigate({ to: "/match/team-selection" });
			return;
		}

		updateGame((g) => {
			const { state } = advanceDay(g);
			return state;
		});
		navigate({ to: "/dashboard" });
	}, [game, pendingAction, updateGame, navigate]);

	const handleConfirmLineup = useCallback(
		(lineup: Player[]) => {
			updateGame((g) => {
				if (!g.pendingFixtureId) return g;
				const withLineup = setPendingLineup(g, g.pendingFixtureId, lineup);
				const { state } = advanceDay({
					...withLineup,
					currentDate: (() => {
						const d = new Date(withLineup.currentDate);
						d.setUTCDate(d.getUTCDate() - 1);
						return d.toISOString().slice(0, 10);
					})(),
				});
				return clearPendingLineup(state);
			});
		},
		[updateGame],
	);

	const handleListForSale = useCallback(
		(playerId: string) => {
			updateGame((g) => listPlayerForSale(g, playerId, g.playerTeamId));
		},
		[updateGame],
	);

	const handleBuy = useCallback(
		(player: ListedPlayer) => {
			updateGame((g) =>
				processTransfer(
					g,
					{
						id: `offer-${player.id}`,
						playerId: player.id,
						fromTeamId: player.teamId,
						toTeamId: g.playerTeamId,
						amount: player.value,
						status: "pending",
					},
					true,
				),
			);
		},
		[updateGame],
	);

	const handleMarkInboxRead = useCallback(
		(messageId: string) => {
			updateGame((g) => markInboxRead(g, messageId));
		},
		[updateGame],
	);

	const handleMarkAllInboxRead = useCallback(() => {
		updateGame((g) => markAllInboxRead(g));
	}, [updateGame]);

	const handleCreateAssignment = useCallback(
		(assignment: Omit<ScoutingAssignment, "id" | "scoutedPlayers">) => {
			updateGame((g) => {
				if (g.scoutingAssignments.length >= 3) return g;
				const newAssignment: ScoutingAssignment = {
					...assignment,
					id: `scout-${Date.now()}`,
					scoutedPlayers: [],
				};
				return {
					...g,
					scoutingAssignments: [...g.scoutingAssignments, newAssignment],
				};
			});
		},
		[updateGame],
	);

	const handleCancelAssignment = useCallback(
		(id: string) => {
			updateGame((g) => ({
				...g,
				scoutingAssignments: g.scoutingAssignments.filter((a) => a.id !== id),
			}));
		},
		[updateGame],
	);

	const handleStartNegotiation = useCallback(
		(playerId: string, offerAmount: number) => {
			updateGame((g) => startNegotiation(g, playerId, offerAmount));
		},
		[updateGame],
	);

	const handleSubmitOffer = useCallback(
		(negotiationId: string, offerAmount: number) => {
			updateGame((g) => submitOffer(g, negotiationId, offerAmount));
		},
		[updateGame],
	);

	const handleAcceptCounter = useCallback(
		(negotiationId: string) => {
			updateGame((g) => acceptCounter(g, negotiationId));
		},
		[updateGame],
	);

	const handleWalkAway = useCallback(
		(negotiationId: string) => {
			updateGame((g) => walkAway(g, negotiationId));
		},
		[updateGame],
	);

	if (!game) return null;

	const playerTeam = teamMap[game.playerTeamId];

	const ctx = {
		game,
		teamMap,
		pendingAction,
		setPendingAction,
		onAdvanceDay: handleAdvanceDay,
		onConfirmLineup: handleConfirmLineup,
		onListForSale: handleListForSale,
		onBuy: handleBuy,
		onMarkInboxRead: handleMarkInboxRead,
		onMarkAllInboxRead: handleMarkAllInboxRead,
		onCreateAssignment: handleCreateAssignment,
		onCancelAssignment: handleCancelAssignment,
		onStartNegotiation: handleStartNegotiation,
		onSubmitOffer: handleSubmitOffer,
		onAcceptCounter: handleAcceptCounter,
		onWalkAway: handleWalkAway,
	};

	return (
		<GameContext.Provider value={ctx}>
			<SidebarProvider defaultOpen={false}>
				<div className="flex h-screen w-full overflow-hidden">
					<AppSidebar playerTeam={playerTeam} game={game} />

					<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
						<AppHeader
							game={game}
							playerTeam={playerTeam}
							onAdvanceDay={handleAdvanceDay}
							onLoad={setGame}
							pendingAction={pendingAction}
						/>

						<main className="flex-1 overflow-y-auto p-4">
							<div className="max-w-5xl mx-auto space-y-4">
								<Outlet />
							</div>
						</main>
					</div>
				</div>
			</SidebarProvider>
		</GameContext.Provider>
	);
}
