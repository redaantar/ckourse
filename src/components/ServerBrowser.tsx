import { useState, useEffect, useCallback } from "react";
import { useLottie } from "lottie-react";
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
import { formatBytes } from "@/lib/format";
import { browseServer, type RemoteNode, type ServerConfig } from "@/lib/servers";
import loadingAnimation from "@/assets/lotties/loading.json";

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

  const { View: loadingAnimationView } = useLottie({
    animationData: loadingAnimation,
    loop: true,
    className: "size-28",
  });

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
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="squircle-subtle absolute inset-0 bg-border/50" />
        <div className="squircle-subtle absolute inset-px bg-card" />

        <div className="relative flex min-h-0 flex-col p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <HardDrives className="size-4 shrink-0 text-info" weight="bold" />
              <h3 className="truncate font-heading text-sm font-bold text-foreground">
                {server ? server.name : "Choose a server"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {!server ? (
            <div className="flex flex-col gap-2">
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServer(s)}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-3 text-left transition-colors hover:bg-secondary"
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
                <button
                  onClick={() => {
                    if (parent) void load(server, parent);
                    else if (servers.length > 1) setServer(null);
                  }}
                  disabled={!parent && servers.length <= 1}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                  aria-label="Go up"
                >
                  <CaretLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1 truncate rounded-lg bg-secondary/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {path ?? "…"}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center py-10">
                    {loadingAnimationView}
                  </div>
                ) : error ? (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-3">
                    <Warning className="mt-px size-4 shrink-0 text-destructive" weight="bold" />
                    <p className="whitespace-pre-wrap font-sans text-xs text-destructive">
                      {error}
                    </p>
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
                              : "cursor-default opacity-60",
                          )}
                        >
                          {entry.isDir ? (
                            <Folder className="size-4 shrink-0 text-info" weight="fill" />
                          ) : isVideo ? (
                            <FileVideo className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <File className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate font-sans text-sm text-foreground">
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
                <button
                  onClick={() => path && onPick(server, path, currentName)}
                  disabled={loading || !path}
                  className={cn(
                    "rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-foreground",
                    "transition-colors hover:bg-primary/90 disabled:opacity-50",
                  )}
                >
                  Use this folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
