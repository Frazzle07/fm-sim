import { nearest } from "./queries";
import type { XY } from "./types";

export interface PassContext {
	from: XY;
	teammates: XY[];
}

// Passes to the nearest teammate. Returns their position (the new ball location).
export function passToNearestTeammate(ctx: PassContext): XY {
	return nearest(ctx.from, ctx.teammates);
}
