import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  SquareHalfIcon as SquareHalf,
  CornersOutIcon as CornersOut,
  CornersInIcon as CornersIn,
  CaretRightIcon as CaretRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { AnimatedThemeToggler } from "@/components/ui/animatedThemeToggle";
import logoDark from "@/assets/icons/logo-dark.svg";
import logoLight from "@/assets/icons/logo-light.svg";
import { spring, navigationItems, appItems } from "./constants";
import { SquircleClipDefs } from "./SquircleClipDefs";
import { useBreadcrumbs } from "./useBreadcrumbs";
import { NavSection } from "./NavSection";
import { SidebarSearch } from "./SidebarSearch";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { theme } = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const logo = theme === "light" ? logoLight : logoDark;
  const [collapsed, setCollapsed] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsSmallScreen(e.matches);
      if (e.matches) setCollapsed(true);
    };
    onChange(mq);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const effectiveCollapsed = isSmallScreen || collapsed;

  return (
    <div className="flex h-screen flex-col bg-linear-to-b from-background to-sidebar text-foreground">
      <SquircleClipDefs />

      {/* Drag strip — provides window dragging and clears the traffic lights zone */}
      <div data-tauri-drag-region className="h-7 w-full shrink-0" />

      <header className="flex h-15 shrink-0 items-center">
        <div
          className="flex shrink-0 items-center px-3"
          style={{
            width: effectiveCollapsed ? 68 : 240,
            transition: `width ${spring()}`,
          }}
        >
          {isSmallScreen ? (
            <div className="flex w-full items-center justify-center">
              <img src={logo} alt="Ckourse logo" className="h-7" />
            </div>
          ) : (
            <div className={cn(
              "flex w-full items-center",
              effectiveCollapsed ? "justify-center" : ""
            )}>
              <div
                className="flex items-center gap-2.5 overflow-hidden"
                style={{
                  opacity: effectiveCollapsed ? 0 : 1,
                  width: effectiveCollapsed ? 0 : 160,
                  transition: `opacity ${spring()}, width ${spring()}`,
                }}
              >
                <img src={logo} alt="Ckourse logo" className="h-7 shrink-0" />
                <span className="shrink-0 font-heading text-lg font-bold tracking-wider text-sidebar-foreground">
                  <span className="text-sidebar-primary">CK</span>OURSE
                </span>
              </div>
              {effectiveCollapsed ? (
                <button
                  onClick={() => setCollapsed(false)}
                  className="group relative flex size-10 shrink-0 items-center justify-center"
                >
                  <img
                    src={logo}
                    alt="Ckourse logo"
                    className="h-7 transition-opacity duration-200 group-hover:opacity-0"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="squircle flex size-10 items-center justify-center bg-sidebar-accent text-sidebar-foreground">
                      <SquareHalf className="size-4 -scale-x-100" />
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setCollapsed(true)}
                  className="squircle ml-auto flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <SquareHalf className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div data-tauri-drag-region className="flex flex-1 items-center px-6 gap-4">
          <nav className="flex items-center gap-1.5">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <CaretRight className="size-3.5 text-muted-foreground/50" />
                  )}
                  {crumb.path && !isLast ? (
                    <Link
                      to={crumb.path}
                      className="font-heading text-lg font-bold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <h1 className="font-heading text-lg font-bold text-foreground">
                      {crumb.label}
                    </h1>
                  )}
                </div>
              );
            })}
          </nav>

          <div data-tauri-drag-region className="flex-1 self-stretch" />

          <div className="flex items-center gap-2">
            <AnimatedThemeToggler className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&_svg]:size-4" />

            <button
              onClick={toggleFullscreen}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {isFullscreen ? <CornersIn className="size-4" /> : <CornersOut className="size-4" />}
            </button>

            {/* <div className="mx-1 h-6 w-px bg-border" /> */}

            {/* Profile icon and name — hardcoded, hidden until auth is implemented */}
            {/* <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                R
              </div>
              <span className="font-sans text-sm font-medium text-foreground">
                Reda
              </span>
            </button> */}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="flex shrink-0 flex-col will-change-[width]"
          style={{
            width: effectiveCollapsed ? 68 : 240,
            transition: `width ${spring()}`,
          }}
        >
          <div className="px-3 pb-1">
            <SidebarSearch collapsed={effectiveCollapsed} />
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 pt-4">
            <NavSection label="Navigation" collapsed={effectiveCollapsed} items={navigationItems} />
            <div className="mx-3 my-3 border-t border-sidebar-border/50" />
            <NavSection label="App" collapsed={effectiveCollapsed} items={appItems} />
          </nav>

          <div className="mx-3 mb-4 mt-auto h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        </aside>

        <main
          className="flex-1 overflow-y-auto rounded-tl-2xl bg-background px-6 py-8 [scrollbar-gutter:stable]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 10% 0%, var(--gradient-spot) 0%, transparent 70%)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
