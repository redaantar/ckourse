import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAllSettings, setSetting } from "@/lib/store";
import type { AppSettings } from "@/types";

const DEFAULTS: AppSettings = {
  autoplay_next: true,
  resume_position: true,
  default_speed: 1,
  default_volume: 100,
  skip_forward_secs: 10,
  skip_backward_secs: 10,
};

function parse(raw: Record<string, string>): AppSettings {
  return {
    autoplay_next: raw.autoplay_next !== "false",
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
