import { useEffect, useState } from "react";
import {
  PlayIcon as Play,
  CheckCircleIcon as CheckCircle,
  CaretDownIcon as CaretDown,
  HeartIcon as Heart,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { Section, Lesson } from "@/types";

interface SectionAccordionProps {
  section: Section;
  activeLessonId: number | undefined;
  onSelectLesson: (lesson: Lesson) => void;
  onToggleComplete: (lessonId: number) => void;
  onToggleFavorite: (lessonId: number) => void;
}

export function SectionAccordion({
  section,
  activeLessonId,
  onSelectLesson,
  onToggleComplete,
  onToggleFavorite,
}: SectionAccordionProps) {
  const completedCount = section.lessons.filter((l) => l.completed).length;
  const allComplete =
    completedCount === section.lessons.length && section.lessons.length > 0;
  const hasActiveLesson = section.lessons.some((l) => l.id === activeLessonId);
  const [open, setOpen] = useState(hasActiveLesson);

  useEffect(() => {
    setOpen(hasActiveLesson);
  }, [hasActiveLesson]);
  const sectionDuration = section.lessons.reduce(
    (sum, l) => sum + l.duration,
    0,
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        <CaretDown
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: `transform 300ms ${EASE}`,
          }}
        />

        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </span>
            {allComplete && (
              <CheckCircle className="ml-auto size-3.5 text-primary" weight="fill" />
            )}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {section.lessons.length} {section.lessons.length === 1 ? "lesson" : "lessons"}
            {sectionDuration > 0 && <> · {formatDuration(sectionDuration)}</>}
          </span>
        </div>
      </button>

      <div
        style={{
          maxHeight: open ? section.lessons.length * 52 + 8 : 0,
          opacity: open ? 1 : 0,
          transition: `max-height 350ms ${EASE}, opacity 250ms ${EASE}`,
        }}
        className="overflow-hidden"
      >
        <div className="flex flex-col gap-px px-2 pt-1 pb-2">
          {section.lessons.map((lesson, index) => {
            const isActive = lesson.id === activeLessonId;

            return (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary",
                  isActive && "bg-primary/5",
                )}
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "translateX(0)" : "translateX(-6px)",
                  transition: `opacity 300ms ${EASE} ${index * 30}ms, transform 300ms ${EASE} ${index * 30}ms`,
                }}
              >
                <div
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(lesson.id);
                  }}
                >
                  {lesson.completed ? (
                    <CheckCircle
                      className="size-4 text-primary"
                      weight="fill"
                    />
                  ) : isActive ? (
                    <div className="flex size-4 items-center justify-center">
                      <Play className="size-3.5 text-primary" weight="fill" />
                    </div>
                  ) : (
                    <LessonProgress
                      progress={lesson.duration > 0 ? lesson.lastPosition / (lesson.duration * 60) : 0}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    "flex-1 font-sans text-xs",
                    lesson.completed
                      ? "text-muted-foreground"
                      : "text-foreground",
                    isActive && "font-medium text-primary",
                  )}
                >
                  {lesson.title}
                </span>

                <span
                  className="relative flex shrink-0 items-center justify-end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(lesson.id);
                  }}
                >
                  {lesson.favorited ? (
                    <Heart className="size-3 text-red-500 transition-colors hover:text-red-400" weight="fill" />
                  ) : (
                    <>
                      <span className="font-mono text-[11px] text-muted-foreground transition-opacity group-hover:opacity-0">
                        {lesson.duration > 0 ? `${lesson.duration}m` : ""}
                      </span>
                      <Heart
                        className="absolute size-3 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:!text-red-400"
                        weight="regular"
                      />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CIRCLE_R = 6;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

function LessonProgress({ progress }: { progress: number }) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const hasProgress = clamped > 0.01;

  return (
    <div className="relative flex size-4 items-center justify-center">
      <svg className="absolute size-4" viewBox="0 0 16 16">
        <circle
          cx="8"
          cy="8"
          r={CIRCLE_R}
          fill="none"
          className={cn(
            "transition-colors",
            hasProgress ? "stroke-primary/15" : "stroke-border group-hover:stroke-muted-foreground",
          )}
          strokeWidth="1.5"
        />
        {hasProgress && (
          <circle
            cx="8"
            cy="8"
            r={CIRCLE_R}
            fill="none"
            className="stroke-primary"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={CIRCLE_C}
            strokeDashoffset={CIRCLE_C * (1 - clamped)}
            transform="rotate(-90 8 8)"
          />
        )}
      </svg>
    </div>
  );
}
