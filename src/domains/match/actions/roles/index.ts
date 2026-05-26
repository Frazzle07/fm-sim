import type { PlayerRole } from "../types";
import type { ZoneConfig } from "./types";
import { LB } from "./LB";
import { LW } from "./LW";
import { RB } from "./RB";
import { RW } from "./RW";

export type { ZoneConfig };

export const ROLE_ZONE_CONFIG: Partial<Record<PlayerRole, ZoneConfig>> = {
	LB,
	RB,
	LW,
	RW,
};
