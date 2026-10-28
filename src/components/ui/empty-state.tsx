import type { CSSProperties, ReactNode } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/constants";

interface EmptyStateProps {
  icon: PhosphorIcon;
  title: string;
  description?: ReactNode;
  /** Optional call to action, e.g. a <Button>. */
  action?: ReactNode;
  /** "page" fills the visible height below a page header; "section" is a compact panel. */
  size?: "page" | "section";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "section",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border px-6 text-center",
        size === "page" ? "min-h-[max(22rem,calc(100dvh-14rem))] py-16" : "min-h-72 py-12",
        className,
      )}
    >
      {/* Faint dot grid, fading out from the center */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]"
      />

      <div className="relative flex flex-col items-center">
        <CardFan icon={icon} />
        <h3 className="mt-8 font-heading text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-sm font-sans text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

/** Three ghost content cards fanned out, the front one carrying the icon as a lime badge. */
function CardFan({ icon: Icon }: { icon: PhosphorIcon }) {
  return (
    <div aria-hidden="true" className="relative h-32 w-48">
      <GhostCard side={-1} />
      <GhostCard side={1} />

      <div
        className="absolute inset-x-0 top-0 mx-auto flex h-32 w-26 flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-pop"
        style={{ animation: `card-in 400ms ${EASE_OUT} both` }}
      >
        <div className="h-11 rounded-md bg-accent" />
        <div className="h-1.5 w-4/5 rounded-full bg-accent" />
        <div className="h-1.5 w-1/2 rounded-full bg-accent" />
        <div className="mt-auto h-1 w-full overflow-hidden rounded-full bg-accent">
          <div className="h-full w-1/3 rounded-full bg-primary" />
        </div>

        <div className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
          <Icon className="size-4.5" weight="fill" />
        </div>
      </div>
    </div>
  );
}

function GhostCard({ side }: { side: -1 | 1 }) {
  const fan = {
    "--fan-x": `${side * 40}px`,
    "--fan-r": `${side * 9}deg`,
    transform: "translateX(var(--fan-x)) rotate(var(--fan-r))",
    animation: `empty-fan 600ms ${EASE_OUT} 120ms both`,
  } as CSSProperties;

  return (
    <div
      className="empty-fan absolute inset-x-0 top-3 mx-auto flex h-28 w-22 origin-bottom flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-card"
      style={fan}
    >
      <div className="h-9 rounded-md bg-secondary" />
      <div className="h-1.5 w-3/4 rounded-full bg-secondary" />
      <div className="h-1.5 w-1/2 rounded-full bg-secondary" />
    </div>
  );
}
