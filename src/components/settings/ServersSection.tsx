import { useState, useEffect, useCallback } from "react";
import {
  HardDrivesIcon as HardDrives,
  PlusIcon as Plus,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
  PlugsConnectedIcon as PlugsConnected,
  WarningCircleIcon as WarningCircle,
  CheckCircleIcon as CheckCircle,
  SpinnerGapIcon as SpinnerGap,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getServers,
  saveServer,
  deleteServer,
  testServer,
  countServerCourses,
  defaultPort,
  SERVER_KIND_LABELS,
  type ServerConfig,
  type ServerInput,
  type ServerKind,
} from "@/lib/servers";
import { SettingsGroup, SettingRow, SettingPanel, CredInput } from "./SettingsPrimitives";

const KINDS: ServerKind[] = ["sftp", "webdav", "s3"];

const KIND_HINTS: Record<ServerKind, string> = {
  sftp: "Any machine you can SSH into. Nothing to install on the server.",
  webdav: "Nextcloud, ownCloud, rclone serve webdav, Apache mod_dav.",
  s3: "MinIO, Backblaze B2, Cloudflare R2, Wasabi, AWS S3.",
};

/** Empty form state for a new server of the given kind. */
function blankForm(kind: ServerKind): ServerInput {
  return {
    name: "",
    kind,
    host: "",
    port: defaultPort(kind),
    username: "",
    basePath: kind === "s3" ? "/" : "/",
    bucket: "",
    region: "",
    pathStyle: true,
    password: "",
    privateKey: "",
    passphrase: "",
  };
}

/** Prefill the form from a saved server. Secrets stay blank — they're in the keychain. */
function formFrom(server: ServerConfig): ServerInput {
  return {
    id: server.id,
    name: server.name,
    kind: server.kind,
    host: server.host,
    port: server.port,
    username: server.username,
    basePath: server.basePath,
    bucket: server.bucket,
    region: server.region,
    pathStyle: server.pathStyle,
    password: "",
    privateKey: "",
    passphrase: "",
  };
}

export function ServersSection() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [form, setForm] = useState<ServerInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    server: ServerConfig;
    courses: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setServers(await getServers());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const set = <K extends keyof ServerInput>(key: K, value: ServerInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const startAdd = () => {
    setError(null);
    setNotice(null);
    setForm(blankForm("sftp"));
  };

  const startEdit = (server: ServerConfig) => {
    setError(null);
    setNotice(null);
    setForm(formFrom(server));
  };

  const closeForm = () => {
    setForm(null);
    setError(null);
    setNotice(null);
  };

  const handleSave = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await saveServer(form);
      await refresh();
      closeForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!form) return;
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await testServer(form));
    } catch (e) {
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  // Removing a server breaks playback for its courses, so say how many first.
  const askDelete = async (server: ServerConfig) => {
    setError(null);
    try {
      setConfirmDelete({ server, courses: await countServerCourses(server.id) });
    } catch {
      setConfirmDelete({ server, courses: 0 });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteServer(confirmDelete.server.id);
      await refresh();
      setConfirmDelete(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsGroup
      title="Your servers"
      description="Stream courses from your own machine over SFTP, WebDAV or S3."
      footer="Passwords and keys live in your system keychain, never in Ckourse's database."
    >
      {form ? (
        <ServerForm
          form={form}
          set={set}
          busy={busy}
          testing={testing}
          onSave={handleSave}
          onTest={handleTest}
          onCancel={closeForm}
        />
      ) : (
        <>
          {servers.map((server) => (
            <SettingRow
              key={server.id}
              icon={<HardDrives />}
              label={<span title={server.name}>{server.name}</span>}
              description={
                <span title={describe(server)}>
                  {describe(server)}
                </span>
              }
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => startEdit(server)}
                aria-label={`Edit ${server.name}`}
                title="Edit"
              >
                <PencilSimple className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void askDelete(server)}
                className="hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${server.name}`}
                title="Remove"
              >
                <Trash className="size-4" />
              </Button>
            </SettingRow>
          ))}

          {servers.length === 0 ? (
            <SettingRow
              icon={<HardDrives />}
              label="No servers yet"
              description="Add one to import courses from your own machine"
            >
              <Button variant="outline" size="sm" onClick={startAdd}>
                <Plus className="size-4" weight="bold" />
                Add server
              </Button>
            </SettingRow>
          ) : (
            <button
              onClick={startAdd}
              className="flex w-full items-center gap-3 px-4 py-3 text-left font-sans text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                <Plus className="size-[18px]" />
              </span>
              Add server
            </button>
          )}
        </>
      )}

      {(notice || error || confirmDelete) && (
        <SettingPanel>
          {notice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2"
            >
              <CheckCircle className="mt-px size-4 shrink-0 text-success" weight="fill" />
              <p className="font-sans text-xs text-foreground select-text">{notice}</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
            >
              <WarningCircle className="mt-px size-4 shrink-0 text-destructive" weight="fill" />
              <p className="min-w-0 whitespace-pre-wrap font-sans text-xs text-destructive select-text">
                {error}
              </p>
            </div>
          )}

          {confirmDelete && (
            <div
              role="alertdialog"
              aria-label="Confirm remove server"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="min-w-0 flex-1 font-sans text-sm text-foreground">
                Remove <span className="font-semibold">{confirmDelete.server.name}</span>?
                {confirmDelete.courses > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    {confirmDelete.courses} imported{" "}
                    {confirmDelete.courses === 1 ? "course" : "courses"} will stop playing —
                    progress and notes are kept.
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)} autoFocus>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDelete()}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </SettingPanel>
      )}
    </SettingsGroup>
  );
}

