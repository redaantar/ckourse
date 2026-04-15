# Releasing & Auto-Updates

The desktop app uses [`tauri-plugin-updater`](https://v2.tauri.app/plugin/updater/) to fetch new versions from GitHub Releases.

## One-time setup

### 1. Generate the signing keypair

Tauri signs every update so installed apps can verify it. You only do this **once** for the project.

```bash
npm run tauri signer generate -- -w ~/.tauri/ckourse.key
```

You'll be prompted for a password. This creates:

- `~/.tauri/ckourse.key` — **private key** (keep secret, never commit)
- `~/.tauri/ckourse.key.pub` — **public key**

### 2. Wire the public key into the app

Copy the contents of `~/.tauri/ckourse.key.pub` and paste it into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`, replacing the `REPLACE_WITH_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE` placeholder.

Commit that change.

### 3. Add GitHub Actions secrets

Add two secrets to the repo (Settings → Secrets and variables → Actions):

- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/ckourse.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you chose

## Cutting a release

1. Bump the version in **both** `package.json` and `src-tauri/tauri.conf.json` (also `src-tauri/Cargo.toml` if you version it separately).
2. Commit, tag, push:
   ```bash
   git commit -am "release vX.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   ```
3. The `Build & Release` workflow builds macOS + Windows, signs the update artifacts, and drafts a GitHub Release with:
   - platform installers (`.dmg`, `.msi`, `.exe`)
   - `latest.json` (the update manifest the app polls)
   - `.sig` signature files
4. Review the draft release on GitHub, then **publish** it. Publishing makes `https://github.com/redaantar/ckourse/releases/latest/download/latest.json` resolve, which is the endpoint the app checks.

## How clients update

- On launch, the app silently polls the endpoint (1.5s after start).
- If a newer version is found, a toast appears and the **Updates** section in Settings shows an `Install vX.Y.Z` button.
- Clicking it downloads + verifies the signature + installs + relaunches.

## Manual check

Users can hit the **Check for updates** button in Settings at any time.

## Troubleshooting

- **"signature error"** on install: public key in `tauri.conf.json` doesn't match the private key used to sign. Regenerate, or re-paste the pubkey.
- **No update detected** after publishing: make sure the release is **published** (not draft) and that the `version` in `latest.json` is greater than the installed app's version (semver compared).
- **`createUpdaterArtifacts: true` missing**: without it, `tauri-action` won't emit `latest.json`.
