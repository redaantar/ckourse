import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  MagnifyingGlassIcon as MagnifyingGlass,
  PlusIcon as Plus,
  CaretUpDownIcon as CaretUpDown,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { FeaturedCourse } from "@/components/dashboard/FeaturedCourse";
import { EmptyLibrary } from "@/components/dashboard/EmptyLibrary";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Course, DashboardStats, CourseCategory, CourseStatus } from "@/types";
import { byLastWatched, getCourses, getDashboardStats } from "@/lib/store";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

type SortOption = "recent" | "progress" | "title";

const builtinCategoryLabels: Record<CourseCategory | "all", string> = {
  all: "All",
  frontend: "Frontend",
  backend: "Backend",
  devops: "DevOps",
  database: "Database",
  design: "Design",
  other: "Other",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** One encouraging, true sentence — never a guilt trip. */
function encouragement(stats: DashboardStats | null, inProgress: number): string {
  if (stats && stats.currentStreak >= 2) return `${stats.currentStreak} days in a row. Keep the thread going.`;
  if (stats && stats.currentStreak === 1) return "You learned something today.";
  if (inProgress > 0) return `${inProgress} ${inProgress === 1 ? "course" : "courses"} in progress.`;
  return "What will you learn today?";
}

/** The course most worth resuming: latest-watched unfinished one, else the first unfinished. */
function pickFeatured(courses: Course[]): Course | null {
  return byLastWatched(courses).find((c) => c.status !== "completed") ?? courses.find((c) => c.status !== "completed") ?? courses[0] ?? null;
}

function getCategoryLabel(cat: string): string {
  return builtinCategoryLabels[cat as CourseCategory | "all"] ?? cat;
}

const statusLabels: Record<CourseStatus | "all", string> = {
  all: "All",
  "in-progress": "In progress",
  "not-started": "Not started",
  completed: "Completed",
};

const sortLabels: Record<SortOption, string> = {
  recent: "Recently watched",
  progress: "Most progress",
  title: "Title",
};

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className }: DashboardProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Derive filter state from URL search params
  const search = searchParams.get("q") ?? "";
  const category = (searchParams.get("cat") ?? "all") as CourseCategory | "all";
  const status = (searchParams.get("status") ?? "all") as CourseStatus | "all";
  const sort = (searchParams.get("sort") ?? "recent") as SortOption;

  const updateParam = useCallback(
    (key: string, value: string, remove?: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (remove || !value || value === "all" || value === "recent") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setSearch = useCallback((v: string) => updateParam("q", v), [updateParam]);
  const setCategory = useCallback((v: CourseCategory | "all") => updateParam("cat", v), [updateParam]);
  const setStatus = useCallback((v: CourseStatus | "all") => updateParam("status", v), [updateParam]);
  const setSort = useCallback((v: SortOption) => updateParam("sort", v), [updateParam]);

  const loadCourses = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setLoadError(false);
    Promise.all([getCourses(), getDashboardStats()])
      .then(([c, s]) => {
        setCourses(c ?? []);
        setStats(s);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCourses(true);
  }, [loadCourses]);

  // The library's old "saved only" filter is the Saved page now
  const legacyBookmarkFilter = searchParams.get("bm") === "1";
  useEffect(() => {
    if (legacyBookmarkFilter) navigate("/bookmarks", { replace: true });
  }, [legacyBookmarkFilter, navigate]);

  // Refresh data when page becomes visible again (keep-alive)
  // Silent refresh so returning to the page doesn't flash a spinner
  usePageVisible("/", () => loadCourses());

  const filteredCourses = useMemo(() => {
    let result = courses;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q)
      );
    }

    if (category !== "all") {
      result = result.filter((c) => c.category === category);
    }

    if (status !== "all") {
      result = result.filter((c) => c.status === status);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "recent": {
          if (!a.lastWatched && !b.lastWatched) return 0;
          if (!a.lastWatched) return 1;
          if (!b.lastWatched) return -1;
          return new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime();
        }
        case "progress": {
          const pA = a.totalLessons ? a.completedLessons / a.totalLessons : 0;
          const pB = b.totalLessons ? b.completedLessons / b.totalLessons : 0;
          return pB - pA;
        }
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [courses, search, category, status, sort]);

  const availableCategories = useMemo(() => {
    const cats = new Set(courses.map((c) => c.category));
    return ["all" as const, ...Array.from(cats)] as (CourseCategory | "all")[];
  }, [courses]);

  const featured = useMemo(() => pickFeatured(courses), [courses]);

  const handleImport = () => {
    navigate("/import");
  };

  if (loading) {
    // Hold the space quietly; a spinner for a local database read is mostly noise
    return <div className={cn("min-h-[60vh]", className)} aria-busy="true" />;
  }

  if (loadError) {
    return (
      <div className={cn("px-10", className)}>
        <EmptyState
          icon={MagnifyingGlass}
          size="page"
          title="Your library didn't load"
          description="Nothing is lost — this is usually a hiccup reading the database."
          action={
            <Button variant="outline" size="sm" onClick={() => loadCourses(true)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className={cn("px-6 lg:px-10", className)}>
        <EmptyLibrary onImport={handleImport} />
      </div>
    );
  }

  const inProgress = courses.filter((c) => c.status === "in-progress").length;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={cn("mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-6 pt-12 pb-20 lg:px-10", className)}>
      <header
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="font-sans text-[13px] font-medium text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-heading text-[34px] leading-tight font-semibold text-foreground">{greeting()}</h1>
          <p className="mt-1 font-sans text-[15px] text-muted-foreground">{encouragement(stats, inProgress)}</p>
        </div>
        <Button onClick={handleImport}>
          <Plus className="size-4" weight="bold" />
          Add course
        </Button>
      </header>

      {featured && (
        <section aria-label="Up next">
          <FeaturedCourse course={featured} />
        </section>
      )}

      <section aria-labelledby="library-title" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="library-title" className="mr-2 font-heading text-[22px] font-semibold text-foreground">
            Library
          </h2>
          <SegmentedControl
            aria-label="Filter by status"
            value={status}
            onChange={setStatus}
            options={(Object.keys(statusLabels) as (CourseStatus | "all")[]).map((s) => ({
              value: s,
              label: statusLabels[s],
            }))}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {availableCategories.length > 2 && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(category !== "all" && "bg-secondary text-foreground")}>
                    {category === "all" ? "All topics" : getCategoryLabel(category)}
                    <CaretUpDown className="size-3.5" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>Topic</MenuLabel>
                  <MenuRadioGroup value={category} onValueChange={(v) => setCategory(v as CourseCategory | "all")}>
                    {availableCategories.map((cat) => (
                      <MenuRadioItem key={cat} value={cat}>
                        {cat === "all" ? "All topics" : getCategoryLabel(cat)}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuContent>
              </Menu>
            )}

            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={`Sort: ${sortLabels[sort]}`}>
                  {sortLabels[sort]}
                  <CaretUpDown className="size-3.5" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Sort by</MenuLabel>
                <MenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  {(Object.keys(sortLabels) as SortOption[]).map((s) => (
                    <MenuRadioItem key={s} value={s}>
                      {sortLabels[s]}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuLabel>{courses.length} courses in your library</MenuLabel>
              </MenuContent>
            </Menu>

            <SearchInput value={search} onChange={setSearch} placeholder="Search library" className="w-full sm:w-56" />
          </div>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-x-6 gap-y-8">
            {filteredCourses.map((course) => (
              <div key={course.id}>
                <CourseCard course={course} onBookmarkChange={loadCourses} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MagnifyingGlass}
            title="Nothing matches"
            description={search ? `No course matches "${search}" with these filters.` : "No courses match these filters."}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchParams({}, { replace: true });
                }}
              >
                Show everything
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
