import type { Action, ActionContext } from "./types";

// The movement behaviour for the player a pass is currently inbound to. Runs in
// two phases while the ball is in flight:
//   1. Anticipate — the receiver runs to the Control Point (the Pass Target
//      proper: receiver + Lead Offset), NOT the Overshoot Point the ball is aimed
//      at. They get to the space ahead of the ball.
//   2. Chase — once the ball has overrun PAST the Control Point (it is still
//      flying toward the Overshoot Point), the receiver chases the ball's live
//      position so a ball played into space converges on an interception point
//      rather than being abandoned at a static spot.
// The simulator controls the ball only when the receiver is genuinely on top of
// its live position, so the ball never snaps to the player. If it reaches the X
// untouched it eases to rest and goes loose; LooseBallAction then takes over.
export const ReceiveAction: Action = {
	canExecute(ctx: ActionContext): boolean {
		// Active only while a ball is in flight to this player.
		if (ctx.ballFlight === null) return false;
		return ctx.ballFlight.receiverId === ctx.player.id;
	},

	execute(ctx: ActionContext): { x: number; y: number } {
		const flight = ctx.ballFlight;
		if (flight === null) return { x: ctx.player.x, y: ctx.player.y };
		// Has the ball overrun past the Control Point? Compare each point's distance
		// from the passer origin along the flight line.
		const ballDist = Math.hypot(
			ctx.ball.x - flight.fromX,
			ctx.ball.y - flight.fromY,
		);
		const controlDist = Math.hypot(
			flight.controlX - flight.fromX,
			flight.controlY - flight.fromY,
		);
		if (ballDist >= controlDist) {
			// Phase 2 — chase the live ball as it runs into space.
			return { x: ctx.ball.x, y: ctx.ball.y };
		}
		// Phase 1 — get to the Control Point ahead of the ball.
		return { x: flight.controlX, y: flight.controlY };
	},
};
