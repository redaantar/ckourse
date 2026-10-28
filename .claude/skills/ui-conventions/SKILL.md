---
name: ui-conventions
description: UI patterns, styling, and component conventions for the Ckourse app. Use when creating pages, components, or UI elements.
---

# Ckourse UI Guidelines

Instructions for creating any new page, element, or component in the Ckourse app.

---

## Tech Stack

- **Framework:** React 19 + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (utility-first, no custom CSS files per component)
- **UI primitives:** shadcn/ui (Radix UI + CVA)
- **Icons:** @phosphor-icons/react (6 weights: thin, light, regular, bold, fill, duotone)
- **Utilities:** `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- **Runtime:** Tauri v2 desktop app
- **Build:** Vite 7

---

## Project Structure

```
src/
  App.tsx                  # Root layout and page composition
  main.tsx                 # Entry point
  index.css                # Centralized theme (single source of truth)
  lib/
    utils.ts               # cn() helper
  components/
    ui/                    # shadcn/ui base primitives (Card, Badge, Button, etc.)
    Header.tsx             # App-level components
    Sidebar.tsx            # App sidebar with navigation
    CourseCard.tsx          # Feature components
    ProgressBar.tsx         # Reusable custom components
    ui/button.tsx           # Button (default/outline/secondary/ghost/destructive/destructive-outline/link)
    ui/input.tsx            # Text input
    ui/search-input.tsx     # Search field with icon, clear button, Esc-to-clear
  pages/
    Dashboard.tsx          # Library / Home page
  data/
    courses.ts             # Data types and mock data
  assets/                  # Static assets (images, logos)
```

### Where to put new files

| Type | Location | Example |
|---|---|---|
| shadcn/ui primitive | `src/components/ui/` | `button.tsx`, `dialog.tsx` |
| Feature component | `src/components/` | `LessonCard.tsx`, `Sidebar.tsx` |
| Page component | `src/pages/` | `Dashboard.tsx`, `Settings.tsx` |
| Data types / mock data | `src/data/` | `lessons.ts`, `users.ts` |
| Utility functions | `src/lib/` | `format.ts`, `api.ts` |
| Static assets | `src/assets/` | `logo-dark.png` |

---

## Theme & Colors

All design tokens live in `src/index.css`. Never hardcode color values in components. The reasoning behind every token is in `BRAND.md` at the repo root; read it before changing color, type or motion.

**Lime means "you did this"**: reserve `primary` for the learner's own progress (fills, completed checks, current lesson, selection). Lime as text/icon color is `text-primary`, which resolves to `--primary-ink` (deepened in light mode).

**Course colors:** always render a course's color through `courseColor(course.accentColor)` from `@/lib/color`, never the raw value. Pickers use `COURSE_COLORS` (named OKLCH palette; `aria-label` is the name).

### Color Tokens

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--sidebar` | `#0C0C0E` | `#EEEEF1` | Window canvas / sidebar |
| `--background` | `#121214` | `#F7F7F8` | Content panel |
| `--foreground` | `#F5F5F7` | `#1D1D1F` | Primary text; also the fill of primary buttons (inverted) |
| `--card` | `#1A1A1D` | `#FFFFFF` | Card surfaces |
| `--popover` | `#222225` | `#FFFFFF` | Dialogs, menus, tooltips |
| `--primary` | `#CDF426` | `#A4D104` | Lime = the learner's progress only (rings, bars, completed checks, the current-lesson play glyph, toggles/sliders). Never for selection chips, buttons, badges or timestamps — those are neutral. Light mode is one step deeper so fills don't vanish on white; `text-primary` resolves to `--primary-ink` (`#4F6A00`) |
| `--secondary` | `#222225` | `#EFEFF2` | Hover states, segmented-control track |
| `--accent` | `#2A2A2E` | `#E6E6EA` | Neutral hover surface, empty progress track — **not** the brand color |
| `--muted-foreground` | `#98989F` | `#6A6A70` | Secondary text, labels |
| `--border` | `#2A2A2D` | `#E5E5E9` | Card borders, dividers |
| `--input` | `#3A3A3E` | `#D2D2D7` | Switch off-track, stronger control borders |
| `--destructive` | `#FF6961` | `#D70015` | Errors, danger actions |
| `--success` | `#4ADE80` | `#1F8A3B` | Completed |
| `--info` | `#64B5FF` | `#0066CC` | Informational states |
| `--warning` | `#FFB340` | `#A85A00` | Streaks, caution |

