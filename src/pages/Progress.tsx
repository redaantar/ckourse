import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  SpinnerGapIcon as SpinnerGap,
  FireIcon as Fire,
  TrophyIcon as Trophy,
  ClockIcon as Clock,
  CheckCircleIcon as CheckCircle,
  BookOpenIcon as BookOpen,
  TrendUpIcon as TrendUp,
  CalendarBlankIcon as CalendarBlank,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { ProgressData, CourseProgress } from "@/types";
import { getProgressData } from "@/lib/store";
import { EASE_OUT } from "@/lib/constants";
import level1 from "@/assets/icons/level_1.svg";
import level2 from "@/assets/icons/level_2.svg";
import level3 from "@/assets/icons/level_3.svg";
import level4 from "@/assets/icons/level_4.svg";

const LEVEL_ICONS: Record<number, string> = { 1: level1, 2: level2, 3: level3, 4: level4 };
const LEVEL_NAMES: Record<number, string> = { 1: "Beginner", 2: "Explorer", 3: "Achiever", 4: "Master" };
const LEVEL_THRESHOLDS = [0, 5, 20, 50];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const CATEGORY_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  devops: "DevOps",
  database: "Database",
  design: "Design",
  other: "Other",
};

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  index: number;
  className?: string;
}

function Section({ title, icon, children, index, className }: SectionProps) {
  return (
    <div
      className={cn("relative", className)}
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 60}ms both`,
      }}
    >
      <div className="squircle-subtle absolute inset-0 bg-card" />
      <div className="relative p-5">
        <div className="mb-4 flex items-center gap-2">
          {icon}
          <h3 className="font-heading text-sm font-bold text-foreground">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}

function StatPill({ label, value, sub, icon }: StatPillProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="squircle flex size-10 shrink-0 items-center justify-center bg-secondary">
        {icon}
      </div>
      <div>
        <div className="font-mono text-xl font-bold leading-tight text-foreground">
          {value}
          {sub && (
            <span className="ml-1 text-xs font-medium text-muted-foreground/50">{sub}</span>
          )}
        </div>
        <div className="font-sans text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ActivityCalendar({ activityDates }: { activityDates: Set<string> }) {
  const days = useMemo(() => {
    const result: { date: string; active: boolean; dayOfWeek: number }[] = [];
    const today = new Date();
    for (let i = 179; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      result.push({
        date: dateStr,
        active: activityDates.has(dateStr),
        dayOfWeek: d.getDay(),
      });
    }
    return result;
  }, [activityDates]);

  // Group into weeks (columns)
  const weeks = useMemo(() => {
    const cols: (typeof days)[] = [];
    let currentWeek: typeof days = [];

    // Pad the first week with empty slots
    if (days.length > 0) {
      const firstDow = days[0].dayOfWeek;
      for (let i = 0; i < firstDow; i++) {
        currentWeek.push({ date: "", active: false, dayOfWeek: i });
      }
    }

    for (const day of days) {
      currentWeek.push(day);
      if (day.dayOfWeek === 6) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) cols.push(currentWeek);
    return cols;
  }, [days]);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const activeDayCount = days.filter((d) => d.active).length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-sans text-xs text-muted-foreground">Last 6 months</span>
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {activeDayCount} active {activeDayCount === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="flex w-full gap-0.5">
        <div className="flex shrink-0 flex-col gap-0.5 pr-1">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="flex w-3 flex-1 items-center justify-center font-mono text-[7px] leading-none text-muted-foreground/40"
            >
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-1 flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                className={cn(
                  "w-full rounded-[2px] transition-colors",
                  day.date === ""
                    ? "bg-transparent"
                    : day.active
                      ? "bg-primary"
                      : "bg-border/50",
                )}
                style={{ aspectRatio: "1" }}
                title={day.date || undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseProgressList({ courses }: { courses: CourseProgress[] }) {
  const sorted = useMemo(
    () =>
      [...courses].sort((a, b) => {
        const pctA = a.totalLessons > 0 ? a.completedLessons / a.totalLessons : 0;
        const pctB = b.totalLessons > 0 ? b.completedLessons / b.totalLessons : 0;
        return pctB - pctA;
      }),
    [courses],
  );

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((course) => {
        const pct = course.totalLessons > 0
          ? Math.round((course.completedLessons / course.totalLessons) * 100)
          : 0;
        return (
          <div key={course.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: course.accentColor }}
                />
                <span className="truncate font-sans text-xs font-medium text-foreground">
                  {course.title}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {course.completedLessons}/{course.totalLessons}
              </span>
            </div>
            <ProgressBar value={pct} />
          </div>
        );
      })}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="squircle bg-popover px-3 py-1.5">
      <span className="font-sans text-[11px] text-muted-foreground">{label}: </span>
      <span className="font-mono text-[11px] font-medium text-foreground">{payload[0].value}</span>
    </div>
  );
}

interface ProgressProps {
  className?: string;
}

export function Progress({ className }: ProgressProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    getProgressData().then(setData);
  }, []);

  useEffect(() => {
    getProgressData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  usePageVisible("/progress", reload);

  const activityDates = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.activityDays.map((d) => d.date));
  }, [data]);

  const categoryChartData = useMemo(() => {
    if (!data) return [];
    return data.categories.map((c, i) => ({
      name: CATEGORY_LABELS[c.category] ?? c.category,
      courses: c.count,
      lessons: c.totalLessons,
      completed: c.completedLessons,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [data]);

  const courseBarData = useMemo(() => {
    if (!data) return [];
    return data.courses
      .filter((c) => c.totalLessons > 0)
      .sort((a, b) => {
        const pA = a.completedLessons / a.totalLessons;
        const pB = b.completedLessons / b.totalLessons;
        return pB - pA;
      })
      .slice(0, 8)
      .map((c) => ({
        name: c.title.length > 18 ? c.title.slice(0, 16) + "..." : c.title,
        progress: Math.round((c.completedLessons / c.totalLessons) * 100),
        fill: c.accentColor,
      }));
  }, [data]);

  const overallPct = useMemo(() => {
    if (!data || data.stats.totalLessons === 0) return 0;
    return Math.round((data.stats.completedLessons / data.stats.totalLessons) * 100);
  }, [data]);

  if (loading) {
    return (
      <div className={cn("mx-auto flex max-w-6xl items-center justify-center py-32", className)}>
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={cn("mx-auto max-w-6xl", className)}>
      <div
        className="mb-8"
        style={{ animation: `card-in 350ms ${EASE_OUT} both` }}
      >
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Progress
        </h2>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Your learning journey at a glance
        </p>
      </div>

      <div
        className="relative mb-6"
        style={{ animation: `card-in 350ms ${EASE_OUT} 40ms both` }}
      >
        <div className="squircle-subtle absolute inset-0 bg-card" />
        <div className="relative p-5">
          {/* Current level header */}
          <div className="mb-5 flex items-center gap-4">
            <img
              src={LEVEL_ICONS[data.stats.userLevel] ?? LEVEL_ICONS[1]}
              alt={`Level ${data.stats.userLevel}`}
              className="size-14 object-contain drop-shadow-[0_0_8px_rgba(200,241,53,0.3)]"
            />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-foreground">
                  Level {data.stats.userLevel}
                </span>
                <span className="font-sans text-sm font-medium text-primary/70">
                  {LEVEL_NAMES[data.stats.userLevel] ?? "Beginner"}
                </span>
              </div>
              {data.stats.lessonsToNextLevel > 0 ? (
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-primary">{data.stats.lessonsToNextLevel}</span>
                  {" "}more {data.stats.lessonsToNextLevel === 1 ? "lesson" : "lessons"} to{" "}
                  <span className="font-medium text-foreground">
                    {LEVEL_NAMES[data.stats.userLevel + 1]}
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  Highest rank achieved
                </p>
              )}
            </div>
          </div>

          {/* Level track */}
          <div className="relative">
            {/* Background track line — aligned to dot center (icon 36px + my-1 4px + dot 10px/2 = 45px from top) */}
            <div className="absolute right-6 left-6 h-0.5 rounded-full bg-border" style={{ top: 45 }} />
            {/* Filled track line */}
            <div
              className="absolute left-6 h-0.5 rounded-full bg-primary transition-all duration-700"
              style={{
                top: 45,
                width: (() => {
                  const lvl = data.stats.userLevel;
                  if (lvl >= 4) return "calc(100% - 48px)";
                  // Each segment is 1/3 of the track
                  const segPct = 100 / 3;
                  const rangeStart = LEVEL_THRESHOLDS[lvl - 1];
                  const rangeEnd = LEVEL_THRESHOLDS[lvl];
                  const total = rangeEnd - rangeStart;
                  const done = total - data.stats.lessonsToNextLevel;
                  const withinSeg = done / total;
                  const fullPct = (lvl - 1) * segPct + withinSeg * segPct;
                  return `calc(${fullPct}% - ${48 - (fullPct / 100) * 48}px)`;
                })(),
              }}
            />

            {/* Level nodes */}
            <div className="relative z-10 flex w-full items-center justify-between">
              {[1, 2, 3, 4].map((lv) => {
                const reached = lv <= data.stats.userLevel;
                const isCurrent = lv === data.stats.userLevel;
                return (
                  <div key={lv} className="flex flex-col items-center">
                    <img
                      src={LEVEL_ICONS[lv]}
                      alt={`Level ${lv}`}
                      className={cn(
                        "size-9 object-contain transition-all",
                        reached ? "opacity-100" : "opacity-15 grayscale",
                        isCurrent && "drop-shadow-[0_0_8px_rgba(200,241,53,0.4)]",
                      )}
                    />
                    {/* Dot on the track line */}
                    <div className={cn(
                      "my-1 size-2.5 rounded-full border-2 transition-colors",
                      isCurrent
                        ? "border-primary bg-primary shadow-[0_0_6px_rgba(200,241,53,0.5)]"
                        : reached
                          ? "border-primary bg-primary"
                          : "border-border bg-background",
                    )} />
                    <div className="text-center">
                      <div className={cn(
                        "font-mono text-[10px] leading-tight",
                        isCurrent
                          ? "font-bold text-foreground"
                          : reached
                            ? "font-medium text-muted-foreground"
                            : "text-muted-foreground/40",
                      )}>
                        Lv.{lv}
                      </div>
                      <div className={cn(
                        "font-sans text-[9px]",
                        isCurrent ? "text-primary/70" : "text-muted-foreground/30",
                      )}>
                        {LEVEL_NAMES[lv]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative mb-6"
        style={{ animation: `card-in 350ms ${EASE_OUT} 80ms both` }}
      >
        <div className="squircle-subtle absolute inset-0 bg-card" />
        <div className="relative grid grid-cols-2 gap-6 p-5 lg:grid-cols-4">
          <StatPill
            icon={<Fire className="size-5 text-orange-400" weight="fill" />}
            label="Current streak"
            value={data.stats.currentStreak}
            sub={data.stats.currentStreak === 1 ? "day" : "days"}
          />
          <StatPill
            icon={<Trophy className="size-5 text-primary" weight="fill" />}
            label="Longest streak"
            value={data.longestStreak}
            sub={data.longestStreak === 1 ? "day" : "days"}
          />
          <StatPill
            icon={<Clock className="size-5 text-info" weight="fill" />}
            label="Total watch time"
            value={formatMins(data.stats.totalWatchTimeMins)}
          />
          <StatPill
            icon={<TrendUp className="size-5 text-primary" weight="fill" />}
            label="Overall progress"
            value={`${overallPct}%`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Section
          title="Activity"
          icon={<CalendarBlank className="size-4 text-muted-foreground" />}
          index={2}
          className="lg:col-span-2"
        >
          <ActivityCalendar activityDates={activityDates} />
        </Section>

        <Section
          title="Categories"
          icon={<BookOpen className="size-4 text-info" weight="fill" />}
          index={3}
        >
          {categoryChartData.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-center">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="courses"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {categoryChartData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="font-sans text-xs text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {cat.courses}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-sans text-xs text-muted-foreground">No courses yet.</p>
          )}
        </Section>

        <Section
          title="Overview"
          icon={<BookOpen className="size-4 text-muted-foreground" />}
          index={4}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">Courses completed</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {data.stats.completedCourses}
                <span className="text-muted-foreground/50"> / {data.stats.totalCourses}</span>
              </span>
            </div>
            <ProgressBar
              value={data.stats.totalCourses > 0 ? Math.round((data.stats.completedCourses / data.stats.totalCourses) * 100) : 0}
            />

            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">Lessons completed</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {data.stats.completedLessons}
                <span className="text-muted-foreground/50"> / {data.stats.totalLessons}</span>
              </span>
            </div>
            <ProgressBar value={overallPct} />

            <div className="mt-2 flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">In progress</span>
              <span className="font-mono text-xs font-medium text-info">
                {data.stats.inProgressCourses}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-muted-foreground">Notes written</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {data.stats.totalNotes}
              </span>
            </div>
          </div>
        </Section>

        <Section
          title="Course Progress"
          icon={<CheckCircle className="size-4 text-primary" weight="fill" />}
          index={5}
          className="lg:col-span-2"
        >
          {data.courses.length > 0 ? (
            <CourseProgressList courses={data.courses} />
          ) : (
            <p className="font-sans text-xs text-muted-foreground">No courses yet.</p>
          )}
        </Section>

        {courseBarData.length > 0 && (
          <Section
            title="Completion by Course"
            icon={<TrendUp className="size-4 text-primary" weight="fill" />}
            index={6}
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={courseBarData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={36}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--secondary)", radius: 4 }}
                />
                <Bar dataKey="progress" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>
    </div>
  );
}
