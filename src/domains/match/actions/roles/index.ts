import type { PlayerRole } from "../types";
import type { ZoneConfig } from "./types";
import { LW } from "./LW";
import { RW } from "./RW";

export type { ZoneConfig };

export const ROLE_ZONE_CONFIG: Partial<Record<PlayerRole, ZoneConfig>> = {
	LW,
	RW,
};
