import type { NavItem } from "@/types";
import { spring } from "./constants";
import { SidebarButton } from "./SidebarButton";

export function NavSection({
  label,
  collapsed,
  items,
}: {
  label: string;
  collapsed: boolean;
  items: NavItem[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="overflow-hidden whitespace-nowrap px-3 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        style={{
          opacity: collapsed ? 0 : 1,
          maxHeight: collapsed ? 0 : 20,
          marginBottom: collapsed ? 0 : 6,
          transition: `opacity ${spring()}, max-height ${spring()}, margin ${spring()}`,
        }}
      >
        {label}
      </span>
      {items.map((item, i) => (
        <SidebarButton key={item.label} item={item} collapsed={collapsed} index={i} />
      ))}
    </div>
  );
}
