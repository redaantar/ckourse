import {
  SquaresFourIcon as SquaresFour,
  ChartBarIcon as ChartBar,
  BookmarkSimpleIcon as BookmarkSimple,
  NotepadIcon as Notepad,
  GearSixIcon as GearSix,
} from "@phosphor-icons/react";
import { EASE } from "@/lib/constants";
import type { NavItem } from "@/types";

export { EASE };
// The sidebar is an object being moved, so it moves like one: a real critically damped spring
export const DUR = "680ms";
export const spring = (extra = "") =>
  `${extra ? extra + " " : ""}${DUR} var(--spring-smooth)`.trim();

export const navigationItems: NavItem[] = [
  { icon: SquaresFour, label: "Home", path: "/" },
  { icon: BookmarkSimple, label: "Saved", path: "/bookmarks" },
  { icon: Notepad, label: "Notes", path: "/notes" },
  { icon: ChartBar, label: "Progress", path: "/progress" },
];

export const appItems: NavItem[] = [
  { icon: GearSix, label: "Settings", path: "/settings" },
];

export const routeTitles: Record<string, string> = {
  "/": "Home",
  "/bookmarks": "Saved",
  "/progress": "Progress",
  "/notes": "Notes",
  "/settings": "Settings",
  "/import": "Import Course",
};
