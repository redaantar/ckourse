import { MagnifyingGlassIcon as MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SquircleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SquircleSearch({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SquircleSearchProps) {
  return (
    <div className={cn("group/search relative", className)}>
      <div className="squircle absolute inset-0 bg-border/50 transition-colors group-focus-within/search:bg-primary" />
      <div className="squircle absolute inset-px bg-card" />
      <div className="relative flex items-center gap-3 px-4 py-2.5 text-muted-foreground">
        <MagnifyingGlass className="size-4 shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
