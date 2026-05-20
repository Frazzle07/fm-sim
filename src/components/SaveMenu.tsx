import { useCallback, useEffect, useState } from "react";
import type { GameState } from "#/GameState";
import {
	deleteSave,
	listSaves,
	loadGame,
	saveGame,
	type SaveMeta,
} from "#/persistence";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface SaveMenuProps {
	game: GameState;
	onLoad: (state: GameState) => void;
}

export default function SaveMenu({ game, onLoad }: SaveMenuProps) {
	const [saves, setSaves] = useState<(SaveMeta | null)[]>([null, null, null]);
	const [open, setOpen] = useState(false);

	const refresh = useCallback(() => setSaves(listSaves()), []);

	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);

	const handleSave = (slot: number) => {
		saveGame(slot, game);
		refresh();
	};

	const handleLoad = (slot: number) => {
		const state = loadGame(slot);
		if (state) {
			onLoad(state);
			setOpen(false);
		}
	};

	const handleDelete = (slot: number, e: React.MouseEvent) => {
		e.stopPropagation();
		deleteSave(slot);
		refresh();
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="px-2 py-1.5 text-xs font-semibold rounded-md transition-colors bg-muted hover:bg-muted/80 text-muted-foreground"
					aria-label="Save / Load"
				>
					⋯
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>Save Slots</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{saves.map((meta, i) => (
					<div key={i}>
						<DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 pt-1">
							Slot {i + 1}
						</DropdownMenuLabel>
						{meta ? (
							<div className="px-2 pb-1">
								<div className="flex items-center gap-2 mb-1">
									<div
										className="w-2 h-2 rounded-full shrink-0"
										style={{ background: meta.teamColor }}
									/>
									<span className="text-xs font-medium">{meta.teamName}</span>
									<span className="text-xs text-muted-foreground ml-auto">
										S{meta.season} W{meta.week}
									</span>
								</div>
								<div className="text-xs text-muted-foreground mb-1.5">
									{new Date(meta.savedAt).toLocaleString("en-GB", {
										day: "numeric",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
								<div className="flex gap-1">
									<DropdownMenuItem
										className="flex-1 justify-center text-xs cursor-pointer"
										onSelect={() => handleSave(i)}
									>
										Overwrite
									</DropdownMenuItem>
									<DropdownMenuItem
										className="flex-1 justify-center text-xs cursor-pointer"
										onSelect={() => handleLoad(i)}
									>
										Load
									</DropdownMenuItem>
									<DropdownMenuItem
										className="flex-1 justify-center text-xs text-destructive cursor-pointer"
										onSelect={(e) => handleDelete(i, e as unknown as React.MouseEvent)}
									>
										Delete
									</DropdownMenuItem>
								</div>
							</div>
						) : (
							<DropdownMenuItem
								className="mx-2 mb-1 text-xs cursor-pointer"
								onSelect={() => handleSave(i)}
							>
								Save to this slot
							</DropdownMenuItem>
						)}
						{i < 2 && <DropdownMenuSeparator />}
					</div>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
