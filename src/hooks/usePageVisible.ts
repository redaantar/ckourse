import { createContext, useContext, useEffect, useRef } from "react";

/**
 * Context that carries the current active pathname.
 * Set by KeepAliveRoutes, consumed by pages to know when they become visible.
 */
export const ActivePathContext = createContext<string>("/");

/**
 * Calls `onVisible` whenever the active path matches `path`.
 * Skips the very first activation (pages load their own data on mount).
 */
export function usePageVisible(path: string, onVisible: () => void) {
  const activePath = useContext(ActivePathContext);
  const isActive = activePath === path;
  const mountedRef = useRef(false);
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  useEffect(() => {
    if (!isActive) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return; // skip initial activation
    }
    callbackRef.current();
  }, [isActive]);
}
