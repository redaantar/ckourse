import level1 from "@/assets/icons/level_1.svg";
import level2 from "@/assets/icons/level_2.svg";
import level3 from "@/assets/icons/level_3.svg";
import level4 from "@/assets/icons/level_4.svg";

export interface LevelInfo {
  level: number;
  name: string;
  /** Completed lessons needed to reach this level. */
  threshold: number;
  icon: string;
}

// Keep thresholds in sync with LEVEL_THRESHOLDS in src-tauri/src/db.rs.
export const LEVELS: LevelInfo[] = [
  { level: 1, name: "Beginner", threshold: 0, icon: level1 },
  { level: 2, name: "Explorer", threshold: 25, icon: level2 },
  { level: 3, name: "Achiever", threshold: 150, icon: level3 },
  { level: 4, name: "Master", threshold: 500, icon: level4 },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevelInfo(level: number): LevelInfo {
  return LEVELS[Math.min(Math.max(level, 1), MAX_LEVEL) - 1];
}

/** Fraction (0–1) of the way from the current level to the next. */
export function getLevelFraction(level: number, lessonsToNext: number): number {
  if (level >= MAX_LEVEL) return 1;
  const total = LEVELS[level].threshold - getLevelInfo(level).threshold;
  return (total - lessonsToNext) / total;
}
