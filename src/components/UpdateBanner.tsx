import {
  ArrowClockwiseIcon as ArrowClockwise,
  DownloadSimpleIcon as DownloadSimple,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUpdater } from "@/hooks/useUpdater";
import { EASE_OUT } from "@/lib/constants";

export function UpdateBanner() {
  const updater = useUpdater();

  const showBanner =
    !updater.dismissed &&
    (updater.status === "available" ||
      updater.status === "downloading" ||
      updater.status === "ready");

  if (!showBanner) return null;

  const isDownloading = updater.status === "downloading";
  const isReady = updater.status === "ready";
  const percent = Math.round(updater.progress * 100);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6"
      style={{ animation: `card-in 300ms ${EASE_OUT} both` }}
    >
      <div className="squircle pointer-events-auto flex w-full max-w-md items-center gap-3 border border-border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ArrowClockwise className="size-4" weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-sans text-sm font-semibold text-foreground">
            {isReady
              ? "Update ready"
              : isDownloading
                ? `Downloading ${percent}%`
                : `Update available`}
          </div>
          <div className="truncate font-sans text-xs text-muted-foreground">
            {isReady
              ? "Restart to finish installing"
              : isDownloading
                ? `Version ${updater.version}`
                : `Version ${updater.version} is ready to install`}
          </div>
          {isDownloading && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
        {!isDownloading && (
          <button
            onClick={updater.status === "available" ? updater.install : updater.install}
            className={cn(
              "shrink-0 rounded-lg bg-primary px-3 py-2",
              "font-sans text-xs font-semibold text-primary-foreground",
              "transition-opacity hover:opacity-90",
              "inline-flex items-center gap-1.5",
            )}
          >
            <DownloadSimple className="size-3.5" weight="bold" />
            {isReady ? "Restart" : "Install"}
          </button>
        )}
        <button
          onClick={updater.dismiss}
          disabled={isDownloading}
          className={cn(
            "shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            isDownloading && "cursor-not-allowed opacity-40",
          )}
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
