import { useState, useEffect, type ReactNode, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  SidebarSimpleIcon as SidebarSimple,
  GearSixIcon as GearSix,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import logoDark from "@/assets/icons/logo-dark.svg";
import logoLight from "@/assets/icons/logo-light.svg";
import { spring, navigationItems } from "./constants";
import { SidebarButton } from "./SidebarButton";
import { SidebarSearch } from "./SidebarSearch";
import { LevelBadge, RecentCourses, useSidebarData } from "./SidebarExtras";

interface AppShellProps {
  children: ReactNode;
}

const settingsItem = { icon: GearSix, label: "Settings", path: "/settings" };

// The window's toolbar band, sized so its centre line runs through the traffic lights
// (pinned by trafficLightPosition in tauri.conf.json, x 18 y 24, which lands them ~22pt down).
// Our controls centre on the same line; change the two together.
const TOOLBAR_H = 44;

// The panel has no toolbar, so its top strip moves the window. Only presses on empty
// space count: anything interactive scrolled under the strip still gets its click.
const DRAG_STRIP_H = 28;
const INTERACTIVE =
  "a, button, input, select, textarea, label, summary, video, [contenteditable], [draggable='true'], [role='button'], [role='link'], [role='tab'], [role='switch'], [role='checkbox'], [role='radio'], [role='slider'], [role='menuitem'], [role='option']";

function dragFromPanelTop(e: MouseEvent<HTMLDivElement>) {
  if (e.button !== 0 || e.clientY - e.currentTarget.getBoundingClientRect().top > DRAG_STRIP_H) return;
  const target = e.target as HTMLElement;
  if (target.closest(INTERACTIVE)) return;
  // A press on a scrollbar lands on the scroller itself, outside its client area
  if (e.nativeEvent.offsetX >= target.clientWidth && target.scrollHeight > target.clientHeight) return;
  e.preventDefault();
  const win = getCurrentWindow();
  void (e.detail === 2 ? win.toggleMaximize() : win.startDragging());
}

const toolbarButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-35";

/**
 * Two surfaces: the window canvas (sidebar) and one inset content panel. The panel
 * floats a few points off the window edge with a rounded corner, so content reads
 * as a sheet you're working on rather than a region of a grid.
 */
export function AppShell({ children }: AppShellProps) {
  const { theme } = useTheme();
  const logo = theme === "light" ? logoLight : logoDark;
  const [collapsed, setCollapsed] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const { recent, stats } = useSidebarData();

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

  // ⌘\ toggles the sidebar, as in Finder-style Mac apps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const effectiveCollapsed = isSmallScreen || collapsed;
  // Collapsed, the rail is exactly the traffic lights plus an equal 18pt margin either side
  // (they run 18–78pt), so they sit centred on the canvas instead of crowding the panel
  const sidebarWidth = effectiveCollapsed ? 96 : 236;
  // Collapsed, the gutter grows so every row narrows to a 32pt square instead of a wide pill
  const gutter = { paddingInline: effectiveCollapsed ? 32 : 12, transition: `padding ${spring()}` };

  return (
    <div className="flex h-screen bg-sidebar text-foreground">
      <aside
        className="flex shrink-0 flex-col will-change-[width]"
        style={{ width: sidebarWidth, transition: `width ${spring()}` }}
      >
        {/* Toolbar band: the traffic lights hold the left end, our controls the right, on one
            centre line. Collapsed, the band is the lights alone; the logo becomes the toggle. */}
        <div
          data-tauri-drag-region
          className="flex shrink-0 items-center justify-end gap-0.5 px-3"
          style={{ height: TOOLBAR_H }}
        >
          {!effectiveCollapsed && !isSmallScreen && (
            <button onClick={() => setCollapsed(true)} aria-label="Hide sidebar" title="Hide sidebar (⌘\)" className={toolbarButton}>
              <SidebarSimple className="size-[18px]" />
            </button>
          )}
        </div>

        <div className={cn("flex items-center gap-2 px-4 pt-2 pb-5", effectiveCollapsed && "justify-center gap-0 px-0 pt-2")}>
          {effectiveCollapsed && !isSmallScreen ? (
            // Collapsed, the logo doubles as the expand control: hovering swaps it for the sidebar icon
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Show sidebar"
              title="Show sidebar (⌘\)"
              className="group grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <img
                src={logo}
                alt=""
                className="col-start-1 row-start-1 h-[22px] transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0"
              />
              <SidebarSimple className="col-start-1 row-start-1 size-[18px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          ) : (
            <img src={logo} alt="" className="h-[22px] shrink-0" />
          )}
          <span
            className="overflow-hidden whitespace-nowrap font-heading text-[17px] font-semibold text-sidebar-foreground"
            style={{
              opacity: effectiveCollapsed ? 0 : 1,
              maxWidth: effectiveCollapsed ? 0 : 120,
              transition: `opacity ${spring()}, max-width ${spring()}`,
            }}
          >
            ckourse
          </span>
        </div>

        <div style={gutter}>
          <SidebarSearch collapsed={effectiveCollapsed} />
        </div>

        <nav
          aria-label="Main"
          className={cn(
            "flex flex-1 flex-col gap-6 pt-5",
            // Scrolling would clip the rail's hover labels, and the collapsed list is short anyway
            effectiveCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden",
          )}
          style={gutter}
        >
          <ul className="flex flex-col gap-1">
            {navigationItems.map((item, i) => (
              <li key={item.path}>
                <SidebarButton item={item} collapsed={effectiveCollapsed} index={i} />
              </li>
            ))}
          </ul>
          <RecentCourses courses={recent} collapsed={effectiveCollapsed} />
        </nav>

        <div className="flex shrink-0 flex-col gap-1.5 pt-2 pb-3" style={gutter}>
          <SidebarButton item={settingsItem} collapsed={effectiveCollapsed} index={0} />
          <div className="mx-1 my-1.5 h-px bg-sidebar-border" />
          <LevelBadge stats={stats} collapsed={effectiveCollapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col py-2 pr-2">
        <div
          onMouseDown={dragFromPanelTop}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-background shadow-[0_0_0_1px_var(--sidebar-border)]"
        >
          <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
        </div>
      </div>
    </div>
  );
}
