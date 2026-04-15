#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <version>
# e.g.  ./scripts/release.sh 1.1.0
#
# Bumps the version in package.json, src-tauri/tauri.conf.json, and
# src-tauri/Cargo.toml, then commits, tags vX.Y.Z, and pushes. The
# Build & Release workflow drafts the GitHub Release from the tag.

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <version>  (e.g. 1.1.0)" >&2
  exit 1
fi

VERSION="$1"
TAG="v${VERSION}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+].+)?$ ]]; then
  echo "error: '$VERSION' is not a valid semver version" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty — commit or stash first" >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "error: must release from 'main' (currently on '$BRANCH')" >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "error: tag $TAG already exists" >&2
  exit 1
fi

echo "==> bumping version to $VERSION"

node -e "
  const fs = require('fs');
  const f = 'package.json';
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.version = '$VERSION';
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
"

node -e "
  const fs = require('fs');
  const f = 'src-tauri/tauri.conf.json';
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.version = '$VERSION';
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
"

# Update the [package] version in Cargo.toml (first `version = "..."` only).
perl -i -pe 'BEGIN{$n=0} if (!$n && /^version\s*=\s*"[^"]+"/) { s/"[^"]+"/"'"$VERSION"'"/; $n=1 }' src-tauri/Cargo.toml

# Refresh Cargo.lock so the new version is reflected.
if command -v cargo >/dev/null 2>&1; then
  (cd src-tauri && cargo update -p ckourse --precise "$VERSION" >/dev/null 2>&1 || cargo generate-lockfile >/dev/null 2>&1 || true)
fi

echo "==> committing and tagging $TAG"
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>/dev/null || true
git commit -m "release $TAG"
git tag "$TAG"

echo "==> pushing to origin"
git push origin "$BRANCH"
git push origin "$TAG"

cat <<EOF

Release $TAG pushed. The Build & Release workflow will draft a GitHub
Release with installers + latest.json. Review and publish it here:

  https://github.com/redaantar/ckourse/releases
EOF
