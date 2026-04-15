export interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalLessons: number;
  completedLessons: number;
  totalWatchTimeMins: number;
  totalNotes: number;
  currentStreak: number;
  weekActivity: boolean[];
  userLevel: number;
  lessonsToNextLevel: number;
}

export interface CourseProgress {
  id: number;
  title: string;
  accentColor: string;
  category: string;
  totalLessons: number;
  completedLessons: number;
  totalDurationMins: number;
  completedDurationMins: number;
}

export interface ActivityDay {
  date: string;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  completed: number;
  totalLessons: number;
  completedLessons: number;
}

export interface ProgressData {
  stats: DashboardStats;
  courses: CourseProgress[];
  activityDays: ActivityDay[];
  categories: CategoryBreakdown[];
  longestStreak: number;
}

export interface LibraryStats {
  totalCourses: number;
  totalSections: number;
  totalLessons: number;
  totalNotes: number;
  totalBookmarks: number;
  totalFavorites: number;
  dbPath: string;
}
