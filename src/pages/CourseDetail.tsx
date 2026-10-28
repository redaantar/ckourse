import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useParams, useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { ActivePathContext } from "@/hooks/usePageVisible";
import { toast } from "sonner";
import {
  CheckCircleIcon as CheckCircle,
  CircleIcon as Circle,
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  PencilSimpleIcon as PencilSimple,
  SidebarSimpleIcon as SidebarSimple,
  BookmarkSimpleIcon as BookmarkSimple,
  HeartIcon as Heart,
  GoogleDriveLogoIcon as GoogleDriveLogo,
  HardDrivesIcon as HardDrives,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { VideoPlayerHandle } from "@/types";
import { VideoPlayer } from "@/components/course-detail/VideoPlayer";
import { SectionAccordion } from "@/components/course-detail/SectionAccordion";
import { NotesPanel } from "@/components/course-detail/NotesPanel";
import { CourseEditPanel } from "@/components/course-detail/CourseEditPanel";
import { CourseCelebration } from "@/components/course-detail/CourseCelebration";
import { PdfViewer } from "@/components/course-detail/PdfViewer";
import { ResourceList } from "@/components/course-detail/ResourceList";
import { EASE_OUT, SPRING_SMOOTH } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { Note, Course, CourseDetail as CourseDetailData, Lesson, Resource, Subtitle } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { routeTitles } from "@/components/app-shell/constants";
import {
  getCourse,
  getCourseDetail,
  getCourseNotes,
  getLessonSubtitles,
  setLastWatched,
  toggleLessonCompleted,
  saveLessonPosition,
  updateLessonDuration,
  updateCourse,
  resetCourseProgress,
  deleteCourse,
  toggleBookmark,
  toggleFavorite,
  addNote as storeAddNote,
  updateNote as storeUpdateNote,
  deleteNote as storeDeleteNote,
  openResource,
} from "@/lib/store";

interface CourseDetailProps {
  className?: string;
}

/** Remote resources (`srv:` / `gdrive:`) have no local path the OS could open. */
function isRemotePath(path: string): boolean {
  return path.startsWith("srv:") || path.startsWith("gdrive:");
}

export function CourseDetail({ className }: CourseDetailProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const numericId = Number(courseId);
  const isValidId = courseId != null && !isNaN(numericId) && numericId > 0;
  const lessonParam = searchParams.get("lesson");
  const fromParam = searchParams.get("from") || "/";
  const seekParam = searchParams.get("t");
  const location = useLocation();

  const [course, setCourse] = useState<Course | null>(null);
  const [courseData, setCourseData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    if (!isValidId) return Promise.resolve();
    return Promise.all([getCourse(numericId), getCourseDetail(numericId)]).then(
      ([c, d]) => {
        setCourse(c);
        setCourseData(d);
        setLoadError(false);
      },
    );
  }, [numericId, isValidId]);

  const initialLoad = useCallback(() => {
    setLoading(true);
    reload()
      .catch((err) => {
        reportError(err, "CourseDetail.load", { courseId: numericId });
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [reload, numericId]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  // Refresh data when this page becomes visible again (keep-alive)
  const activePath = useContext(ActivePathContext);
  const isVisible = activePath.startsWith(`/course/${courseId}`);
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!isVisible) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    reload();
  }, [isVisible, reload]);

  if (loading) {
    return (
      <div
        className={cn(
          "min-h-[60vh]",
          className,
        )}
        aria-busy="true"
      >
      </div>
    );
  }

  if (!isValidId || !course || !courseData) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-32 text-center", className)}>
        <p className="font-sans text-sm text-muted-foreground">
          {!isValidId
            ? "Invalid course."
            : loadError
              ? "This course didn't load. Nothing is lost; try again in a moment."
              : "This course isn't in your library anymore."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={fromParam}>
              <CaretLeft className="size-3.5" weight="bold" />
              Back
            </Link>
          </Button>
          {isValidId && loadError && (
            <Button size="sm" onClick={initialLoad}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <CourseEditPanel
        course={course}
        onSave={async (title, author, accentColor, category) => {
          await updateCourse(course.id, title, author, accentColor, category);
          await reload();
        }}
        onResetProgress={async () => {
          await resetCourseProgress(course.id);
          await reload();
        }}
        onDelete={async () => {
          await deleteCourse(course.id);
          navigate(fromParam);
        }}
        onBack={() => setEditing(false)}
        className={className}
      />
    );
  }

  return (
    <CourseDetailInner
      course={course}
      courseData={courseData}
      initialLessonId={lessonParam ? Number(lessonParam) : undefined}
      initialSeek={seekParam ? Number(seekParam) : undefined}
      navKey={location.key}
      backTo={fromParam}
      isVisible={isVisible}
      onDataChange={reload}
      onEdit={() => setEditing(true)}
      onToggleBookmark={async () => {
        await toggleBookmark(course.id);
        await reload();
      }}
      className={className}
    />
  );
}

function CourseDetailInner({
  course,
  courseData,
  initialLessonId,
  initialSeek,
  navKey,
  backTo,
  isVisible,
  onDataChange,
  onEdit,
  onToggleBookmark,
  className,
}: {
  course: Course;
  courseData: CourseDetailData;
  initialLessonId?: number;
  /** Seconds into the lesson to start at (?t=), e.g. from a note's timestamp */
  initialSeek?: number;
  /** Changes on every navigation, so revisiting the same link re-applies it */
  navKey: string;
  backTo: string;
  isVisible: boolean;
  onDataChange: () => Promise<void>;
  onEdit: () => void;
  onToggleBookmark: () => Promise<void>;
  className?: string;
}) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const allLessons = courseData.sections.flatMap((s) => s.lessons);

  const requestedLesson = initialLessonId
    ? allLessons.find((l) => l.id === initialLessonId)
    : undefined;
  const lastWatchedLesson = allLessons.find((l) => l.isLastWatched);
  const nextLesson = allLessons.find((l) => !l.completed);
  const initialLesson = requestedLesson ?? lastWatchedLesson ?? nextLesson ?? allLessons[0];

  const [activeLessonId, setActiveLessonId] = useState<number | undefined>(
    initialLesson?.id,
  );

  // Sync active lesson when navigating to a specific lesson (e.g. from favorites)
  useEffect(() => {
    if (initialLessonId && allLessons.some((l) => l.id === initialLessonId)) {
      setActiveLessonId(initialLessonId);
    }
  }, [initialLessonId, navKey]);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"resources" | "notes">("notes");
  const [openPdf, setOpenPdf] = useState<Resource | null>(null);
  const lessonResources = activeLesson
    ? courseData.resources.filter((r) => r.lessonId === activeLesson.id)
    : [];
  const hasResources = courseData.resources.length > 0;
  const [notes, setNotes] = useState<Note[]>([]);
  const lessonNotes = activeLesson
    ? notes.filter((n) => n.lessonId === activeLesson.id)
    : [];
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [curriculumOpen, setCurriculumOpen] = useState(true);
  const [videoTime, setVideoTime] = useState(0);
  const videoTimeRef = useRef(0);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  // Arriving from a note's timestamp: land on that moment once its lesson is the active one.
  // The player holds the seek until the video is ready, so the resume position can't override it.
  const noteSeekRef = useRef<{ lessonId: number; seconds: number } | null>(null);
  useEffect(() => {
    const lessonId = initialLessonId ?? activeLesson?.id;
    noteSeekRef.current =
      initialSeek != null && Number.isFinite(initialSeek) && lessonId != null
        ? { lessonId, seconds: initialSeek }
        : null;
  }, [navKey]);
  useEffect(() => {
    const seek = noteSeekRef.current;
    if (!seek || activeLesson?.id !== seek.lessonId) return;
    noteSeekRef.current = null;
    videoPlayerRef.current?.seekTo(seek.seconds);
  }, [navKey, activeLesson?.id]);
  const [pendingTimestampNav, setPendingTimestampNav] = useState<{
    seconds: number;
    lessonId: number;
    lessonTitle: string;
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevCompletedRef = useRef(course.completedLessons);

  const handleTimeUpdate = useCallback((time: number) => {
    setVideoTime(time);
    videoTimeRef.current = time;
  }, []);

  // Save position when leaving the page
  useEffect(() => {
    return () => {
      if (activeLesson && videoTimeRef.current > 0) {
        saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
          reportError(err, "CourseDetail.saveOnUnmount", {
            lessonId: activeLesson.id,
            position: videoTimeRef.current,
          }),
        );
      }
    };
  }, [activeLesson?.id]);

  // Pause video when navigating away (keep-alive hides the page but keeps it mounted)
  useEffect(() => {
    if (!isVisible) {
      videoPlayerRef.current?.pause();
      if (activeLesson && videoTimeRef.current > 0) {
        saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
          reportError(err, "CourseDetail.saveOnHide", {
            lessonId: activeLesson.id,
            position: videoTimeRef.current,
          }),
        );
      }
    }
  }, [isVisible, activeLesson?.id]);

  const percentage =
    course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0;

  // Detect course completion transition
  useEffect(() => {
    const prev = prevCompletedRef.current;
    prevCompletedRef.current = course.completedLessons;

    if (
      course.totalLessons > 0 &&
      prev < course.totalLessons &&
      course.completedLessons === course.totalLessons
    ) {
      setShowCelebration(true);
    }
  }, [course.completedLessons, course.totalLessons]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Re-fetch notes on mount and when course prop changes (e.g. after returning from Notes page)
  useEffect(() => {
    getCourseNotes(course.id).then(setNotes).catch(() => {});
  }, [course]);

  useEffect(() => {
    if (activeLesson) {
      const lessonId = activeLesson.id;
      getLessonSubtitles(lessonId)
        .then(setSubtitles)
        .catch((err) => {
          setSubtitles([]);
          reportError(err, "CourseDetail.getLessonSubtitles", { lessonId });
        });
    } else {
      setSubtitles([]);
    }
  }, [activeLesson?.id]);

  const handleSelectLesson = useCallback(
    async (lesson: Lesson) => {
      // Save position of current lesson before switching
      if (activeLesson && videoTimeRef.current > 0) {
        saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
          reportError(err, "CourseDetail.handleSelectLesson", {
            lessonId: activeLesson.id,
            position: videoTimeRef.current,
          }),
        );
      }

      setActiveLessonId(lesson.id);
      setVideoTime(0);
      videoTimeRef.current = 0;

      await setLastWatched(course.id, lesson.id);
      await onDataChange();
    },
    [course.id, activeLesson?.id, onDataChange],
  );

  const handlePlayStateChange = useCallback(
    (playing: boolean) => {
      if (playing) {
        setAutoPlay(false);
      }
      if (!playing && activeLesson && videoTimeRef.current > 0) {
        saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
          reportError(err, "CourseDetail.handlePlayStateChange", {
            lessonId: activeLesson.id,
            position: videoTimeRef.current,
          }),
        );
      }
    },
    [activeLesson?.id],
  );

  const handleNextLesson = useCallback(async () => {
    if (!activeLesson) return;
    const idx = allLessons.findIndex((l) => l.id === activeLesson.id);
    if (idx >= 0 && idx < allLessons.length - 1) {
      const next = allLessons[idx + 1];
      // Save position of current lesson before switching
      if (videoTimeRef.current > 0) {
        saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
          reportError(err, "CourseDetail.handleNextLesson", {
            lessonId: activeLesson.id,
            position: videoTimeRef.current,
          }),
        );
      }
      setActiveLessonId(next.id);
      setVideoTime(0);
      videoTimeRef.current = 0;
      setAutoPlay(true);
      await setLastWatched(course.id, next.id);
      await onDataChange();
    }
  }, [activeLesson, allLessons, course.id, onDataChange]);

  const handleToggleComplete = useCallback(
    async (lessonId: number) => {
      try {
        await toggleLessonCompleted(lessonId);
        await onDataChange();
      } catch (err) {
        console.error("toggleLessonCompleted failed", err);
        reportError(err, "CourseDetail.handleToggleComplete", { lessonId });
        toast.error("Couldn't update lesson", {
          description: "Try again in a moment.",
        });
      }
    },
    [onDataChange],
  );

  const handleToggleFavorite = useCallback(
    async (lessonId: number) => {
      try {
        await toggleFavorite(lessonId);
        await onDataChange();
      } catch (err) {
        console.error("toggleFavorite failed", err);
        reportError(err, "CourseDetail.handleToggleFavorite", { lessonId });
        toast.error("Couldn't update favorite", {
          description: "Try again in a moment.",
        });
      }
    },
    [onDataChange],
  );

  const handleVideoEnded = useCallback(async () => {
    if (!activeLesson) return;
    if (!activeLesson.completed) {
      try {
        await toggleLessonCompleted(activeLesson.id);
        await onDataChange();
      } catch (err) {
        // Background auto-complete; no toast since it wasn't user-initiated.
        console.error("auto-complete on video end failed", err);
        reportError(err, "CourseDetail.handleVideoEnded.autoComplete", {
          lessonId: activeLesson.id,
        });
      }
    }
  }, [activeLesson, onDataChange]);

  const handleDurationChange = useCallback(
    (duration: number) => {
      if (!activeLesson) return;
      const mins = Math.round(duration / 60);
      if (mins > 0 && mins !== activeLesson.duration) {
        updateLessonDuration(activeLesson.id, mins)
          .then(onDataChange)
          .catch((err) =>
            reportError(err, "CourseDetail.handleDurationChange", {
              lessonId: activeLesson.id,
              durationMinutes: mins,
            }),
          );
      }
    },
    [activeLesson, onDataChange],
  );

  async function handleAddNote(content: string) {
    if (!activeLesson) return;
    try {
      const note = await storeAddNote(
        course.id,
        activeLesson.id,
        activeLesson.title,
        content,
      );
      setNotes((prev) => [note, ...prev]);
      setShowEditor(false);
    } catch (err) {
      // Keep editor open so the user doesn't lose their content.
      console.error("addNote failed", err);
      reportError(err, "CourseDetail.handleAddNote", {
        courseId: course.id,
        lessonId: activeLesson.id,
        contentLength: content.length,
      });
      toast.error("Couldn't save note", {
        description: "Your content is still in the editor.",
      });
    }
  }

  async function handleEditNote(noteId: number, content: string) {
    try {
      await storeUpdateNote(noteId, content);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n,
        ),
      );
      setEditingNoteId(null);
    } catch (err) {
      // Keep edit mode open so the user can retry.
      console.error("updateNote failed", err);
      reportError(err, "CourseDetail.handleEditNote", {
        noteId,
        contentLength: content.length,
      });
      toast.error("Couldn't update note", {
        description: "Your changes weren't saved.",
      });
    }
  }

  async function handleDeleteNote(noteId: number) {
    try {
      await storeDeleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("deleteNote failed", err);
      reportError(err, "CourseDetail.handleDeleteNote", { noteId });
      toast.error("Couldn't delete note", {
        description: "Try again in a moment.",
      });
    }
  }

  const handleTimestampClick = useCallback(
    (seconds: number, lessonId: number) => {
      if (activeLesson && activeLesson.id === lessonId) {
        // Same lesson — just seek
        videoPlayerRef.current?.seekTo(seconds);
      } else {
        // Different lesson — ask for confirmation
        const targetLesson = allLessons.find((l) => l.id === lessonId);
        setPendingTimestampNav({
          seconds,
          lessonId,
          lessonTitle: targetLesson?.title ?? "another lesson",
        });
      }
    },
    [activeLesson, allLessons],
  );

  const confirmTimestampNav = useCallback(async () => {
    if (!pendingTimestampNav) return;
    const { seconds, lessonId } = pendingTimestampNav;
    const targetLesson = allLessons.find((l) => l.id === lessonId);
    if (!targetLesson) return;

    // Save current position
    if (activeLesson && videoTimeRef.current > 0) {
      saveLessonPosition(activeLesson.id, videoTimeRef.current).catch((err) =>
        reportError(err, "CourseDetail.confirmTimestampNav", {
          lessonId: activeLesson.id,
          position: videoTimeRef.current,
        }),
      );
    }

    setActiveLessonId(lessonId);
    setVideoTime(0);
    videoTimeRef.current = 0;
    setPendingTimestampNav(null);

    await setLastWatched(course.id, lessonId);
    await onDataChange();

    // Seek after the new video loads
    requestAnimationFrame(() => {
      setTimeout(() => {
        videoPlayerRef.current?.seekTo(seconds);
      }, 200);
    });
  }, [pendingTimestampNav, activeLesson, allLessons, course.id, onDataChange]);

  const handleOpenResource = (resource: Resource) => {
    if (resource.type === "pdf") {
      videoPlayerRef.current?.pause();
      setOpenPdf(resource);
      return;
    }
    if (isRemotePath(resource.path)) {
      toast.error("Can't open this resource", {
        description: "Only PDFs can be opened from a server or Google Drive course.",
      });
      return;
    }
    void openExternally(resource);
  };

  const openExternally = async (resource: Resource) => {
    try {
      await openResource(resource.id);
    } catch (err) {
      // Expected when the file was moved/deleted outside the app — debug-level.
      console.debug("openResource failed", err);
      reportError(err, "CourseDetail.handleOpenResource", {
        path: resource.path,
        severity: "expected",
      });
      toast.error("Couldn't open resource", {
        description: `No app could open "${resource.title}". Make sure the file still exists and its drive is connected.`,
      });
    }
  };

  const activeIndex = activeLesson ? allLessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const hasNext = activeIndex >= 0 && activeIndex < allLessons.length - 1;
  const upcoming = hasNext ? allLessons[activeIndex + 1] : null;
  const activeSection = activeLesson
    ? courseData.sections.find((s) => s.lessons.some((l) => l.id === activeLesson.id))
    : undefined;
  const isDrive = course.folderPath.startsWith("gdrive:");
  const isServer = course.folderPath.startsWith("srv:");

  return (
    <div className={cn("min-h-full", className)}>
      <div className="flex min-h-full flex-col lg:flex-row">
        <div
          className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-1 flex-col px-6 pt-10 pb-20 lg:px-10"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 600ms ${EASE_OUT} 80ms, transform 600ms ${EASE_OUT} 80ms`,
          }}
        >
          {/* Toolbar: where you came from, what you're watching, and three quiet tools */}
          <div className="mb-4 flex items-center gap-3">
            <Link
              to={backTo}
              aria-label={`Back to ${routeTitles[backTo.split("?")[0]] ?? "previous page"}`}
              title={`Back to ${routeTitles[backTo.split("?")[0]] ?? "previous page"}`}
              className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <CaretLeft className="size-4" weight="bold" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-sans text-sm font-medium text-foreground" title={course.title}>
                {course.title}
              </h1>
              <p className="flex items-center gap-1.5 truncate font-sans text-xs text-muted-foreground">
                {course.author || "Unknown author"}
                {(isDrive || isServer) && (
                  <>
                    <span aria-hidden="true">·</span>
                    {isDrive ? <GoogleDriveLogo className="size-3" /> : <HardDrives className="size-3" />}
                    {isDrive ? "Google Drive" : "Server"}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleBookmark}
                aria-pressed={course.bookmarked}
                aria-label={course.bookmarked ? "Remove from Saved" : "Save course"}
                title={course.bookmarked ? "Remove from Saved" : "Save course"}
                className={cn(course.bookmarked && "text-foreground")}
              >
                <BookmarkSimple className="size-[18px]" weight={course.bookmarked ? "fill" : "regular"} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit course" title="Edit course">
                <PencilSimple className="size-[18px]" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurriculumOpen((o) => !o)}
                aria-expanded={curriculumOpen}
                aria-controls="course-curriculum"
                aria-label={curriculumOpen ? "Hide course content" : "Show course content"}
                title={curriculumOpen ? "Hide course content" : "Show course content"}
                className={cn("hidden lg:inline-flex", !curriculumOpen && "bg-secondary text-foreground")}
              >
                <SidebarSimple className="size-[18px] -scale-x-100" weight={curriculumOpen ? "regular" : "fill"} />
              </Button>
            </div>
          </div>

          <VideoPlayer
            ref={videoPlayerRef}
            lesson={activeLesson}
            subtitles={subtitles}
            hasNext={!!hasNext}
            accentColor={course.accentColor}
            autoPlay={autoPlay}
            autoSkipEnabled={settings.autoplay_next}
            autoSkipSeconds={settings.autoplay_delay_secs}
            initialTime={settingsLoaded ? (settings.resume_position ? activeLesson?.lastPosition : 0) : null}
            defaultSpeed={settings.default_speed}
            defaultVolume={settings.default_volume}
            skipSeconds={settings.skip_forward_secs}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlayStateChange={handlePlayStateChange}
            onEnded={handleVideoEnded}
            onNext={handleNextLesson}
          />

          {activeLesson && (
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="truncate font-sans text-[13px] text-muted-foreground tabular-nums">
                  {activeSection && <>{activeSection.title} · </>}
                  Lesson {activeIndex + 1} of {allLessons.length}
                  {activeLesson.duration > 0 && <> · {formatDuration(activeLesson.duration)}</>}
                </p>
                <h2 className="mt-1 font-heading text-2xl leading-tight font-semibold text-balance text-foreground">
                  {activeLesson.title}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleFavorite(activeLesson.id)}
                  aria-label={activeLesson.favorited ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={activeLesson.favorited}
                  title={activeLesson.favorited ? "Remove from favorites" : "Favorite this lesson"}
                  className={cn(activeLesson.favorited && "text-destructive hover:text-destructive")}
                >
                  <Heart className="size-[18px]" weight={activeLesson.favorited ? "fill" : "regular"} />
                </Button>
                <Button
                  variant={activeLesson.completed ? "secondary" : "outline"}
                  onClick={() => handleToggleComplete(activeLesson.id)}
                  aria-pressed={activeLesson.completed}
                  title={activeLesson.completed ? "Mark as not done" : "Mark this lesson complete"}
                >
                  {activeLesson.completed ? (
                    <CheckCircle key="done" className="check-pop size-4 text-primary" weight="fill" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  {activeLesson.completed ? "Completed" : "Mark complete"}
                </Button>
                {upcoming && (
                  <Button
                    onClick={handleNextLesson}
                    title={`Next: ${upcoming.title}`}
                    className="max-w-64"
                  >
                    <span className="truncate">Next lesson</span>
                    <CaretRight className="size-3.5" weight="bold" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {upcoming && (
            <p className="mt-2 truncate font-sans text-xs text-muted-foreground">
              Up next: <span className="text-foreground">{upcoming.title}</span>
            </p>
          )}

          <div className="mt-10">
            {hasResources ? (
              <SegmentedControl
                aria-label="Lesson panels"
                size="sm"
                value={activeTab}
                onChange={setActiveTab}
                className="mb-4"
                options={[
                  {
                    value: "notes",
                    label: (
                      <>
                        Notes
                        {lessonNotes.length > 0 && <span className="tabular-nums text-muted-foreground">{lessonNotes.length}</span>}
                      </>
                    ),
                  },
                  {
                    value: "resources",
                    label: (
                      <>
                        Resources
                        {lessonResources.length > 0 && (
                          <span className="tabular-nums text-muted-foreground">{lessonResources.length}</span>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            ) : (
              <h3 className="mb-4 font-heading text-[17px] font-semibold text-foreground">Notes</h3>
            )}

            {activeTab === "resources" && hasResources && (
              <ResourceList
                courseData={courseData}
                activeLesson={activeLesson ?? undefined}
                onOpen={handleOpenResource}
              />
            )}

            {activeTab === "notes" && (
              <NotesPanel
                notes={lessonNotes}
                videoTime={Math.floor(videoTime)}
                editingNoteId={editingNoteId}
                showEditor={showEditor}
                onAdd={handleAddNote}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onSetEditing={setEditingNoteId}
                onSetShowEditor={setShowEditor}
                onTimestampClick={handleTimestampClick}
              />
            )}
          </div>
        </div>

        <div
          id="course-curriculum"
          inert={!curriculumOpen}
          className="overflow-clip lg:sticky lg:top-0 lg:h-[calc(100vh-1rem)] lg:shrink-0 lg:self-start"
          style={{
            width: curriculumOpen ? 368 : 0,
            opacity: mounted ? 1 : 0,
            transition: `width ${SPRING_SMOOTH}, opacity 600ms ${EASE_OUT} 160ms`,
          }}
        >
          <div className="flex h-[70vh] w-[368px] flex-col overflow-hidden border-l border-border bg-sidebar/40 lg:h-full">
            <div className="flex items-center gap-3 px-5 pt-10 pb-4">
              <ProgressRing value={percentage} size={36} stroke={3.5} label="Course progress">
                <span className="font-sans text-[10px] font-semibold tabular-nums text-foreground">{percentage}</span>
              </ProgressRing>
              <div className="min-w-0">
                <h2 className="font-heading text-[15px] font-semibold text-foreground">Course content</h2>
                <p className="font-sans text-xs text-muted-foreground tabular-nums">
                  {course.completedLessons} of {course.totalLessons} lessons
                  {courseData.totalDuration > 0 && <> · {formatDuration(courseData.totalDuration)}</>}
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-6">
              {courseData.sections.map((section) => (
                <SectionAccordion
                  key={section.id}
                  section={section}
                  activeLessonId={activeLesson?.id}
                  onSelectLesson={handleSelectLesson}
                  onToggleComplete={handleToggleComplete}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {openPdf && (
        <PdfViewer
          resource={openPdf}
          onClose={() => setOpenPdf(null)}
          onOpenExternally={
            isRemotePath(openPdf.path) ? undefined : () => void openExternally(openPdf)
          }
        />
      )}

      <CourseCelebration
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
        title={course.title}
        accentColor={course.accentColor}
      />

      {pendingTimestampNav && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timestamp-dialog-title"
          onClick={() => setPendingTimestampNav(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPendingTimestampNav(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-2xl bg-popover p-5 shadow-pop"
            style={{
              animation: "timestamp-dialog-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <h3 id="timestamp-dialog-title" className="font-heading text-base font-semibold text-foreground">
              Switch lesson?
            </h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
              This timestamp is from{" "}
              <span className="font-medium text-foreground">
                {pendingTimestampNav.lessonTitle}
              </span>
              . Switching will save your current position.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingTimestampNav(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmTimestampNav} autoFocus>
                Switch & Jump
              </Button>
            </div>
          </div>
          <style>{`
            @keyframes timestamp-dialog-in {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(8px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
