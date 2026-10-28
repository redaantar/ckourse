import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpenIcon as FolderOpen,
  UploadSimpleIcon as UploadSimple,
  FileVideoIcon as FileVideo,
  CaretLeftIcon as CaretLeft,
  WarningIcon as Warning,
  CaretDownIcon as CaretDown,
  CaretRightIcon as CaretRight,
  FileIcon as File,
  DotsSixVerticalIcon as DotsSixVertical,
  PencilSimpleIcon as PencilSimple,
  CloudIcon as Cloud,
  HardDrivesIcon as HardDrives,
  CaretUpDownIcon as CaretUpDown,
  PlusIcon as Plus,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import type { CourseCategory, ParsedCourse, ParsedSection, ParsedLesson } from "@/types";
import { selectCourseFolder, parseCourseFolder } from "@/lib/courseParser";
import {
  driveCredentialsStatus,
  driveAuthStatus,
  driveConnect,
  drivePickFolder,
  parseDriveFolder,
} from "@/lib/drive";
import { getServers, parseServerFolder, type ServerConfig } from "@/lib/servers";
import { ServerBrowser } from "@/components/ServerBrowser";
import { importCourse, getCustomCategories, addCustomCategory, deleteCustomCategory } from "@/lib/store";
import { DEFAULT_COURSE_COLOR } from "@/lib/color";
import { Input } from "@/components/ui/input";
import { CourseColorPicker } from "@/components/ui/course-color-picker";
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { CourseCover } from "@/components/dashboard/CourseCover";
import { formatDuration } from "@/lib/format";

function makeId() {
  return Math.random().toString(36).slice(2, 11);
}

interface StructureIds {
  sections: string[];
  lessons: string[][];
}

const builtinCategories: { value: CourseCategory; label: string }[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "devops", label: "DevOps" },
  { value: "database", label: "Database" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" },
];

interface ImportCourseProps {
  className?: string;
}

