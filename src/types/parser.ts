export type Confidence = "high" | "medium" | "low";

export type ResourceType =
  | "pdf"
  | "document"
  | "text"
  | "archive"
  | "image"
  | "code"
  | "link"
  | "other";

export interface ParsedSubtitle {
  path: string;
  language: string | null;
  isPositionalMatch: boolean;
}

export interface ParsedResource {
  title: string;
  path: string;
  type: ResourceType;
}

export interface ParsedLesson {
  title: string;
  order: number;
  videoPath: string;
  durationSecs: number;
  subtitles: ParsedSubtitle[];
  resources: ParsedResource[];
}

export interface ParsedSection {
  title: string;
  order: number;
  lessons: ParsedLesson[];
}

export interface ParsedCourse {
  title: string;
  description: string | null;
  thumbnailPath: string | null;
  sections: ParsedSection[];
  resources: ParsedResource[];
  confidence: Confidence;
  confidenceReasons: string[];
  totalVideoCount: number;
  folderPath: string;
}
