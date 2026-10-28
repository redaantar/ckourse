import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import { spring } from "./constants";
import { sectionMemory } from "@/hooks/useSectionMemory";

export function SidebarButton({
  item,
  collapsed,
  index,
}: {
  item: NavItem;
  collapsed: boolean;
  index: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get("from");
  const fromPathname = from ? from.split("?")[0] : null;
  const isCourseRoute = location.pathname.startsWith("/course/");

  const isActive =
    item.path === "/"
      ? location.pathname === "/" || (isCourseRoute && (!fromPathname || fromPathname === "/"))
      : fromPathname === item.path
        ? isCourseRoute
        : location.pathname.startsWith(item.path);
  const Icon = item.icon;
  const delay = `${index * 25}ms`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isActive) return;
    // Navigate to the last remembered path in this section
    const target = sectionMemory.get(item.path);
    navigate(target);
  };

  return (
    <a
      href={item.path}
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-8 items-center rounded-lg font-sans text-[13px] transition-colors duration-150",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
        // Inside a course, the Recent row carries the highlight; the section just stays legible
        isActive && isCourseRoute
          ? "font-medium text-sidebar-foreground hover:bg-sidebar-accent/60"
          : isActive
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" weight={isActive ? "fill" : "regular"} />

      <span
        className="overflow-hidden whitespace-nowrap"
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 160,
          transform: collapsed ? "translateX(-8px)" : "translateX(0)",
          transition: `opacity ${spring()} ${delay}, max-width ${spring()}, transform ${spring()} ${delay}`,
        }}
      >
        {item.label}
      </span>

      {collapsed && <SidebarTooltip label={item.label} />}
    </a>
  );
}

/** Hover label for the collapsed rail */
export function SidebarTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 font-sans text-xs font-medium text-popover-foreground opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}
