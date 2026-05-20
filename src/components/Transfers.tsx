import { useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ageFromDob } from "#/domains/player/generator";
import type { Player, Position } from "#/domains/player/types";
import type { GameState } from "#/GameState";
import { fmt, PosBadge } from "./shared";
import { Button } from "./ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "./ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

interface TransfersProps {
	game: GameState;
	onStartNegotiation: (playerId: string, offerAmount: number) => void;
}

type MarketRow = Player & {
	age: number;
	teamId: string;
	teamName: string;
	hasActiveNegotiation: boolean;
};

export default function Transfers({
	game,
	onStartNegotiation,
}: TransfersProps) {
	const playerTeam = game.teams.find((t) => t.id === game.playerTeamId);
	const navigate = useNavigate();

	const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
	const [offerPlayerId, setOfferPlayerId] = useState<string | null>(null);
	const [offerInput, setOfferInput] = useState("");
	const [offerError, setOfferError] = useState("");
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "ca", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");

	const activeNegotiationPlayerIds = useMemo(
		() =>
			new Set(
				game.transferNegotiations
					.filter((n) => n.status === "negotiating")
					.map((n) => n.playerId),
			),
		[game.transferNegotiations],
	);

	const data = useMemo<MarketRow[]>(() => {
		const allPlayers = game.teams
			.filter((t) => t.id !== game.playerTeamId)
			.flatMap((t) =>
				t.players.map((p) => ({
					...p,
					age: ageFromDob(p.dateOfBirth, game.currentDate),
					teamId: t.id,
					teamName: t.name,
					hasActiveNegotiation: activeNegotiationPlayerIds.has(p.id),
				})),
			);
		return posFilter === "ALL"
			? allPlayers
			: allPlayers.filter((p) => p.position === posFilter);
	}, [game, posFilter, activeNegotiationPlayerIds]);

	const columns = useMemo<ColumnDef<MarketRow>[]>(
		() => [
			{
				accessorKey: "position",
				header: "Pos",
				cell: ({ row }) => <PosBadge pos={row.original.position} />,
				enableSorting: false,
			},
			{
				accessorKey: "name",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Name <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="font-medium text-sm">{row.original.name}</span>
				),
			},
			{
				accessorKey: "teamName",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Club <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.teamName}
					</span>
				),
			},
			{
				accessorKey: "age",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Age <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums">{row.original.age}</span>
				),
			},
			{
				accessorKey: "ca",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						CA <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums font-medium">
						{row.original.ca}
					</span>
				),
			},
			{
				accessorKey: "value",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Value <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums">
						{fmt(row.original.value)}
					</span>
				),
			},
			{
				accessorKey: "wage",
				header: ({ column }) => (
					<button
						type="button"
						className="flex items-center gap-1 hover:text-foreground"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Wage <ArrowUpDown className="h-3 w-3" />
					</button>
				),
				cell: ({ row }) => (
					<span className="text-sm tabular-nums">
						{fmt(row.original.wage)}/wk
					</span>
				),
			},
		],
		[],
	);

	function submitOffer(playerId: string) {
		const amount =
			Number.parseFloat(offerInput.replace(/[^0-9.]/g, "")) * 1_000_000;
		if (Number.isNaN(amount) || amount <= 0) {
			setOfferError("Enter a valid amount in millions.");
			return;
		}
		if (amount > (playerTeam?.budget ?? 0)) {
			setOfferError("Offer exceeds your budget.");
			return;
		}
		onStartNegotiation(playerId, amount);
		setOfferPlayerId(null);
		setOfferInput("");
		setOfferError("");
		navigate({
			to: "/transfers/negotiate/$playerId",
			params: { playerId },
		});
	}

	const table = useReactTable({
		data,
		columns,
		state: { sorting, columnFilters, columnVisibility, globalFilter },
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				{(["ALL", ...POSITIONS] as (Position | "ALL")[]).map((p) => (
					<button
						type="button"
						key={p}
						onClick={() => setPosFilter(p)}
						style={{
							padding: "4px 12px",
							borderRadius: 6,
							border: "0.5px solid var(--color-border-secondary)",
							background:
								posFilter === p
									? "var(--color-text-primary)"
									: "var(--color-background-primary)",
							color:
								posFilter === p
									? "var(--color-background-primary)"
									: "var(--color-text-primary)",
							cursor: "pointer",
							fontSize: 13,
						}}
					>
						{p}
					</button>
				))}

				<span className="text-xs text-muted-foreground self-center">
					Budget: {fmt(playerTeam?.budget ?? 0)}
				</span>

				<Input
					placeholder="Search players…"
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="h-8 w-48 text-sm ml-auto"
				/>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 text-sm">
							Columns <ChevronDown className="ml-1 h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{table
							.getAllColumns()
							.filter((col) => col.getCanHide())
							.map((col) => (
								<DropdownMenuCheckboxItem
									key={col.id}
									className="capitalize"
									checked={col.getIsVisible()}
									onCheckedChange={(v) => col.toggleVisibility(v)}
								>
									{col.id}
								</DropdownMenuCheckboxItem>
							))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{offerPlayerId &&
				(() => {
					const target = data.find((p) => p.id === offerPlayerId);
					if (!target) return null;
					return (
						<div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-2">
							<p className="text-sm font-medium">
								Make offer for {target.name}{" "}
								<span className="text-muted-foreground font-normal">
									— asking {fmt(target.value)}
								</span>
							</p>
							<div className="flex items-center gap-2">
								<Input
									value={offerInput}
									onChange={(e) => {
										setOfferInput(e.target.value);
										setOfferError("");
									}}
									placeholder="Amount (£m)"
									className="h-8 w-32 text-sm"
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter") submitOffer(offerPlayerId);
										if (e.key === "Escape") {
											setOfferPlayerId(null);
											setOfferInput("");
											setOfferError("");
										}
									}}
								/>
								<Button
									size="sm"
									className="h-8"
									onClick={() => submitOffer(offerPlayerId)}
								>
									Submit offer
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-8"
									onClick={() => {
										setOfferPlayerId(null);
										setOfferInput("");
										setOfferError("");
									}}
								>
									Cancel
								</Button>
							</div>
							{offerError && (
								<p className="text-xs text-destructive">{offerError}</p>
							)}
						</div>
					);
				})()}

			<div className="rounded-lg border border-border overflow-hidden">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((hg) => (
							<TableRow key={hg.id}>
								{hg.headers.map((header) => (
									<TableHead key={header.id} className="text-xs">
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row) => {
								const p = row.original;
								return (
									<ContextMenu key={row.id}>
										<ContextMenuTrigger asChild>
											<TableRow
												className="cursor-pointer hover:bg-muted/50"
												onClick={() =>
													navigate({
														to: "/player/$playerId",
														params: { playerId: p.id },
													})
												}
											>
												{row.getVisibleCells().map((cell) => (
													<TableCell key={cell.id} className="py-2">
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												))}
											</TableRow>
										</ContextMenuTrigger>
										<ContextMenuContent>
											<ContextMenuItem
												onSelect={() =>
													navigate({
														to: "/player/$playerId",
														params: { playerId: p.id },
													})
												}
											>
												View profile
											</ContextMenuItem>
											{p.hasActiveNegotiation ? (
												<ContextMenuItem
													onSelect={() =>
														navigate({
															to: "/transfers/negotiate/$playerId",
															params: { playerId: p.id },
														})
													}
												>
													Continue negotiation
												</ContextMenuItem>
											) : (
												<>
													<ContextMenuSeparator />
													<ContextMenuItem
														onSelect={() => {
															setOfferPlayerId(p.id);
															setOfferInput("");
															setOfferError("");
														}}
													>
														Approach player
													</ContextMenuItem>
												</>
											)}
										</ContextMenuContent>
									</ContextMenu>
								);
							})
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="text-center text-sm text-muted-foreground py-8"
								>
									No players found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

		</div>
	);
}
