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
- ☁️ **Google Drive courses** — connect your own Google account and import a course straight from Drive, streaming lessons without downloading the whole folder first
- ▶️ **Built-in video player** — native HTML5 player with subtitle support, timestamp navigation, and autoplay with a configurable delay between lessons
- 📊 **Progress tracking** — per-lesson completion, per-course progress bar, resume from exactly where you stopped
- 📝 **Timestamped notes** — add notes tied to specific timestamps and navigate back to them instantly, even across lessons
- 📄 **PDF viewer** — read PDF attachments inside the app, for local, server and Drive courses alike; each lesson's own files show up next to it in the Resources tab
- 🔖 **Bookmarks** — bookmark lessons for quick access from a dedicated page
- 🗂️ **Course library** — a clean dashboard of all your imported courses with progress at a glance
- 🎉 **Completion celebration** — canvas particle animation when you finish a course
- 🌙 **Themes** — light, dark, and system-sync
- 🔄 **Auto-update** — the app checks for new releases and offers to update in place

### 🚧 v2 — Planned
- 📄 **Resource viewer** — preview other attachment types (text, images, Markdown) without leaving the app
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
| PDF rendering | [PDF.js](https://mozilla.github.io/pdf.js/) |
| Analytics | [PostHog](https://posthog.com/) (optional, env-configured) |
| Backend | [Rust](https://www.rust-lang.org/) |
| Database | SQLite via [rusqlite](https://github.com/rusqlite/rusqlite) (bundled) |
| Cloud Storage | [Google Drive API](https://developers.google.com/drive) (optional, bring-your-own credentials) |
| Credential Storage | OS keychain via [keyring](https://github.com/hwchen/keyring-rs) |
| Build Tool | [Vite](https://vite.dev/) |

---

## Download

Pre-built installers for macOS and Windows are available on the [Releases page](https://github.com/redaantar/ckourse/releases).

---

## Building from Source

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

# Run in development mode (macOS / Windows / Linux)
npm run tauri dev

# Build for production (produces installers for the current OS)
npm run tauri build
```

#### Platform-specific build targets

**macOS** — build a universal binary (Apple Silicon + Intel):

```bash
rustup target add x86_64-apple-darwin  # one-time setup
npm run tauri build -- --target universal-apple-darwin
```

Output: `.dmg` and `.app` under `src-tauri/target/universal-apple-darwin/release/bundle/`.

**Windows** — build an MSI and NSIS installer:

```powershell
npm run tauri build
```

Output: `.msi` and `.exe` under `src-tauri\target\release\bundle\`.

**Linux** — build `.deb` / `.AppImage`:

```bash
npm run tauri build
```

Output: `.deb` and `.AppImage` under `src-tauri/target/release/bundle/`.

### Environment variables (optional)

PostHog analytics is disabled unless you set the following in a `.env` file at the project root. Leave them unset to run the app with analytics off.

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### CI

CI builds macOS (universal) and Windows installers on tag push — see [`.github/workflows/build.yml`](.github/workflows/build.yml).

---

## Google Drive Setup

Drive support is **bring-your-own-credentials**: you create a personal Google Cloud project and paste its credentials into Ckourse's Settings. Nothing is shipped with the app and nothing is sent to a Ckourse server — credentials are stored in your OS keychain, and the app talks to Google directly.

This is deliberate. Reading a course folder requires the Restricted `drive.readonly` scope, which would demand an annual third-party security assessment for a shared, published app. Using your own project — which stays in "testing" mode — sidesteps that entirely and keeps your files under your own account.

The app ships an interactive walkthrough (**Settings → Google Drive → Setup guide**) that links each console page directly. The short version:

1. [Create a Google Cloud project](https://console.cloud.google.com/projectcreate).
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) and the [Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com).
3. Configure the OAuth consent screen and add your own Google account as a test user.
4. Create an **OAuth client ID** (application type: *Web application*).
5. Create an **API key** — this powers the folder picker.
6. Paste the client ID, client secret, and API key into Ckourse's Settings, then click Connect.

OAuth completes through a one-shot `http://127.0.0.1` listener on a random port, so no redirect URI needs to be registered ahead of time.

---

## Project Structure

```
ckourse/
├── src/                      # React frontend
│   ├── components/
│   │   ├── app-shell/        # Layout, sidebar, navigation
│   │   ├── course-detail/    # Video player, notes, sections
│   │   ├── dashboard/        # Course cards, stats, empty state
│   │   ├── ui/               # Shared UI primitives
│   │   ├── DriveSetupGuide.tsx  # Interactive Google Cloud walkthrough
│   │   ├── ErrorBoundary.tsx
│   │   └── UpdateBanner.tsx
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
│   │   ├── parser.rs         # Course folder parser (local + Drive)
│   │   ├── subtitle.rs       # Subtitle file handling
│   │   ├── google.rs         # Google OAuth, Drive API, token refresh
│   │   ├── drive_protocol.rs # drive:// handler — streams Drive media
│   │   ├── video_protocol.rs # video:// handler — streams local media
│   │   └── commands/         # courses.rs, lessons.rs, notes.rs,
│   │                         #   settings.rs, drive.rs
│   └── tauri.conf.json       # Tauri configuration
└── public/                   # Static assets
```

---

## Contributing

Ckourse is in early development. Contributions, issues, and feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code conventions, and commit style, and the [Code of Conduct](CODE_OF_CONDUCT.md) for community expectations.

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

---

## License

MIT — free to use, modify, and distribute.

---

## Links

- 🐛 Issues: [github.com/redaantar/ckourse/issues](https://github.com/redaantar/ckourse/issues)
