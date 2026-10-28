import { CheckIcon as Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Automatic", hint: "Follows your Mac" },
  { value: "light", label: "Light", hint: "Bright rooms" },
  { value: "dark", label: "Dark", hint: "Evenings, focus" },
];

// Literal colors on purpose: each thumbnail must show its own theme no matter which one is active.
const PALETTE = {
  light: { canvas: "#EEEEF1", panel: "#F7F7F8", card: "#FFFFFF", line: "#D2D2D7", ink: "#1D1D1F" },
  dark: { canvas: "#0C0C0E", panel: "#121214", card: "#222225", line: "#3A3A3E", ink: "#F5F5F7" },
} as const;

/** A miniature Ckourse window: sidebar, content panel, a hero card and a row of covers. */
function WindowThumb({ mode }: { mode: "light" | "dark" }) {
  const p = PALETTE[mode];
  return (
    <div className="absolute inset-0 flex gap-1 p-1.5" style={{ background: p.canvas }}>
      <div className="flex w-[26%] flex-col gap-1 pt-2.5 pl-0.5">
        <div className="flex gap-0.5 pb-1">
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} className="size-1 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span className="h-1 w-4/5 rounded-full" style={{ background: p.line }} />
        <span className="h-1 w-3/5 rounded-full" style={{ background: p.line }} />
        <span className="h-1 w-2/3 rounded-full" style={{ background: p.line }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded-[5px] p-1.5" style={{ background: p.panel }}>
        <span className="h-1.5 w-1/3 rounded-full" style={{ background: p.ink, opacity: 0.85 }} />
        <div className="flex h-[38%] gap-1 overflow-hidden rounded-[3px]" style={{ background: p.card }}>
          <span className="w-1/2" style={{ background: "#2A6F8A" }} />
          <span className="flex flex-1 flex-col justify-end gap-0.5 p-1">
            <span className="h-0.5 w-full rounded-full bg-[#CDF426]" />
          </span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1">
          {["#7A4A8C", "#8C5A2A", "#2A7A5A"].map((c) => (
            <span key={c} className="rounded-[3px]" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Theme picker as three little windows rather than a dropdown: you choose by
 * recognising what you'll see, not by reading a word. Automatic is listed first
 * because matching the room's light is what's easiest on the eyes.
 */
export function AppearanceSection() {
  const { preference } = useTheme();

  return (
    <section
      aria-labelledby="appearance-title"
    >
      <header className="mb-3 px-1">
        <h2 id="appearance-title" className="font-heading text-[17px] font-semibold text-foreground">
          Appearance
        </h2>
        <p className="mt-0.5 font-sans text-[13px] text-muted-foreground">
          Automatic switches between light and dark with your Mac's schedule.
        </p>
      </header>

      <div role="radiogroup" aria-labelledby="appearance-title" className="grid grid-cols-3 gap-3 sm:gap-5">
        {OPTIONS.map((o) => {
          const selected = preference === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setThemePreference(o.value)}
              className="group flex flex-col items-center gap-2.5 rounded-2xl outline-none"
            >
              <span
                className={cn(
                  "relative aspect-[16/11] w-full overflow-hidden rounded-xl shadow-card ring-offset-4 ring-offset-background transition-shadow duration-150",
                  selected
                    ? "ring-2 ring-foreground"
                    : "ring-1 ring-border group-hover:ring-input group-focus-visible:ring-2 group-focus-visible:ring-ring",
                )}
              >
                {o.value === "system" ? (
                  <>
                    <WindowThumb mode="light" />
                    {/* Dark half cut along the diagonal: one window, both moods */}
                    <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
                      <WindowThumb mode="dark" />
                    </span>
                  </>
                ) : (
                  <WindowThumb mode={o.value} />
                )}
                {selected && (
                  <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-card">
                    <Check weight="bold" className="size-3" />
                  </span>
                )}
              </span>
              <span className="flex flex-col items-center">
                <span
                  className={cn(
                    "font-sans text-[13px] text-foreground",
                    selected ? "font-semibold" : "font-medium",
                  )}
                >
                  {o.label}
                </span>
                <span className="font-sans text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
