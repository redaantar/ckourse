import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  BookmarkSimpleIcon as BookmarkSimple,
  HeartIcon as Heart,
  SpinnerGapIcon as SpinnerGap,
  ClockIcon as Clock,
  CheckCircleIcon as CheckCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Course, FavoriteLesson } from "@/types";
import { getBookmarkedCourses, getAllFavorites, toggleFavorite } from "@/lib/store";
import { EASE_OUT } from "@/lib/constants";

interface BookmarksProps {
  className?: string;
}

export function Bookmarks({ className }: BookmarksProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [favorites, setFavorites] = useState<FavoriteLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"courses" | "favorites">("courses");

  const reload = useCallback(() => {
    return Promise.all([getBookmarkedCourses(), getAllFavorites()]).then(
      ([c, f]) => {
        setCourses(c);
        setFavorites(f);
      },
    );
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Refresh data when page becomes visible again (keep-alive)
  usePageVisible("/bookmarks", reload);

  const handleRemoveFavorite = useCallback(
    async (lessonId: number) => {
      await toggleFavorite(lessonId);
      await reload();
    },
    [reload],
  );

  if (loading) {
    return (
      <div className={cn("mx-auto flex max-w-6xl items-center justify-center py-32", className)}>
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = courses.length === 0 && favorites.length === 0;

  return (
    <div className={cn("mx-auto max-w-6xl", className)}>
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-32 text-center"
          style={{ animation: `card-in 350ms ${EASE_OUT} both` }}
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
            <BookmarkSimple className="size-6 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-lg font-bold text-foreground">
            No bookmarks yet
          </h2>
          <p className="max-w-xs font-sans text-sm text-muted-foreground">
            Bookmark courses and favorite videos to find them quickly here.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-1">
            <button
              onClick={() => setActiveTab("courses")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-sans text-sm font-medium transition-colors",
                activeTab === "courses"
                  ? "border border-border bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BookmarkSimple className="size-3.5" />
              Courses
              {courses.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full border border-border bg-muted font-mono text-[9px] font-medium text-muted-foreground">
                  {courses.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-sans text-sm font-medium transition-colors",
                activeTab === "favorites"
                  ? "border border-border bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Heart className="size-3.5" />
              Favorites
              {favorites.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full border border-border bg-muted font-mono text-[9px] font-medium text-muted-foreground">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "courses" && (
            <>
              {courses.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course, index) => (
                    <div
                      key={course.id}
                      style={{
                        animation: `card-in 350ms ${EASE_OUT} ${index * 50}ms both`,
                      }}
                    >
                      <CourseCard course={course} onBookmarkChange={reload} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySection
                  icon={BookmarkSimple}
                  message="No bookmarked courses"
                  description="Bookmark a course from your library or course detail page."
                />
              )}
            </>
          )}

          {activeTab === "favorites" && (
            <>
              {favorites.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {favorites.map((fav, index) => (
                    <FavoriteItem
                      key={fav.id}
                      favorite={fav}
                      index={index}
                      onRemove={handleRemoveFavorite}
                    />
                  ))}
                </div>
              ) : (
                <EmptySection
                  icon={Heart}
                  message="No favorite videos"
                  description="Favorite a video from the curriculum sidebar."
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmptySection({
  icon: Icon,
  message,
  description,
}: {
  icon: React.ElementType;
  message: string;
  description: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-20 text-center"
      style={{ animation: `card-in 350ms ${EASE_OUT} both` }}
    >
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="font-sans text-sm font-medium text-muted-foreground">{message}</p>
      <p className="font-sans text-xs text-muted-foreground/60">{description}</p>
    </div>
  );
}

function FavoriteItem({
  favorite,
  index,
  onRemove,
}: {
  favorite: FavoriteLesson;
  index: number;
  onRemove: (lessonId: number) => void;
}) {
  const progress = favorite.duration > 0
    ? Math.min(favorite.lastPosition / (favorite.duration * 60), 1)
    : 0;
  const percentage = Math.round(progress * 100);

  return (
    <Link
      to={`/course/${favorite.courseId}?lesson=${favorite.lessonId}&from=/bookmarks`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary"
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 40}ms both`,
      }}
    >
      <div
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: favorite.accentColor }}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-sans text-sm font-medium text-foreground">
          {favorite.lessonTitle}
        </span>
        <span className="truncate font-sans text-xs text-muted-foreground">
          {favorite.courseTitle}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {favorite.completed ? (
          <CheckCircle className="size-3.5 text-primary" weight="fill" />
        ) : percentage > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="w-12">
              <ProgressBar value={percentage} />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {percentage}%
            </span>
          </div>
        ) : null}

        <span className="flex w-10 items-center justify-end gap-1 font-mono text-[11px] text-muted-foreground">
          {favorite.duration > 0 && (
            <>
              <Clock className="size-3 shrink-0" />
              {favorite.duration}m
            </>
          )}
        </span>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(favorite.lessonId);
          }}
          className="rounded-md p-1 text-red-500 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100"
        >
          <Heart className="size-3.5" weight="fill" />
        </button>
      </div>
    </Link>
  );
}
