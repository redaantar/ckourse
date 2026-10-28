import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPRING_SMOOTH } from "@/lib/constants";

interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** Rendered in the middle of the ring */
  children?: ReactNode;
  /** Ring color; defaults to the progress lime */
  color?: string;
  className?: string;
}

/**
 * Activity-style ring. Round caps and a track the same shape as the fill, so the
 * ring reads as one object being filled, not a gauge with a needle. Fills from
 * empty on arrival with a critically damped spring (never overstates progress).
 */
export function ProgressRing({
  value,
  size = 20,
  stroke = 2.5,
  label,
  children,
  color,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const complete = clamped >= 100;

  return (
    <span
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(clamped) : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-accent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={complete && !children ? (color ?? "var(--primary)") : "none"}
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color ?? "var(--primary)"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          style={{ transition: `stroke-dashoffset ${SPRING_SMOOTH} 80ms, fill 200ms` }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}
