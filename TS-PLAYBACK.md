# Automatic local .ts playback on macOS

Local `.ts` / `.TS` files, including courses on the Desktop, use the existing
player and all existing controls. No reimport is needed for existing lessons.
The original video paths and lesson IDs remain in SQLite. Notes with timestamps,
bookmarks, favorites, completion, last-watched lesson and saved position are not
migrated or rewritten by media preparation.

On first playback the bundled native FFmpeg prepares a seekable MP4 in
`~/Library/Caches/com.ckourse.app/playback/`. H.264/yuv420p video is copied when
possible, with a full H.264 fallback; other codecs are encoded as H.264/yuv420p.
Audio is made AAC. Videos without audio are supported. The first preparation
can take time, especially for large files that require encoding; the existing
player shows a preparation status. Playback starts when the complete file is
ready. This is automatic background preparation, not direct TS decoding.

The source is opened for reading only. Nothing is created in the course folder;
read-only external volumes work as well as local folders. Cache files are keyed
by canonical path, size, modification time and pipeline version, reused on later
plays, and atomically published. Concurrent requests share serialized preparation;
failed temporary files are removed. A changed source gets a new cache entry.
Do not edit a source during preparation. Disk space is needed on the Mac for the
prepared MP4; completed cache entries persist until deleted. To reclaim space,
quit ckourse and delete the `playback` cache directory. Notes/progress are in
Application Support, separate from this disposable cache.

Seeking from a timestamp during preparation is queued until metadata is ready.
Leaving a lesson prevents its late preparation result from replacing the next
lesson. The existing stream protocol serves the MP4 with byte-range support.
Drive and remote-server playback are unchanged; this feature handles local files.
Encrypted or damaged TS files may fail with a retryable error.

## Build Apple Silicon

Install Node and Rust stable plus Xcode Command Line Tools, then:

```sh
npm ci
npm run build:mac-arm64
```

This builds `1.2.1-ts.1` for `aarch64-apple-darwin` with native ffmpeg and ffprobe,
checks their architecture, and emits an app and DMG under
`src-tauri/target/aarch64-apple-darwin/release/bundle/`.
The local configuration uses an ad-hoc signature and omits updater artifacts;
it does not require the upstream developer's private signing keys. It is not
Apple Developer ID signed or notarized. Copy the app from the DMG to Applications.
macOS may require approval in System Settings > Privacy & Security > Open Anyway.

## Verification

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
# Generate short TS fixtures and exercise the exact packaged binaries:
CKOURSE_KEEP_MEDIA_TESTS=1 cargo test --manifest-path src-tauri/Cargo.toml \
  transport_stream_preparation -- --ignored --nocapture
# Use the MEDIA_TEST_DIR printed above:
swift scripts/test-webkit-playback.swift "$MEDIA_TEST_DIR/cache"
```

The media integration test covers H.264 + MP2, MPEG-2 + MP2, silent H.264,
uppercase extensions, spaces/Unicode/# in paths, read-only source permissions,
byte-identical originals, cache reuse, invalid media cleanup, timeline duration,
seek/decode, and unchanged database notes/progress/bookmarks/favorites.
Set `CKOURSE_READONLY_SOURCE` to a TS on an actual read-only mounted volume to
also check that directory writes fail while preparation succeeds.

The frontend tests cover delayed preparation and resume, ordinary MP4 playback,
queued timestamp clicks, stale results after lesson changes and retry after a
preparation failure. The Swift smoke test checks metadata, seeking and playback
in the native macOS WKWebView for all prepared fixture MP4s. Real personal course
files are not used or modified by these tests.
