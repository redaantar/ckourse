import { useState, useEffect, useRef } from "react";
import {
  ArrowLeftIcon as ArrowLeft,
  PaletteIcon as Palette,
  TrashIcon as Trash,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  FloppyDiskIcon as FloppyDisk,
  WarningIcon as Warning,
  FolderOpenIcon as FolderOpen,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SquircleButton } from "@/components/ui/SquircleButton";
import { EASE_OUT, SNAPPY } from "@/lib/constants";
import type { CourseCategory, Course } from "@/types";
import { getCustomCategories, addCustomCategory, deleteCustomCategory } from "@/lib/store";

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

interface CourseEditPanelProps {
  course: Course;
  onSave: (title: string, author: string, accentColor: string, category: string) => Promise<void>;
  onResetProgress: () => Promise<void>;
  onDelete: () => Promise<void>;
  onBack: () => void;
  className?: string;
}

export function CourseEditPanel({
  course,
  onSave,
  onResetProgress,
  onDelete,
  onBack,
  className,
}: CourseEditPanelProps) {
  const [title, setTitle] = useState(course.title);
  const [author, setAuthor] = useState(course.author);
  const [category, setCategory] = useState<string>(course.category);
  const [accentColor, setAccentColor] = useState(course.accentColor);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    getCustomCategories().then(setCustomCategories).catch(() => {});
  }, []);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mounted, setMounted] = useState(false);

  useState(() => {
    requestAnimationFrame(() => setMounted(true));
  });

  const hasChanges =
    title.trim() !== course.title ||
    author.trim() !== course.author ||
    category !== course.category ||
    accentColor !== course.accentColor;

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(title.trim(), author.trim(), accentColor, category);
      onBack();
    } finally {
      setSaving(false);
    }
  };

  const handleResetProgress = async () => {
    await onResetProgress();
    setConfirmReset(false);
    onBack();
  };

  const handleDelete = async () => {
    await onDelete();
  };

  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      <div
        className="mb-4"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(8px)",
          transition: `opacity 500ms ${EASE_OUT}, transform 500ms ${EASE_OUT}`,
        }}
      >
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Course
        </button>
      </div>

      <div
        className="mb-8"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: `opacity 600ms ${EASE_OUT} 40ms, transform 600ms ${EASE_OUT} 40ms`,
        }}
      >
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Edit Course
        </h2>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          Update course details or manage progress and data.
        </p>
      </div>

      <div
        className="mb-6"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: `opacity 600ms ${EASE_OUT} 80ms, transform 600ms ${EASE_OUT} 80ms`,
        }}
      >
        <div className="group relative">
          <div className="squircle-subtle absolute inset-0 bg-border" />
          <div className="squircle-subtle absolute inset-px bg-card" />
          <div className="relative flex items-center gap-3 px-4 py-3">
            <FolderOpen className="size-4 shrink-0 text-primary" />
            <span className="truncate font-mono text-xs text-muted-foreground">
              {course.folderPath}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div
          className="flex flex-col gap-5"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 600ms ${EASE_OUT} 120ms, transform 600ms ${EASE_OUT} 120ms`,
          }}
        >
          <h3 className="font-heading text-base font-bold text-foreground">
            Course Details
          </h3>

          <FieldGroup label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </FieldGroup>

          <FieldGroup label="Author">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Instructor name"
              className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </FieldGroup>

          <CategoryPicker
            category={category}
            onCategoryChange={setCategory}
            customCategories={customCategories}
            onCustomCategoriesChange={setCustomCategories}
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
                  onClick={() => setAccentColor(color)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform duration-150",
                    accentColor === color
                      ? "scale-110 border-foreground"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SquircleButton
              variant="primary"
              onClick={handleSave}
              disabled={!title.trim() || !hasChanges || saving}
            >
              <FloppyDisk className="size-4" weight="bold" />
              {saving ? "Saving..." : "Save Changes"}
            </SquircleButton>
            {hasChanges && (
              <span className="font-sans text-xs text-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        <div
          className="flex flex-col gap-5"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 600ms ${EASE_OUT} 160ms, transform 600ms ${EASE_OUT} 160ms`,
          }}
        >
          <h3 className="font-heading text-base font-bold text-foreground">
            Manage
          </h3>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info/10">
                <ArrowCounterClockwise className="size-4 text-info" />
              </div>
              <div className="flex-1">
                <p className="font-sans text-sm font-medium text-foreground">
                  Reset Progress
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  Mark all lessons as incomplete and clear watch history.
                </p>
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="mt-3 rounded-md border border-border px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    style={{ transitionTimingFunction: SNAPPY }}
                  >
                    Reset Progress
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleResetProgress}
                      className="rounded-md bg-info/15 px-3 py-1.5 font-sans text-xs font-medium text-info transition-colors hover:bg-info/25"
                      style={{ transitionTimingFunction: SNAPPY }}
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="rounded-md px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <Trash className="size-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-sans text-sm font-medium text-foreground">
                  Delete Course
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  Remove this course from your library. Your files on disk won't
                  be affected.
                </p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-1.5 font-sans text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                    style={{ transitionTimingFunction: SNAPPY }}
                  >
                    Delete Course
                  </button>
                ) : (
                  <div className="mt-3">
                    <div className="mb-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2">
                      <Warning
                        className="size-3.5 shrink-0 text-destructive"
                        weight="bold"
                      />
                      <span className="font-sans text-xs text-destructive">
                        This will delete all notes and progress. This cannot be
                        undone.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDelete}
                        className="rounded-md bg-destructive px-3 py-1.5 font-sans text-xs font-medium text-white transition-colors hover:bg-destructive/90"
                        style={{ transitionTimingFunction: SNAPPY }}
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-md px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
                : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground",
            )}
            style={{ transitionTimingFunction: SNAPPY }}
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
                : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground",
            )}
            style={{ transitionTimingFunction: SNAPPY }}
          >
            <button onClick={() => onCategoryChange(name)}>{name}</button>
            <button
              onClick={() => handleDelete(name)}
              className="flex items-center justify-center rounded-full p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
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
            style={{ transitionTimingFunction: SNAPPY }}
          >
            + Custom
          </button>
        )}
      </div>
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
        <div className="relative px-4 py-2.5">{children}</div>
      </div>
    </div>
  );
}
