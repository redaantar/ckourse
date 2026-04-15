# Contributing to Ckourse

Thanks for your interest in contributing! Ckourse is an open-source desktop app for organizing and watching downloaded courses, and contributions of all kinds — bug reports, feature ideas, documentation, code — are welcome.

## Before you start

- Please read and agree to the [Contributor License Agreement](CLA.md). The CLA bot will prompt you to sign on your first PR.
- Be kind and constructive. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs

Open an issue using the **Bug report** template and include:

- What you did, what you expected, what happened instead
- Your OS + version (macOS / Windows / Linux)
- Ckourse version (from the app's Settings page or the release tag)
- Steps to reproduce — smallest possible example
- Logs or a screenshot if relevant

## Requesting features

Open an issue using the **Feature request** template. Explain the problem you're trying to solve first, then propose a solution. Features that align with the v2 roadmap in the README are most likely to be picked up.

## Development workflow

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature` or `fix/your-bug`
3. Make your changes
4. Run the app locally to verify: `npm run tauri dev`
5. Commit with a clear message (see below)
6. Push and open a Pull Request against `main`

See [Building from Source](README.md#building-from-source) for setup instructions.

## Code conventions

- **Named exports only** — no default exports
- **Class merging** — use `cn()` from `src/lib/utils.ts`
- **Imports** — use the `@/` alias for project paths (e.g. `@/components/...`)
- **Icons** — from `@phosphor-icons/react`
- **Fonts** — DM Sans (body), Syne (headings), JetBrains Mono (code)
- **TypeScript** — prefer explicit types at component and function boundaries; avoid `any`
- **Rust** — run `cargo fmt` and `cargo clippy` before pushing backend changes

## Commit messages

Keep them short and descriptive. No strict format required, but prefer imperative mood:

```
Fix subtitle offset when track has BOM
Add keyboard shortcut for toggling sidebar
Refactor course parser to handle nested sections
```

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Update the README / relevant docs if behavior changes
- Reference the issue number if applicable (`Closes #42`)
- Expect a review round or two; that's normal

## Questions

If you're stuck or unsure whether something fits the project, open a discussion or a draft PR — it's easier to talk about concrete code than abstract ideas.
