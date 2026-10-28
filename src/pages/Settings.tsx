import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useSettings, AUTOPLAY_DELAY_MAX } from "@/hooks/useSettings";
import {
  DatabaseIcon as Database,
  ArrowsClockwiseIcon as ArrowsClockwise,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
  CloudIcon as Cloud,
  KeyIcon as Key,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LibraryStats } from "@/types";
import { getLibraryStats, deleteAllData } from "@/lib/store";
import {
  driveCredentialsStatus,
  driveSetCredentials,
  driveClearCredentials,
  driveAuthStatus,
  driveConnect,
  driveDisconnect,
} from "@/lib/drive";
import { EASE_OUT } from "@/lib/constants";
import { DriveSetupGuide } from "@/components/DriveSetupGuide";
import {
  SettingsGroup,
  SettingRow,
  SettingPanel,
  CredInput,
  Toggle,
  Select,
  Slider,
  type SelectOption,
} from "@/components/settings/SettingsPrimitives";
import { ServersSection } from "@/components/settings/ServersSection";
import { useUpdater } from "@/hooks/useUpdater";
import { getVersion } from "@tauri-apps/api/app";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { AppearanceSection } from "@/components/settings/AppearanceSection";

/** One figure in the library summary: the number carries it, the label whispers. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="font-sans text-[22px] leading-none font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="mt-1.5 font-sans text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const CONFIRM_PHRASE = "delete all";

function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const matches = input.toLowerCase().trim() === CONFIRM_PHRASE;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-all-title"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-popover p-6 shadow-pop"
        style={{ animation: `card-in 250ms ${EASE_OUT} both` }}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3"
        >
          <X className="size-4" />
        </Button>

        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-destructive/12">
          <WarningCircle className="size-6 text-destructive" weight="fill" />
        </div>
        <h3 id="delete-all-title" className="font-heading text-lg font-semibold text-foreground">
          Erase everything in Ckourse?
        </h3>
        <p className="mt-2 mb-5 font-sans text-sm text-muted-foreground">
          Every course, all progress, notes, saved courses, favorites and settings are removed for
          good. Your video files on disk stay exactly where they are.
        </p>

        <div className="mb-4">
          <label
            htmlFor="delete-confirm"
            className="mb-1.5 block font-sans text-xs font-medium text-muted-foreground"
          >
            Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to
            confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoFocus
            className={cn(
              "w-full rounded-lg border bg-card px-3 py-2",
              "font-sans text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none transition-colors focus-visible:border-ring",
              matches ? "border-destructive" : "border-input",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) onConfirm();
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches}>
            Erase everything
          </Button>
        </div>
      </div>
    </div>
  );
}

const SPEED_OPTIONS: SelectOption[] = [
  { value: "0.5", label: "0.5x" },
  { value: "0.75", label: "0.75x" },
  { value: "1", label: "1x" },
  { value: "1.25", label: "1.25x" },
  { value: "1.5", label: "1.5x" },
  { value: "1.75", label: "1.75x" },
  { value: "2", label: "2x" },
];

const SKIP_OPTIONS: SelectOption[] = [
  { value: "5", label: "5s" },
  { value: "10", label: "10s" },
  { value: "15", label: "15s" },
  { value: "30", label: "30s" },
];

interface SettingsProps {
  className?: string;
}

function UpdatesSection() {
  const updater = useUpdater();
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(""));
  }, []);

  const isChecking = updater.status === "checking";
  const isDownloading = updater.status === "downloading";
  const isReady = updater.status === "ready";
  const hasUpdate = updater.status === "available" || isDownloading || isReady;
  const percent = Math.round(updater.progress * 100);

  let buttonLabel = "Check for updates";
  if (isChecking) buttonLabel = "Checking…";
  else if (isReady) buttonLabel = "Restart to update";
  else if (isDownloading) buttonLabel = `Downloading ${percent}%`;
  else if (updater.status === "available") buttonLabel = `Install v${updater.version}`;

  const onClick = () => {
    if (hasUpdate) updater.install();
    else updater.check();
  };

  let description = "Check for new versions";
  if (updater.status === "up-to-date")
    description = `You're on the latest version (v${appVersion})`;
  else if (updater.status === "available") description = `Version ${updater.version} is available`;
  else if (updater.status === "error") description = updater.error ?? "Update check failed";

  return (
    <SettingsGroup title="About">
      <SettingRow
        icon={<ArrowsClockwise className={cn(isChecking && "animate-spin")} />}
        label={appVersion ? `Ckourse ${appVersion}` : "Ckourse"}
        description={description}
      >
        <Button
          size="sm"
          onClick={onClick}
          disabled={isChecking || isDownloading}
          variant={hasUpdate ? "default" : "outline"}
        >
          {buttonLabel}
        </Button>
      </SettingRow>
      {(isDownloading || (updater.status === "available" && updater.notes)) && (
        <SettingPanel>
          {isDownloading && (
            <div
              role="progressbar"
              aria-label="Download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1 w-full overflow-hidden rounded-full bg-accent"
              title={`${percent}%`}
            >
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          {updater.status === "available" && updater.notes && (
            <div className="max-h-32 overflow-y-auto rounded-lg bg-secondary px-3 py-2 font-sans text-xs whitespace-pre-wrap text-muted-foreground select-text">
              {updater.notes}
            </div>
          )}
        </SettingPanel>
      )}
    </SettingsGroup>
  );
}

function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

function GoogleDriveSection() {
  const [credsSet, setCredsSet] = useState(false);
  const [connected, setConnected] = useState(false);
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const set = await driveCredentialsStatus();
      setCredsSet(set);
      setConnected(set ? (await driveAuthStatus()).connected : false);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The Settings page stays mounted (kept-alive), so re-check status whenever it
  // becomes visible again — e.g. after reconnecting Drive from a course page.
  usePageVisible("/settings", refresh);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  // Connect is special: the Rust side blocks until the browser redirect arrives
  // (or its long internal timeout fires), and closing the browser sends no
  // signal. A generation token lets the user abort the "Check your browser…"
  // state — a later-resolving stale attempt is then ignored.
  const [connecting, setConnecting] = useState(false);
  const connectGen = useRef(0);

  const connect = useCallback(async () => {
    const gen = ++connectGen.current;
    setConnecting(true);
    setError(null);
    try {
      await driveConnect();
      if (gen !== connectGen.current) return; // aborted or superseded
      await refresh();
    } catch (e) {
      if (gen !== connectGen.current) return;
      setError(errMsg(e));
    } finally {
      if (gen === connectGen.current) setConnecting(false);
    }
  }, [refresh]);

  const cancelConnect = useCallback(() => {
    connectGen.current++; // invalidate the in-flight attempt
    setConnecting(false);
    setError(null);
  }, []);

  const saveCreds = () =>
    run(async () => {
      if (!clientId.trim() || !clientSecret.trim() || !apiKey.trim()) {
        throw new Error("All three fields are required");
      }
      await driveSetCredentials(clientId.trim(), clientSecret.trim(), apiKey.trim());
      setEditing(false);
      setClientSecret("");
    });

  const closeForm = () => {
    setEditing(false);
    setError(null);
  };

  let status = "Not set up";
  if (credsSet) {
    if (connecting) status = "Check your browser…";
    else status = connected ? "Connected" : "Not connected — connect to sign in";
  }

  return (
    <SettingsGroup
      title="Google Drive"
      description="Stream courses straight from a Drive folder, nothing downloaded."
      footer="Uses your own Google Cloud credentials with read-only access, kept in your system keychain."
    >
      <SettingRow
        icon={<Cloud />}
        label="Google Drive"
        description={
          <span className="flex items-center gap-1.5" role="status">
            {credsSet && (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  connected ? "bg-success" : "bg-input",
                )}
                aria-hidden
              />
            )}
            {status}
          </span>
        }
      >
        {!credsSet ? (
          !editing && (
            <Button size="sm" onClick={() => setEditing(true)}>
              Set up
            </Button>
          )
        ) : connected ? (
          <Button variant="outline" size="sm" onClick={() => run(driveDisconnect)} disabled={busy}>
            Disconnect
          </Button>
        ) : connecting ? (
          <Button variant="outline" size="sm" onClick={cancelConnect}>
            Cancel
          </Button>
        ) : (
          <Button size="sm" onClick={connect} disabled={busy}>
            Connect
          </Button>
        )}
      </SettingRow>

      {credsSet && !editing && (
        <SettingRow
          icon={<Key />}
          label="Credentials"
          description="Client ID, secret and API key"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={busy || connecting}
          >
            Edit
          </Button>
          <Button
            variant="destructive-outline"
            size="sm"
            onClick={() => run(driveClearCredentials)}
            disabled={busy || connecting}
          >
            Clear
          </Button>
        </SettingRow>
      )}

      {editing && (
        <SettingPanel>
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-sm text-muted-foreground">
              Paste the three values from Google Cloud.
            </p>
            <DriveSetupGuide />
          </div>
          <CredInput
            label="OAuth Client ID (Desktop app)"
            value={clientId}
            onChange={setClientId}
            placeholder="xxxxx.apps.googleusercontent.com"
          />
          <CredInput
            label="OAuth Client Secret"
            value={clientSecret}
            onChange={setClientSecret}
            type="password"
            placeholder="GOCSPX-…"
          />
          <CredInput
            label="API Key (Picker API)"
            value={apiKey}
            onChange={setApiKey}
            placeholder="AIza…"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={saveCreds} disabled={busy}>
              Save credentials
            </Button>
          </div>
        </SettingPanel>
      )}

      {error && (
        <SettingPanel>
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
          >
            <WarningCircle className="mt-px size-4 shrink-0 text-destructive" weight="fill" />
            <p className="min-w-0 whitespace-pre-wrap font-sans text-xs text-destructive select-text">
              {error}
            </p>
          </div>
        </SettingPanel>
      )}
    </SettingsGroup>
  );
}

export function Settings({ className }: SettingsProps) {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadStats = useCallback(() => {
    return getLibraryStats().then(setStats);
  }, []);

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  usePageVisible("/settings", loadStats);

  const handleDeleteAll = useCallback(async () => {
    await deleteAllData();
    setShowDeleteDialog(false);
    navigate("/");
    window.location.reload();
  }, [navigate]);

  if (loading) {
    return <div className={cn("min-h-[60vh]", className)} aria-busy="true" />;
  }

  const delay = settings.autoplay_delay_secs;
  const delayText = delay === 0 ? "Instant" : `${delay}s`;

  return (
    <div className={cn("mx-auto w-full max-w-3xl px-6 pt-12 pb-20 lg:px-10", className)}>
      <div className="flex flex-col gap-10">
        <header>
          <h1 className="font-heading text-[34px] leading-tight font-semibold text-foreground">Settings</h1>
          <p className="mt-1 font-sans text-[15px] text-muted-foreground">
            Make Ckourse fit the way you learn.
          </p>
        </header>

        <AppearanceSection />

        <SettingsGroup title="Playback" description="Defaults for every lesson you open.">
          <SettingRow
            label="Play the next lesson automatically"
            description="When a lesson ends, the next one starts on its own"
          >
            <Toggle
              label="Play the next lesson automatically"
              checked={settings.autoplay_next}
              onChange={(v) => update("autoplay_next", String(v))}
            />
          </SettingRow>
          {settings.autoplay_next && (
            <SettingRow label="Pause between lessons" description="A moment to breathe before the next one">
              <Slider
                label="Pause between lessons"
                value={delay}
                min={0}
                max={AUTOPLAY_DELAY_MAX}
                valueText={delayText}
                onChange={(v) => update("autoplay_delay_secs", v)}
              />
            </SettingRow>
          )}
          <SettingRow label="Resume where you stopped" description="Videos reopen at your last position">
            <Toggle
              label="Resume where you stopped"
              checked={settings.resume_position}
              onChange={(v) => update("resume_position", String(v))}
            />
          </SettingRow>
          <SettingRow label="Speed">
            <Select
              label="Default playback speed"
              value={String(settings.default_speed)}
              onChange={(v) => update("default_speed", v)}
              options={SPEED_OPTIONS}
            />
          </SettingRow>
          <SettingRow label="Volume">
            <Slider
              label="Default volume"
              value={settings.default_volume}
              min={0}
              max={100}
              valueText={`${settings.default_volume}%`}
              onChange={(v) => update("default_volume", v)}
            />
          </SettingRow>
          <SettingRow label="Skip" description="How far the back and forward buttons jump">
            <Select
              label="Skip forward / backward"
              value={String(settings.skip_forward_secs)}
              onChange={(v) => {
                update("skip_forward_secs", v);
                update("skip_backward_secs", v);
              }}
              options={SKIP_OPTIONS}
            />
          </SettingRow>
        </SettingsGroup>

        <SettingsGroup title="Library">
          {stats && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 px-5 py-5 sm:grid-cols-6">
              <Figure label="Courses" value={stats.totalCourses} />
              <Figure label="Sections" value={stats.totalSections} />
              <Figure label="Lessons" value={stats.totalLessons} />
              <Figure label="Notes" value={stats.totalNotes} />
              <Figure label="Saved" value={stats.totalBookmarks} />
              <Figure label="Favorites" value={stats.totalFavorites} />
            </div>
          )}
          <SettingRow
            icon={<Database />}
            label="Database"
            description={
              <span className="select-text" title={stats?.dbPath}>
                {stats?.dbPath}
              </span>
            }
          >
            {stats?.dbPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void revealItemInDir(stats.dbPath).catch(() => {})}
              >
                Show in Finder
              </Button>
            )}
          </SettingRow>
        </SettingsGroup>

        <GoogleDriveSection />

        <ServersSection />

        <UpdatesSection />

        <SettingsGroup
          title="Erase all data"
          footer="Your video files are never touched — only what Ckourse knows about them."
        >
          <SettingRow
            label="Start over"
            description="Removes every course, all progress, notes and settings"
          >
            <Button variant="destructive-outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
              Erase…
            </Button>
          </SettingRow>
        </SettingsGroup>
      </div>

      {showDeleteDialog && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
