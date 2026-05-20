import { useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "#/components/ui/sidebar";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import type { PendingAction } from "../GameContext";
import { NAV_ITEMS } from "./AppSidebar";
import SaveMenu from "./SaveMenu";

export default function AppHeader({
	game,
	playerTeam,
	onAdvanceDay,
	onLoad,
	pendingAction,
}: {
	game: GameState;
	playerTeam: Team | undefined;
	onAdvanceDay: () => void;
	onLoad: (state: GameState) => void;
	pendingAction: PendingAction | null;
}) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const activeLabel =
		NAV_ITEMS.find(
			(n) =>
				pathname === n.to ||
				(n.to === "/squad" && pathname.startsWith("/squad/")),
		)?.label ?? "";

	return (
		<header className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
			<SidebarTrigger className="shrink-0" />
			<div className="flex-1 min-w-0">
				<div className="font-semibold text-sm leading-tight">{activeLabel}</div>
				<div className="text-xs text-muted-foreground">
					{new Date(`${game.currentDate}T00:00:00Z`).toLocaleDateString(
						"en-GB",
						{
							weekday: "short",
							day: "numeric",
							month: "long",
							year: "numeric",
							timeZone: "UTC",
						},
					)}
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<div
					className="w-2.5 h-2.5 rounded-full"
					style={{ background: playerTeam?.color }}
				/>
				<span className="text-sm font-medium">{playerTeam?.shortName}</span>
				<button
					type="button"
					onClick={onAdvanceDay}
					disabled={pendingAction?.disabled}
					className={`ml-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${pendingAction ? "bg-red-600 text-white hover:bg-red-700" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
				>
					{pendingAction ? pendingAction.label : "Continue →"}
				</button>
				<SaveMenu game={game} onLoad={onLoad} />
			</div>
		</header>
	);
}
