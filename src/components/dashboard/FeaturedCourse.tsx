import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PlayIcon as Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Course, CourseDetail, Lesson } from "@/types";
import { getCourseDetail } from "@/lib/store";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseCover } from "./CourseCover";
import { coursePercent, formatLastWatched } from "./CourseCard";

interface FeaturedCourseProps {
  course: Course;
  className?: string;
}

interface UpNext {
  lesson: Lesson;
  section: string;
  index: number;
  remainingMins: number;
}

/** The lesson you'd actually press play on: the one you left mid-way, else the first unfinished. */
function findUpNext(detail: CourseDetail): UpNext | null {
  const flat = detail.sections.flatMap((s) => s.lessons.map((l) => ({ lesson: l, section: s.title })));
  const pick =
    flat.find((x) => x.lesson.isLastWatched && !x.lesson.completed) ??
    flat.find((x) => !x.lesson.completed) ??
    null;
  if (!pick) return null;
  const remainingMins = flat.filter((x) => !x.lesson.completed).reduce((sum, x) => sum + x.lesson.duration, 0);
  return { ...pick, index: flat.indexOf(pick) + 1, remainingMins };
}

function formatRemaining(mins: number): string {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min left`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h} h ${m} min left` : `${h} h left`;
}

/**
 * "Up next": the one thing the learner most likely opened the app to do, with the
 * exact lesson named — "resume" is a promise, so it should say what it resumes.
 */
export function FeaturedCourse({ course, className }: FeaturedCourseProps) {
  const location = useLocation();
  const [upNext, setUpNext] = useState<UpNext | null>(null);
  const percentage = coursePercent(course);
  const started = course.status !== "not-started";

  useEffect(() => {
    let alive = true;
    getCourseDetail(course.id)
      .then((d) => alive && d && setUpNext(findUpNext(d)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [course.id, course.completedLessons]);

  const href = `/course/${course.id}?from=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <Link
      to={href}
      className={cn(
        "group grid overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-colors duration-200 hover:bg-secondary/60 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <CourseCover
        title={course.title}
        author={course.author}
        accentColor={course.accentColor}
        className="aspect-[16/10] md:aspect-auto md:min-h-72"
      />

      <div className="flex min-w-0 flex-col p-7">
        <span className="font-sans text-xs font-medium text-muted-foreground">
          {started ? "Up next" : "Start something new"}
          {course.lastWatched && <> · {formatLastWatched(course.lastWatched)}</>}
        </span>

        <h2 className="mt-2 line-clamp-2 font-heading text-[26px] leading-[1.15] font-semibold text-foreground">
          {upNext?.lesson.title ?? course.title}
        </h2>
        <p className="mt-2 line-clamp-2 font-sans text-sm text-muted-foreground">
          {upNext ? (
            <>
              Lesson {upNext.index} of {course.totalLessons} · {upNext.section}
            </>
          ) : (
            course.author || " "
          )}
        </p>

        <div className="mt-auto pt-8">
          <div className="mb-2.5 flex items-baseline justify-between gap-3 font-sans text-xs text-muted-foreground tabular-nums">
            <span className="truncate">{course.title}</span>
            <span className="shrink-0">
              {percentage}%{upNext && ` · ${formatRemaining(upNext.remainingMins)}`}
            </span>
          </div>
          <ProgressBar value={percentage} label={`${course.title} progress`} className="h-1" />

          <span className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 font-sans text-sm font-medium text-background transition-opacity duration-150 group-hover:opacity-90">
            <Play className="size-4" weight="fill" />
            {started ? "Resume" : "Start course"}
          </span>
        </div>
      </div>
    </Link>
  );
}
