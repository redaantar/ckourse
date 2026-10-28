import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COURSE_COLORS, courseColorAt, courseColorPosition } from "@/lib/color";
import { SPRING_SNAPPY } from "@/lib/constants";

interface CourseColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** id of the visible label, for aria-labelledby */
  labelledBy?: string;
  className?: string;
}

const STEP = 1 / 90; // 3.5° of hue per arrow press

/**
 * A hue slider over the course palette. The track is painted with the exact colors
 * the slider produces — equal chroma, lightness on the gamut cusp — so what you see
 * along it is what you get, and no position yields a muddy or neon cover. The twelve
 * presets below are shortcuts, not the limit.
 */
export function CourseColorPicker({ value, onChange, labelledBy, className }: CourseColorPickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const position = courseColorPosition(value);

  const track = useMemo(
    () =>
      `linear-gradient(to right, ${Array.from({ length: 25 }, (_, i) => courseColorAt(i / 24)).join(", ")})`,
    [],
  );

  const setFromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(courseColorAt((clientX - r.left) / r.width));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? STEP : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -STEP : 0;
    if (e.key === "Home") onChange(courseColorAt(0));
    else if (e.key === "End") onChange(courseColorAt(1));
    else if (delta) onChange(courseColorAt(position + delta * (e.shiftKey ? 6 : 1)));
    else return;
    e.preventDefault();
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelledBy}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position * 100)}
        aria-valuetext="Hue"
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setFromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging && setFromPointer(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative h-7 cursor-pointer touch-none rounded-full focus-visible:outline-offset-4"
        style={{ backgroundImage: track }}
      >
        {/* Inner hairline so the track reads as an object on both light and dark cards */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/10" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 size-6 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgb(0_0_0/0.35)]"
          style={{
            left: `calc(${position * 100}% - ${position * 28}px + 2px)`,
            backgroundColor: value,
            transform: `translateY(-50%) scale(${dragging ? 1.15 : 1})`,
            transition: dragging ? `transform ${SPRING_SNAPPY}` : `left ${SPRING_SNAPPY}, transform ${SPRING_SNAPPY}`,
          }}
        />
      </div>

      <div role="radiogroup" aria-label="Preset colors" className="flex justify-between">
        {COURSE_COLORS.map(({ name, value: preset }) => {
          const selected = preset.toUpperCase() === value.toUpperCase();
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              onClick={() => onChange(preset)}
              className={cn(
                "size-5 rounded-full ring-offset-2 ring-offset-card transition-shadow duration-150",
                selected ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border",
              )}
              style={{ backgroundColor: preset }}
            />
          );
        })}
      </div>
    </div>
  );
}