Primary CTA = `<Button>` default variant: an inverted neutral pill (`bg-foreground text-background`). Buttons and search fields are `rounded-full`.

Elevation: `shadow-card` (cards, outline controls) and `shadow-pop` (dialogs, popovers, hovered cards) — both theme-aware tokens. Dialogs use `rounded-2xl bg-popover shadow-pop` without a border.

Every text token meets WCAG AA (4.5:1) on `background`, `card` and `secondary` in both themes. Light-mode lime is deliberately darker (`#4F7A00`) so white text on it and lime text on white stay legible.

### Contrast rules

- Never fade readable text with opacity (`text-muted-foreground/50`, `text-primary/60`…). Use `text-muted-foreground` for secondary text. Opacity is only for decorative icons/shapes.
- No text smaller than 10px; `text-[11px]` is the floor for labels, `text-xs` for most metadata.
- Placeholders use `placeholder:text-muted-foreground` (no opacity).
- Disabled controls use `disabled:opacity-50` on the whole control, not a fainter text color.
- Borders use `border-border` (surfaces) or `border-input` (controls) without opacity modifiers.

### Using colors in Tailwind

```tsx
// Correct - use theme tokens
<div className="bg-background text-foreground" />
<p className="text-muted-foreground" />
<button className="bg-primary text-primary-foreground" />

// Wrong - never hardcode hex values
<div style={{ color: "#EDEDED" }} />
```

### Opacity modifiers

Use Tailwind's opacity syntax for transparent variants:

```tsx
<Badge className="bg-primary/15 text-primary border-primary/20" />
<div className="bg-info/15 text-info" />
```

---

## Typography

Three font families are defined in the theme:

| Font | Variable | Tailwind Class | Usage |
|---|---|---|---|
| Geist (bundled via `@fontsource-variable`, never a CDN) | `--font-sans` | `font-sans` | Body text (default) |
| Geist (tight tracking) | `--font-heading` | `font-heading` | Headings, titles — use `font-semibold`, not `font-bold` |
| Geist Mono | `--font-mono` | `font-mono` | Video timestamps and code only. Everything else numeric (durations, counts, stats, dates) is `font-sans tabular-nums` |

### Typography patterns

```tsx
// Page heading (breadcrumb in the shell header is small; the page owns the big title)
<h2 className="font-heading text-3xl font-semibold text-foreground">Title</h2>

// Body text
<p className="font-sans text-sm text-muted-foreground">Description</p>

// Stats / numeric data
<span className="font-mono text-xs font-medium text-muted-foreground">42/80</span>

// Bold brand text
<span className="text-primary">CK</span>OURSE
```

---

## Component Patterns

### Creating a new component

1. Use named exports (not default exports)
2. Accept a `className` prop and merge it with `cn()`
3. Type props with an interface
4. Use theme tokens, not hardcoded values

```tsx
// src/components/MyComponent.tsx
import { cn } from "@/lib/utils";

interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h3 className="font-sans text-sm font-semibold text-foreground">
        {title}
      </h3>
    </div>
  );
}
```

### Shared UI primitives

Always prefer these over hand-rolled `<button>`/`<input>` styling:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";

<Button onClick={handleImport}><Plus weight="bold" />Import Course</Button>   // primary CTA
<Button variant="outline">Filters</Button>                                     // secondary
<Button variant="ghost" size="icon-sm" aria-label="Close"><X /></Button>      // icon-only (aria-label required)
<Button variant="destructive-outline">Delete all</Button>

