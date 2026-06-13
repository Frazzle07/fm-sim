export interface ZoneConfig {
	xMin: number;
	xMax: number;
	/** Y-band at deepest own-half ball position (home perspective). */
	yMinDeep: number;
	/** Y-band at deepest opposition-half ball position (home perspective). */
	yMinHigh: number;
	yMaxDeep: number;
	yMaxHigh: number;
	/**
	 * How far ahead of the ball (in attacking direction, 0–1 pitch units) this
	 * role ideally positions itself. Positive = ahead, negative = behind.
	 * Used instead of a shared depth-alignment metric so each role maintains
	 * its own depth relative to the ball rather than collapsing to ball depth.
	 */
	idealBallOffset: number;
	/**
	 * Drive Tendency (0–1): the probability this role engages **Drive** (the
	 * burst gear) when the situation invites it — a close defender plus open
	 * space ahead. High for wide attackers, low for centre-backs. Role gates the
	 * *likelihood* of sprinting with the ball, never the top speed (which is the
	 * player's Pace). See the **Drive Tendency** glossary entry.
	 */
	driveTendency: number;
	/**
	 * Carry Tendency (0–1): how willing this role is to carry the ball *at all*,
	 * applied as a multiplier on the carry's Expected Gain in the **Ball Action
	 * Arbiter**. Distinct from **Drive Tendency** (which only chooses how fast a
	 * carry already underway goes): this scales whether the carry wins the
	 * pass-vs-dribble decision in the first place. 1.0 = carry freely; low values
	 * make any half-decent pass outscore the carry, so the role only dribbles when
	 * no pass clears the bar. Roles with no config (notably the GK) default low —
	 * goalkeepers distribute by passing, dribbling only as a last resort.
	 */
	carryTendency: number;
}
