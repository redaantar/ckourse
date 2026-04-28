import { useLocation } from "react-router-dom";
import { routeTitles } from "./constants";
import { useCourseTitles } from "./CourseTitleContext";
import type { BreadcrumbItem } from "@/types";

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const { titles } = useCourseTitles();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get("from");

  // Course detail: Parent > <Course title>
  const courseMatch = pathname.match(/^\/course\/(\d+)$/);
  if (courseMatch) {
    // from may include search params (e.g. "/?q=react"), extract pathname for label
    const fromPathname = from ? from.split("?")[0] : "/";
    const parentLabel = routeTitles[fromPathname] || "Dashboard";
    const parentPath = from || "/";
    const courseId = Number(courseMatch[1]);
    const courseTitle = titles[courseId] ?? "Course Details";
    return [
      { label: parentLabel, path: parentPath },
      { label: courseTitle },
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
