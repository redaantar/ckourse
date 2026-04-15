import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ParsedCourse } from "@/types";

export async function selectCourseFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Course Folder",
  });

  return selected as string | null;
}

export async function parseCourseFolder(
  folderPath: string
): Promise<ParsedCourse> {
  return invoke<ParsedCourse>("parse_course_folder", { folderPath });
}
