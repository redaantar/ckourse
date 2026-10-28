export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
export const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
export const SNAPPY = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * Physical springs (see --spring-* in index.css). A spring curve is only correct at its
 * own settle time, so each comes with its duration: `${SPRING_SMOOTH}` already includes it.
 */
export const SPRING_SMOOTH = "680ms var(--spring-smooth)"; // no overshoot — progress, layout
export const SPRING_SNAPPY = "520ms var(--spring-snappy)"; // controls, toggles
export const SPRING_BOUNCY = "730ms var(--spring-bouncy)"; // earned moments only
