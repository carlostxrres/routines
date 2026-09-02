import type { AppSettings } from "@shared/types";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { setTimeZone } from "@/lib/temporal";

interface SettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<AppSettings>("/settings");
      // temporal.ts is not React code and can't read context, so the display
      // zone is pushed into its module-level store here.
      setTimeZone(data.timeZone);
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refetch: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

// Defaults keep the UI usable while settings are still loading, or if the
// request failed.
export function useChartHue(): number {
  return useSettings().settings?.chartHue ?? 30;
}

export function useWeekStartDay(): number {
  return useSettings().settings?.weekStartDay ?? 1;
}
