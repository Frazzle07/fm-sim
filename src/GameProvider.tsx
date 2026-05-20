import { createContext, useContext, useState } from "react";
import type { GameState } from "#/GameState";

interface GameStoreValue {
	game: GameState | null;
	setGame: (game: GameState) => void;
	updateGame: (updater: (g: GameState) => GameState) => void;
}

const GameStoreContext = createContext<GameStoreValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
	const [game, setGameState] = useState<GameState | null>(null);

	const setGame = (g: GameState) => setGameState(g);
	const updateGame = (updater: (g: GameState) => GameState) =>
		setGameState((g) => (g ? updater(g) : g));

	return (
		<GameStoreContext.Provider value={{ game, setGame, updateGame }}>
			{children}
		</GameStoreContext.Provider>
	);
}

export function useGameStore(): GameStoreValue {
	const ctx = useContext(GameStoreContext);
	if (!ctx) throw new Error("useGameStore must be used within GameProvider");
	return ctx;
}
