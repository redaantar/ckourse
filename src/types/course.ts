export type CourseStatus = "in-progress" | "completed" | "not-started";
export type CourseCategory = "frontend" | "backend" | "devops" | "database" | "design" | "other";

export interface Course {
  id: number;
  title: string;
  author: string;
  completedLessons: number;
  totalLessons: number;
  status: "in-progress" | "completed" | "not-started";
  accentColor: string;
  lastWatched: string | null;
  category: string;
  folderPath: string;
  description: string | null;
  thumbnailPath: string | null;
  bookmarked: boolean;
}

export interface CourseDetail {
  courseId: number;
  totalDuration: number;
  resources: Resource[];
  sections: Section[];
}

export interface Section {
  id: number;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: number;
  title: string;
  duration: number;
  completed: boolean;
  isLastWatched: boolean;
  videoPath: string;
  lastPosition: number;
  favorited: boolean;
}

export interface Resource {
  id: number;
  title: string;
  type: string;
  path: string;
}

export interface Note {
  id: number;
  courseId: number;
  lessonId: number;
  lessonTitle: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subtitle {
  id: number;
  lessonId: number;
  path: string;
  language: string | null;
}

export interface SaveCourseConfig {
  title: string;
  author: string;
  accentColor: string;
  category: string;
}

export interface NoteWithCourse {
  id: number;
  courseId: number;
  lessonId: number;
  lessonTitle: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  courseTitle: string;
  accentColor: string;
}

export interface SearchResult {
  kind: "course" | "lesson";
  courseId: number;
  courseTitle: string;
  accentColor: string;
  lessonId: number | null;
  lessonTitle: string | null;
}

export interface FavoriteLesson {
  id: number;
  lessonId: number;
  lessonTitle: string;
  duration: number;
  completed: boolean;
  lastPosition: number;
  courseId: number;
  courseTitle: string;
  accentColor: string;
  createdAt: string;
}
