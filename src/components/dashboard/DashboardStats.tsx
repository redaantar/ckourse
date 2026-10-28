import {
  FireIcon as Fire,
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  GraduationCapIcon as GraduationCap,
  LightningIcon as Lightning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { EASE_OUT } from "@/lib/constants";
import { getLevelFraction, getLevelInfo } from "@/lib/levels";

function formatWatchTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getWeekdayLabels(): string[] {
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay(); // 0=Sun
  const result: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayIndex = (today - i + 7) % 7;
    result.push(labels[dayIndex]);
  }
  return result;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  index: number;
}

function StatCard({ icon, label, value, sub, index }: StatCardProps) {
  return (
    <div
      className="relative"
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 50}ms both`,
      }}
    >
      <div className="squircle absolute inset-0 bg-card" />

      <div className="relative flex items-center gap-3 px-4 py-3">
        <div className="squircle flex size-9 shrink-0 items-center justify-center bg-secondary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-lg font-bold leading-tight text-foreground">
            {value}
            {sub && (
              <span className="ml-0.5 text-sm font-medium text-muted-foreground/50">{sub}</span>
            )}
          </div>
          <div className="font-sans text-[11px] text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

interface WeekActivityProps {
  activity: boolean[];
  index: number;
}

function WeekActivity({ activity, index }: WeekActivityProps) {
  const labels = getWeekdayLabels();

  return (
    <div
      className="relative"
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 50}ms both`,
      }}
    >
      <div className="squircle absolute inset-0 bg-card" />

      <div className="relative flex items-center gap-3 px-4 py-3">
        <div className="squircle flex size-9 shrink-0 items-center justify-center bg-secondary">
          <Lightning className="size-4 text-primary" weight="fill" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 font-sans text-[11px] text-muted-foreground">
            This week
          </div>
          <div className="flex items-center gap-1.5">
            {activity.map((active, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-border",
                  )}
                />
                <span className="font-mono text-[8px] leading-none text-muted-foreground/50">
                  {labels[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LevelCardProps {
  level: number;
  lessonsToNext: number;
  index: number;
}

function LevelCard({ level, lessonsToNext, index }: LevelCardProps) {
  const { icon, name } = getLevelInfo(level);
  const progress = Math.round(getLevelFraction(level, lessonsToNext) * 100);

  return (
    <div
      className="relative"
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 50}ms both`,
      }}
    >
      <div className="squircle absolute inset-0 bg-card" />

      <div className="relative flex items-center gap-3 px-4 py-3">
        <img
          src={icon}
          alt={`Level ${level}`}
          className="size-10 shrink-0 object-contain drop-shadow-[0_0_6px_rgba(200,241,53,0.3)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold leading-tight text-foreground">
              Lv.{level}
            </span>
            <span className="font-sans text-[11px] font-medium text-primary/70">
              {name}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {lessonsToNext > 0 && (
              <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50">
                {lessonsToNext} left
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardStatsBarProps {
  stats: DashboardStats;
  className?: string;
}

export function DashboardStatsBar({ stats, className }: DashboardStatsBarProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-6", className)}>
      <LevelCard
        level={stats.userLevel}
        lessonsToNext={stats.lessonsToNextLevel}
        index={0}
      />
      <StatCard
        icon={<Fire className="size-4 text-orange-400" weight="fill" />}
        label="Day streak"
        value={stats.currentStreak}
        index={1}
      />
      <StatCard
        icon={<CheckCircle className="size-4 text-primary" weight="fill" />}
        label="Lessons done"
        value={stats.completedLessons}
        sub={`/ ${stats.totalLessons}`}
        index={2}
      />
      <StatCard
        icon={<GraduationCap className="size-4 text-info" weight="fill" />}
        label="Courses done"
        value={stats.completedCourses}
        sub={`/ ${stats.totalCourses}`}
        index={3}
      />
      <StatCard
        icon={<Clock className="size-4 text-muted-foreground" />}
        label="Watch time"
        value={formatWatchTime(stats.totalWatchTimeMins)}
        index={4}
      />
      <WeekActivity activity={stats.weekActivity} index={5} />
    </div>
  );
}
