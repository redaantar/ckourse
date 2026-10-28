import { Link, useLocation } from "react-router-dom";
import {
  BookmarkSimpleIcon as BookmarkSimple,
  CheckIcon as Check,
  GoogleDriveLogoIcon as GoogleDriveLogo,
  HardDrivesIcon as HardDrives,
} from "@phosphor-icons/react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";
import { toggleBookmark } from "@/lib/store";
import { SPRING_BOUNCY } from "@/lib/constants";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CourseCover } from "./CourseCover";

export function formatLastWatched(dateStr: string | null): string {
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

export function coursePercent(course: Course): number {
  return course.totalLessons ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
}

/**
 * A course as an object on a shelf: the cover carries title and author, the line
 * below carries only what changes — how far along you are and when you were last here.
 */
export function CourseCard({ course, onBookmarkChange }: { course: Course; onBookmarkChange?: () => void }) {
  const location = useLocation();
  const percentage = coursePercent(course);
  const isFromDrive = course.folderPath.startsWith("gdrive:");
  const isFromServer = course.folderPath.startsWith("srv:");
  const done = course.status === "completed";

  return (
    <div className="group relative">
      <Link
        to={`/course/${course.id}?from=${encodeURIComponent(location.pathname + location.search)}`}
        aria-label={`${course.title} by ${course.author || "unknown author"}, ${done ? "completed" : `${percentage}% complete`}`}
        className="flex flex-col gap-2.5 rounded-2xl focus-visible:outline-offset-4"
      >
        <CourseCover
          title={course.title}
          author={course.author}
          accentColor={course.accentColor}
          className="aspect-[16/10] rounded-2xl shadow-card transition-[filter] duration-200 group-hover:brightness-110"
        />

        <div className="flex items-center gap-2 px-0.5 font-sans text-xs text-muted-foreground">
          {done ? (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check weight="bold" className="size-2.5" />
            </span>
          ) : (
            <ProgressRing value={percentage} size={16} stroke={2.25} />
          )}
          <span className="truncate tabular-nums">
            {done
              ? "Completed"
              : course.status === "not-started"
                ? `${course.totalLessons} lessons`
                : `${percentage}% · ${course.completedLessons} of ${course.totalLessons}`}
          </span>
          {(isFromDrive || isFromServer) && (
            <span title={isFromDrive ? "Google Drive" : "Your server"} className="flex shrink-0">
              {isFromDrive ? <GoogleDriveLogo className="size-3.5" /> : <HardDrives className="size-3.5" />}
              <span className="sr-only">{isFromDrive ? "From Google Drive" : "From your server"}</span>
            </span>
          )}
          {course.lastWatched && <span className="ml-auto shrink-0">{formatLastWatched(course.lastWatched)}</span>}
        </div>
      </Link>

      <BookmarkButton bookmarked={course.bookmarked} courseId={course.id} onBookmarkChange={onBookmarkChange} />
    </div>
  );
}

function BookmarkButton({ bookmarked: initialBookmarked, courseId, onBookmarkChange }: { bookmarked: boolean; courseId: number; onBookmarkChange?: () => void }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  // Only a save the user just made gets the pop — not every saved card on load
  const [justSaved, setJustSaved] = useState(false);

  // Sync with parent prop when it changes (e.g. after navigating back from course detail)
  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = await toggleBookmark(courseId);
    setBookmarked(newState);
    setJustSaved(newState);
    onBookmarkChange?.();
  }, [courseId, onBookmarkChange]);

  return (
    <button
      onClick={handleClick}
      aria-label={bookmarked ? "Remove from Saved" : "Save course"}
      aria-pressed={bookmarked}
      title={bookmarked ? "Remove from Saved" : "Save"}
      className={cn(
        "absolute top-2.5 right-2.5 z-10 flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-opacity duration-150 hover:bg-black/50",
        !bookmarked && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      <BookmarkSimple
        className="size-4"
        weight={bookmarked ? "fill" : "bold"}
        style={justSaved ? { animation: `check-pop ${SPRING_BOUNCY}` } : undefined}
      />
    </button>
  );
}
