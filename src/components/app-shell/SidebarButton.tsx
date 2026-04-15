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
      className={cn(
        "group relative flex items-center py-2.5 font-sans text-sm",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        isActive
          ? "font-semibold text-primary"
          : "text-muted-foreground hover:text-sidebar-accent-foreground"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 squircle transition-[background] duration-200",
          isActive
            ? "bg-primary/10"
            : "bg-transparent group-hover:bg-sidebar-accent"
        )}
      />

      <div className="relative z-10 shrink-0">
        <Icon className="size-4" />
      </div>

      <span
        className="relative z-10 overflow-hidden whitespace-nowrap"
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : 160,
          transform: collapsed ? "translateX(-8px)" : "translateX(0)",
          transition: `opacity ${spring()} ${delay}, max-width ${spring()}, transform ${spring()} ${delay}`,
        }}
      >
        {item.label}
      </span>

      {collapsed && (
        <span className="squircle pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap bg-popover px-3 py-1.5 font-sans text-xs font-medium text-popover-foreground opacity-0 shadow-lg transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
          {item.label}
        </span>
      )}
    </a>
  );
}