<SearchInput value={search} onChange={setSearch} placeholder="Search courses..." />
```

`Button` variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `destructive-outline`, `link`. Sizes: `default` (h-9), `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. Buttons default to `type="button"`.

For a toggled/active state, pass classes (e.g. `className={cn(active && "border-primary/40 text-primary")}`) and set `aria-pressed` / `aria-expanded`.

### Using shadcn/ui components

shadcn/ui primitives live in `src/components/ui/` and use CVA for variants:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

<Card className="overflow-hidden border-border">
  <CardContent className="p-4">
    <Badge variant="secondary">Label</Badge>
  </CardContent>
</Card>
```

To add a new shadcn component, run:

```bash
npx shadcn@latest add <component-name>
```

### Composing with `cn()`

Always use `cn()` to merge classes. This ensures Tailwind classes resolve correctly:

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "base-classes here",
  isActive && "bg-primary text-primary-foreground",
  className
)} />
```

---

## Spacing & Layout

### Standard patterns

| Pattern | Classes |
|---|---|
| Page container | `mx-auto w-full max-w-[1400px] px-6 pt-12 pb-20 lg:px-10` (Settings/forms: `max-w-3xl`). The top 28px of the content panel is a window drag strip — keep content below it. Pages own their gutters, so the course page can still dock its curriculum flush |
| Page header | eyebrow/`<h1 className="font-heading text-[34px] font-semibold">` + one plain, true sentence in `text-[15px] text-muted-foreground` |
| Section heading | `font-heading text-[20px] font-semibold`; sections are separated by whitespace, not boxed cards with icon headers |
| Section header | `mb-6 flex items-baseline justify-between` |
| Card grid | `grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4` (fills any width) |
| Segmented control / tabs | `<SegmentedControl>` from `@/components/ui/segmented-control` (one sliding thumb on a spring, arrow-key navigation) |
| Pop-up choices (sort, filter) | `<Menu>` from `@/components/ui/menu` with a ghost `Button` trigger + `CaretUpDown` — not native `<select>`, not chip rows that truncate |
| Progress | `<ProgressRing>` (`ui/progress-ring`) for compact/at-a-glance, `<ProgressBar>` for rows. Both fill from empty on arrival |
| Courses | `<CourseCard>` grid `grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-x-6 gap-y-8`; artwork via `<CourseCover title author accentColor>` (generative, title printed on it) |
| Flex row with gap | `flex items-center gap-3` |
| Flex column with gap | `flex flex-col gap-3` |

### Border radius

The base radius is `0.75rem`. Use standard `border-radius` everywhere; there are no custom clip-path shapes.

| Element | Class |
|---|---|
| Cards, panels | `rounded-2xl border border-border bg-card shadow-card` |
| Dialogs, popovers | `rounded-2xl bg-popover shadow-pop` |
| Buttons, search fields | `rounded-full` |
| Inputs, list rows, nav items, icon tiles | `rounded-lg` |
| Small inner controls, tooltips | `rounded-md` |
| Badges, pills, avatars, progress bars | `rounded-full` |

Focus rings and shadows work normally — use `focus-visible:ring-*` / `focus-visible:border-ring`. A global `:focus-visible` outline exists in `index.css` as a fallback.

---

## Interactive States

Motion is Apple-quiet: hovers change color or opacity only (no lifts, scale-ups, glows or sliding arrows); presses dim (`active:opacity-80`); entrances use `card-in` (fade + 4px rise, ~300ms) with stagger capped (`Math.min(index, 10) * 30ms`).

Use `transition-colors` for hover/focus animations. Controls revealed on hover (`opacity-0 group-hover:opacity-100`) must also add `focus-visible:opacity-100` so keyboard users can reach them. Icon-only buttons need `aria-label` (and `title` for a tooltip). Panels kept mounted for animation but visually hidden need `inert` so they aren't tabbable.

