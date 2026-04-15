import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useSettings } from "@/hooks/useSettings";
import {
  GearSixIcon as GearSix,
  PlayIcon as Play,
  DatabaseIcon as Database,
  FolderIcon as Folder,
  NotepadIcon as Notepad,
  BookmarkSimpleIcon as BookmarkSimple,
  HeartIcon as Heart,
  SpinnerGapIcon as SpinnerGap,
  StackIcon as Stack,
  MonitorPlayIcon as MonitorPlay,
  ArrowsClockwiseIcon as ArrowsClockwise,
  FastForwardIcon as FastForward,
  SpeakerHighIcon as SpeakerHigh,
  SkipForwardIcon as SkipForward,
  TrashIcon as Trash,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { LibraryStats } from "@/types";
import { getLibraryStats, deleteAllData } from "@/lib/store";
import { EASE_OUT } from "@/lib/constants";
import { useUpdater } from "@/hooks/useUpdater";
import { getVersion } from "@tauri-apps/api/app";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "block size-4.5 rounded-full bg-background shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none rounded-lg border border-border bg-secondary px-3 py-1.5",
          "font-sans text-sm text-foreground outline-none",
          "cursor-pointer transition-colors hover:border-muted-foreground/30",
          "pr-8",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  index: number;
}

