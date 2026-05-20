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
import {
	FormDots,
	fmt,
	getPlayerBadges,
	PlayerBadgeStack,
	PosBadge,
} from "./shared";
import { Button } from "./ui/button";
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

interface SquadProps {
	game: GameState;
	onListForSale: (playerId: string) => void;
}

type SquadRow = Player & { age: number; isListed: boolean };

export default function Squad({ game, onListForSale }: SquadProps) {
	const team = game.teams.find((t) => t.id === game.playerTeamId);
	const navigate = useNavigate();

	const [sorting, setSorting] = useState<SortingState>([
		{ id: "ca", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");
	const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");

	const listedIds = useMemo(
		() => new Set(game.transferMarket.map((p) => p.id)),
		[game.transferMarket],
	);

	const data = useMemo<SquadRow[]>(() => {
		const players = team?.players ?? [];
		const filtered =
			posFilter === "ALL"
				? players
				: players.filter((p) => p.position === posFilter);
		return filtered.map((p) => ({
			...p,
			age: ageFromDob(p.dateOfBirth, game.currentDate),
			isListed: listedIds.has(p.id),
		}));
	}, [team, posFilter, game.currentDate, listedIds]);

	const columns = useMemo<ColumnDef<SquadRow>[]>(
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
					<div className="flex items-center gap-2 min-w-0">
						<span className="font-medium text-sm truncate">
							{row.original.name}
						</span>
						<PlayerBadgeStack badges={getPlayerBadges(row.original)} />
					</div>
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
			{
				accessorKey: "form",
				header: "Form",
				cell: ({ row }) => <FormDots form={row.original.form} />,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) =>
					row.original.isListed ? (
						<span className="text-xs text-green-600 whitespace-nowrap">
							Listed
						</span>
					) : (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onListForSale(row.original.id);
							}}
							className="text-xs px-2 py-1 border border-border rounded cursor-pointer bg-transparent text-muted-foreground hover:text-foreground whitespace-nowrap"
						>
							List
						</button>
					),
				enableSorting: false,
			},
		],
		[onListForSale],
	);

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
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() =>
										navigate({
											to: "/player/$playerId",
											params: { playerId: row.original.id },
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
							))
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
