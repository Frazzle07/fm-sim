import type { PlayerRole } from "../types";
import type { ZoneConfig } from "./types";
import { CAM } from "./CAM";
import { CB } from "./CB";
import { CDM } from "./CDM";
import { CF } from "./CF";
import { CM } from "./CM";
import { LB } from "./LB";
import { LW } from "./LW";
import { RB } from "./RB";
import { RW } from "./RW";

export type { ZoneConfig };

export const ROLE_ZONE_CONFIG: Partial<Record<PlayerRole, ZoneConfig>> = {
	LB,
	CB,
	RB,
	LW,
	CM,
	CDM,
	RW,
	CAM,
	CF,
};
