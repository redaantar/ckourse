import { Link } from "react-router-dom";
import { CheckIcon as Check } from "@phosphor-icons/react";
import type { CourseProgress } from "@/types";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { EASE_OUT } from "@/lib/constants";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseCover } from "@/components/dashboard/CourseCover";

function pct(c: CourseProgress): number {
  return c.totalLessons > 0 ? (c.completedLessons / c.totalLessons) * 100 : 0;
}

/** In-progress courses first (closest to done on top), then untouched, then finished. */
function rank(c: CourseProgress): number {
  const p = pct(c);
  if (p >= 100) return 2;
  if (p === 0) return 1;
  return 0;
}

function detail(c: CourseProgress): string {
  const lessons = `${c.completedLessons} of ${c.totalLessons} lessons`;
  const left = c.totalDurationMins - c.completedDurationMins;
  if (c.completedLessons === 0) return c.totalDurationMins > 0 ? `${lessons} · ${formatDuration(c.totalDurationMins)}` : lessons;
  return left > 0 ? `${lessons} · ${formatDuration(left)} left` : lessons;
}

export function CourseProgressList({ courses, className }: { courses: CourseProgress[]; className?: string }) {
  const sorted = [...courses].sort((a, b) => rank(a) - rank(b) || pct(b) - pct(a));

  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {sorted.map((c, i) => {
        const p = pct(c);
        const done = p >= 100;
        return (
          <li key={c.id} style={{ animation: `card-in 300ms ${EASE_OUT} ${Math.min(i, 10) * 30}ms both` }}>
            <Link
              to={`/course/${c.id}?from=${encodeURIComponent("/progress")}`}
              className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-secondary active:opacity-80"
            >
              <CourseCover
                title={c.title}
                accentColor={c.accentColor}
                showTitle={false}
                className="aspect-[16/10] w-[72px] shrink-0 rounded-lg"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-sans text-sm font-medium text-foreground" title={c.title}>
                      {c.title}
                    </span>
                    <span className="truncate font-sans text-xs tabular-nums text-muted-foreground">{detail(c)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-sans text-sm font-medium tabular-nums text-foreground">
                    {done ? (
                      <>
                        <Check weight="bold" className="size-3.5 text-primary" /> Completed
                      </>
                    ) : (
                      `${Math.round(p)}%`
                    )}
                  </span>
                </span>
                <ProgressBar value={p} label={`${c.title} progress`} className="h-1" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
