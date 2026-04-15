import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  MagnifyingGlassIcon as MagnifyingGlass,
  PlusIcon as Plus,
  FunnelIcon as Funnel,
  SortAscendingIcon as SortAscending,
  SpinnerGapIcon as SpinnerGap,
  BookmarkSimpleIcon as BookmarkSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { DashboardStatsBar } from "@/components/dashboard/DashboardStats";
import { EmptyLibrary } from "@/components/dashboard/EmptyLibrary";
import { SquircleSearch } from "@/components/ui/SquircleSearch";
import { SquircleButton } from "@/components/ui/SquircleButton";
import type { Course, DashboardStats, CourseCategory, CourseStatus } from "@/types";
import { getCourses, getDashboardStats } from "@/lib/store";
import { EASE, EASE_OUT } from "@/lib/constants";

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

function getCategoryLabel(cat: string): string {
  return builtinCategoryLabels[cat as CourseCategory | "all"] ?? cat;
}

const statusLabels: Record<CourseStatus | "all", string> = {
  all: "All Status",
  "in-progress": "In Progress",
  completed: "Completed",
  "not-started": "Not Started",
};

const sortLabels: Record<SortOption, string> = {
  recent: "Recently Watched",
  progress: "Progress",
  title: "Title A-Z",
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
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);

  // Derive filter state from URL search params
  const search = searchParams.get("q") ?? "";
  const category = (searchParams.get("cat") ?? "all") as CourseCategory | "all";
  const status = (searchParams.get("status") ?? "all") as CourseStatus | "all";
  const sort = (searchParams.get("sort") ?? "recent") as SortOption;
  const showFilters = searchParams.get("filters") === "1";
  const bookmarkFilter = searchParams.get("bm") === "1";

  const updateParam = useCallback(
    (key: string, value: string, remove?: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (remove || !value || value === "all" || value === "recent" || (key === "filters" && value === "0") || (key === "bm" && value === "0")) {
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
  const setShowFilters = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? v(showFilters) : v;
      updateParam("filters", next ? "1" : "0");
    },
    [updateParam, showFilters],
  );
  const setBookmarkFilter = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? v(bookmarkFilter) : v;
      updateParam("bm", next ? "1" : "0");
    },
    [updateParam, bookmarkFilter],
  );

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

  // Refresh data when page becomes visible again (keep-alive)
  usePageVisible("/", () => loadCourses(true));

  useEffect(() => {
    if (filterRef.current) {
      setFilterHeight(filterRef.current.scrollHeight);
    }
  }, [showFilters, category, status]);

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

    if (bookmarkFilter) {
      result = result.filter((c) => c.bookmarked);
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
  }, [courses, search, category, status, sort, bookmarkFilter]);

  const availableCategories = useMemo(() => {
    const cats = new Set(courses.map((c) => c.category));
    return ["all" as const, ...Array.from(cats)] as (CourseCategory | "all")[];
  }, [courses]);

  const handleImport = () => {
    navigate("/import");
  };

  if (loading) {
    return (
      <div className={cn("mx-auto flex max-w-6xl items-center justify-center py-32", className)}>
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn("mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 py-32", className)}>
        <p className="font-sans text-sm text-muted-foreground">Failed to load your library.</p>
        <button
          onClick={() => loadCourses(true)}
          className="font-sans text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          Try again
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className={cn("mx-auto max-w-6xl", className)}>
        <EmptyLibrary onImport={handleImport} />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-6xl", className)}>
      {stats && <DashboardStatsBar stats={stats} className="mb-6" />}

      <div className="mb-6 flex items-center gap-3">
        <SquircleSearch
          value={search}
          onChange={setSearch}
          placeholder="Search courses..."
          className="flex-1"
        />

        <SquircleButton
          variant="secondary"
          active={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Funnel
            className="size-4"
            style={{
              transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
              transition: `transform 500ms ${EASE}`,
            }}
          />
          Filters
        </SquircleButton>

        <SquircleButton variant="primary" onClick={() => navigate("/import")}>
          <Plus className="size-4" weight="bold" />
          Import Course
        </SquircleButton>
      </div>

      <div
        ref={filterRef}
        style={{
          maxHeight: showFilters ? filterHeight : 0,
          opacity: showFilters ? 1 : 0,
          transform: showFilters ? "translateY(0)" : "translateY(-8px)",
          transition: `max-height 350ms ${EASE}, opacity 350ms ${EASE}, transform 350ms ${EASE}`,
          pointerEvents: showFilters ? "auto" : "none",
        }}
        className="overflow-hidden"
      >
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
                  category === cat
                    ? "border-primary/25 bg-primary/15 text-primary"
                    : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            {(Object.keys(statusLabels) as (CourseStatus | "all")[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
                  status === s
                    ? "border-primary/25 bg-primary/15 text-primary"
                    : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          <button
            onClick={() => setBookmarkFilter((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
              bookmarkFilter
                ? "border-primary/25 bg-primary/15 text-primary"
                : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <BookmarkSimple className="size-3" weight={bookmarkFilter ? "fill" : "regular"} />
            Bookmarked
          </button>

          <div className="ml-auto flex items-center gap-2">
            <SortAscending className="size-4 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-transparent font-sans text-xs font-medium text-muted-foreground focus:outline-none"
            >
              {(Object.keys(sortLabels) as SortOption[]).map((s) => (
                <option key={s} value={s}>
                  {sortLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Your Library
        </h2>
        <span className="font-mono text-sm font-medium text-muted-foreground">
          {filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"}
        </span>
      </div>

      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course, index) => (
            <div
              key={course.id}
              style={{
                animation: `card-in 350ms ${EASE_OUT} ${index * 50}ms both`,
              }}
            >
              <CourseCard course={course} onBookmarkChange={loadCourses} />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 py-20 text-center"
          style={{
            animation: `card-in 350ms ${EASE_OUT} both`,
          }}
        >
          <MagnifyingGlass className="size-10 text-muted-foreground/50" />
          <p className="font-sans text-sm text-muted-foreground">
            No courses match your filters.
          </p>
          <button
            onClick={() => {
              setSearchParams({}, { replace: true });
            }}
            className="font-sans text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
