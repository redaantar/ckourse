---
name: animation
description: Animation patterns, easing curves, and motion conventions for the Ckourse app. Use when adding transitions, animations, or any interactive motion to components.
---

# Ckourse Animation Guidelines

Instructions for creating consistent, Apple-style motion across the entire app.

---

## Philosophy

Ckourse follows Apple's Human Interface Guidelines for motion:

- **Motion has purpose** — animate to communicate relationships, not to decorate
- **Fast-in, gentle-out** — elements arrive quickly and settle softly
- **Responsive** — motion starts instantly on interaction, no perceived delay
- **Continuity** — elements should stay in the DOM and animate between states rather than being conditionally rendered

---

## Springs (preferred)

`src/index.css` defines physical springs sampled from a damped oscillator as CSS `linear()` easings. Use the constants from `@/lib/constants`; they include the matching duration, because a spring curve is only correct at its own settle time:

| Constant | Value | Use |
|---|---|---|
| `SPRING_SMOOTH` | `680ms var(--spring-smooth)` | Progress fills, layout, sidebar. No overshoot: progress must never show more than was earned |
| `SPRING_SNAPPY` | `520ms var(--spring-snappy)` | Controls, toggles |
| `SPRING_BOUNCY` | `730ms var(--spring-bouncy)` | Earned moments only (lesson check `check-pop`, course complete) |

```tsx
style={{ transition: `width ${SPRING_SMOOTH}` }}
```

Tailwind: `ease-spring`, `ease-spring-snappy`, `ease-spring-bouncy` (set the duration to match).

Reduced motion is handled globally in `index.css`: all transitions and animations complete instantly. Canvas/JS animations must check `prefers-reduced-motion` themselves (see `CourseCelebration`). JS physics must integrate against elapsed time (`dt`), never per frame: ProMotion displays run at 120 Hz.

## Easing Curves

All curves are defined in `src/index.css` via the `.ease-apple` utility class and used inline when combining multiple transition properties.

| Name | Value | Usage |
|---|---|---|
| **Apple Spring** | `cubic-bezier(0.32, 0.72, 0, 1)` | Default for all layout & structural animations (sidebar, panels, nav) |
| **Ease Out** | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances — elements appearing on screen (modals, dropdowns, toasts) |
| **Ease In** | `cubic-bezier(0.64, 0, 0.78, 0)` | Exits — elements leaving the screen |
| **Snappy** | `cubic-bezier(0.2, 0, 0, 1)` | Micro-interactions — hover states, toggles, small UI feedback |

### Constants

Define these at the top of any component that uses inline transition styles:

```tsx
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";   // Apple spring
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)"; // Entrances
const EASE_IN = "cubic-bezier(0.64, 0, 0.78, 0)"; // Exits
const SNAPPY = "cubic-bezier(0.2, 0, 0, 1)";      // Micro-interactions
```

### CSS utilities in `src/index.css`

```css
.ease-apple {
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Use `.ease-apple` in Tailwind class strings where possible. Fall back to inline `style` when you need per-property control (different durations or delays per property).

---

## Durations

| Token | Value | Usage |
|---|---|---|
| **Micro** | `150ms` | Hover color changes, opacity toggles, icon swaps |
| **Fast** | `200ms` | Tooltips, dropdown appearance, button feedback |
| **Normal** | `350ms` | Card transitions, content fades, tab switches |
| **Smooth** | `500ms` | Sidebar collapse/expand, panel slides, layout shifts |
| **Slow** | `700ms` | Page-level transitions, large orchestrated sequences |

### Rules

- Use **Micro** or **Fast** for anything triggered by hover/focus
- Use **Normal** for state changes within a component (e.g., accordion open)
- Use **Smooth** for layout-level changes (sidebar, drawer, panel resize)
- Use **Slow** sparingly — only for page transitions or coordinated multi-element sequences

---

## Animation Patterns

### 1. Layout transitions (sidebar, panels)

Animate `width` or `height` with the Apple Spring curve. Use `will-change` to hint GPU compositing.

```tsx
<aside
  style={{
    width: collapsed ? 68 : 240,
    transition: `width 500ms cubic-bezier(0.32, 0.72, 0, 1)`,
  }}
  className="will-change-[width]"
>
```

### 2. Reveal/hide content (labels, text, descriptions)

**Never conditionally render** (`{show && <span>}`) content that animates. Keep it in the DOM and animate `opacity`, `maxWidth`/`maxHeight`, and `transform`.

```tsx
// Correct — smooth fade + slide
<span
  style={{
    opacity: collapsed ? 0 : 1,
    maxWidth: collapsed ? 0 : 160,
    transform: collapsed ? "translateX(-8px)" : "translateX(0)",
    transition: `opacity 500ms cubic-bezier(0.32, 0.72, 0, 1),
                 max-width 500ms cubic-bezier(0.32, 0.72, 0, 1),
                 transform 500ms cubic-bezier(0.32, 0.72, 0, 1)`,
  }}
  className="overflow-hidden whitespace-nowrap"
