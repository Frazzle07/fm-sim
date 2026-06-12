import type { PlayerRole } from "../types";
import type { ZoneConfig } from "./types";
import { CAM } from "./CAM";
import { CDM } from "./CDM";
import { CF } from "./CF";
import { LB } from "./LB";
import { LCB } from "./LCB";
import { LCM } from "./LCM";
import { LW } from "./LW";
import { RB } from "./RB";
import { RCB } from "./RCB";
import { RCM } from "./RCM";
import { RW } from "./RW";
import { SS } from "./SS";

export type { ZoneConfig };

export const ROLE_ZONE_CONFIG: Partial<Record<PlayerRole, ZoneConfig>> = {
	LB,
	LCB,
	RCB,
	RB,
	LW,
	LCM,
	RCM,
	CDM,
	RW,
	CAM,
	CF,
	SS,
};
