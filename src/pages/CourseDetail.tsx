import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ActivePathContext } from "@/hooks/usePageVisible";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  FileTextIcon as FileText,
  FileIcon as File,
  LinkIcon as LinkSimple,
  ArrowLeftIcon as ArrowLeft,
  NotePencilIcon as NotePencil,
  PencilSimpleIcon as PencilSimple,
  FolderOpenIcon as FolderOpen,
  SpinnerGapIcon as SpinnerGap,
  SidebarSimpleIcon as SidebarSimple,
  BookmarkSimpleIcon as BookmarkSimple,
  HeartIcon as Heart,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/posthog";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { VideoPlayerHandle } from "@/types";
import { VideoPlayer } from "@/components/course-detail/VideoPlayer";
import { SectionAccordion } from "@/components/course-detail/SectionAccordion";
import { NotesPanel } from "@/components/course-detail/NotesPanel";
import { CourseEditPanel } from "@/components/course-detail/CourseEditPanel";
import { CourseCelebration } from "@/components/course-detail/CourseCelebration";
import { EASE_OUT, SNAPPY } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { Note, Course, CourseDetail as CourseDetailData, Lesson, Subtitle } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { useCourseTitles } from "@/components/app-shell/CourseTitleContext";
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
} from "@/lib/store";

interface CourseDetailProps {
  className?: string;
}

function getStatusBadge(status: string) {
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

const resourceIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  document: FileText,
  text: FileText,
  link: LinkSimple,
  file: File,
  archive: File,
  code: File,
  image: File,
  other: File,
};

