import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LottieLib from "lottie-react";

// Handle CJS/ESM default export interop: in some Vite/Rollup build modes
// lottie-react resolves to the module namespace object rather than the component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lottie: React.ComponentType<{ animationData: unknown; loop?: boolean; className?: string }> = (LottieLib as any).default ?? LottieLib;
import {
  FolderOpenIcon as FolderOpen,
  UploadSimpleIcon as UploadSimple,
  FileVideoIcon as FileVideo,
  CaretLeftIcon as CaretLeft,
  CheckCircleIcon as CheckCircle,
  PaletteIcon as Palette,
  WarningIcon as Warning,
  CaretDownIcon as CaretDown,
  CaretRightIcon as CaretRight,
  FileIcon as File,
} from "@phosphor-icons/react";
import loadingAnimation from "@/assets/lotties/loading.json";
import { cn } from "@/lib/utils";
import { SquircleButton } from "@/components/ui/SquircleButton";
import type { CourseCategory, ParsedCourse, ParsedSection } from "@/types";
import { selectCourseFolder, parseCourseFolder } from "@/lib/courseParser";
import { importCourse, getCustomCategories, addCustomCategory, deleteCustomCategory } from "@/lib/store";
import { EASE_OUT } from "@/lib/constants";

const builtinCategories: { value: CourseCategory; label: string }[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "devops", label: "DevOps" },
  { value: "database", label: "Database" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" },
];

const accentColors = [
  "#61DAFB",
  "#F74C00",
  "#8B5CF6",
  "#3178C6",
  "#2496ED",
  "#336791",
  "#E44D26",
  "#38BDF8",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#C8F135",
];

interface ImportCourseProps {
  className?: string;
}

export function ImportCourse({ className }: ImportCourseProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "configure">("select");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCourse, setParsedCourse] = useState<ParsedCourse | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [accentColor, setAccentColor] = useState(accentColors[0]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    getCustomCategories().then(setCustomCategories).catch(() => {});
  }, []);

  const handleParseCourse = async (folderPath: string) => {
    setIsLoading(true);
    setParseError(null);

    try {
      const result = await parseCourseFolder(folderPath);
      setParsedCourse(result);
      setTitle(result.title);
      setStep("configure");
    } catch (err) {
      setParseError(typeof err === "string" ? err : "Failed to parse course folder");
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
      setParseError("Failed to open folder picker");
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
            setParseError("Could not read the dropped folder path. Try using Browse instead.");
          }
        }
      }
    }
  };

  const handleImport = async () => {
    if (!parsedCourse) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setIsImporting(true);

    try {
      const courseId = await importCourse(parsedCourse, {
        title: trimmedTitle,
        author: author.trim(),
        accentColor,
        category,
      });
      navigate(`/course/${courseId}`);
    } catch (err) {
      setParseError(typeof err === "string" ? err : "Failed to import course");
    } finally {
      setIsImporting(false);
    }
  };

  if (isImporting) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <Lottie
          animationData={loadingAnimation}
          loop
          className="size-40"
        />
        <p className="mt-2 font-sans text-sm font-semibold text-foreground">
          Importing course...
        </p>
        <p className="mt-1.5 font-sans text-xs text-muted-foreground">
          Setting up your library
        </p>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-5xl", className)}>
      <button
        onClick={() => (step === "configure" ? setStep("select") : navigate("/"))}
        className="mb-6 flex items-center gap-1.5 font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretLeft className="size-4" />
        {step === "configure" ? "Change folder" : "Back to library"}
      </button>

      <div
        className="mb-8"
        style={{ animation: `card-in 350ms ${EASE_OUT} both` }}
      >
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Import Course
        </h2>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          {step === "select"
            ? "Select a folder containing your course videos to get started."
            : "Review the detected structure and configure your course details."}
        </p>
      </div>

      {step === "select" ? (
        <FolderSelectStep
          isDragOver={isDragOver}
          isLoading={isLoading}
          error={parseError}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onBrowse={handleFolderSelect}
        />
      ) : parsedCourse ? (
        <ConfigureStep
          course={parsedCourse}
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
        />
      ) : null}
    </div>
  );
}

