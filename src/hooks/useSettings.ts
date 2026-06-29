import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAllSettings, setSetting } from "@/lib/store";
import type { AppSettings } from "@/types";

const DEFAULTS: AppSettings = {
  autoplay_next: true,
  autoplay_delay_secs: 5,
  resume_position: true,
  default_speed: 1,
  default_volume: 100,
  skip_forward_secs: 10,
  skip_backward_secs: 10,
};

export const AUTOPLAY_DELAY_MAX = 15;

function clampDelay(raw: string | undefined): number {
  const n = Number(raw);
  if (raw === undefined || raw === "" || Number.isNaN(n)) return 5;
  return Math.min(Math.max(Math.round(n), 0), AUTOPLAY_DELAY_MAX);
}

function parse(raw: Record<string, string>): AppSettings {
  return {
    autoplay_next: raw.autoplay_next !== "false",
    // 0 is a valid delay (instant skip), so coerce explicitly rather than
    // falling back through `|| 5`, which would turn 0 into the default.
    autoplay_delay_secs: clampDelay(raw.autoplay_delay_secs),
    resume_position: raw.resume_position !== "false",
    default_speed: Number(raw.default_speed) || 1,
    default_volume: Number(raw.default_volume) || 100,
    skip_forward_secs: Number(raw.skip_forward_secs) || 10,
    skip_backward_secs: Number(raw.skip_backward_secs) || 10,
  };
}

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  update: (key: string, value: string) => void;
  reload: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  loaded: false,
  update: () => {},
  reload: async () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function useSettingsProvider() {
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const settings = parse(raw);

  const reload = useCallback(async () => {
    const s = await getAllSettings();
    setRaw(s);
  }, []);

  useEffect(() => {
    reload().then(() => setLoaded(true));
  }, [reload]);

  const update = useCallback((key: string, value: string) => {
    setRaw((prev) => ({ ...prev, [key]: value }));
    setSetting(key, value);
  }, []);

  return { settings, loaded, update, reload };
}
