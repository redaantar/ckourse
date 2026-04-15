import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MagnifyingGlassIcon as MagnifyingGlass,
  BookOpenIcon as BookOpen,
  PlayCircleIcon as PlayCircle,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { searchContent } from "@/lib/store";
import type { SearchResult } from "@/types";
import { spring } from "./constants";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

interface SidebarSearchProps {
  collapsed: boolean;
}

export function SidebarSearch({ collapsed }: SidebarSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const openModal = useCallback(() => setOpen(true), []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // "/" keybind to open modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        openModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openModal]);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    searchContent(q).then((res) => {
      setResults(res);
      setActiveIndex(-1);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 200);
  };

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      if (result.kind === "lesson") {
        navigate(`/course/${result.courseId}`, {
          state: { focusLessonId: result.lessonId },
        });
      } else {
        navigate(`/course/${result.courseId}`);
      }
      closeModal();
    },
    [navigate, closeModal],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigateToResult(results[activeIndex]);
    } else if (e.key === "Escape") {
      closeModal();
    }
  };

  const courseResults = results.filter((r) => r.kind === "course");
  const lessonResults = results.filter((r) => r.kind === "lesson");
  const hasResults = results.length > 0;

  return (
    <>
      {/* Sidebar trigger button */}
      <button
        onClick={openModal}
        className={cn(
          "squircle flex w-full items-center bg-sidebar-accent/50 py-2.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
        )}
      >
        <MagnifyingGlass className="size-4 shrink-0" />
        <div
          className="flex flex-1 items-center overflow-hidden"
          style={{
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? 0 : 200,
            transition: `opacity ${spring()}, max-width ${spring()}`,
          }}
        >
          <span className="font-sans text-sm">Search</span>
          <kbd className="ml-auto shrink-0 rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>
      </button>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: `opacity 400ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
        onPointerDown={closeModal}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        style={{ pointerEvents: open ? "auto" : "none" }}
        onPointerDown={closeModal}
      >
        <div
          className="w-full max-w-lg"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(-8px)",
            transition: `opacity 350ms ${EASE_OUT}, transform 350ms ${EASE_OUT}`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* border layer */}
          <div className="squircle-subtle absolute inset-0 bg-border/60" />
          {/* fill layer */}
          <div className="squircle-subtle absolute inset-px bg-card" />

          <div className="relative">
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Search courses and lessons…"
                className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query ? (
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setQuery("");
                    setResults([]);
                    setActiveIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  esc
                </kbd>
              )}
            </div>

            {/* Divider + results */}
            {hasResults && (
              <>
                <div className="mx-4 h-px bg-border/50" />
                <div className="max-h-80 overflow-y-auto py-2">
                  {courseResults.length > 0 && (
                    <div>
                      <div className="px-4 pb-1 pt-2">
                        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          Courses
                        </span>
                      </div>
                      {courseResults.map((r) => {
                        const globalIdx = results.indexOf(r);
                        return (
                          <button
                            key={`course-${r.courseId}`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              navigateToResult(r);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              activeIndex === globalIdx
                                ? "bg-secondary text-foreground"
                                : "text-foreground hover:bg-secondary/60",
                            )}
                          >
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${r.accentColor}22` }}
                            >
                              <BookOpen
                                className="size-4"
                                style={{ color: r.accentColor }}
                                weight="bold"
                              />
                            </span>
                            <span className="truncate font-sans text-sm">{r.courseTitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {lessonResults.length > 0 && (
                    <div className={cn(courseResults.length > 0 && "mt-1")}>
                      {courseResults.length > 0 && (
                        <div className="mx-4 my-1 h-px bg-border/40" />
                      )}
                      <div className="px-4 pb-1 pt-2">
                        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          Lessons
                        </span>
                      </div>
                      {lessonResults.map((r) => {
                        const globalIdx = results.indexOf(r);
                        return (
                          <button
                            key={`lesson-${r.lessonId}`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              navigateToResult(r);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              activeIndex === globalIdx
                                ? "bg-secondary text-foreground"
                                : "text-foreground hover:bg-secondary/60",
                            )}
                          >
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${r.accentColor}22` }}
                            >
                              <PlayCircle
                                className="size-4"
                                style={{ color: r.accentColor }}
                                weight="bold"
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-sans text-sm">{r.lessonTitle}</div>
                              <div className="truncate font-sans text-xs text-muted-foreground">
                                {r.courseTitle}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Empty state */}
            {query.trim() && !hasResults && (
              <>
                <div className="mx-4 h-px bg-border/50" />
                <div className="px-4 py-8 text-center">
                  <p className="font-sans text-sm text-muted-foreground">
                    No results for <span className="text-foreground">"{query}"</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
