import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdaterState {
  status: UpdaterStatus;
  version?: string;
  currentVersion?: string;
  notes?: string;
  progress: number;
  error?: string;
}

export interface UpdaterApi extends UpdaterState {
  check: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  dismissed: boolean;
}

const initialState: UpdaterState = {
  status: "idle",
  progress: 0,
};

export function useUpdaterProvider(): UpdaterApi {
  const [state, setState] = useState<UpdaterState>(initialState);
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<Update | null>(null);
  const totalBytesRef = useRef(0);
  const downloadedBytesRef = useRef(0);

  const runCheck = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    try {
      setState((s) => ({ ...s, status: silent ? s.status : "checking", error: undefined }));
      const update = await check();
      if (!update) {
        updateRef.current = null;
        setState((s) => ({
          ...s,
          status: silent && s.status === "idle" ? "idle" : "up-to-date",
          version: undefined,
          notes: undefined,
        }));
        return;
      }
      updateRef.current = update;
      setDismissed(false);
      setState({
        status: "available",
        version: update.version,
        currentVersion: update.currentVersion,
        notes: update.body ?? undefined,
        progress: 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, status: silent ? s.status : "error", error: message }));
    }
  }, []);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    try {
      totalBytesRef.current = 0;
      downloadedBytesRef.current = 0;
      setState((s) => ({ ...s, status: "downloading", progress: 0, error: undefined }));
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytesRef.current = event.data.contentLength ?? 0;
          downloadedBytesRef.current = 0;
          setState((s) => ({ ...s, progress: 0 }));
        } else if (event.event === "Progress") {
          downloadedBytesRef.current += event.data.chunkLength;
          const total = totalBytesRef.current;
          const progress = total > 0 ? downloadedBytesRef.current / total : 0;
          setState((s) => ({ ...s, progress }));
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, status: "ready", progress: 1 }));
        }
      });
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, status: "error", error: message }));
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { ...state, check: runCheck, install, dismiss, dismissed };
}

export const UpdaterContext = createContext<UpdaterApi | null>(null);

export function useUpdater(): UpdaterApi {
  const ctx = useContext(UpdaterContext);
  if (!ctx) throw new Error("useUpdater must be used within UpdaterContext.Provider");
  return ctx;
}

export function useStartupUpdateCheck(api: UpdaterApi) {
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const timer = setTimeout(() => {
      api.check({ silent: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [api]);
}
