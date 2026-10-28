import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SPRING_SMOOTH } from "@/lib/constants";

interface ProgressBarProps {
  value: number;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, className, label = "Progress" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  // Fill from empty on arrival, so progress is felt rather than just read.
  // Critically damped: a bar must never show, even for a frame, more than was earned.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-accent", className)}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${shown}%`, transition: `width ${SPRING_SMOOTH} 80ms` }}
      />
    </div>
  );
}
