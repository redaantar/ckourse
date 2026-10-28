<div align="center">

# Ckourse

**A desktop course player for the courses you already own.**

Import a course from a local folder, Google Drive, or your own server. Ckourse works out the structure, plays it, and keeps track of where you stopped.

[![Latest release](https://img.shields.io/github/v/release/redaantar/ckourse?label=release)](https://github.com/redaantar/ckourse/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB)](https://tauri.app/)

[Download](https://github.com/redaantar/ckourse/releases) · [Features](#features) · [Course sources](#course-sources) · [Build from source](#building-from-source) · [Contributing](#contributing)

</div>

---

## Why Ckourse

A downloaded course usually arrives as a folder of 80 inconsistently named videos, spread across subfolders, with PDFs and subtitles mixed in. A general-purpose media player doesn't know what "Section 4 – Lesson 12" means, and a file manager doesn't remember which lessons you've finished.

Ckourse fills that gap. It turns a course folder into a structured, trackable course, whether the files are on your disk, in Google Drive, or on a server you run. There's no subscription and no Ckourse account. Your library lives in a local SQLite database, and credentials stay in your operating system's keychain.

---

## Features

### Library and import

- **Smart folder parsing.** Ckourse detects sections, lessons, subtitles, and attachments in the usual course layouts, including nested and flat folders and numbered or unnumbered names.
- **Review before import.** Rename sections and lessons, drag them into a different order, set the title and author, and pick a category before the course is saved.
- **Three course sources.** Local folders, Google Drive, and self-hosted servers over SFTP, WebDAV, or S3. See [Course sources](#course-sources).
- **Course library.** A dashboard that shows every course with its progress, plus favorites and custom categories.

### Playback

- **Built-in video player** with subtitles, adjustable playback speed, configurable skip intervals, and resume from your last position.
- **Autoplay** to the next lesson, with a configurable delay.
- **Streaming for remote sources.** Drive and server courses play without being downloaded first. A shared block cache with read-ahead keeps playback and seeking smooth, and the player pauses cleanly instead of skipping frames when the buffer runs low.

### Learning tools

- **Progress tracking** for each lesson and each course, with automatic completion.
- **Timestamped notes.** Each note is tied to a moment in a lesson. Click one to jump back to that moment, even from another lesson.
- **Bookmarks** for lessons you want to come back to, collected on their own page.
- **Progress page** with daily streaks, total watch time, an activity chart, and completion by course and by category.
- **Levels.** Move from Beginner to Explorer, Achiever, and Master as you complete lessons (25, 150, and 500 lessons).
- **Completion celebration** when you finish a course.

### App

- Light, dark, and system themes.
- In-app auto-update from GitHub Releases.
- Analytics are optional and turned off unless you configure them at build time.

### Roadmap

- PDF and resource viewer for course attachments
- Search across courses, lessons, and notes

---

## Download

Installers for macOS (universal) and Windows are published on the [Releases page](https://github.com/redaantar/ckourse/releases). For Linux, build from source. Instructions are [below](#building-from-source).

---

## Course sources

| Source | Connection | Browsing | Credentials |
|---|---|---|---|
| **Local folder** | Filesystem | Native folder picker or drag and drop | None |
| **Google Drive** | Google Drive API, using your own Google Cloud project | Google Picker | OS keychain |
| **SFTP** | SSH, with a password or private key | In-app folder browser | OS keychain |
| **WebDAV** | HTTP(S), with ranged GET requests | In-app folder browser | OS keychain |
| **S3-compatible** | Presigned URLs (AWS S3, MinIO, Cloudflare R2, Backblaze B2, and others) | In-app folder browser | OS keychain |

Remote courses are streamed on demand. Ckourse doesn't copy or sync your files, and it never sends them to any server other than the one you configured.

### Self-hosted servers

Add a server under **Settings → Servers**. You can save several named servers and use different protocols for each.

1. Choose the protocol and enter the host, port, and base path, or the endpoint and bucket for S3.
2. Enter the credentials. Secrets are stored in the OS keychain, and only non-secret settings are written to the local database.
3. Click **Test connection**, then choose **Import from a server** on the Import page and browse to the course folder.

For SFTP, Ckourse pins the server's SSH host key the first time it connects (trust on first use). If the key changes later, it refuses to connect and tells you why.

Remote listings don't include video durations. Each lesson's duration is filled in the first time you play it.

### Google Drive

Drive uses your own credentials. You create a personal Google Cloud project and paste its credentials into Ckourse. Nothing is shipped with the app, and nothing goes through a Ckourse server: the app talks to Google directly.

This is deliberate. Reading a course folder requires the restricted `drive.readonly` scope, and a shared, published app with that scope would need an annual third-party security assessment. A personal project that stays in testing mode avoids that requirement and keeps your files under your own account.

The app includes an interactive walkthrough at **Settings → Google Drive → Setup guide** that links to each console page. The steps are:

1. [Create a Google Cloud project](https://console.cloud.google.com/projectcreate).
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) and the [Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com).
3. Configure the OAuth consent screen and add your Google account as a test user.
4. Create an **OAuth client ID** with the application type set to **Desktop app**.
5. Create an **API key**. The folder picker uses it.
6. Paste the client ID, client secret, and API key into Ckourse's settings, then click **Connect**.

Sign-in finishes through a one-time listener on `http://127.0.0.1` with a random port, so you don't need to register a redirect URI in advance.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri 2](https://tauri.app/) |
| Frontend | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [React Router 7](https://reactrouter.com/) |
| UI | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Phosphor Icons](https://phosphoricons.com/), [Recharts](https://recharts.org/), [dnd kit](https://dndkit.com/) |
| Backend | [Rust](https://www.rust-lang.org/) |
| Database | SQLite via [rusqlite](https://github.com/rusqlite/rusqlite) (bundled) |
| Networking | [reqwest](https://github.com/seanmonstar/reqwest) (rustls), [russh](https://github.com/Eugeny/russh) and russh-sftp, [rusty-s3](https://github.com/paolobarbolini/rusty-s3) |
| Credentials | OS keychain via [keyring](https://github.com/hwchen/keyring-rs) |
| Analytics | [PostHog](https://posthog.com/) (optional) |
| Build | [Vite](https://vite.dev/) |

---

## Building from source

### Prerequisites

- [Rust](https://rustup.rs/), latest stable
- [Node.js](https://nodejs.org/) v20 or later
- The Tauri platform toolchain. See [Tauri prerequisites](https://tauri.app/start/prerequisites/).

### Development

```bash
git clone https://github.com/redaantar/ckourse.git
cd ckourse
npm install

npm run tauri dev      # run in development mode
npm run tauri build    # build installers for the current OS
```

### Platform builds

| Platform | Command | Output |
|---|---|---|
| macOS (universal) | `npm run tauri build -- --target universal-apple-darwin` | `.dmg` and `.app` in `src-tauri/target/universal-apple-darwin/release/bundle/` |
| Windows | `npm run tauri build` | `.msi` and `.exe` in `src-tauri\target\release\bundle\` |
| Linux | `npm run tauri build` | `.deb` and `.AppImage` in `src-tauri/target/release/bundle/` |

The universal macOS build needs the Intel target installed once: `rustup target add x86_64-apple-darwin`.

### Tests

```bash
cd src-tauri && cargo test
```

### Environment variables (optional)

PostHog analytics stays off unless both variables are set in a `.env` file at the project root.

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### CI and releases

When a version tag is pushed, CI builds the macOS (universal) and Windows installers. See [`.github/workflows/build.yml`](.github/workflows/build.yml). The release process is described in [RELEASING.md](RELEASING.md).

---

## Project structure

```
ckourse/
├── src/                          # React frontend
│   ├── components/
│   │   ├── app-shell/            # Layout, sidebar, navigation
│   │   ├── course-detail/        # Video player, notes, sections
│   │   ├── dashboard/            # Course cards, stats, levels
│   │   ├── settings/             # Settings sections (servers, shared primitives)
│   │   ├── ui/                   # Shared UI primitives
│   │   ├── DriveSetupGuide.tsx   # Interactive Google Cloud walkthrough
│   │   └── ServerBrowser.tsx     # Remote folder browser
│   ├── pages/                    # Dashboard, CourseDetail, Notes, Bookmarks,
│   │                             #   Progress, ImportCourse, Settings
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Store, levels, servers, utilities
│   └── types/                    # TypeScript types
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── lib.rs                # App setup and protocol registration
│       ├── db.rs                 # SQLite schema and queries
│       ├── parser.rs             # Course structure parser (local and remote)
│       ├── subtitle.rs           # Subtitle handling
│       ├── google.rs             # Google OAuth and Drive API
│       ├── remote/               # RemoteBackend trait: sftp.rs, webdav.rs, s3.rs
│       ├── stream_cache.rs       # Shared block cache and read-ahead for remote streams
│       ├── video_protocol.rs     # video://  (local media)
│       ├── drive_protocol.rs     # gdrive:// (Google Drive media)
│       ├── remote_protocol.rs    # srv://    (self-hosted server media)
│       └── commands/             # Tauri commands: courses, lessons, notes,
│                                 #   settings, drive, servers
└── public/                       # Static assets
```

---

## Contributing

Issues, feature requests, and pull requests are welcome. Before you start, read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code conventions, and commit style, and the [Code of Conduct](CODE_OF_CONDUCT.md). Contributors are asked to sign the [CLA](CLA.md) on their first pull request.

To report a security vulnerability, follow [SECURITY.md](SECURITY.md) and don't open a public issue.

---

## License

[MIT](LICENSE) © Reda Antar
