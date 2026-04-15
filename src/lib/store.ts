import { invoke } from "@tauri-apps/api/core";
import type {
  Course,
  CourseDetail,
  Note,
  NoteWithCourse,
  FavoriteLesson,
  Subtitle,
  SaveCourseConfig,
  ParsedCourse,
  DashboardStats,
  ProgressData,
  LibraryStats,
  SearchResult,
} from "@/types";

export async function getCourses(): Promise<Course[]> {
  return invoke<Course[]>("get_courses");
}

export async function getCourse(courseId: number): Promise<Course | null> {
  return invoke<Course | null>("get_course", { courseId });
}

export async function getCourseDetail(
  courseId: number,
): Promise<CourseDetail | null> {
  return invoke<CourseDetail | null>("get_course_detail", { courseId });
}

export async function importCourse(
  parsed: ParsedCourse,
  config: SaveCourseConfig,
): Promise<number> {
  return invoke<number>("import_course", { parsed, config });
}

export async function updateCourse(
  courseId: number,
  title: string,
  author: string,
  accentColor: string,
  category: string,
): Promise<void> {
  return invoke("update_course", { courseId, title, author, accentColor, category });
}

export async function resetCourseProgress(courseId: number): Promise<void> {
  return invoke("reset_course_progress", { courseId });
}

export async function deleteCourse(courseId: number): Promise<void> {
  return invoke("delete_course", { courseId });
}

export async function toggleLessonCompleted(
  lessonId: number,
): Promise<boolean> {
  return invoke<boolean>("toggle_lesson_completed", { lessonId });
}

export async function updateLessonDuration(
  lessonId: number,
  duration: number,
): Promise<void> {
  return invoke("update_lesson_duration", { lessonId, duration });
}

export async function saveLessonPosition(
  lessonId: number,
  position: number,
): Promise<void> {
  return invoke("save_lesson_position", { lessonId, position });
}

export async function setLastWatched(
  courseId: number,
  lessonId: number,
): Promise<void> {
  return invoke("set_last_watched", { courseId, lessonId });
}

export async function getAllNotes(): Promise<NoteWithCourse[]> {
  return invoke<NoteWithCourse[]>("get_all_notes");
}

export async function getCourseNotes(courseId: number): Promise<Note[]> {
  return invoke<Note[]>("get_course_notes", { courseId });
}

export async function addNote(
  courseId: number,
  lessonId: number,
  lessonTitle: string,
  content: string,
): Promise<Note> {
  return invoke<Note>("add_note", { courseId, lessonId, lessonTitle, content });
}

export async function updateNote(
  noteId: number,
  content: string,
): Promise<void> {
  return invoke("update_note", { noteId, content });
}

export async function deleteNote(noteId: number): Promise<void> {
  return invoke("delete_note", { noteId });
}

export async function toggleBookmark(courseId: number): Promise<boolean> {
  return invoke<boolean>("toggle_bookmark", { courseId });
}

export async function toggleFavorite(lessonId: number): Promise<boolean> {
  return invoke<boolean>("toggle_favorite", { lessonId });
}

export async function getAllFavorites(): Promise<FavoriteLesson[]> {
  return invoke<FavoriteLesson[]>("get_all_favorites");
}

export async function getBookmarkedCourses(): Promise<Course[]> {
  return invoke<Course[]>("get_bookmarked_courses");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return invoke<DashboardStats>("get_dashboard_stats");
}

export async function getProgressData(): Promise<ProgressData> {
  return invoke<ProgressData>("get_progress_data");
}

export async function getLessonSubtitles(
  lessonId: number,
): Promise<Subtitle[]> {
  return invoke<Subtitle[]>("get_lesson_subtitles", { lessonId });
}

export async function getSubtitleVtt(path: string): Promise<string> {
  return invoke<string>("get_subtitle_vtt", { path });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const pairs = await invoke<[string, string][]>("get_all_settings");
  return Object.fromEntries(pairs);
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function getLibraryStats(): Promise<LibraryStats> {
  return invoke<LibraryStats>("get_library_stats");
}

export async function deleteAllData(): Promise<void> {
  return invoke("delete_all_data");
}

export async function getCustomCategories(): Promise<string[]> {
  return invoke<string[]>("get_custom_categories");
}

export async function addCustomCategory(name: string): Promise<void> {
  return invoke("add_custom_category", { name });
}

export async function deleteCustomCategory(name: string): Promise<void> {
  return invoke("delete_custom_category", { name });
}

export async function searchContent(query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_content", { query });
}
