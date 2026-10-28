import {
  ArrowClockwiseIcon as ArrowClockwise,
  DownloadSimpleIcon as DownloadSimple,
  XIcon as X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
      <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-popover/95 p-3 pl-4 shadow-pop backdrop-blur">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground" aria-hidden="true">
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
            <div
              role="progressbar"
              aria-label="Download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
        {!isDownloading && (
          <Button size="sm" onClick={updater.install}>
            {isReady ? (
              <ArrowClockwise className="size-3.5" weight="bold" />
            ) : (
              <DownloadSimple className="size-3.5" weight="bold" />
            )}
            {isReady ? "Restart" : "Install"}
          </Button>
        )}
        {!isDownloading && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={updater.dismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
