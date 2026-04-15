#!/usr/bin/env bash
# Copies static ffmpeg + ffprobe binaries from npm packages into src-tauri/binaries/.
# Requires: npm install (already run as part of build)
#
# Usage:
#   bash scripts/download-ffmpeg.sh        # local dev
#   bash scripts/download-ffmpeg.sh --ci   # CI universal build (both archs)

set -euo pipefail

DEST="src-tauri/binaries"
mkdir -p "$DEST"

NM="node_modules"
CI_MODE="${1:-}"

if [[ "$(uname)" == "Darwin" ]]; then
  if [[ "$CI_MODE" == "--ci" ]]; then
    # Universal build needs both arch-specific AND a combined universal binary.
    # Compilation phase uses the arch-specific ones; bundling phase uses the universal.
    cp "$NM/ffprobe-static/bin/darwin/arm64/ffprobe"  "$DEST/ffprobe-aarch64-apple-darwin"
    cp "$NM/ffprobe-static/bin/darwin/x64/ffprobe"    "$DEST/ffprobe-x86_64-apple-darwin"
    cp "$NM/ffmpeg-static/ffmpeg"                      "$DEST/ffmpeg-aarch64-apple-darwin"
    cp "$NM/ffmpeg-static/ffmpeg"                      "$DEST/ffmpeg-x86_64-apple-darwin"
    chmod +x "$DEST/ffprobe-aarch64-apple-darwin" "$DEST/ffprobe-x86_64-apple-darwin" \
             "$DEST/ffmpeg-aarch64-apple-darwin"  "$DEST/ffmpeg-x86_64-apple-darwin"

    # Create universal (fat) binaries for the bundling phase.
    for BIN in ffprobe ffmpeg; do
      lipo -create "$DEST/${BIN}-aarch64-apple-darwin" "$DEST/${BIN}-x86_64-apple-darwin" \
        -output "$DEST/${BIN}-universal-apple-darwin" 2>/dev/null || \
        cp "$DEST/${BIN}-aarch64-apple-darwin" "$DEST/${BIN}-universal-apple-darwin"
      chmod +x "$DEST/${BIN}-universal-apple-darwin"
    done
  else
    ARCH=$(uname -m)
    [[ "$ARCH" == "arm64" ]] && TRIPLE="aarch64-apple-darwin" || TRIPLE="x86_64-apple-darwin"
    [[ "$ARCH" == "arm64" ]] && FFPROBE_DIR="arm64" || FFPROBE_DIR="x64"

    cp "$NM/ffprobe-static/bin/darwin/$FFPROBE_DIR/ffprobe" "$DEST/ffprobe-$TRIPLE"
    cp "$NM/ffmpeg-static/ffmpeg"                            "$DEST/ffmpeg-$TRIPLE"
    chmod +x "$DEST/ffprobe-$TRIPLE" "$DEST/ffmpeg-$TRIPLE"
  fi

  for f in "$DEST"/ff*-*-apple-darwin; do
    echo "✓ $f  ($(ls -lh "$f" | awk '{print $5}'), $(file "$f" | grep -o 'arm64\|x86_64'))"
  done

elif [[ "$(uname)" == "MINGW"* ]] || [[ "$(uname)" == "MSYS"* ]]; then
  cp "$NM/ffprobe-static/bin/win32/x64/ffprobe.exe" "$DEST/ffprobe-x86_64-pc-windows-msvc.exe"
  cp "$NM/ffmpeg-static/ffmpeg.exe"                  "$DEST/ffmpeg-x86_64-pc-windows-msvc.exe"
  echo "✓ $DEST/ffprobe-x86_64-pc-windows-msvc.exe"
  echo "✓ $DEST/ffmpeg-x86_64-pc-windows-msvc.exe"
fi
