import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { LEVELS, MAX_LEVEL, getLevelFraction, getLevelInfo } from "@/lib/levels";
import { ProgressRing } from "@/components/ui/progress-ring";

interface LevelSummaryProps {
  stats: DashboardStats;
  className?: string;
}

/**
 * Where you are and what's next, in one glance: a ring for progress within the
 * current level beside the four-step journey showing the whole climb.
 */
export function LevelSummary({ stats, className }: LevelSummaryProps) {
  const level = stats.userLevel;
  const { name } = getLevelInfo(level);
  const atMax = level >= MAX_LEVEL;
  const pct = getLevelFraction(level, stats.lessonsToNextLevel) * 100;
  const next = atMax ? null : getLevelInfo(level + 1);

  // Journey line: each segment is an equal share; fill up to the current level plus progress within it
  const journeyPct = atMax ? 100 : ((level - 1 + pct / 100) / (MAX_LEVEL - 1)) * 100;

  return (
    <div className={cn("flex flex-col gap-8 md:flex-row md:items-center md:gap-12", className)}>
      <div className="flex shrink-0 items-center gap-5">
        <ProgressRing value={pct} size={96} stroke={9} label={`Progress to ${next ? `level ${level + 1}` : "the top level"}`}>
          <span className="flex flex-col items-center leading-none">
            <span className="font-sans text-[11px] font-medium text-muted-foreground">Level</span>
            <span className="mt-1 font-heading text-3xl font-semibold tabular-nums text-foreground">{level}</span>
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <h2 className="font-heading text-[26px] leading-tight font-semibold text-foreground">{name}</h2>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {next ? (
              <>
                <span className="font-medium tabular-nums text-foreground">{stats.lessonsToNextLevel}</span>{" "}
                {stats.lessonsToNextLevel === 1 ? "lesson" : "lessons"} to {next.name}
              </>
            ) : (
              "You've reached the top level."
            )}
          </p>
        </div>
      </div>

      <ol className="relative grid flex-1 grid-cols-4" aria-label="Level journey">
        <span aria-hidden="true" className="absolute top-[5px] right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-accent" />
        <span
          aria-hidden="true"
          className="absolute top-[5px] left-[12.5%] h-0.5 rounded-full bg-primary"
          style={{ width: `calc(${journeyPct / 100} * 75%)` }}
        />
        {LEVELS.map((l) => {
          const reached = l.level <= level;
          const current = l.level === level;
          return (
            <li
              key={l.level}
              aria-current={current ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "size-3 rounded-full",
                  reached ? "bg-primary" : "bg-card ring-2 ring-accent ring-inset",
                  current && "ring-4 ring-primary/25",
                )}
              />
              <span className="flex flex-col">
                <span
                  className={cn(
                    "font-sans text-xs",
                    current ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {l.name}
                </span>
                <span className="font-sans text-[11px] tabular-nums text-muted-foreground">
                  {l.threshold === 0 ? "Start" : `${l.threshold} lessons`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
