/**
 * Course colors, managed in OKLCH — a perceptual space where equal steps in
 * lightness *look* equal, unlike hex/HSL where "#FFFF00" and "#0000FF" share a
 * lightness value but differ ~8× in luminance.
 */

export interface CourseColor {
  name: string;
  value: string;
}

/**
 * Twelve hues at equal chroma (0.15), lightness following the sRGB gamut cusp —
 * warm hues sit brighter, blues darker — so no cover outshouts its neighbours
 * in the library grid. The 95°–140° band is left out on purpose: that is the
 * brand lime, which means "your progress", and a lime cover would blur that.
 */
export const COURSE_COLORS: CourseColor[] = [
  { name: "Ruby", value: "#F77C7F" },
  { name: "Coral", value: "#FD8A62" },
  { name: "Tangerine", value: "#F89A43" },
  { name: "Amber", value: "#E9AB2B" },
  { name: "Jade", value: "#32C386" },
  { name: "Teal", value: "#04B1AA" },
  { name: "Cyan", value: "#04A1BC" },
  { name: "Sky", value: "#0292D7" },
  { name: "Cobalt", value: "#5283E0" },
  { name: "Indigo", value: "#7A78DE" },
  { name: "Violet", value: "#A070D2" },
  { name: "Orchid", value: "#CB6DB8" },
];

export const DEFAULT_COURSE_COLOR = COURSE_COLORS[7].value;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklch(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
}

function oklchToLinearRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** OKLCH → sRGB hex, shedding chroma (never lightness or hue) until the color fits the gamut. */
function oklchToHex(L: number, C: number, h: number): string {
  let rgb = oklchToLinearRgb(L, C, h);
  while (C > 0 && rgb.some((v) => v < -1e-4 || v > 1 + 1e-4)) {
    C -= 0.002;
    rgb = oklchToLinearRgb(L, Math.max(C, 0), h);
  }
  return toHex(rgb);
}

const cache = new Map<string, string>();

/**
 * Brings any stored accent into the library's perceptual band while keeping its
 * hue — a course chosen as "blue" stays blue, it just can't arrive as near-black
 * navy or as neon. Out-of-gamut results shed chroma (not lightness or hue), the
 * same trade the eye makes least noticeable.
 */
export function courseColor(hex: string): string {
  const hit = cache.get(hex);
  if (hit) return hit;
  const lch = hexToOklch(hex);
  if (!lch) return hex;
  const out = oklchToHex(Math.min(0.8, Math.max(0.6, lch[0])), Math.min(0.16, lch[1]), lch[2]);
  cache.set(hex, out);
  return out;
}

/*
 * The free color picker walks the hue circle *around* the brand lime: it starts just
 * past it (140°) and ends just before it (95°), so a course can be any color except
 * the one that means "your progress".
 */
const HUE_START = 140;
const HUE_SPAN = 315;

/** Any hue, rendered the way the preset palette is: equal chroma, lightness on the gamut cusp. */
export function hueToCourseColor(hueDeg: number): string {
  const L = 0.7 + 0.08 * Math.cos(((hueDeg - 90) * Math.PI) / 180);
  return oklchToHex(L, 0.15, (hueDeg * Math.PI) / 180);
}

/** Slider position (0–1) → course color. */
export function courseColorAt(t: number): string {
  return hueToCourseColor((HUE_START + Math.min(1, Math.max(0, t)) * HUE_SPAN) % 360);
}

/** Course color → slider position (0–1); hues inside the reserved lime band snap to the nearer end. */
export function courseColorPosition(hex: string): number {
  const lch = hexToOklch(hex);
  if (!lch) return 0;
  const deg = ((lch[2] * 180) / Math.PI + 360) % 360;
  const offset = (deg - HUE_START + 360) % 360;
  if (offset <= HUE_SPAN) return offset / HUE_SPAN;
  return offset - HUE_SPAN < (360 - offset) ? 1 : 0;
}
