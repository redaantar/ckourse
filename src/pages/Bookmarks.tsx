import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  BookmarkSimpleIcon as BookmarkSimple,
  HeartIcon as Heart,
  CheckIcon as Check,
  PlayIcon as Play,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { CourseCover } from "@/components/dashboard/CourseCover";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { Course, FavoriteLesson } from "@/types";
import { getBookmarkedCourses, getAllFavorites, toggleFavorite } from "@/lib/store";

type Tab = "courses" | "lessons";

interface BookmarksProps {
  className?: string;
}

export function Bookmarks({ className }: BookmarksProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [favorites, setFavorites] = useState<FavoriteLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("courses");

  const reload = useCallback(() => {
    return Promise.all([getBookmarkedCourses(), getAllFavorites()]).then(([c, f]) => {
      setCourses(c);
      setFavorites(f);
    });
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Refresh data when page becomes visible again (keep-alive)
  usePageVisible("/bookmarks", reload);

  // Land on whichever tab actually has something in it
  useEffect(() => {
    if (!loading && courses.length === 0 && favorites.length > 0) setActiveTab("lessons");
    // Only on first load — after that the user's choice wins
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleRemoveFavorite = useCallback(
    async (lessonId: number) => {
      await toggleFavorite(lessonId);
      await reload();
    },
    [reload],
  );

  if (loading) {
    return <div className={cn("min-h-[60vh]", className)} aria-busy="true" />;
  }

  const isEmpty = courses.length === 0 && favorites.length === 0;

  return (
    <div className={cn("mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 pt-12 pb-20 lg:px-10", className)}>
      <header
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-[34px] leading-tight font-semibold text-foreground">Saved</h1>
          <p className="mt-1 font-sans text-[15px] text-muted-foreground">
            The courses and lessons you wanted to come back to.
          </p>
        </div>
        {!isEmpty && (
          <SegmentedControl
            aria-label="Show saved"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              {
                value: "courses",
                ariaLabel: `Courses, ${courses.length}`,
                label: (
                  <>
                    Courses <span className="text-muted-foreground tabular-nums">{courses.length}</span>
                  </>
                ),
              },
              {
                value: "lessons",
                ariaLabel: `Lessons, ${favorites.length}`,
                label: (
                  <>
                    Lessons <span className="text-muted-foreground tabular-nums">{favorites.length}</span>
                  </>
                ),
              },
            ]}
          />
        )}
      </header>

      {isEmpty ? (
        <EmptyState
          className="border-0"
          size="page"
          icon={BookmarkSimple}
          title="Nothing saved yet"
          description="Save a course from its cover, or heart a lesson in the curriculum. They'll wait for you here."
          action={
            <Button asChild variant="outline">
              <Link to="/">Go to your library</Link>
            </Button>
          }
        />
      ) : activeTab === "courses" ? (
        courses.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-x-6 gap-y-8">
            {courses.map((course) => (
              <div key={course.id}>
                <CourseCard course={course} onBookmarkChange={reload} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="border-0"
            icon={BookmarkSimple}
            title="No saved courses"
            description="Hover a course in your library and tap the bookmark to keep it here."
          />
        )
      ) : favorites.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {favorites.map((fav) => (
            <FavoriteItem key={fav.id} favorite={fav} onRemove={handleRemoveFavorite} />
          ))}
        </ul>
      ) : (
        <EmptyState
          className="border-0"
          icon={Heart}
          title="No saved lessons"
          description="Tap the heart next to any lesson in a course's curriculum to save it here."
        />
      )}
    </div>
  );
}

function FavoriteItem({
  favorite,
  onRemove,
}: {
  favorite: FavoriteLesson;
  onRemove: (lessonId: number) => void;
}) {
  const progress = favorite.duration > 0 ? Math.min(favorite.lastPosition / (favorite.duration * 60), 1) : 0;
  const percentage = Math.round(progress * 100);

  return (
    <li
      className="group relative flex items-center transition-colors duration-150 hover:bg-secondary/50"
    >
      <Link
        to={`/course/${favorite.courseId}?lesson=${favorite.lessonId}&from=/bookmarks`}
        className="flex min-w-0 flex-1 items-center gap-4 py-3 pr-14 pl-3"
      >
        <CourseCover
          title={favorite.courseTitle}
          accentColor={favorite.accentColor}
          showTitle={false}
          className="aspect-[16/10] w-20 shrink-0 rounded-lg"
        >
          <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <Play weight="fill" className="size-4 drop-shadow" />
          </span>
        </CourseCover>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-sans text-sm font-medium text-foreground" title={favorite.lessonTitle}>
            {favorite.lessonTitle}
          </span>
          <span className="truncate font-sans text-xs text-muted-foreground" title={favorite.courseTitle}>
            {favorite.courseTitle}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 font-sans text-xs text-muted-foreground tabular-nums">
          {favorite.completed ? (
            <>
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check weight="bold" className="size-2.5" />
              </span>
              Watched
            </>
          ) : percentage > 0 ? (
            <>
              <ProgressRing value={percentage} size={16} stroke={2.25} label="Watched" />
              {Math.max(1, Math.round(favorite.duration * (1 - progress)))} min left
            </>
          ) : (
            favorite.duration > 0 && `${favorite.duration} min`
          )}
        </div>
      </Link>

      <button
        onClick={() => onRemove(favorite.lessonId)}
        aria-label={`Remove "${favorite.lessonTitle}" from saved lessons`}
        title="Remove from saved"
        className={cn(
          "absolute right-3 flex size-8 items-center justify-center rounded-full text-destructive transition-[opacity,background-color] duration-150 hover:bg-destructive/10",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Heart className="size-4" weight="fill" />
      </button>
    </li>
  );
}
