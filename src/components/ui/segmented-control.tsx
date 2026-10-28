import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/constants";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is an icon or includes a count */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "default";
  className?: string;
}

/**
 * macOS-style segmented control. The selection is one physical thumb that slides
 * between segments on a spring, rather than segments lighting up independently —
 * the eye tracks one moving object more easily than a blink in two places.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "default",
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const el = track?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
    if (!track || !el) return;
    const measure = () => setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, options]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    trackRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full bg-secondary p-0.5",
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0 rounded-full bg-card shadow-card ring-1 ring-black/5 dark:ring-white/5"
          style={{
            width: thumb.w,
            transform: `translateX(${thumb.x}px)`,
            transition: `transform ${SPRING_SNAPPY}, width ${SPRING_SNAPPY}`,
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-full font-sans font-medium whitespace-nowrap transition-colors duration-150 [&_svg]:size-3.5",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
