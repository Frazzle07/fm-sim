import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	CalendarDays,
	ChevronRight,
	Inbox,
	Radar,
	Search,
	Trophy,
	Users,
	Bug,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";

export const NAV_ITEMS = [
	{
		id: "dashboard",
		label: "Home",
		icon: Inbox,
		to: "/dashboard",
	},
	{ id: "squad", label: "Squad", icon: Users, to: "/squad" },
	{
		id: "transfers",
		label: "Transfers",
		icon: ArrowLeftRight,
		to: "/transfers",
	},
	{
		id: "player-search",
		label: "Player Search",
		icon: Search,
		to: "/player-search",
	},
	{ id: "table", label: "League Table", icon: Trophy, to: "/table" },
	{ id: "schedule", label: "Schedule", icon: CalendarDays, to: "/schedule" },
	{ id: "scouting", label: "Scouting", icon: Radar, to: "/scouting" },
] as const;

export default function AppSidebar({
	playerTeam,
	game,
}: {
	playerTeam: Team | undefined;
	game: GameState;
}) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const navigate = useNavigate();

	const unreadCount = game.inbox.filter((m) => !m.read).length;

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="p-4">
				<div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
					<div
						className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
						style={{ background: playerTeam?.color ?? "#1a56db" }}
					>
						{playerTeam?.shortName?.slice(0, 2) ?? "FM"}
					</div>
					<div className="group-data-[collapsible=icon]:hidden min-w-0">
						<div className="font-semibold text-sm truncate">
							{playerTeam?.name ?? "FM Sim"}
						</div>
						<div className="text-xs text-muted-foreground">
							Wk {game.week} · S{game.season}
						</div>
					</div>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV_ITEMS.map((item) => {
								const Icon = item.icon;
								const active =
									pathname === item.to ||
									(item.to === "/squad" && pathname.startsWith("/squad/")) ||
									(item.to === "/transfers" &&
										pathname.startsWith("/transfers/"));
								const showBadge = item.id === "dashboard" && unreadCount > 0;
								return (
									<SidebarMenuItem key={item.id}>
										<SidebarMenuButton
											isActive={active}
											onClick={() => navigate({ to: item.to })}
											tooltip={item.label}
										>
											<Icon className="shrink-0" />
											<span>{item.label}</span>
											{showBadge && (
												<span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground group-data-[collapsible=icon]:hidden">
													{unreadCount}
												</span>
											)}
											{active && !showBadge && (
												<ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />
											)}
										</SidebarMenuButton>
										{showBadge && (
											<span className="pointer-events-none absolute top-1 right-1 h-2 w-2 rounded-full bg-primary hidden group-data-[collapsible=icon]:block" />
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="p-3">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={() => { window.location.href = "/debug/match"; }}
							tooltip="Match Debug"
						>
							<Bug className="shrink-0" />
							<span className="text-muted-foreground">Match Debug</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
