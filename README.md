# Ckourse

> Your local course player — with progress that actually sticks.

Ckourse is an open-source desktop application for watching and organizing downloaded courses. No subscriptions, no cloud, no chaos — just your files, beautifully organized with full progress tracking.

---

## The Problem

You download a course from the internet. You get a folder with 80 videos, inconsistently named, nested in subfolders, with PDFs and subtitles scattered around. You watch a few lessons, close your laptop, and come back three days later with no idea where you left off.

Your media player doesn't know what "Section 4 - Lesson 12" means. Your file manager doesn't track progress. Nothing ties it all together.

**Ckourse does.**

---

## Features

### ✅ v1 — Core
- 📁 **Smart folder import** — point Ckourse at any course folder and it parses the structure automatically, detecting sections, lessons, subtitles, and attachments
- ▶️ **Built-in video player** — native HTML5 player with subtitle support, autoplay, and timestamp navigation
- 📊 **Progress tracking** — per-lesson completion, per-course progress bar, resume from exactly where you stopped
- 📝 **Timestamped notes** — add notes tied to specific timestamps and navigate back to them instantly, even across lessons
- 🔖 **Bookmarks** — bookmark lessons for quick access from a dedicated page
- 🗂️ **Course library** — a clean dashboard of all your imported courses with progress at a glance
- 🎉 **Completion celebration** — canvas particle animation when you finish a course
- 🌙 **Themes** — light, dark, and system-sync

### 🚧 v2 — Planned
- 📄 **PDF/resource viewer** — read course attachments without leaving the app
- 🔍 **Search** — search across all courses, lessons, and your personal notes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | [Tauri 2](https://tauri.app/) |
| Frontend | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Routing | [React Router 7](https://reactrouter.com/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Icons | [Phosphor Icons](https://phosphoricons.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Analytics | [PostHog](https://posthog.com/) (optional, env-configured) |
| Backend | [Rust](https://www.rust-lang.org/) |
| Database | SQLite via [rusqlite](https://github.com/rusqlite/rusqlite) (bundled) |
| Build Tool | [Vite](https://vite.dev/) |

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v20+)
- Platform toolchain for Tauri — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
# Clone the repository
git clone https://github.com/redaantar/ckourse.git
cd ckourse

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build

# Build universal macOS binary (Apple Silicon + Intel)
rustup target add x86_64-apple-darwin  # one-time setup
npm run tauri build -- --target universal-apple-darwin
```

### Environment variables (optional)

PostHog analytics is disabled unless you set the following in a `.env` file at the project root. Leave them unset to run the app with analytics off.

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### CI / Releases

The project includes a GitHub Actions workflow (`.github/workflows/build.yml`) that builds for macOS (universal) and Windows automatically.

```bash
# When ready to release:
git tag v1.0.0
git push --tags
```

This creates a **draft GitHub Release** with `.dmg` (macOS) and `.msi`/`.exe` (Windows) installers attached. You can also trigger builds manually from the Actions tab.

---

## Project Structure

```
ckourse/
├── src/                      # React frontend
│   ├── components/
│   │   ├── app-shell/        # Layout, sidebar, navigation
│   │   ├── course-detail/    # Video player, notes, sections
│   │   ├── dashboard/        # Course cards, stats, empty state
│   │   └── ui/               # Shared UI primitives
│   ├── pages/                # Route pages (Dashboard, CourseDetail, Notes,
│   │                         #   Bookmarks, Progress, ImportCourse, Settings)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Store, utilities, constants
│   ├── assets/               # Lottie animations, icons
│   └── types/                # TypeScript type definitions
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── lib.rs            # Tauri app setup
│   │   ├── db.rs             # SQLite schema and queries
│   │   ├── parser.rs         # Course folder parser
│   │   ├── subtitle.rs       # Subtitle file handling
│   │   └── commands/         # courses.rs, lessons.rs, notes.rs, settings.rs
│   └── tauri.conf.json       # Tauri configuration
└── public/                   # Static assets
```

---

## Contributing

Ckourse is in early development. Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run the app locally to verify: `npm run tauri dev`
5. Commit your changes: `git commit -m 'Add your feature'`
6. Push and open a Pull Request

### Notes for contributors

- Use named exports only
- Use `cn()` from `src/lib/utils.ts` for conditional class merging
- Use `@/` import alias for project imports
- Icons come from `@phosphor-icons/react`
- Fonts: DM Sans (body), Syne (headings), JetBrains Mono (code)

---

## License

MIT — free to use, modify, and distribute.

---

## Links

- 🐛 Issues: [github.com/redaantar/ckourse/issues](https://github.com/redaantar/ckourse/issues)
