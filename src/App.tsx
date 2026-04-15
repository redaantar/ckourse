import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AppShell } from "@/components/app-shell/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { CourseDetail } from "@/pages/CourseDetail";
import { ImportCourse } from "@/pages/ImportCourse";
import { Bookmarks } from "@/pages/Bookmarks";
import { Progress } from "@/pages/Progress";
import { Notes } from "@/pages/Notes";
import { Settings } from "@/pages/Settings";
import { ActivePathContext } from "@/hooks/usePageVisible";
import { sectionMemory } from "@/hooks/useSectionMemory";
import { SettingsContext, useSettingsProvider } from "@/hooks/useSettings";
import {
  UpdaterContext,
  useUpdaterProvider,
  useStartupUpdateCheck,
} from "@/hooks/useUpdater";
import { UpdateBanner } from "@/components/UpdateBanner";

function routeKey(pathname: string, search: string): string {
  if (pathname.startsWith("/course/")) {
    const section = sectionRoot(pathname, search);
    return `${pathname}::${section}`;
  }
  return pathname;
}

function sectionRoot(pathname: string, search: string): string {
  if (pathname.startsWith("/course/")) {
    const params = new URLSearchParams(search);
    const from = params.get("from");
    return from ? from.split("?")[0] : "/";
  }
  return pathname;
}

const TRANSIENT_ROUTES = new Set(["/import"]);

/**
 * Keep-alive router: caches page instances so they preserve state when
 * navigating away. Course pages are keyed by origin section so the same
 * course opened from Dashboard vs Bookmarks gets separate cached instances.
 * Routes in TRANSIENT_ROUTES always mount fresh.
 */
function KeepAliveRoutes() {
  const location = useLocation();
  const key = routeKey(location.pathname, location.search);
  const isTransient = TRANSIENT_ROUTES.has(location.pathname);

  const [cache, setCache] = useState<Map<string, ReturnType<typeof useLocation>>>(
    () => isTransient ? new Map() : new Map([[key, { ...location }]]),
  );

  useEffect(() => {
    if (isTransient) return;
    const section = sectionRoot(location.pathname, location.search);
    sectionMemory.set(section, location.pathname + location.search);
  }, [location, isTransient]);

  useEffect(() => {
    if (isTransient) return;
    setCache((prev) => {
      const next = new Map(prev);
      next.set(key, { ...location });
      for (const cachedKey of next.keys()) {
        if (cachedKey !== key && cachedKey.startsWith("/course/")) {
          next.delete(cachedKey);
        }
      }
      return next;
    });
  }, [location, key, isTransient]);

  return (
    <ActivePathContext.Provider value={key}>
      {Array.from(cache.entries()).map(([cachedKey, cachedLocation]) => (
        <div
          key={cachedKey}
          style={{ display: cachedKey === key ? undefined : "none" }}
        >
          <Routes location={cachedLocation}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/course/:courseId" element={<CourseDetail />} />
          </Routes>
        </div>
      ))}

      {isTransient && (
        <Routes location={location}>
          <Route path="/import" element={<ImportCourse />} />
        </Routes>
      )}
    </ActivePathContext.Provider>
  );
}

function App() {
  const settingsCtx = useSettingsProvider();
  const updaterCtx = useUpdaterProvider();
  useStartupUpdateCheck(updaterCtx);

  return (
    <SettingsContext.Provider value={settingsCtx}>
      <UpdaterContext.Provider value={updaterCtx}>
        <AppShell>
          <KeepAliveRoutes />
        </AppShell>
        <UpdateBanner />
      </UpdaterContext.Provider>
    </SettingsContext.Provider>
  );
}

export default App;
