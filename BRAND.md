# Ckourse brand

Ckourse is where people turn a folder of videos into something they finish. The
brand serves that one outcome: help the learner start, keep going, and feel the
finish. Every rule below exists for a reason you can name; if a rule's reason
stops being true, change the rule.

## 1. Principle: the course is the hero, the app recedes

The interface is neutral gray so the learner's courses carry the color. Chrome
never competes with content: one accent color, no gradients on controls,
inverted-neutral primary buttons (`bg-foreground text-background`), and hovers
that change color only. This is Apple's *deference* principle applied to a
library app.

## 2. Structure

- **The shell is two surfaces.** The window canvas holds the sidebar, and the
  content sits on one inset panel with rounded corners, 8px off the window edge.
  It reads as a sheet you're working on rather than a cell in a grid.
- **The sidebar is where you've been and who you are.** It has four
  destinations (Home, Saved, Notes, Progress), your three most recent courses
  (each with a ring in the course's color), and Settings. At the bottom sits a
  level ring with your streak, which is the one persistent piece of
  encouragement. There are no section labels for five items. Theme lives in
  Settings, because it's set once; fullscreen is the window's green button.
  ⌘\ toggles the sidebar.
- **Home answers "what was I doing?" first.** Up next names the exact lesson,
  its chapter and the time left in the course, because "Resume" is a promise
  and should say what it resumes. Below it is the library: a status segmented
  control, topic and sort menus, and search.
- **Covers are generated artwork.** Each course gets its own color plus one of
  five geometric motifs, chosen by hashing its title, so a course keeps the same
  cover forever. The title is printed on it like a book jacket, so you scan the
  library by shape and color rather than by reading captions. The base is
  darkened until white type clears 5:1 at its lightest corner.
- **One idea per screen region.** Sections are separated by whitespace and a
  heading, not boxed cards with an icon in every header. A card means "this is
  one object", nothing more.
- **Charts compare by length, not angle.** Topics use bars, not a donut:
  people judge position and length far more accurately than angle (Cleveland &
  McGill).
- **Monospace is for timestamps and code only.** Numbers elsewhere are Geist
  Sans `tabular-nums`, so they align without looking like a terminal.

## 3. Color

### Lime means "you did this"

`--primary` `#CDF426` · `oklch(90.8% 0.21 121)`

The logo lime sits at ~555 nm, the peak of the eye's photopic luminosity curve:
a few pixels of it register before anything else on screen. That makes it too
loud to decorate with, so it is rationed to a single meaning, **the learner's
own progress**: progress fills, completed checkmarks, the current lesson, the
level bar, selection. If lime appears anywhere else, it dilutes the one signal
the learner is working toward.

- **Light mode lime is one step deeper**: `#A4D104`, `oklch(80% 0.2 124)`. The
  logo lime on white is 1.3:1 and 1.04:1 against an empty track, so a progress
  fill would vanish. True 3:1 would mean olive and lose the brand. Every fill
  is paired with its number in text, so color is never the only signal.
- **Lime as text** uses `--primary-ink`. In dark mode that is the lime itself
  (14.8:1 on the background). In light mode lime on white is ~1.3:1, so ink
  drops to `#4F6A00`, `oklch(48.5% 0.122 125)`: the same hue at a lightness
  that clears 6:1. Lime *fills* stay bright in both themes, with near-black ink
  on them (15.5:1).
- **Course colors avoid the 95°–140° hue band**, so a lime cover is never
  mistaken for "done".

### Neutrals are tinted toward lime's complement

The grays (`--background`, `--card`, `--border`…) carry ~0.005 OKLCH chroma at
hue ≈286°, almost opposite the lime at 121°. Through simultaneous contrast this
makes the lime *look* more saturated without adding any chroma to it. It is the
same blue-leaning gray Apple uses for its system grays. Keep new neutrals on
that hue.

### Course colors live in OKLCH

`src/lib/color.ts`

- **`COURSE_COLORS`**: twelve named hues at equal chroma (0.15). Their lightness
  follows the sRGB gamut cusp, so warm hues sit brighter and blues sit darker.
  The result is a grid of covers with even visual weight, where no course
  shouts and none disappears. The names (Ruby, Sky, Cobalt…) are what screen
  readers announce; hex codes are not names.
- **`courseColor(hex)`**: every place that paints a course's color goes through
  this. It keeps the stored hue and clamps lightness to 60–80% and chroma to
  ≤0.16, so colors picked before this palette existed (near-black navy, neon
  lime) still sit evenly in the library. Out-of-gamut colors lose chroma rather
  than lightness or hue, because the eye notices that loss least.

Never render `course.accentColor` raw.

### Contrast floor

Every text token meets WCAG AA (4.5:1) on `background`, `card` and `secondary`
in both themes. Readable text is never faded with opacity. Dark mode is
`#121214`, not black, and text is `#F5F5F7`, not white: pure white on pure black
causes halation (glowing, smearing letterforms) for the roughly one in three
people with astigmatism.

## 4. Type

Geist and Geist Mono are **bundled** (`@fontsource-variable/*`), not loaded from
Google Fonts. A desktop learning app has to work on a plane, and loading fonts
shouldn't send the user's IP to a third party on every launch.

- Headings: `font-heading font-semibold`, tracked `-0.025em`. Large type needs
  negative tracking to read as one shape.
- Numbers that change (progress, counts, time): `tabular-nums`, so digits
  don't jitter as they tick.
- Big stat figures: Geist Sans. Geist Mono's slashed zero reads as noise at
  display sizes.

## 5. Motion: physics, not curves

Things on screen move as if they had mass. The three springs in `index.css` are
sampled from a damped harmonic oscillator (SwiftUI's `spring(response, bounce)`)
and written out as CSS `linear()` easings:

| Token | Duration | Overshoot | For |
|---|---|---|---|
| `--spring-smooth` / `SPRING_SMOOTH` | 680ms | none | Progress, layout, the sidebar |
| `--spring-snappy` / `SPRING_SNAPPY` | 520ms | 0.6% | Controls, toggles |
| `--spring-bouncy` / `SPRING_BOUNCY` | 730ms | 4.6% | Earned moments only |

Use the `SPRING_*` constants: they bundle the duration, and a spring curve
stretched to the wrong duration stops being a spring.

**Progress never overshoots.** A bar that springs past its value shows, for a
few frames, more progress than the learner earned. Bounce is reserved for
rewards.

**Why there's no press-to-shrink.** iOS buttons squish under your finger because
the finger covers the control and the user needs feedback they can see around
it. With a cursor you can see the control, so following macOS convention,
presses dim (`active:opacity-80`) and nothing scales.

**Reduced motion** removes travel, not information. Under
`prefers-reduced-motion`, every transition and animation completes instantly
(state still changes), and the course-complete celebration keeps its words but
drops the confetti. Vestibular disorders are triggered by movement, not by
change.

## 6. Reward: honest, earned, small

People should come back because finishing things here feels good, not because
something nags them. So:

- **Progress fills on arrival.** Bars grow from empty when a screen opens, like
  Apple's Activity rings, so progress is felt and not only read.
- **Completing a lesson lands.** The checkmark springs in with `check-pop`, but
  only for a lesson completed during this visit. Lessons that were already done
  render still; a celebration repeated on every page load means nothing.
- **Finishing a course is the big moment.** Confetti in the course's own color
  plus lime and white, with the course's name. The physics runs on real elapsed
  time, so it falls identically at 60 Hz and 120 Hz (ProMotion). Air drag lets
  the paper float, strips foreshorten as they tumble, and the canvas renders at
  Retina resolution.
- **No dark patterns.** No streak-loss guilt, no variable-ratio rewards, no
  invented urgency. Streaks are shown, never threatened.

## 7. Shape

The base radius is 12px. Cards and dialogs are `rounded-2xl`; buttons, search
fields and pills are `rounded-full`; inner controls are `rounded-lg`. When
nesting, keep corners concentric: inner radius = outer radius − padding.
Elevation is `shadow-card` and `shadow-pop`. In dark mode a lifted surface also
gets *lighter*, because shadows barely show on dark backgrounds.
