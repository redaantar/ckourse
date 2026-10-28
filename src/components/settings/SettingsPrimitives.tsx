import { cn } from "@/lib/utils";

// Shared building blocks for the Settings page — an inset-grouped list in the
// style of the Dashboard's stat rows. Extracted so sections can live in their
// own files without importing from the page itself.

export interface SettingsGroupProps {
  title?: string;
  /** One line under the heading, before the card */
  description?: React.ReactNode;
  /** Caption under the card — explanations go here, not inside the card. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsGroup({ title, description, footer, children, className }: SettingsGroupProps) {
  return (
    <section
      aria-label={title}
      className={className}
    >
      {(title || description) && (
        <header className="mb-3 px-1">
          {title && <h2 className="font-heading text-[17px] font-semibold text-foreground">{title}</h2>}
          {description && (
            <p className="mt-0.5 font-sans text-[13px] text-muted-foreground">{description}</p>
          )}
        </header>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {children}
      </div>
      {footer && (
        <p className="mt-2.5 px-1 font-sans text-xs leading-relaxed text-muted-foreground">
          {footer}
        </p>
      )}
    </section>
  );
}

export interface SettingRowProps {
  icon?: React.ReactNode;
  /** Text color for the glyph; muted unless the row needs to stand out (e.g. destructive). */
  tint?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * One list row: an optional quiet glyph, label + description, control on the right.
 * Glyphs are muted line icons, not colored tiles — in a list of settings the
 * labels are what you scan, so nothing else should compete for the eye.
 */
export function SettingRow({
  icon,
  tint,
  label,
  description,
  children,
  className,
}: SettingRowProps) {
  return (
    <div className={cn("flex min-h-[52px] items-center gap-3 px-4 py-3", className)}>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 shrink-0 items-center justify-center [&_svg]:size-[18px]",
            tint ?? "text-muted-foreground",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[13px] font-medium text-foreground">{label}</div>
        {description && (
          <div className="mt-0.5 truncate font-sans text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** Padded area inside a group for forms and inline confirmations. */
export function SettingPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-3 p-4", className)}>{children}</div>;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
}

export function Select({ value, onChange, options, label }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 min-w-20 appearance-none rounded-lg bg-secondary pr-8 pl-3",
          "font-sans text-sm text-foreground tabular-nums outline-none",
          "cursor-pointer transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

interface SliderProps {
  value: number;
  onChange: (value: string) => void;
  min: number;
  max: number;
  label: string;
  valueText: string;
}

/** Range input with its current value shown to the right. */
export function Slider({ value, onChange, min, max, label, valueText }: SliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-1.5 w-32 cursor-pointer accent-primary"
      />
      <span className="w-12 text-right font-sans text-sm text-muted-foreground tabular-nums">
        {valueText}
      </span>
    </div>
  );
}

export function CredInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-background px-3 hover:border-input",
          "font-mono text-xs text-foreground placeholder:text-muted-foreground",
          "outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        )}
      />
    </label>
  );
}