export function ImportCourse({ className }: ImportCourseProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "configure">("select");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForDrive, setWaitingForDrive] = useState(false);
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [errorNeedsSettings, setErrorNeedsSettings] = useState(false);

  // Single entry point for surfacing/clearing the parse error so the
  // "needs settings" flag never drifts out of sync with the message.
  const showError = (msg: string | null, needsSettings = false) => {
    setParseError(msg);
    setErrorNeedsSettings(needsSettings);
  };
  const [parsedCourse, setParsedCourse] = useState<ParsedCourse | null>(null);
  const [structureIds, setStructureIds] = useState<StructureIds>({ sections: [], lessons: [] });
  const [isImporting, setIsImporting] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [accentColor, setAccentColor] = useState(DEFAULT_COURSE_COLOR);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    getCustomCategories().then(setCustomCategories).catch(() => {});
  }, []);

  const applyParsed = (result: ParsedCourse) => {
    setParsedCourse(result);
    setStructureIds({
      sections: result.sections.map(() => makeId()),
      lessons: result.sections.map((s) => s.lessons.map(() => makeId())),
    });
    setTitle(result.title);
    setStep("configure");
  };

  const handleParseCourse = async (folderPath: string) => {
    setIsLoading(true);
    showError(null);

    try {
      applyParsed(await parseCourseFolder(folderPath));
    } catch (err) {
      showError(typeof err === "string" ? err : "Failed to parse course folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderSelect = async () => {
    try {
      const folderPath = await selectCourseFolder();
      if (folderPath) {
        await handleParseCourse(folderPath);
      }
    } catch (err) {
      showError("Failed to open folder picker");
    }
  };

  const handleDriveImport = async () => {
    showError(null);
    setWaitingForDrive(true);
    try {
      if (!(await driveCredentialsStatus())) {
        showError("Connect your Google Drive before importing.", true);
        return;
      }
      if (!(await driveAuthStatus()).connected) {
        await driveConnect();
      }
      // Folder picker opens in the system browser; user picks one course folder.
      const folder = await drivePickFolder();
      setWaitingForDrive(false);
      setIsLoading(true);
      applyParsed(await parseDriveFolder(folder.id, folder.name));
    } catch (err) {
      const msg = typeof err === "string" ? err : "";
      // Cancelling the picker is a deliberate action, not an error.
      if (/cancel/i.test(msg)) return;
      // Missing credentials can also surface here (not just the pre-check above);
      // point the user at Settings so they can add them.
      if (/credentials? (not set|not configured)/i.test(msg)) {
        showError(msg, true);
        return;
      }
      showError(msg || "Failed to import from Google Drive");
    } finally {
      setWaitingForDrive(false);
      setIsLoading(false);
    }
  };

  const handleServerImport = async () => {
    showError(null);
    try {
      const saved = await getServers();
      if (saved.length === 0) {
        showError("Add a server in Settings before importing from one.", true);
        return;
      }
      setServers(saved);
      setBrowsing(true);
    } catch (err) {
      showError(typeof err === "string" ? err : "Couldn't load your servers");
    }
  };

  // The browser lists one directory at a time; walking the whole tree only
  // happens here, once the user has committed to a folder.
  const handleServerFolderPicked = async (
    server: ServerConfig,
    path: string,
    name: string,
  ) => {
    setBrowsing(false);
    setIsLoading(true);
    showError(null);
    try {
      applyParsed(await parseServerFolder(server.id, path, name || server.name));
    } catch (err) {
      showError(typeof err === "string" ? err : "Couldn't read that folder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (items.length > 0) {
      const item = items[0];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          // In Tauri, dropped folders/files expose a native path
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const path = (file as any).path as string | undefined;
          if (path) {
            await handleParseCourse(path);
          } else {
            showError("Could not read the dropped folder path. Try using Browse instead.");
          }
        }
      }
    }
  };

  const reorderSections = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setParsedCourse((prev) => {
      if (!prev) return prev;
      const sections = arrayMove(prev.sections, fromIdx, toIdx).map((s, i) => ({ ...s, order: i }));
      return { ...prev, sections };
    });
    setStructureIds((prev) => ({
      sections: arrayMove(prev.sections, fromIdx, toIdx),
      lessons: arrayMove(prev.lessons, fromIdx, toIdx),
    }));
  };

  const reorderLessons = (sectionIdx: number, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setParsedCourse((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => {
        if (i !== sectionIdx) return s;
        const lessons = arrayMove(s.lessons, fromIdx, toIdx).map((l, j) => ({ ...l, order: j }));
        return { ...s, lessons };
      });
      return { ...prev, sections };
    });
    setStructureIds((prev) => ({
      sections: prev.sections,
      lessons: prev.lessons.map((arr, i) => (i === sectionIdx ? arrayMove(arr, fromIdx, toIdx) : arr)),
    }));
  };

  const renameSection = (sectionIdx: number, newTitle: string) => {
    setParsedCourse((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => (i === sectionIdx ? { ...s, title: newTitle } : s));
      return { ...prev, sections };
    });
  };

  const renameLesson = (sectionIdx: number, lessonIdx: number, newTitle: string) => {
    setParsedCourse((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => {
        if (i !== sectionIdx) return s;
        const lessons = s.lessons.map((l, j) => (j === lessonIdx ? { ...l, title: newTitle } : l));
        return { ...s, lessons };
      });
      return { ...prev, sections };
    });
  };

  const handleImport = async () => {
    if (!parsedCourse) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setIsImporting(true);
    showError(null);

    try {
      const courseId = await importCourse(parsedCourse, {
        title: trimmedTitle,
        author: author.trim(),
        accentColor,
        category,
      });
      navigate(`/course/${courseId}`);
    } catch (err) {
      showError(typeof err === "string" ? err : "Failed to import course");
    } finally {
      setIsImporting(false);
    }
  };

  if (isImporting) {
    return (
      <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <LoadingAnimation className="size-16" />
        <p className="mt-2 font-sans text-sm font-semibold text-foreground">
          Adding to your library…
        </p>
        <p className="mt-1.5 font-sans text-xs text-muted-foreground">
          Setting up chapters and lessons
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-6 pt-12 pb-20 lg:px-10",
        className,
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            showError(null);
            if (step === "configure") setStep("select");
            else navigate("/");
          }}
          className="-ml-3 text-muted-foreground"
        >
          <CaretLeft className="size-4" />
          {step === "configure" ? "Choose a different folder" : "Home"}
        </Button>
        <div className="flex items-center gap-2" aria-label={`Step ${step === "select" ? 1 : 2} of 2`}>
          {[1, 2].map((n) => (
            <span
              key={n}
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300",
                (step === "select" ? 1 : 2) === n ? "w-5 bg-foreground" : "w-1.5 bg-input",
              )}
            />
          ))}
          <span className="ml-1 font-sans text-[13px] font-medium text-muted-foreground">
            Step {step === "select" ? 1 : 2} of 2
          </span>
        </div>
      </div>

      <header className="mb-10">
        <h1 className="font-heading text-[34px] leading-tight font-semibold text-foreground">
          {step === "select" ? "Add a course" : "Make it yours"}
        </h1>
        <p className="mt-1 font-sans text-[15px] text-muted-foreground">
          {step === "select"
            ? "Point Ckourse at a folder of videos. It finds the chapters, lessons, subtitles and files for you."
            : "Here's what we found. Name it, give it a color, and fix the order if anything looks off."}
        </p>
      </header>

      {step === "select" ? (
        <FolderSelectStep
          isDragOver={isDragOver}
          isLoading={isLoading}
          waitingForDrive={waitingForDrive}
          error={parseError}
          errorNeedsSettings={errorNeedsSettings}
          onGoToSettings={() => navigate("/settings")}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false);
          }}
          onDrop={handleDrop}
          onBrowse={handleFolderSelect}
          onImportDrive={handleDriveImport}
          onImportServer={handleServerImport}
        />
      ) : parsedCourse ? (
        <ConfigureStep
          course={parsedCourse}
          structureIds={structureIds}
          onReorderSections={reorderSections}
          onReorderLessons={reorderLessons}
          onRenameSection={renameSection}
          onRenameLesson={renameLesson}
          title={title}
          onTitleChange={setTitle}
          author={author}
          onAuthorChange={setAuthor}
          category={category}
          onCategoryChange={setCategory}
          customCategories={customCategories}
          onCustomCategoriesChange={setCustomCategories}
          accentColor={accentColor}
          onAccentColorChange={setAccentColor}
          onImport={handleImport}
          error={parseError}
        />
      ) : null}

      {browsing && (
        <ServerBrowser
          servers={servers}
          onPick={handleServerFolderPicked}
          onClose={() => setBrowsing(false)}
        />
      )}
    </div>
  );
}