function FolderSelectStep({
  isDragOver,
  isLoading,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: {
  isDragOver: boolean;
  isLoading: boolean;
  error: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ animation: `card-in 350ms ${EASE_OUT} 50ms both` }}>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="group relative cursor-pointer transition-colors"
        onClick={isLoading ? undefined : onBrowse}
      >
        <div
          className={cn(
            "squircle-subtle absolute inset-0 transition-colors",
            isDragOver ? "bg-primary" : "bg-border"
          )}
        />
        <div
          className={cn(
            "squircle-subtle absolute inset-px transition-colors",
            isDragOver ? "bg-primary/10" : "bg-card group-hover:bg-secondary"
          )}
        />

        <div className="relative flex flex-col items-center gap-4 px-6 py-16">
          {isLoading ? (
            <>
              <Lottie
                animationData={loadingAnimation}
                loop
                className="size-28"
              />
              <div className="text-center">
                <p className="font-sans text-sm font-semibold text-foreground">
                  Scanning folder...
                </p>
                <p className="mt-1.5 font-sans text-xs text-muted-foreground">
                  Detecting videos, subtitles, and resources
                </p>
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "flex size-16 items-center justify-center rounded-2xl transition-colors",
                  isDragOver ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                )}
              >
                {isDragOver ? (
                  <UploadSimple className="size-7" weight="bold" />
                ) : (
                  <FolderOpen className="size-7" />
                )}
              </div>

              <div className="text-center">
                <p className="font-sans text-sm font-semibold text-foreground">
                  {isDragOver ? "Drop folder here" : "Drag & drop a course folder"}
                </p>
                <p className="mt-1.5 font-sans text-xs text-muted-foreground">
                  or click to browse your files
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-border/50 bg-secondary px-4 py-2">
                <FolderOpen className="size-4 text-muted-foreground" />
                <span className="font-sans text-xs font-medium text-muted-foreground">
                  Browse Folder
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3">
          <Warning className="size-4 shrink-0 text-destructive" weight="bold" />
          <p className="font-sans text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2">
        <FileVideo className="size-3.5 text-muted-foreground/50" />
        <p className="font-sans text-xs text-muted-foreground/50">
          Supports .mp4, .mkv, .avi, .mov and other video formats
        </p>
      </div>
    </div>
  );
}