/** One-line summary of where a server points. */
function describe(server: ServerConfig): string {
  switch (server.kind) {
    case "sftp":
      return `sftp://${server.username}@${server.host}:${server.port}${server.basePath}`;
    case "webdav":
      return `${server.host}${server.basePath === "/" ? "" : server.basePath}`;
    case "s3":
      return `s3://${server.bucket}${server.basePath === "/" ? "" : server.basePath}`;
  }
}

interface ServerFormProps {
  form: ServerInput;
  set: <K extends keyof ServerInput>(key: K, value: ServerInput[K]) => void;
  busy: boolean;
  testing: boolean;
  onSave: () => void;
  onTest: () => void;
  onCancel: () => void;
}

function ServerForm({ form, set, busy, testing, onSave, onTest, onCancel }: ServerFormProps) {
  const isEdit = Boolean(form.id);
  const [useKey, setUseKey] = useState(false);

  return (
    <SettingPanel>
      <div>
        <span className="mb-1.5 block font-sans text-xs font-medium text-muted-foreground">
          Type
        </span>
        <div
          role="group"
          aria-label="Server type"
          className="flex gap-0.5 rounded-xl bg-secondary p-1"
        >
          {KINDS.map((kind) => (
            <button
              key={kind}
              aria-pressed={form.kind === kind}
              onClick={() => {
                set("kind", kind);
                set("port", defaultPort(kind));
              }}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                form.kind === kind
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SERVER_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-sans text-[11px] text-muted-foreground">
          {KIND_HINTS[form.kind]}
        </p>
      </div>

      <CredInput
        label="Name"
        value={form.name}
        onChange={(v) => set("name", v)}
        placeholder="Home server"
      />

      {form.kind === "sftp" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <CredInput
                label="Host"
                value={form.host}
                onChange={(v) => set("host", v)}
                placeholder="192.168.1.10 or vps.example.com"
              />
            </div>
            <div className="w-24">
              <CredInput
                label="Port"
                value={String(form.port ?? 22)}
                onChange={(v) => set("port", Number(v) || 22)}
                placeholder="22"
                inputMode="numeric"
              />
            </div>
          </div>
          <CredInput
            label="Username"
            value={form.username}
            onChange={(v) => set("username", v)}
            placeholder="ubuntu"
          />

          <div>
            <div
              role="group"
              aria-label="Authentication method"
              className="flex gap-0.5 rounded-xl bg-secondary p-1"
            >
              <button
                aria-pressed={!useKey}
                onClick={() => setUseKey(false)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                  !useKey
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Password
              </button>
              <button
                aria-pressed={useKey}
                onClick={() => setUseKey(true)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                  useKey
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Private key
              </button>
            </div>
          </div>

          {useKey ? (
            <>
              <label className="block">
                <span className="mb-1.5 block font-sans text-xs font-medium text-muted-foreground">
                  Private key {isEdit && "(leave blank to keep the saved one)"}
                </span>
                <textarea
                  value={form.privateKey ?? ""}
                  onChange={(e) => set("privateKey", e.target.value)}
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n…"}
                  spellCheck={false}
                  rows={4}
                  className={cn(
                    "w-full resize-y rounded-lg border border-border bg-background px-3 py-2 hover:border-input",
                    "font-mono text-xs text-foreground placeholder:text-muted-foreground",
                    "outline-none transition-colors focus-visible:border-ring",
                  )}
                />
              </label>
              <CredInput
                label="Key passphrase (if encrypted)"
                value={form.passphrase ?? ""}
                onChange={(v) => set("passphrase", v)}
                type="password"
                placeholder="Leave blank if none"
              />
            </>
          ) : (
            <CredInput
              label={`Password${isEdit ? " (leave blank to keep the saved one)" : ""}`}
              value={form.password ?? ""}
              onChange={(v) => set("password", v)}
              type="password"
              placeholder="••••••••"
            />
          )}
        </>
      )}

      {form.kind === "webdav" && (
        <>
          <CredInput
            label="WebDAV URL"
            value={form.host}
            onChange={(v) => set("host", v)}
            placeholder="https://cloud.example.com/remote.php/dav/files/me"
          />
          <CredInput
            label="Username"
            value={form.username}
            onChange={(v) => set("username", v)}
            placeholder="me"
          />
          <CredInput
            label={`Password${isEdit ? " (leave blank to keep the saved one)" : ""}`}
            value={form.password ?? ""}
            onChange={(v) => set("password", v)}
            type="password"
            placeholder="••••••••"
          />
        </>
      )}

      {form.kind === "s3" && (
        <>
          <CredInput
            label="Endpoint URL"
            value={form.host}
            onChange={(v) => set("host", v)}
            placeholder="https://s3.us-west-002.backblazeb2.com"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <CredInput
                label="Bucket"
                value={form.bucket ?? ""}
                onChange={(v) => set("bucket", v)}
                placeholder="courses"
              />
            </div>
            <div className="flex-1">
              <CredInput
                label="Region"
                value={form.region ?? ""}
                onChange={(v) => set("region", v)}
                placeholder="us-east-1"
              />
            </div>
          </div>
          <CredInput
            label="Access key ID"
            value={form.username}
            onChange={(v) => set("username", v)}
            placeholder="AKIA…"
          />
          <CredInput
            label={`Secret access key${isEdit ? " (leave blank to keep the saved one)" : ""}`}
            value={form.password ?? ""}
            onChange={(v) => set("password", v)}
            type="password"
            placeholder="••••••••"
          />
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.pathStyle ?? true}
              onChange={(e) => set("pathStyle", e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="font-sans text-xs text-muted-foreground">
              Path-style URLs — needed for MinIO and most self-hosted gateways. Turn off for AWS and
              Cloudflare R2.
            </span>
          </label>
        </>
      )}

      <CredInput
        label="Start folder"
        value={form.basePath ?? "/"}
        onChange={(v) => set("basePath", v)}
        placeholder={form.kind === "s3" ? "/" : "/srv/courses"}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button variant="outline" onClick={onTest} disabled={busy || testing}>
          {testing ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : (
            <PlugsConnected className="size-4" />
          )}
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy || testing}>
            {isEdit ? "Save changes" : "Add server"}
          </Button>
        </div>
      </div>
    </SettingPanel>
  );
}