export function CourseDetail({ className }: CourseDetailProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const numericId = Number(courseId);
  const isValidId = courseId != null && !isNaN(numericId) && numericId > 0;
  const lessonParam = searchParams.get("lesson");
  const fromParam = searchParams.get("from") || "/";

  const [course, setCourse] = useState<Course | null>(null);
  const [courseData, setCourseData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    if (!isValidId) return Promise.resolve();
    return Promise.all([getCourse(numericId), getCourseDetail(numericId)]).then(
      ([c, d]) => {
        setCourse(c);
        setCourseData(d);
      },
    );
  }, [numericId, isValidId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

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
          "mx-auto flex max-w-4xl items-center justify-center py-32",
          className,
        )}
      >
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isValidId || !course || !courseData) {
    return (
      <div className={cn("mx-auto max-w-4xl", className)}>
        <p className="font-sans text-sm text-muted-foreground">
          {!isValidId ? "Invalid course." : "Course not found."}
        </p>
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
  backTo: string;
  isVisible: boolean;
  onDataChange: () => Promise<void>;
  onEdit: () => void;
  onToggleBookmark: () => Promise<void>;
  className?: string;
}) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const { setTitle: setBreadcrumbTitle } = useCourseTitles();
  const allLessons = courseData.sections.flatMap((s) => s.lessons);

  useEffect(() => {
    setBreadcrumbTitle(course.id, course.title);
  }, [course.id, course.title, setBreadcrumbTitle]);

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
  }, [initialLessonId]);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"resources" | "notes">("notes");
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

  const handleOpenResource = async (path: string) => {
    try {
      await openPath(path);
    } catch (err) {
      // Expected when the file was moved/deleted outside the app — debug-level.
      console.debug("openPath failed", err);
      reportError(err, "CourseDetail.handleOpenResource", {
        path,
        severity: "expected",
      });
      toast.error("Couldn't open resource", {
        description: "The file may have been moved or deleted.",
      });
    }
  };

  const hasNext =
    activeLesson &&
    allLessons.findIndex((l) => l.id === activeLesson.id) <
      allLessons.length - 1;

  return (
    <div className={cn("mx-auto max-w-6xl", className)}>
      <div
        className="mb-4 flex items-center justify-between"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(8px)",
          transition: `opacity 500ms ${EASE_OUT}, transform 500ms ${EASE_OUT}`,
        }}
      >
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurriculumOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-secondary hover:text-foreground",
              curriculumOpen ? "text-muted-foreground" : "text-foreground bg-secondary",
            )}
            style={{ transitionTimingFunction: SNAPPY }}
          >
            <SidebarSimple
              className="size-3.5 transition-transform duration-300"
              style={{
                transform: curriculumOpen ? "scaleX(1)" : "scaleX(-1)",
                transitionTimingFunction: SNAPPY,
              }}
            />
            {curriculumOpen ? "Hide" : "Show Curriculum"}
          </button>
          <button
            onClick={onToggleBookmark}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-secondary hover:text-foreground",
              course.bookmarked ? "text-primary" : "text-muted-foreground",
            )}
            style={{ transitionTimingFunction: SNAPPY }}
          >
            <BookmarkSimple className="size-3.5" weight={course.bookmarked ? "fill" : "regular"} />
            {course.bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            style={{ transitionTimingFunction: SNAPPY }}
          >
            <PencilSimple className="size-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div
        className="flex flex-col lg:flex-row"
        style={{
          gap: curriculumOpen ? 20 : 0,
          transition: `gap 400ms ${SNAPPY}`,
        }}
      >
        <div
          className="flex flex-1 flex-col gap-4"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 600ms ${EASE_OUT} 80ms, transform 600ms ${EASE_OUT} 80ms`,
          }}
        >
          <VideoPlayer
            ref={videoPlayerRef}
            lesson={activeLesson}
            subtitles={subtitles}
            hasNext={!!hasNext}
            accentColor={course.accentColor}
            autoPlay={autoPlay}
            autoSkipEnabled={settings.autoplay_next}
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
            <div className="flex items-center gap-2">
              <h2 className="font-sans text-base font-semibold text-foreground">
                {activeLesson.title}
              </h2>
              <button
                onClick={() => handleToggleFavorite(activeLesson.id)}
                className={cn(
                  "rounded-md p-1 transition-colors",
                  activeLesson.favorited
                    ? "text-red-500 hover:bg-red-500/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-red-400",
                )}
              >
                <Heart
                  className="size-3.5"
                  weight={activeLesson.favorited ? "fill" : "regular"}
                />
              </button>
              <button
                onClick={() => handleToggleComplete(activeLesson.id)}
                className={cn(
                  "ml-auto flex items-center gap-1 rounded-md px-2 py-1 font-sans text-xs font-medium transition-colors",
                  activeLesson.completed
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <CheckCircle
                  className="size-3.5"
                  weight={activeLesson.completed ? "fill" : "regular"}
                />
                {activeLesson.completed ? "Completed" : "Mark complete"}
              </button>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <p className="font-sans text-sm text-muted-foreground">
                by {course.author}
              </p>
              {getStatusBadge(course.status)}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {formatDuration(courseData.totalDuration)}
                </span>
              </div>
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {course.completedLessons}/{course.totalLessons} lessons
              </span>
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {percentage}%
              </span>
            </div>

            <div className="mt-2">
              <ProgressBar value={percentage} />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-1">
              {courseData.resources.length > 0 && (
                <button
                  onClick={() => setActiveTab("resources")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-sans text-xs font-medium transition-colors",
                    activeTab === "resources"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={{ transitionTimingFunction: SNAPPY }}
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="size-3.5" />
                    Resources
                  </span>
                </button>
              )}
              <button
                onClick={() => setActiveTab("notes")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-sans text-xs font-medium transition-colors",
                  activeTab === "notes"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{ transitionTimingFunction: SNAPPY }}
              >
                <span className="flex items-center gap-1.5">
                  <NotePencil className="size-3.5" />
                  Notes
                  {lessonNotes.length > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {lessonNotes.length}
                    </span>
                  )}
                </span>
              </button>
            </div>

            {activeTab === "resources" && courseData.resources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {courseData.resources.map((resource) => {
                  const Icon = resourceIcons[resource.type] || File;
                  return (
                    <button
                      key={resource.id}
                      onClick={() => handleOpenResource(resource.path)}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-all duration-150 hover:scale-[1.02] hover:bg-secondary active:scale-[0.98]"
                      style={{ transitionTimingFunction: SNAPPY }}
                    >
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="font-sans text-xs font-medium text-foreground">
                        {resource.title}
                      </span>
                    </button>
                  );
                })}
              </div>
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
          className="lg:shrink-0 overflow-clip self-start sticky top-4"
          style={{
            width: curriculumOpen ? 320 : 0,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `width 400ms ${SNAPPY}, opacity 600ms ${EASE_OUT} 160ms, transform 600ms ${EASE_OUT} 160ms`,
          }}
        >
          <div
            className="flex h-[85vh] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-heading text-sm font-bold text-foreground">
                Curriculum
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {course.completedLessons}/{course.totalLessons}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
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

      <CourseCelebration
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />

      {pendingTimestampNav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-5"
            style={{
              animation: "timestamp-dialog-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <h3 className="font-heading text-sm font-bold text-foreground">
              Switch lesson?
            </h3>
            <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
              This timestamp is from{" "}
              <span className="font-medium text-foreground">
                {pendingTimestampNav.lessonTitle}
              </span>
              . Switching will save your current position.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingTimestampNav(null)}
                className="rounded-lg px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                style={{ transitionTimingFunction: SNAPPY }}
              >
                Cancel
              </button>
              <button
                onClick={confirmTimestampNav}
                className="rounded-lg bg-primary px-3 py-1.5 font-sans text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                style={{ transitionTimingFunction: SNAPPY }}
              >
                Switch & Jump
              </button>
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