function SectionCard({ title, icon, children, index }: SectionCardProps) {
  return (
    <div
      className="relative"
      style={{
        animation: `card-in 350ms ${EASE_OUT} ${index * 60}ms both`,
      }}
    >
      <div className="squircle-subtle absolute inset-0 bg-border/50" />
      <div className="squircle-subtle absolute inset-px bg-card" />
      <div className="relative p-5">
        <div className="mb-4 flex items-center gap-2">
          {icon}
          <h3 className="font-heading text-sm font-bold text-foreground">{title}</h3>
        </div>
        <div className="flex flex-col gap-0.5">{children}</div>
      </div>
    </div>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ icon, label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </div>
        <div>
          <div className="font-sans text-sm font-medium text-foreground">{label}</div>
          {description && (
            <div className="font-sans text-xs text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-3 py-2.5">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="font-mono text-sm font-bold text-foreground">{value}</div>
        <div className="font-sans text-[11px] text-muted-foreground">{label}</div>
      </div>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        style={{ animation: `card-in 250ms ${EASE_OUT} both` }}
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
            <WarningCircle className="size-5 text-destructive" weight="bold" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">
              Delete all data
            </h3>
            <p className="font-sans text-xs text-muted-foreground">
              This action cannot be undone
            </p>
          </div>
        </div>

        <p className="mb-4 font-sans text-sm text-muted-foreground">
          This will permanently delete all your courses, progress, notes, bookmarks,
          favorites, and settings. Your original course files on disk will not be affected.
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-xs font-medium text-muted-foreground">
            Type <span className="font-mono font-bold text-foreground">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoFocus
            className={cn(
              "w-full rounded-lg border bg-secondary px-3 py-2",
              "font-mono text-sm text-foreground placeholder:text-muted-foreground/40",
              "outline-none transition-colors",
              matches ? "border-destructive" : "border-border",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) onConfirm();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches}
            className={cn(
              "rounded-lg px-4 py-2 font-sans text-sm font-semibold transition-colors",
              matches
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "cursor-not-allowed bg-secondary text-muted-foreground/40",
            )}
          >
            Delete everything
          </button>
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

function UpdatesSection({ index }: { index: number }) {
  const updater = useUpdater();
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion(""));
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

  let description = appVersion ? `Current version v${appVersion}` : "Check for new versions";
  if (updater.status === "up-to-date") description = `You're on the latest version (v${appVersion})`;
  else if (updater.status === "available") description = `Version ${updater.version} is available`;
  else if (updater.status === "error") description = updater.error ?? "Update check failed";

  return (
    <SectionCard
      title="Updates"
      icon={<ArrowsClockwise className="size-4 text-info" weight="bold" />}
      index={index}
    >
      <SettingRow
        icon={<ArrowsClockwise className={cn("size-4", isChecking && "animate-spin")} />}
        label="App updates"
        description={description}
      >
        <button
          onClick={onClick}
          disabled={isChecking || isDownloading}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2",
            "font-sans text-sm font-semibold transition-colors",
            hasUpdate
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "border border-border bg-secondary text-foreground hover:bg-secondary/70",
            (isChecking || isDownloading) && "cursor-not-allowed opacity-60",
          )}
        >
          {buttonLabel}
        </button>
      </SettingRow>
      {isDownloading && (
        <div className="px-2 pb-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      {updater.status === "available" && updater.notes && (
        <div className="mx-2 mb-2 max-h-32 overflow-y-auto rounded-lg bg-secondary/50 px-3 py-2 font-sans text-xs whitespace-pre-wrap text-muted-foreground">
          {updater.notes}
        </div>
      )}
    </SectionCard>
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
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-3xl px-6 py-8", className)}>
      <div
        className="mb-8 flex items-center gap-3"
        style={{ animation: `card-in 350ms ${EASE_OUT} both` }}
      >
        <div className="squircle flex size-10 items-center justify-center bg-primary/15">
          <GearSix className="size-5 text-primary" weight="bold" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Settings</h2>
          <p className="font-sans text-sm text-muted-foreground">
            Configure your learning experience
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Playback"
          icon={<Play className="size-4 text-primary" weight="bold" />}
          index={0}
        >
          <SettingRow
            icon={<SkipForward className="size-4" />}
            label="Autoplay next lesson"
            description="Automatically play the next lesson when one finishes"
          >
            <Toggle
              checked={settings.autoplay_next}
              onChange={(v) => update("autoplay_next", String(v))}
            />
          </SettingRow>
          <SettingRow
            icon={<ArrowsClockwise className="size-4" />}
            label="Resume from last position"
            description="Continue videos from where you left off"
          >
            <Toggle
              checked={settings.resume_position}
              onChange={(v) => update("resume_position", String(v))}
            />
          </SettingRow>
          <SettingRow
            icon={<FastForward className="size-4" />}
            label="Default playback speed"
          >
            <Select
              value={String(settings.default_speed)}
              onChange={(v) => update("default_speed", v)}
              options={SPEED_OPTIONS}
            />
          </SettingRow>
          <SettingRow
            icon={<SpeakerHigh className="size-4" />}
            label="Default volume"
          >
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={100}
                value={settings.default_volume}
                onChange={(e) => update("default_volume", e.target.value)}
                className="h-1.5 w-24 cursor-pointer accent-primary"
              />
              <span className="w-8 font-mono text-xs text-muted-foreground">
                {settings.default_volume}%
              </span>
            </div>
          </SettingRow>
          <SettingRow
            icon={<MonitorPlay className="size-4" />}
            label="Skip forward / backward"
          >
            <Select
              value={String(settings.skip_forward_secs)}
              onChange={(v) => {
                update("skip_forward_secs", v);
                update("skip_backward_secs", v);
              }}
              options={SKIP_OPTIONS}
            />
          </SettingRow>
        </SectionCard>

        <SectionCard
          title="Library"
          icon={<Database className="size-4 text-info" weight="bold" />}
          index={1}
        >
          {stats && (
            <div className="grid grid-cols-3 gap-2.5">
              <StatChip
                icon={<Stack className="size-3.5" />}
                label="Courses"
                value={stats.totalCourses}
              />
              <StatChip
                icon={<MonitorPlay className="size-3.5" />}
                label="Lessons"
                value={stats.totalLessons}
              />
              <StatChip
                icon={<Notepad className="size-3.5" />}
                label="Notes"
                value={stats.totalNotes}
              />
              <StatChip
                icon={<BookmarkSimple className="size-3.5" />}
                label="Bookmarks"
                value={stats.totalBookmarks}
              />
              <StatChip
                icon={<Heart className="size-3.5" />}
                label="Favorites"
                value={stats.totalFavorites}
              />
              <StatChip
                icon={<Folder className="size-3.5" />}
                label="Sections"
                value={stats.totalSections}
              />
            </div>
          )}
          <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2.5">
            <div className="font-sans text-xs text-muted-foreground">Database location</div>
            <div className="mt-0.5 truncate font-mono text-xs text-foreground/70">
              {stats?.dbPath}
            </div>
          </div>
        </SectionCard>

        <UpdatesSection index={2} />

        <SectionCard
          title="Danger Zone"
          icon={<WarningCircle className="size-4 text-destructive" weight="bold" />}
          index={3}
        >
          <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash className="size-4" />
              </div>
              <div>
                <div className="font-sans text-sm font-medium text-foreground">
                  Delete all data
                </div>
                <div className="font-sans text-xs text-muted-foreground">
                  Permanently remove all courses, progress, notes, and settings
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className={cn(
                "shrink-0 rounded-lg border border-destructive/30 px-4 py-2",
                "font-sans text-sm font-semibold text-destructive",
                "transition-colors hover:bg-destructive/10",
              )}
            >
              Delete all
            </button>
          </div>
        </SectionCard>
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
