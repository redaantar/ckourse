import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { courseColor } from "@/lib/color";

interface CourseCoverProps {
  title: string;
  accentColor: string;
  /** Printed on the cover, like a book jacket. Off for tiny thumbnails. */
  author?: string;
  showTitle?: boolean;
  className?: string;
  children?: ReactNode;
}

/** FNV-1a — a stable hash, so a course keeps the same artwork forever. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Motif = (seed: number) => ReactNode;

// Every motif is drawn in white on a 160×100 canvas and composited at low opacity
// over the course color — geometry gives each course identity, color gives it family.
const MOTIFS: Motif[] = [
  // Concentric rings radiating from a corner
  (seed) => {
    const cx = seed & 1 ? 150 : 10;
    const cy = seed & 2 ? 95 : 8;
    return Array.from({ length: 9 }, (_, i) => (
      <circle key={i} cx={cx} cy={cy} r={14 + i * 13} fill="none" stroke="white" strokeWidth={1.1} opacity={0.5 - i * 0.04} />
    ));
  },
  // A dot field whose dots swell along a diagonal wave
  (seed) => {
    const phase = (seed % 628) / 100;
    const dots: ReactNode[] = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 14; x++) {
        const r = 0.6 + 2.6 * (0.5 + 0.5 * Math.sin(x * 0.55 + y * 0.45 + phase));
        dots.push(<circle key={`${x}-${y}`} cx={6 + x * 11.5} cy={7 + y * 12.5} r={r} fill="white" opacity={0.45} />);
      }
    return dots;
  },
  // Overlapping rounded squares, rotated like a fanned deck
  (seed) => {
    const base = (seed % 30) - 15;
    return Array.from({ length: 4 }, (_, i) => (
      <rect
        key={i}
        x={92 - i * 14}
        y={18 + i * 6}
        width={70}
        height={70}
        rx={16}
        fill="white"
        opacity={0.1 + i * 0.05}
        transform={`rotate(${base + i * 9} 125 55)`}
      />
    ));
  },
  // Diagonal bands of varying weight
  (seed) =>
    Array.from({ length: 7 }, (_, i) => {
      const w = 3 + ((seed >> i) & 3) * 3;
      const x = -40 + i * 34;
      return <rect key={i} x={x} y={-40} width={w} height={200} fill="white" opacity={0.18} transform="rotate(32 80 50)" />;
    }),
  // Large soft orbs, like out-of-focus light
  (seed) => [
    <circle key="a" cx={120 + (seed % 30)} cy={20} r={46} fill="white" opacity={0.16} />,
    <circle key="b" cx={150} cy={90} r={30} fill="white" opacity={0.12} />,
    <circle key="c" cx={80 + (seed % 40)} cy={110} r={40} fill="black" opacity={0.12} />,
  ],
];

/**
 * Generative course artwork. The base is the course's color taken down to a depth
 * where white type on it clears AA (≥5:1 at the lightest corner), lit from the top-left; a motif chosen
 * by hashing the title sits on top. Same course → same cover, always.
 */
export function CourseCover({ title, accentColor, author, showTitle = true, className, children }: CourseCoverProps) {
  const c = courseColor(accentColor);
  const seed = hash(title);
  const motif = MOTIFS[seed % MOTIFS.length];
  const id = useId();

  return (
    <div
      className={cn("@container relative isolate overflow-hidden", className)}
      style={{
        backgroundColor: `color-mix(in oklab, ${c} 58%, black)`,
        backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${c} 70%, black) 0%, color-mix(in oklab, ${c} 46%, black) 100%)`,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        <defs>
          <radialGradient id={`${id}-sheen`} cx="0" cy="0" r="1.2">
            <stop offset="0" stopColor="white" stopOpacity="0.14" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g opacity={0.7} style={{ mixBlendMode: "soft-light" }}>{motif(seed >> 3)}</g>
        <rect width="160" height="100" fill={`url(#${id}-sheen)`} />
      </svg>

      {/* Hairline inner edge: covers read as physical objects, not holes in the page */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />

      {showTitle && (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between p-[6cqw] text-white">
          <span className="line-clamp-3 max-w-[85%] font-heading text-[clamp(14px,7.4cqw,44px)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance">
            {title}
          </span>
          {author && (
            <span className="truncate font-sans text-[clamp(10px,3.6cqw,15px)] font-medium text-white/85">{author}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