>
  {label}
</span>

// Wrong — causes content to pop in/out
{!collapsed && <span>{label}</span>}
```

### 3. Staggered reveals

When multiple items animate together (nav items, grid cards, list rows), stagger their delays to create a cascade effect.

```tsx
const delay = `${index * 25}ms`; // 25ms offset per item

<span
  style={{
    opacity: visible ? 1 : 0,
    transition: `opacity 500ms cubic-bezier(0.32, 0.72, 0, 1) ${delay}`,
  }}
>
```

| Context | Stagger interval |
|---|---|
| Nav items (sidebar) | `25ms` per item |
| Grid cards | `50ms` per item |
| List rows | `30ms` per item |

### 4. Hover states

Use Tailwind's `transition-colors` with `duration-150` or `duration-200` for color changes. For transforms (scale, translate), use inline styles with the Snappy curve.

```tsx
// Color-only hover — use Tailwind
<button className="transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground">

// Transform hover — use inline for the curve
<div
  className="transition-transform duration-200"
  style={{ transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" }}
>
```

### 5. Tooltips

Fade in with a subtle translate. Use **Fast** (200ms) duration and the Ease Out curve.

```tsx
<span className="opacity-0 -translate-x-1 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0">
  {tooltip}
</span>
```

### 6. Icon rotation/swap

Rotate the same icon instead of swapping two different icons. Use Apple Spring.

```tsx
<div
  style={{
    transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
    transition: `transform 500ms cubic-bezier(0.32, 0.72, 0, 1)`,
  }}
>
  <ChevronLeft className="size-4" />
</div>
```

### 7. Modal / dialog entry

Scale from 95% + fade in. Use Ease Out at **Normal** duration.

```tsx
// Entry
<div
  style={{
    opacity: open ? 1 : 0,
    transform: open ? "scale(1)" : "scale(0.95)",
    transition: `opacity 350ms cubic-bezier(0.16, 1, 0.3, 1),
                 transform 350ms cubic-bezier(0.16, 1, 0.3, 1)`,
  }}
>
```

### 8. Backdrop / overlay

Fade the backdrop independently at a slower pace so it feels layered.

```tsx
<div
  style={{
    opacity: open ? 1 : 0,
    transition: `opacity 400ms cubic-bezier(0.32, 0.72, 0, 1)`,
  }}
  className="fixed inset-0 bg-background/60 backdrop-blur-sm"
/>
```

### 9. Progress bars / gauges

Animate `width` with Apple Spring. Add a slight delay so the container renders first.

```tsx
<div
  style={{
    width: `${percent}%`,
    transition: `width 700ms cubic-bezier(0.32, 0.72, 0, 1) 100ms`,
  }}
  className="h-full rounded-full bg-primary"
/>
```

---

## GPU Acceleration Hints

Use `will-change` for properties that animate frequently. Remove it when animation is idle if needed.

| Property | When to hint |
|---|---|
| `will-change-[width]` | Sidebar, collapsible panels |
| `will-change-transform` | Elements with translate/scale/rotate animations |
| `will-change-[opacity]` | Fade-heavy sequences (modal overlays) |

Do not apply `will-change` globally or to many elements — it reserves compositor memory.

---

## Anti-patterns

| Don't | Do instead |
|---|---|
| `{show && <Component />}` for animated content | Keep in DOM, animate `opacity` + `transform` |
| `transition: all` | List specific properties: `transition: opacity 350ms, transform 350ms` |
| Linear easing (`ease`, `linear`) | Use the Apple curves above |
| `setTimeout` to sequence animations | Use `transition-delay` or staggered delays |
| Animating `left`/`top` | Use `transform: translate()` (GPU-composited) |
| Animating `display: none` to `block` | Use `opacity: 0` + `pointer-events: none` + `inert` (so hidden content isn't tabbable) |
| `transform-origin` without thinking | Set it explicitly when using scale (e.g., dropdowns should scale from their anchor) |

---

## Checklist for New Animated UI

- [ ] Uses an appropriate easing curve from the table (never `ease` or `linear`)
- [ ] Duration matches the interaction type (Micro/Fast/Normal/Smooth/Slow)
- [ ] Animated content stays in DOM (no conditional rendering for transitions)
- [ ] Stagger applied when multiple items animate together
- [ ] `will-change` set only on frequently-animated elements
- [ ] Hover states use `transition-colors` or Snappy curve for transforms
- [ ] Transitions list specific properties (never `transition: all`)
