import { Link, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ArrowRightIcon as ArrowRight, BookmarkSimpleIcon as BookmarkSimple, ClockIcon as Clock } from "@phosphor-icons/react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";
import { toggleBookmark } from "@/lib/store";

function getStatusBadge(status: Course["status"]) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default">
          Completed
        </Badge>
      );
    case "in-progress":
      return (
        <Badge variant="info">
          In Progress
        </Badge>
      );
    case "not-started":
      return (
        <Badge variant="secondary">
          Not Started
        </Badge>
      );
  }
}

function formatLastWatched(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CourseCard({ course, onBookmarkChange }: { course: Course; onBookmarkChange?: () => void }) {
  const location = useLocation();
  const percentage = Math.round(
    (course.completedLessons / course.totalLessons) * 100
  );

  return (
    <Link to={`/course/${course.id}?from=${encodeURIComponent(location.pathname + location.search)}`} className="block h-full">
      <div className="squircle-subtle-wrapper group relative flex h-full flex-col transition-colors">
        <div className="squircle-subtle absolute inset-0 bg-border" />
        <div className="squircle-subtle absolute inset-px bg-card transition-colors group-hover:bg-secondary" />

        <div className="squircle-subtle absolute inset-0 overflow-hidden">
          <div
            className="relative flex h-24 items-center justify-center"
            style={{ backgroundColor: `${course.accentColor}10` }}
          >
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: course.accentColor }}
            />
            <span
              className="font-heading text-2xl font-bold opacity-20"
              style={{ color: course.accentColor }}
            >
              {course.title.split(/[\s—-]/)[0]}
            </span>
          </div>
        </div>

        <BookmarkButton bookmarked={course.bookmarked} courseId={course.id} onBookmarkChange={onBookmarkChange} />

        <Card className="relative flex flex-1 flex-col gap-0 border-0 bg-transparent py-0 shadow-none">
          <div className="h-24 shrink-0" />

          <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 min-h-[2.5em] font-sans text-sm font-semibold leading-tight text-foreground">
                {course.title}
              </h3>
              {getStatusBadge(course.status)}
            </div>

            <div className="flex items-center justify-between">
              <p className="font-sans text-xs text-muted-foreground">
                {course.author || "Unknown author"}
              </p>
              <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {formatLastWatched(course.lastWatched)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {course.completedLessons}/{course.totalLessons} lessons
                </span>
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {percentage}%
                </span>
              </div>
              <ProgressBar value={percentage} className="bg-border" />
            </div>

            <div className="mt-auto pt-3">
              <div className="relative mb-3 h-px">
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/20 to-transparent" />
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" }} />
              </div>
              <div className="flex items-center justify-center gap-1.5 font-sans text-xs font-semibold text-primary">
                {course.status === "not-started" ? "Start Course" : course.status === "completed" ? "Review Course" : "Continue"}
                <ArrowRight
                  className="size-3.5 transition-transform duration-150 group-hover:translate-x-1"
                  style={{ transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Link>
  );
}

function BookmarkButton({ bookmarked: initialBookmarked, courseId, onBookmarkChange }: { bookmarked: boolean; courseId: number; onBookmarkChange?: () => void }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);

  // Sync with parent prop when it changes (e.g. after navigating back from course detail)
  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = await toggleBookmark(courseId);
    setBookmarked(newState);
    onBookmarkChange?.();
  }, [courseId, onBookmarkChange]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "absolute right-3 top-3 z-10 rounded-md p-1.5 transition-colors",
        bookmarked
          ? "text-primary"
          : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
      )}
    >
      <BookmarkSimple className="size-4" weight={bookmarked ? "fill" : "regular"} />
    </button>
  );
}
