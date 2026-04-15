import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          transition: `width 700ms cubic-bezier(0.32, 0.72, 0, 1) 100ms`,
        }}
      />
    </div>
  );
}
