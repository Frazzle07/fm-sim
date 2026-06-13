import type { Action, ActionContext } from "./types";

// The movement behaviour for the player a pass is currently inbound to. Highest
// priority while the ball is in flight, replacing the simulator's old practice
// of pinning the receiver in place. The receiver runs onto the Pass Target;
// once the ball goes loose, LooseBallAction takes over (the named receiver holds
// no special status then).
//
// The receiver always runs to the Pass Target — never short of it. Marking on
// the receiver's body is handled at pass time by PassAction's Lead Offset, which
// collapses the offset toward the receiver's feet when stepping into space
// wouldn't buy any. (An earlier "come short up the flight line" branch lived here
// but desynced ball and receiver: it moved the receiver back toward the passer
// while the ball still flew the full distance to the Pass Target, leaving the
// receiver stranded behind the ball on ~40% of receptions.)
export const ReceiveAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		const flight = ctx.ballFlight;
		if (flight === null) return false;
		return flight.receiverId === ctx.player.id;
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		// canExecute guarantees a flight for this player; guard for the type.
		const flight = ctx.ballFlight;
		if (flight === null) return { x: ctx.player.x, y: ctx.player.y };
		return { x: flight.toX, y: flight.toY };
	},
};
