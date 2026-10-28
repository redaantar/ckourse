import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon as Folder,
  FileVideoIcon as FileVideo,
  FileIcon as File,
  CaretLeftIcon as CaretLeft,
  XIcon as X,
  WarningIcon as Warning,
  HardDrivesIcon as HardDrives,
  CaretRightIcon as CaretRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { browseServer, type RemoteNode, type ServerConfig } from "@/lib/servers";
import { LoadingAnimation } from "@/components/LoadingAnimation";

const VIDEO_EXTENSIONS = /\.(mp4|m4v|mkv|mov|webm|avi|ogv|ogg)$/i;

interface ServerBrowserProps {
  servers: ServerConfig[];
  /** Resolves the picked folder — its path and display name. */
  onPick: (server: ServerConfig, path: string, name: string) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Modal for picking a course folder on a saved server. Lists one directory at a
 * time, so a deep library never has to be walked up front — that only happens
 * once the user commits to a folder.
 */
export function ServerBrowser({ servers, onPick, onClose, className }: ServerBrowserProps) {
  const [server, setServer] = useState<ServerConfig | null>(
    servers.length === 1 ? servers[0] : null,
  );
  const [path, setPath] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<RemoteNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (target: ServerConfig, next?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await browseServer(target.id, next);
        setPath(result.path);
        setParent(result.parent);
        setEntries(result.entries);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (server) void load(server, undefined);
  }, [server, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const videoCount = entries.filter((e) => !e.isDir && VIDEO_EXTENSIONS.test(e.name)).length;
  const folderCount = entries.filter((e) => e.isDir).length;
  const currentName = path ? path.split("/").filter(Boolean).pop() ?? server?.name ?? "" : "";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm",
        className,
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-browser-title"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-popover shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-col p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <HardDrives className="size-4 shrink-0 text-info" weight="bold" />
              <h3 id="server-browser-title" className="truncate font-heading text-base font-semibold text-foreground">
                {server ? server.name : "Choose a server"}
              </h3>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" title="Close">
              <X className="size-4" />
            </Button>
          </div>

          {!server ? (
            <div className="flex flex-col gap-2">
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServer(s)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0">
                    <div className="truncate font-sans text-sm font-medium text-foreground">
                      {s.name}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {s.kind === "s3" ? s.bucket : s.host}
                    </div>
                  </div>
                  <CaretRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (parent) void load(server, parent);
                    else if (servers.length > 1) setServer(null);
                  }}
                  disabled={!parent && servers.length <= 1}
                  aria-label={parent ? "Go up one folder" : "Back to servers"}
                  title={parent ? "Go up one folder" : "Back to servers"}
                >
                  <CaretLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-muted-foreground" title={path ?? undefined}>
                  {path ?? "…"}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center py-10">
                    <LoadingAnimation />
                  </div>
                ) : error ? (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3">
                    <Warning className="mt-px size-4 shrink-0 text-destructive" weight="bold" />
                    <p className="min-w-0 flex-1 whitespace-pre-wrap font-sans text-xs text-destructive select-text">
                      {error}
                    </p>
                    <Button variant="outline" size="xs" onClick={() => void load(server, path ?? undefined)}>
                      Retry
                    </Button>
                  </div>
                ) : entries.length === 0 ? (
                  <p className="py-10 text-center font-sans text-xs text-muted-foreground">
                    This folder is empty.
                  </p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {entries.map((entry) => {
                      const isVideo = !entry.isDir && VIDEO_EXTENSIONS.test(entry.name);
                      return (
                        <button
                          key={entry.path}
                          onClick={() => entry.isDir && void load(server, entry.path)}
                          disabled={!entry.isDir}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                            entry.isDir
                              ? "hover:bg-secondary"
                              : "cursor-default",
                          )}
                        >
                          {entry.isDir ? (
                            <Folder className="size-4 shrink-0 text-info" weight="fill" />
                          ) : isVideo ? (
                            <FileVideo className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <File className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate font-sans text-sm",
                              entry.isDir ? "text-foreground" : "text-muted-foreground",
                            )}
                            title={entry.name}
                          >
                            {entry.name}
                          </span>
                          {!entry.isDir && entry.size > 0 && (
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              {formatBytes(entry.size)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
                <p className="font-sans text-xs text-muted-foreground">
                  {loading
                    ? "Loading…"
                    : `${folderCount} folder${folderCount === 1 ? "" : "s"}, ${videoCount} video${videoCount === 1 ? "" : "s"} here`}
                </p>
                <Button
                  onClick={() => path && onPick(server, path, currentName)}
                  disabled={loading || !path}
                >
                  Use this folder
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
