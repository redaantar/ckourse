import { convertFileSrc, invoke } from "@tauri-apps/api/core";

let request: Promise<string | null> | null = null;
let resolved: string | null | undefined;

/**
 * Base URL of the loopback media server, or null where the webview plays
 * custom URI schemes natively (macOS, Windows). WebKitGTK can't load <video>
 * from `stream://`, `gdrive://` or `srv://`, so on Linux lessons are served
 * over http://127.0.0.1 instead — see `src-tauri/src/media_server.rs`.
 */
export function getMediaServerUrl(): Promise<string | null> {
  request ??= invoke<string | null>("media_server_url")
    .catch(() => null)
    .then((url) => (resolved = url));
  return request;
}

/** Drops the media server's per-launch token from a URL before it's reported anywhere. */
export function redactMediaSrc(src: string): string {
  return resolved ? src.replace(resolved, "http://127.0.0.1/<media-server>") : src;
}

/** The server URL if it has already been fetched, `undefined` otherwise. */
export function peekMediaServerUrl(): string | null | undefined {
  return resolved;
}

/**
 * Playable URL for a lesson. Local lessons stream from disk via `stream://`,
 * Drive lessons store `gdrive:<fileId>`, and lessons on a saved server store
 * `srv:<serverId>:<path>`. All three support range requests, so seeking works
 * the same way everywhere.
 */
export function lessonVideoSrc(videoPath: string, mediaServerUrl: string | null): string {
  const [scheme, path] = videoPath.startsWith("gdrive:")
    ? ["gdrive", videoPath.slice("gdrive:".length)]
    : videoPath.startsWith("srv:")
      ? ["srv", videoPath.slice("srv:".length)]
      : ["stream", videoPath];
  return mediaServerUrl
    ? `${mediaServerUrl}/${scheme}/${encodeURIComponent(path)}`
    : convertFileSrc(path, scheme);
}
