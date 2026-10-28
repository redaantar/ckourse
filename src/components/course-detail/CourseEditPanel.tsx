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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EASE_OUT, SNAPPY } from "@/lib/constants";
import type { CourseCategory, Course } from "@/types";
import { getCustomCategories, addCustomCategory, deleteCustomCategory } from "@/lib/store";
import { CourseColorPicker } from "@/components/ui/course-color-picker";
import { CourseCover } from "@/components/dashboard/CourseCover";

const builtinCategories: { value: CourseCategory; label: string }[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "devops", label: "DevOps" },
  { value: "database", label: "Database" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" },
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
    <div className={cn("mx-auto w-full max-w-[1100px] px-6 pt-10 pb-20 lg:px-10", className)}>
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
          className="-ml-2 inline-flex h-8 items-center gap-1 rounded-full pr-3 pl-2 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {course.title.length > 40 ? "Back to course" : course.title}
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
        <h2 className="font-heading text-[34px] leading-tight font-semibold text-foreground">
          Course settings
        </h2>
        <p className="mt-1 font-sans text-[15px] text-muted-foreground">
          How this course appears in your library, and what happens to its progress.
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
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-card px-4 py-3">
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs text-muted-foreground select-text" title={course.folderPath}>
            {course.folderPath}
          </span>
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
          <h3 className="font-heading text-[17px] font-semibold text-foreground">
            Details
          </h3>

          {/* Live preview: the cover as it will sit on your shelf */}
          <CourseCover
            title={title.trim() || "Untitled course"}
            author={author.trim()}
            accentColor={accentColor}
            className="aspect-[16/10] w-full max-w-72 rounded-2xl shadow-card"
          />

          <FieldGroup label="Title">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              aria-invalid={!title.trim() || undefined}
            />
          </FieldGroup>

          <FieldGroup label="Author">
            <Input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Instructor name"
            />
          </FieldGroup>

          <CategoryPicker
            category={category}
            onCategoryChange={setCategory}
            customCategories={customCategories}
            onCustomCategoriesChange={setCustomCategories}
          />

          <div className="flex flex-col gap-2">
            <span id="accent-color-label" className="flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground">
              <Palette className="size-3.5" />
              Color
            </span>
            <CourseColorPicker
              value={accentColor}
              onChange={setAccentColor}
              labelledBy="accent-color-label"
              className="max-w-sm"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={!title.trim() || !hasChanges || saving}
            >
              <FloppyDisk className="size-4" weight="bold" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {!title.trim() ? (
              <span className="font-sans text-xs text-destructive">
                Title is required
              </span>
            ) : hasChanges && (
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
          <h3 className="font-heading text-[17px] font-semibold text-foreground">
            Progress and data
          </h3>

          <div className="rounded-2xl border border-border bg-card shadow-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <ArrowCounterClockwise className="size-4 text-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-sans text-sm font-medium text-foreground">
                  Start over
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  Mark all lessons as incomplete and clear watch history.
                </p>
                {!confirmReset ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmReset(true)}
                    className="mt-3"
                  >
                    Reset progress
                  </Button>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleResetProgress}
                    >
                      Reset all lessons
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-destructive/25 bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <Trash className="size-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-sans text-sm font-medium text-foreground">
                  Remove from library
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  Remove this course from your library. Your files on disk won't
                  be affected.
                </p>
                {!confirmDelete ? (
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3"
                  >
                    Remove course
                  </Button>
                ) : (
                  <div className="mt-3">
                    <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
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
                      <Button variant="destructive" size="sm" onClick={handleDelete}>
                        Remove for good
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                        Cancel
                      </Button>
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
      <span id="category-label" className="font-sans text-xs font-medium text-muted-foreground">
        Category
      </span>
      <div role="group" aria-labelledby="category-label" className="flex flex-wrap gap-1.5">
        {builtinCategories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            aria-pressed={category === cat.value}
            className={cn(
              "rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150",
              category === cat.value
                ? "border-transparent bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
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
                ? "border-transparent bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            style={{ transitionTimingFunction: SNAPPY }}
          >
            <button onClick={() => onCategoryChange(name)} aria-pressed={category === name}>{name}</button>
            <button
              onClick={() => handleDelete(name)}
              aria-label={`Delete category ${name}`}
              title={`Delete category ${name}`}
              className="flex items-center justify-center rounded-full p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-1 rounded-full border border-input bg-card pl-3 pr-1.5 py-1.5">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              placeholder="Category name"
              aria-label="New category name"
              className="w-24 bg-transparent font-sans text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAdd}
              aria-label="Add category"
              title="Add category"
              className="flex items-center justify-center rounded-full p-1 text-foreground transition-colors hover:bg-secondary"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setAdding(false); setNewName(""); }}
              aria-label="Cancel"
              title="Cancel"
              className="flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/10"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-input px-3 py-1.5 font-sans text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-input hover:text-foreground"
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
    <label className="flex flex-col gap-2">
      <span className="font-sans text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
