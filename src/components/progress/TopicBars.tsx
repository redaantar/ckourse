import type { CategoryBreakdown } from "@/types";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";

const CATEGORY_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  devops: "DevOps",
  database: "Database",
  design: "Design",
  other: "Other",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * One bar per topic on a shared baseline and a shared 0–100% scale: how far through
 * each topic you are. Lengths on a common baseline are the most accurately compared
 * visual encoding — far better than the angles of a donut. Sizes are in the text.
 */
export function TopicBars({ categories, className }: { categories: CategoryBreakdown[]; className?: string }) {
  const sorted = [...categories].sort((a, b) => b.totalLessons - a.totalLessons);

  return (
    <ul className={cn("flex flex-col gap-5", className)}>
      {sorted.map((c) => {
        const donePct = c.totalLessons ? (c.completedLessons / c.totalLessons) * 100 : 0;
        return (
          <li key={c.category} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-sans text-sm font-medium text-foreground">{categoryLabel(c.category)}</span>
                <span className="font-sans text-xs tabular-nums text-muted-foreground">
                  {c.count} {c.count === 1 ? "course" : "courses"} · {c.completedLessons} of {c.totalLessons} lessons
                </span>
              </span>
              <span className="shrink-0 font-sans text-sm font-medium tabular-nums text-foreground">
                {Math.round(donePct)}%
              </span>
            </div>
            <ProgressBar
              value={donePct}
              label={`${categoryLabel(c.category)}: ${c.completedLessons} of ${c.totalLessons} lessons`}
            />
          </li>
        );
      })}
    </ul>
  );
}