function ConfigureStep({
  course,
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
}: {
  course: ParsedCourse;
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
}) {
  const totalLessons = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {course.confidence !== "high" && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg px-4 py-3",
            course.confidence === "low"
              ? "bg-destructive/10"
              : "bg-info/10"
          )}
          style={{ animation: `card-in 350ms ${EASE_OUT} 50ms both` }}
        >
          <Warning
            className={cn(
              "mt-0.5 size-4 shrink-0",
              course.confidence === "low" ? "text-destructive" : "text-info"
            )}
            weight="bold"
          />
          <div>
            <p
              className={cn(
                "font-sans text-sm font-medium",
                course.confidence === "low" ? "text-destructive" : "text-info"
              )}
            >
              {course.confidence === "low"
                ? "Low confidence parse — review carefully"
                : "Some structure was inferred"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {course.confidenceReasons.map((reason, i) => (
                <li
                  key={i}
                  className="font-sans text-xs text-muted-foreground"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ animation: `card-in 350ms ${EASE_OUT} 50ms both` }}>
        <div className="group relative">
          <div className="squircle-subtle absolute inset-0 bg-border" />
          <div className="squircle-subtle absolute inset-px bg-card" />
          <div className="relative flex items-center gap-3 px-4 py-3">
            <FolderOpen className="size-4 shrink-0 text-primary" />
            <span className="truncate font-mono text-xs text-muted-foreground">
              {course.folderPath}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <CheckCircle className="size-4 text-primary" weight="fill" />
              <span className="font-sans text-xs font-medium text-primary">
                {totalLessons} lessons in {course.sections.length}{" "}
                {course.sections.length === 1 ? "section" : "sections"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          className="flex flex-col gap-5"
          style={{ animation: `card-in 350ms ${EASE_OUT} 100ms both` }}
        >
          <h3 className="font-heading text-base font-bold text-foreground">
            Course Details
          </h3>

          <FieldGroup label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Course title"
              className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </FieldGroup>

          <FieldGroup label="Author">
            <input
              type="text"
              value={author}
              onChange={(e) => onAuthorChange(e.target.value)}
              placeholder="Instructor name"
              className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </FieldGroup>

          <CategoryPicker
            category={category}
            onCategoryChange={onCategoryChange}
            customCategories={customCategories}
            onCustomCategoriesChange={onCustomCategoriesChange}
          />

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground">
              <Palette className="size-3.5" />
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2">
              {accentColors.map((color) => (
                <button
                  key={color}
                  onClick={() => onAccentColorChange(color)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform duration-150",
                    accentColor === color
                      ? "scale-110 border-foreground"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {course.description && (
            <div className="flex flex-col gap-2">
              <label className="font-sans text-xs font-medium text-muted-foreground">
                Description (from README)
              </label>
              <p className="line-clamp-4 font-sans text-xs leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            </div>
          )}

          {course.resources.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="font-sans text-xs font-medium text-muted-foreground">
                Course Resources
              </label>
              <div className="flex flex-wrap gap-1.5">
                {course.resources.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary px-2.5 py-1 font-sans text-xs text-muted-foreground"
                  >
                    <File className="size-3" />
                    {r.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="flex flex-col gap-3"
          style={{ animation: `card-in 350ms ${EASE_OUT} 150ms both` }}
        >
          <h3 className="font-heading text-base font-bold text-foreground">
            Course Structure
          </h3>

          <div className="relative">
            <div className="squircle-subtle absolute inset-0 bg-border" />
            <div className="squircle-subtle absolute inset-px bg-card" />
            <div className="relative max-h-112 overflow-y-auto p-1">
              {course.sections.map((section, si) => (
                <SectionItem
                  key={si}
                  section={section}
                  sectionIndex={si}
                  defaultOpen={course.sections.length <= 3}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-3 border-t border-border pt-6"
        style={{ animation: `card-in 350ms ${EASE_OUT} 200ms both` }}
      >
        <span className="font-sans text-xs text-muted-foreground">
          {totalLessons} lessons will be imported
        </span>
        <SquircleButton
          variant="primary"
          onClick={onImport}
          disabled={!title.trim()}
        >
          <UploadSimple className="size-4" weight="bold" />
          Import Course
        </SquircleButton>
      </div>
    </div>
  );
}

function CategoryPicker({
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
    onCategoryChange(trimmed);
    setNewName("");
    setAdding(false);
  };

  const handleDelete = async (name: string) => {
    await deleteCustomCategory(name);
    onCustomCategoriesChange(customCategories.filter((c) => c !== name));
    if (category === name) onCategoryChange("other");
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-sans text-xs font-medium text-muted-foreground">
        Category
      </label>
      <div className="flex flex-wrap gap-1.5">
        {builtinCategories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
              category === cat.value
                ? "border-primary/25 bg-primary/15 text-primary"
                : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
        {customCategories.map((name) => (
          <div
            key={name}
            className={cn(
              "group flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
              category === name
                ? "border-primary/25 bg-primary/15 text-primary"
                : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <button onClick={() => onCategoryChange(name)}>{name}</button>
            <button
              onClick={() => handleDelete(name)}
              className="flex items-center justify-center rounded-full p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 pl-3 pr-1.5 py-1.5">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              placeholder="Category name"
              className="w-24 bg-transparent font-sans text-xs text-primary placeholder:text-primary/50 focus:outline-none"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAdd}
              className="flex items-center justify-center rounded-full p-1 text-primary transition-colors hover:bg-primary/20"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setAdding(false); setNewName(""); }}
              className="flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/10"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-border/50 px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/25 hover:text-primary"
          >
            + Custom
          </button>
        )}
      </div>
    </div>
  );
}

function SectionItem({
  section,
  sectionIndex,
  defaultOpen,
}: {
  section: ParsedSection;
  sectionIndex: number;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        animation: `card-in 250ms ${EASE_OUT} ${(sectionIndex + 2) * 40}ms both`,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary"
      >
        {isOpen ? (
          <CaretDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <CaretRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-left font-sans text-sm font-medium text-foreground">
          {section.title}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {section.lessons.length} {section.lessons.length === 1 ? "lesson" : "lessons"}
        </span>
      </button>

      {isOpen && (
        <div className="ml-5 border-l border-border/50 pl-2">
          {section.lessons.map((lesson, li) => (
            <div
              key={li}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary font-mono text-[10px] font-medium text-muted-foreground group-hover:bg-muted">
                {li + 1}
              </span>
              <div className="flex flex-1 items-center gap-2 overflow-hidden">
                <span className="truncate font-sans text-xs text-foreground">
                  {lesson.title}
                </span>
                {lesson.subtitles.length > 0 && (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-primary">
                    SUB
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-sans text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="group/field relative">
        <div className="squircle absolute inset-0 bg-border/25 transition-colors group-focus-within/field:bg-primary" />
        <div className="squircle absolute inset-px bg-card" />
        <div className="relative px-4 py-2.5">
          {children}
        </div>
      </div>
    </div>
  );
}
