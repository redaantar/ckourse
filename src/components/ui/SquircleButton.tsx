import { cn } from "@/lib/utils";

type SquircleButtonVariant = "primary" | "secondary" | "ghost";

interface SquircleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SquircleButtonVariant;
  active?: boolean;
}

const borderStyles: Record<SquircleButtonVariant, { base: string; active: string }> = {
  primary: {
    base: "bg-primary transition-colors group-hover/sqbtn:bg-primary/85",
    active: "bg-primary transition-colors group-hover/sqbtn:bg-primary/85",
  },
  secondary: {
    base: "bg-border",
    active: "bg-primary/10",
  },
  ghost: {
    base: "bg-transparent",
    active: "bg-primary/10",
  },
};

const fillStyles: Record<SquircleButtonVariant, { base: string; active: string }> = {
  primary: {
    base: "bg-primary transition-colors group-hover/sqbtn:bg-primary/85",
    active: "bg-primary transition-colors group-hover/sqbtn:bg-primary/85",
  },
  secondary: {
    base: "bg-card",
    active: "bg-primary/10",
  },
  ghost: {
    base: "bg-transparent group-hover/sqbtn:bg-secondary",
    active: "bg-primary/10",
  },
};

const textStyles: Record<SquircleButtonVariant, { base: string; active: string }> = {
  primary: {
    base: "font-semibold text-primary-foreground",
    active: "font-semibold text-primary-foreground",
  },
  secondary: {
    base: "font-medium text-muted-foreground hover:text-foreground",
    active: "font-medium text-primary",
  },
  ghost: {
    base: "font-medium text-muted-foreground hover:text-foreground",
    active: "font-medium text-primary",
  },
};

export function SquircleButton({
  variant = "secondary",
  active = false,
  className,
  children,
  ...props
}: SquircleButtonProps) {
  const state = active ? "active" : "base";

  return (
    <div className="group/sqbtn relative transition-transform duration-150 ease-out active:scale-[0.97]">
      <div className={cn("squircle absolute inset-0", borderStyles[variant][state])} />
      <div className={cn("squircle absolute inset-px", fillStyles[variant][state])} />
      <button
        className={cn(
          "relative flex items-center gap-2 px-4 py-2.5 font-sans text-sm transition-colors",
          textStyles[variant][state],
          className
        )}
        {...props}
      >
        {children}
      </button>
    </div>
  );
}