```tsx
// Button / clickable element
<button className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">

// Card hover
<Card className="transition-colors hover:bg-secondary">
```

---

## Loading States

Use Lottie animations for loading indicators. The library `lottie-react` is installed. Lottie JSON files live in `src/assets/lotties/`.

### Usage pattern

```tsx
import Lottie from "lottie-react";
import loadingAnimation from "@/assets/lotties/loading.json";

// Inline loading (inside a card or section)
<Lottie animationData={loadingAnimation} loop className="size-28" />

// Full-screen loading overlay (for blocking operations like imports)
<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
  <Lottie animationData={loadingAnimation} loop className="size-40" />
  <p className="mt-2 font-sans text-sm font-semibold text-foreground">
    Importing course...
  </p>
  <p className="mt-1.5 font-sans text-xs text-muted-foreground">
    Setting up your library
  </p>
</div>
```

### Guidelines

- **Never use CSS spinners** — always use Lottie for loading states
- **Fast local reads show nothing** (an empty `aria-busy` block of the page's height). A loader that flashes for 50ms is noise; reserve Lottie for genuinely slow work (imports, network sources)
- Use `size-28` for inline/contextual loading, `size-40` for full-screen overlays
- Full-screen overlays use `bg-background/80 backdrop-blur-sm` for the backdrop
- Add a short label (`font-sans text-sm font-semibold`) and optional sublabel (`text-xs text-muted-foreground`) below the animation
- **Tauri commands that do heavy work must be `async fn`** in Rust so they run off the main thread — otherwise the webview freezes and animations won't play

---

## Icons

Use `@phosphor-icons/react`. Always import with the `Icon` suffix (non-deprecated API), aliased to a clean name. Standard size is `size-4`, default weight is `"regular"`:

```tsx
import { GearSixIcon as GearSix, UserIcon as User } from "@phosphor-icons/react";

<GearSix className="size-4" />
<User className="size-4" weight="bold" />
```

Available weights: `"thin"`, `"light"`, `"regular"` (default), `"bold"`, `"fill"`, `"duotone"`. Use `"bold"` for active/emphasized states and `"regular"` for default.

---

## Data Layer

Define types and data in `src/data/`:

```tsx
// src/data/lessons.ts
export interface Lesson {
  id: number;
  title: string;
  duration: number;
}

export const lessons: Lesson[] = [
  { id: 1, title: "Introduction", duration: 12 },
];
```

---

## Import Aliases

Use the `@/` alias for all project imports (configured in `tsconfig.json`):

```tsx
// Correct
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Wrong
import { cn } from "../../lib/utils";
```

---

## Checklist for New UI Work

- [ ] Uses theme tokens from `src/index.css` (no hardcoded colors)
- [ ] Uses `cn()` for class merging
- [ ] Uses `@/` import alias
- [ ] Named export (not default)
- [ ] Props typed with an interface
- [ ] `className` prop supported and merged
- [ ] Correct font family (`font-sans`, `font-heading`, or `font-mono`)
- [ ] Interactive elements have `transition-colors` and hover states
- [ ] Uses `Button` / `Input` / `SearchInput` instead of hand-styled controls
- [ ] No opacity-faded readable text; nothing under 10px
- [ ] Icon-only buttons have `aria-label`; toggles have `aria-pressed`/`aria-expanded`
- [ ] Correct radius: `rounded-2xl` cards (`rounded-3xl` hero cards / drop zones), `rounded-lg` rows and nav items, `rounded-full` buttons, pills, segmented controls
- [ ] Lime appears only where it shows the learner's progress
- [ ] Copy is plain and human ("Remove from library", "Start over"), never system-speak
- [ ] Icons from `@phosphor-icons/react` with `size-4` default
- [ ] Placed in the correct directory per the structure table
