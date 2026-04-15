import { useLocation } from "react-router-dom";
import { routeTitles } from "./constants";
import type { BreadcrumbItem } from "@/types";

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get("from");

  // Course detail: Parent > Course Details
  const courseMatch = pathname.match(/^\/course\/(\d+)$/);
  if (courseMatch) {
    // from may include search params (e.g. "/?q=react"), extract pathname for label
    const fromPathname = from ? from.split("?")[0] : "/";
    const parentLabel = routeTitles[fromPathname] || "Dashboard";
    const parentPath = from || "/";
    return [
      { label: parentLabel, path: parentPath },
      { label: "Course Details" },
    ];
  }

  // Import: Dashboard > Import Course
  if (pathname === "/import") {
    return [
      { label: "Dashboard", path: "/" },
      { label: "Import Course" },
    ];
  }

  // Top-level pages
  return [{ label: routeTitles[pathname] ?? "Ckourse" }];
}
