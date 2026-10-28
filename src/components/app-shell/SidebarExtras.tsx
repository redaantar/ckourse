import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FireIcon as Fire } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Course, DashboardStats } from "@/types";
import { byLastWatched, getCourses, getDashboardStats } from "@/lib/store";
import { courseColor } from "@/lib/color";
import { getLevelFraction, getLevelInfo } from "@/lib/levels";
import { ProgressRing } from "@/components/ui/progress-ring";
import { spring } from "./constants";
import { SidebarTooltip } from "./SidebarButton";

/** Pages after which the recent list or the level may have changed. */
const changesProgress = (path: string) => path.startsWith("/course/") || path === "/settings";

/**
 * Refreshes when you leave the player (or Settings, which can reset progress), so finishing
 * a lesson shows up the moment you leave, and on Home, where it shares the page's own fetch.
 */
export function useSidebarData() {
  const location = useLocation();
  const [recent, setRecent] = useState<Course[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev !== null && !changesProgress(prev) && location.pathname !== "/") return;
    let alive = true;
    Promise.all([getCourses(), getDashboardStats()])
      .then(([courses, s]) => {
        if (!alive) return;
        setRecent(byLastWatched(courses ?? []).slice(0, 3));
        setStats(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  return { recent, stats };
}

function Label({ collapsed, children }: { collapsed: boolean; children: string }) {
  return (
    <span
      className="block overflow-hidden whitespace-nowrap px-2.5 font-sans text-[11px] font-medium text-muted-foreground"
      style={{
        opacity: collapsed ? 0 : 1,
        maxHeight: collapsed ? 0 : 20,
        marginBottom: collapsed ? 0 : 4,
        transition: `opacity ${spring()}, max-height ${spring()}, margin ${spring()}`,
      }}
    >
      {children}
    </span>
  );
}

/** The last few courses you touched — the sidebar's job is to be one click from anywhere you were. */
export function RecentCourses({ courses, collapsed }: { courses: Course[]; collapsed: boolean }) {
  const location = useLocation();
  if (courses.length === 0) return null;

  return (
    <div>
      <Label collapsed={collapsed}>Recent</Label>
      {/* Collapsed, the label's job falls to a hairline, so the rings aren't read as more nav */}
      {collapsed && <div className="mx-auto mb-2 h-px w-4 bg-sidebar-border" />}
      <ul className="flex flex-col gap-1">
        {courses.map((c) => {
          const pct = c.totalLessons ? (c.completedLessons / c.totalLessons) * 100 : 0;
          const active = location.pathname === `/course/${c.id}`;
          const color = courseColor(c.accentColor);
          return (
            <li key={c.id}>
              <Link
                to={`/course/${c.id}?from=${encodeURIComponent(location.pathname)}`}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? c.title : undefined}
                className={cn(
                  "group relative flex h-8 items-center rounded-lg font-sans text-[13px] transition-colors duration-150",
                  collapsed ? "justify-center" : "gap-2.5 px-2.5",
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {/* Alone on the rail, a bare ring reads as a loading spinner; the initial makes it a course */}
                <ProgressRing value={pct} size={collapsed ? 26 : 18} stroke={collapsed ? 2 : 2.5} color={color}>
                  {collapsed && (
                    <span className="font-sans text-[10px] font-semibold uppercase" style={{ color }}>
                      {c.title.trim().charAt(0)}
                    </span>
                  )}
                </ProgressRing>
                <span
                  className="truncate"
                  style={{
                    opacity: collapsed ? 0 : 1,
                    maxWidth: collapsed ? 0 : 170,
                    transition: `opacity ${spring()}, max-width ${spring()}`,
                  }}
                >
                  {c.title}
                </span>
                {collapsed && <SidebarTooltip label={c.title} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Who you are here: level and streak, always in the corner of your eye. It is the
 * one persistent piece of encouragement in the app, so it is small and quiet —
 * a companion, not a scoreboard.
 */
export function LevelBadge({ stats, collapsed }: { stats: DashboardStats | null; collapsed: boolean }) {
  const location = useLocation();
  if (!stats) return null;
  const { name } = getLevelInfo(stats.userLevel);
  const pct = getLevelFraction(stats.userLevel, stats.lessonsToNextLevel) * 100;
  const active = location.pathname === "/progress";

  return (
    <Link
      to="/progress"
      aria-label={`Level ${stats.userLevel}, ${name}. ${stats.currentStreak}-day streak. View progress`}
      className={cn(
        "group relative flex items-center rounded-xl transition-colors duration-150",
        collapsed ? "justify-center" : "gap-3 p-2",
        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
      )}
    >
      <ProgressRing value={pct} size={collapsed ? 32 : 34} stroke={3}>
        <span className="font-sans text-xs font-semibold tabular-nums text-sidebar-foreground">{stats.userLevel}</span>
      </ProgressRing>
      <span
        className="flex min-w-0 flex-col overflow-hidden whitespace-nowrap"
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 170,
          transition: `opacity ${spring()}, max-width ${spring()}`,
        }}
      >
        <span className="truncate font-sans text-[13px] font-medium text-sidebar-foreground">{name}</span>
        <span className="flex items-center gap-1 font-sans text-xs text-muted-foreground tabular-nums">
          {stats.currentStreak > 0 ? (
            <>
              <Fire weight="fill" className="size-3 text-warning" />
              {stats.currentStreak}-day streak
            </>
          ) : stats.lessonsToNextLevel > 0 ? (
            `${stats.lessonsToNextLevel} to level ${stats.userLevel + 1}`
          ) : (
            "Highest level"
          )}
        </span>
      </span>
      {collapsed && <SidebarTooltip label={`Level ${stats.userLevel} · ${name}`} />}
    </Link>
  );
}
