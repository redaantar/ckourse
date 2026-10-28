import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CELL = 13;
const GAP = 3;
const LABEL_WIDTH = 32;
const MIN_WEEKS = 16;
const MAX_WEEKS = 104;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// activity_log dates are UTC (the backend stamps them from the system clock), so
// the grid works in UTC days too: every Date here is a UTC midnight.
const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });

function relativeDay(date: Date, today: Date): string {
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmt(date, { month: "short", day: "numeric" });
}

/** As many whole weeks as fit the width: the grid always fills its card at a constant cell size. */
function useWeeksThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(53);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width - LABEL_WIDTH + GAP) / (CELL + GAP));
      setWeeks(Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, fit)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, weeks] as const;
}

function Fact({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-heading text-xl leading-none font-semibold tabular-nums text-foreground">{value}</span>
      <span className="font-sans text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

/**
 * Learning days, as far back as the card is wide. One hue, two states: active
 * days in lime (your effort), the rest a quiet track. Weeks run left→right, days
 * top→bottom, with month labels at the first week of each month.
 */
export function ActivityHeatmap({ activityDates, className }: { activityDates: Set<string>; className?: string }) {
  const [gridRef, weekCount] = useWeeksThatFit();

  const { weeks, months, monthCount, lastActive, today } = useMemo(() => {
    const today = new Date(`${dateKey(new Date())}T00:00:00Z`);
    // Start on the Sunday weekCount-1 weeks ago so the grid ends with the current week
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - today.getUTCDay() - (weekCount - 1) * 7);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const weeks: { key: string; active: boolean; future: boolean; label: string }[][] = [];
    const months: { col: number; label: string }[] = [];
    let monthCount = 0;
    for (let w = 0; w < weekCount; w++) {
      const col: (typeof weeks)[number] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + w * 7 + d);
        const key = dateKey(date);
        const future = date > today;
        const active = !future && activityDates.has(key);
        if (active && date >= monthStart) monthCount++;
        if (date.getUTCDate() === 1 || (w === 0 && d === 0)) {
          const label = fmt(date, { month: "short" });
          // A month that starts mid-way through the first column replaces the partial one
          const existing = months.find((m) => m.col === w);
          if (existing) existing.label = label;
          else months.push({ col: w, label });
        }
        col.push({
          key,
          active,
          future,
          label: fmt(date, { weekday: "short", month: "short", day: "numeric" }),
        });
      }
      weeks.push(col);
    }
    // Drop a first-column label that would collide with the next month's
    if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();

    const sorted = [...activityDates].sort();
    const last = sorted[sorted.length - 1];
    const lastActive = last ? new Date(`${last}T00:00:00Z`) : null;
    return { weeks, months, monthCount, lastActive, today };
  }, [activityDates, weekCount]);

  const total = activityDates.size;

  return (
    <div className={cn("flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-card", className)}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Fact value={total} label={total === 1 ? "day learned" : "days learned"} />
        <Fact value={monthCount} label="this month" />
        <Fact value={lastActive ? relativeDay(lastActive, today) : "Not yet"} label="last session" />
        <span className="ml-auto flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
          <span className="size-2.5 rounded-[3px] bg-accent" /> No lessons
          <span className="ml-2 size-2.5 rounded-[3px] bg-primary" /> Learned
        </span>
      </div>

      <div ref={gridRef} className="overflow-hidden">
        <div
          role="img"
          aria-label={`${total} ${total === 1 ? "day" : "days"} learned; ${monthCount} this month`}
          className="grid w-fit gap-(--gap)"
          style={
            {
              "--cell": `${CELL}px`,
              "--gap": `${GAP}px`,
              gridTemplateColumns: `${LABEL_WIDTH - GAP}px repeat(${weekCount}, var(--cell))`,
              gridTemplateRows: "auto repeat(7, var(--cell))",
            } as CSSProperties
          }
        >
          {months.map((m) => (
            <span
              key={m.col}
              className="mb-1 font-sans text-[11px] whitespace-nowrap text-muted-foreground"
              style={{ gridRow: 1, gridColumn: m.col + 2 }}
            >
              {m.label}
            </span>
          ))}

          {DAY_LABELS.map((l, i) => (
            <span
              key={i}
              className="flex items-center font-sans text-[10px] leading-none text-muted-foreground"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              {l}
            </span>
          ))}

          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <span
                key={day.key}
                title={day.future ? undefined : `${day.label}${day.active ? " · learned" : ""}`}
                className={cn("rounded-[3px]", day.future ? "bg-transparent" : day.active ? "bg-primary" : "bg-accent")}
                style={{ gridRow: di + 2, gridColumn: wi + 2 }}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}