function FolderSelectStep({
  isDragOver,
  isLoading,
  waitingForDrive,
  error,
  errorNeedsSettings,
  onGoToSettings,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  onImportDrive,
  onImportServer,
}: {
  isDragOver: boolean;
  isLoading: boolean;
  waitingForDrive: boolean;
  error: string | null;
  errorNeedsSettings: boolean;
  onGoToSettings: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
  onImportDrive: () => void;
  onImportServer: () => void;
}) {
  const busy = isLoading || waitingForDrive;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label="Choose a course folder"
        aria-busy={isLoading}
        aria-disabled={busy}
        className={cn(
          "group rounded-3xl border-2 border-dashed transition-colors duration-200",
          busy ? "cursor-default" : "cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/8"
            : "border-input bg-card/50 hover:border-muted-foreground/60 hover:bg-card",
        )}
        onClick={busy ? undefined : onBrowse}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onBrowse();
          }
        }}
      >
        <div className="flex min-h-80 flex-col items-center justify-center gap-5 px-6 py-14" aria-live="polite">
          {isLoading ? (
            <>
              <LoadingAnimation />
              <div className="text-center">
                <p className="font-sans text-[15px] font-semibold text-foreground">Reading the folder…</p>
                <p className="mt-1 font-sans text-[13px] text-muted-foreground">
                  Finding videos, subtitles and resources
                </p>
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "flex size-18 items-center justify-center rounded-[22px] shadow-card transition-[background-color,color,transform] duration-300",
                  isDragOver ? "scale-110 bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                )}
                style={{ transitionTimingFunction: "var(--spring-snappy)" }}
              >
                {isDragOver ? (
                  <UploadSimple className="size-8" weight="bold" />
                ) : (
                  <FolderOpen className="size-8" weight="duotone" />
                )}
              </div>

              <div className="text-center">
                <p className="font-heading text-lg font-semibold text-foreground">
                  {isDragOver ? "Let go to add it" : "Drop a course folder here"}
                </p>
                <p className="mt-1 font-sans text-[13px] text-muted-foreground">
                  One folder per course. Subfolders become chapters.
                </p>
              </div>

              <span
                aria-hidden="true"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 font-sans text-sm font-medium text-foreground shadow-card transition-colors group-hover:bg-secondary"
              >
                Choose a folder…
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SourceCard
          icon={<Cloud className="size-5" weight="duotone" />}
          title="Google Drive"
          description={waitingForDrive ? "Finish signing in in your browser…" : "Stream a course from a Drive folder"}
          onClick={onImportDrive}
          disabled={busy}
        />
        <SourceCard
          icon={<HardDrives className="size-5" weight="duotone" />}
          title="Your server"
          description="SFTP · WebDAV · S3"
          onClick={onImportServer}
          disabled={busy}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <Warning className="mt-0.5 size-4 shrink-0 text-destructive" weight="fill" />
          <p className="font-sans text-sm text-destructive select-text">
            {error}
            {errorNeedsSettings && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onGoToSettings}
                  className="font-semibold text-destructive underline underline-offset-2 transition-opacity hover:opacity-80"
                >
                  Open Settings
                </button>
              </>
            )}
          </p>
        </div>
      )}

      <p className="mt-2 flex items-center justify-center gap-1.5 font-sans text-xs text-muted-foreground">
        <FileVideo className="size-3.5" aria-hidden="true" />
        Works with MP4, MKV, MOV, AVI and most other video formats
      </p>
    </div>
  );
}

/** A secondary source: equal in shape to each other, quieter than the folder drop zone above. */
function SourceCard({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-colors duration-150 hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate font-sans text-xs text-muted-foreground">{description}</span>
      </span>
      <CaretRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ConfigureStep({
  course,
  structureIds,
  onReorderSections,
  onReorderLessons,
  onRenameSection,
  onRenameLesson,
  title,
  onTitleChange,
  author,
  onAuthorChange,
  category,
  onCategoryChange,
  customCategories,
  onCustomCategoriesChange,
  accentColor,
  onAccentColorChange,
  onImport,
  error,
}: {
  course: ParsedCourse;
  structureIds: StructureIds;
  onReorderSections: (from: number, to: number) => void;
  onReorderLessons: (sectionIdx: number, from: number, to: number) => void;
  onRenameSection: (sectionIdx: number, newTitle: string) => void;
  onRenameLesson: (sectionIdx: number, lessonIdx: number, newTitle: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  author: string;
  onAuthorChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  customCategories: string[];
  onCustomCategoriesChange: (v: string[]) => void;
  accentColor: string;
  onAccentColorChange: (v: string) => void;
  onImport: () => void;
  error: string | null;
}) {
  const totalLessons = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = structureIds.sections.indexOf(String(active.id));
    const toIdx = structureIds.sections.indexOf(String(over.id));
    if (fromIdx === -1 || toIdx === -1) return;
    onReorderSections(fromIdx, toIdx);
  };

  const totalMins = Math.round(
    course.sections.reduce((sum, s) => sum + s.lessons.reduce((t, l) => t + l.durationSecs, 0), 0) / 60,
  );
  const canImport = !!title.trim() && totalLessons > 0;
  const guessed = course.confidence !== "high";

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/*
        Details: one tall column — the cover on top, the fields that shape it directly
        beneath, so every keystroke and swatch lands just above where you're typing.
        Its height sets the row; the chapter list matches it and scrolls inside.
      */}
      <section
        aria-labelledby="import-details-title"
        className="flex flex-col gap-3"
      >
        <h2 id="import-details-title" className="px-1 font-heading text-[20px] font-semibold text-foreground">
          Details
        </h2>
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <CourseCover
          title={title.trim() || "Untitled course"}
          author={author.trim() || undefined}
          accentColor={accentColor}
          className="aspect-[16/10] rounded-xl shadow-pop"
        />

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Field label="Title" htmlFor="import-title">
              <Input
                id="import-title"
                type="text"
                dir="auto"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Course title"
                aria-invalid={!title.trim() || undefined}
              />
            </Field>
            <Field label="Instructor" htmlFor="import-author">
              <Input
                id="import-author"
                type="text"
                dir="auto"
                value={author}
                onChange={(e) => onAuthorChange(e.target.value)}
                placeholder="Who teaches it"
              />
            </Field>
            <TopicField
              category={category}
              onCategoryChange={onCategoryChange}
              customCategories={customCategories}
              onCustomCategoriesChange={onCustomCategoriesChange}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <span id="import-accent-label" className="font-sans text-xs font-medium text-muted-foreground">
              Color
            </span>
            <CourseColorPicker value={accentColor} onChange={onAccentColorChange} labelledBy="import-accent-label" />
          </div>
        </div>

        {(course.description || course.resources.length > 0) && (
          <div className="flex flex-col gap-4 border-t border-border pt-6">
            {course.description && (
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-xs font-medium text-muted-foreground">About, from the README</span>
                <p dir="auto" className="line-clamp-3 font-sans text-[13px] leading-relaxed text-foreground select-text">
                  {course.description}
                </p>
              </div>
            )}
            {course.resources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-sans text-xs font-medium text-muted-foreground">Course files</span>
                {course.resources.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-sans text-xs text-muted-foreground"
                    title={r.title}
                  >
                    <File className="size-3 shrink-0" />
                    <span className="truncate">{r.title}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      {/* Out of flow on wide screens, so it takes the Details column's height instead of setting its own */}
      <div className="relative min-h-[28rem] lg:min-h-0">
      <section
        aria-labelledby="import-structure-title"
        className="flex flex-col gap-3 lg:absolute lg:inset-0"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
          <h2 id="import-structure-title" className="font-heading text-[20px] font-semibold text-foreground">
            Chapters and lessons
          </h2>
          <span className="font-sans text-[13px] text-muted-foreground tabular-nums">
            {course.sections.length} {course.sections.length === 1 ? "chapter" : "chapters"} · {totalLessons}{" "}
            {totalLessons === 1 ? "lesson" : "lessons"}
            {totalMins > 0 && ` · ${formatDuration(totalMins)}`}
          </span>
        </div>

        <div className="flex max-h-[36rem] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:max-h-none">
          {/* The order caveat lives on the list it's about, not as a page-wide alarm */}
          <div
            className={cn(
              "flex shrink-0 items-start gap-2.5 border-b border-border px-4 py-3 font-sans text-[13px]",
              guessed && course.confidence === "low" ? "bg-destructive/8" : guessed ? "bg-warning/8" : "bg-secondary/50",
            )}
          >
            {guessed ? (
              <Warning
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  course.confidence === "low" ? "text-destructive" : "text-warning",
                )}
                weight="fill"
              />
            ) : (
              <DotsSixVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" weight="bold" />
            )}
            <p className="text-muted-foreground">
              {guessed && (
                <span className="font-medium text-foreground">
                  {course.confidence === "low" ? "Hard to read this folder — please check the order. " : "Order was guessed. "}
                </span>
              )}
              {guessed && course.confidenceReasons.length > 0 && `${course.confidenceReasons.join(" · ")}. `}
              Drag to reorder, double-click a name to rename.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={structureIds.sections} strategy={verticalListSortingStrategy}>
                {course.sections.map((section, si) => (
                  <SortableSection
                    key={structureIds.sections[si]}
                    id={structureIds.sections[si]}
                    section={section}
                    lessonIds={structureIds.lessons[si] ?? []}
                    defaultOpen={course.sections.length <= 3}
                    onRenameSection={(t) => onRenameSection(si, t)}
                    onRenameLesson={(li, t) => onRenameLesson(si, li, t)}
                    onReorderLessons={(from, to) => onReorderLessons(si, from, to)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </section>
      </div>
      </div>

      {/*
        Commit bar: pinned to the bottom of the view, so the one action on this page
        is reachable whether the course has 3 lessons or 300.
      */}
      <div className="sticky bottom-4 z-20 -mx-2">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-popover/95 p-3 pl-4 shadow-pop backdrop-blur-xl">
          <CourseCover
            title={title}
            accentColor={accentColor}
            showTitle={false}
            className="hidden aspect-[16/10] w-14 shrink-0 rounded-md sm:block"
          />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="truncate font-sans text-sm font-medium text-foreground">
              {title.trim() || "Untitled course"}
            </p>
            <p
              className={cn("truncate font-sans text-xs", error || !title.trim() ? "text-destructive" : "text-muted-foreground")}
              title={error ?? course.folderPath}
              role={error ? "alert" : undefined}
            >
              {error ?? (title.trim() ? course.folderPath : "Give the course a title to add it")}
            </p>
          </div>
          <Button size="lg" onClick={onImport} disabled={!canImport} className="shrink-0">
            Add to library
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="font-sans text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Topic as a field that opens a menu, instead of a cloud of chips that wraps unevenly
 * and grows with every custom topic. Creating one happens in place; removing a
 * custom topic is offered only while it's the one selected.
 */
function TopicField({
  category,
  onCategoryChange,
  customCategories,
  onCustomCategoriesChange,
}: {
  category: string;
  onCategoryChange: (v: string) => void;
  customCategories: string[];
  onCustomCategoriesChange: (v: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const isBuiltin = builtinCategories.some((c) => c.value === trimmed.toLowerCase());
    const isDuplicate = customCategories.includes(trimmed);
    if (!isBuiltin && !isDuplicate) {
      await addCustomCategory(trimmed);
      onCustomCategoriesChange([...customCategories, trimmed]);
    }
    onCategoryChange(isBuiltin ? trimmed.toLowerCase() : trimmed);
    setNewName("");
    setAdding(false);
  };

  const handleDelete = async (name: string) => {
    await deleteCustomCategory(name);
    onCustomCategoriesChange(customCategories.filter((c) => c !== name));
    if (category === name) onCategoryChange("other");
  };

  const label = builtinCategories.find((c) => c.value === category)?.label ?? category;
  const isCustom = customCategories.includes(category);

  if (adding) {
    return (
      <Field label="Topic" htmlFor="import-new-topic">
        <Input
          id="import-new-topic"
          ref={inputRef}
          dir="auto"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") {
              setNewName("");
              setAdding(false);
            }
          }}
          placeholder="New topic — Return to add, Esc to cancel"
        />
      </Field>
    );
  }

  return (
    <Field label="Topic" htmlFor="import-topic">
    <Menu>
      <MenuTrigger asChild>
        <button
          id="import-topic"
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-left transition-[border-color,box-shadow] outline-none hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[state=open]:border-input"
        >
          <span dir="auto" className="min-w-0 flex-1 truncate font-sans text-sm text-foreground">
            {label}
          </span>
          <CaretUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <MenuRadioGroup value={category} onValueChange={onCategoryChange}>
          {builtinCategories.map((c) => (
            <MenuRadioItem key={c.value} value={c.value}>
              {c.label}
            </MenuRadioItem>
          ))}
          {customCategories.length > 0 && <MenuSeparator />}
          {customCategories.map((name) => (
            <MenuRadioItem key={name} value={name}>
              <span dir="auto" className="truncate">
                {name}
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={() => setAdding(true)}>
          <Plus />
          New topic…
        </MenuItem>
        {isCustom && (
          <MenuItem onSelect={() => void handleDelete(category)} className="text-destructive [&_svg]:text-destructive">
            <Trash />
            Delete “{category}”
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
    </Field>
  );
}

function SortableSection({
  id,
  section,
  lessonIds,
  defaultOpen,
  onRenameSection,
  onRenameLesson,
  onReorderLessons,
}: {
  id: string;
  section: ParsedSection;
  lessonIds: string[];
  defaultOpen: boolean;
  onRenameSection: (newTitle: string) => void;
  onRenameLesson: (lessonIdx: number, newTitle: string) => void;
  onReorderLessons: (from: number, to: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionMins = Math.round(section.lessons.reduce((sum, l) => sum + l.durationSecs, 0) / 60);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const lessonSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = lessonIds.indexOf(String(active.id));
    const toIdx = lessonIds.indexOf(String(over.id));
    if (fromIdx === -1 || toIdx === -1) return;
    onReorderLessons(fromIdx, toIdx);
  };

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
    >
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="group/section flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary"
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder section"
            className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground opacity-0 transition-[opacity,color] group-hover/section:opacity-100 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing"
          >
            <DotsSixVertical className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse section" : "Expand section"}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground"
          >
            {isOpen ? (
              <CaretDown className="size-3.5" />
            ) : (
              <CaretRight className="size-3.5" />
            )}
          </button>
          <EditableTitle
            value={section.title}
            onSave={onRenameSection}
            ariaLabel="Edit section title"
            className="flex-1 truncate text-left font-sans text-sm font-semibold text-foreground"
            inputClassName="w-full min-w-0 flex-1 bg-transparent font-sans text-sm font-semibold text-foreground focus:outline-none"
          />
          <span className="shrink-0 font-sans text-xs text-muted-foreground tabular-nums">
            {section.lessons.length} {section.lessons.length === 1 ? "lesson" : "lessons"}
            {sectionMins > 0 && ` · ${formatDuration(sectionMins)}`}
          </span>
        </div>

        {isOpen && (
          <div className="pb-1 pl-7">
            <DndContext
              sensors={lessonSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleLessonDragEnd}
            >
              <SortableContext items={lessonIds} strategy={verticalListSortingStrategy}>
                {section.lessons.map((lesson, li) => (
                  <SortableLesson
                    key={lessonIds[li]}
                    id={lessonIds[li]}
                    lesson={lesson}
                    index={li}
                    onRename={(t) => onRenameLesson(li, t)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableLesson({
  id,
  lesson,
  index,
  onRename,
}: {
  id: string;
  lesson: ParsedLesson;
  index: number;
  onRename: (newTitle: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder lesson"
        className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing"
      >
        <DotsSixVertical className="size-4" weight="bold" />
      </button>
      <span className="w-5 shrink-0 text-right font-sans text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <EditableTitle
          value={lesson.title}
          onSave={onRename}
          ariaLabel="Edit lesson title"
          className="min-w-0 flex-1 truncate text-left font-sans text-[13px] text-foreground"
          inputClassName="w-full min-w-0 flex-1 bg-transparent font-sans text-[13px] text-foreground focus:outline-none"
        />
        {lesson.subtitles.length > 0 && (
          <span
            className="shrink-0 rounded border border-border px-1 font-sans text-[10px] leading-4 font-semibold text-muted-foreground"
            title="Has subtitles"
          >
            CC
          </span>
        )}
        {lesson.resources.length > 0 && (
          <span
            title={lesson.resources.map((r) => r.title).join("\n")}
            className="flex shrink-0 items-center gap-0.5 font-sans text-[11px] text-muted-foreground"
          >
            <File className="size-3" aria-hidden="true" />
            {lesson.resources.length}
            <span className="sr-only">{lesson.resources.length === 1 ? "file" : "files"}</span>
          </span>
        )}
        {lesson.durationSecs > 0 && (
          <span className="w-12 shrink-0 text-right font-sans text-xs text-muted-foreground tabular-nums">
            {formatDuration(Math.max(1, Math.round(lesson.durationSecs / 60)))}
          </span>
        )}
      </div>
    </div>
  );
}

function EditableTitle({
  value,
  onSave,
  ariaLabel,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (newValue: string) => void;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        aria-label={ariaLabel}
        dir="auto"
        className={inputClassName}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        dir="auto"
        onDoubleClick={startEditing}
        className={className}
        title={value}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={ariaLabel}
        title={ariaLabel}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/section:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <PencilSimple className="size-3" weight="bold" />
      </button>
    </div>
  );
}
