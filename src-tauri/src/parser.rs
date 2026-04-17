use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// --- Constants ---

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "m4v", "ts", "mpeg", "mpg", "vob",
];

const SUBTITLE_EXTENSIONS: &[&str] = &["srt", "vtt", "ass", "ssa", "sub"];

const DOCUMENT_EXTENSIONS: &[&str] = &["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"];
const TEXT_EXTENSIONS: &[&str] = &["txt", "md"];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "rar"];
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "webp"];
const THUMBNAIL_NAMES: &[&str] = &["thumbnail", "cover", "poster", "artwork"];
const DESCRIPTION_NAMES: &[&str] = &["readme.md", "description.txt", "about.txt"];
const CODE_FOLDER_NAMES: &[&str] = &[
    "code", "starter", "solution", "exercise", "exercises", "src", "source",
];

const ACRONYMS: &[&str] = &[
    "HTML", "CSS", "API", "REST", "SQL", "JSON", "XML", "HTTP", "HTTPS", "URL", "URI", "DOM",
    "JWT", "OAuth", "CORS", "CRUD", "ORM", "MVP", "MVC", "CLI", "SDK", "CDN", "AWS", "GCP",
    "SSH", "SSL", "TLS", "DNS", "TCP", "UDP", "IP", "GPU", "CPU", "RAM", "SSD", "HDD", "USB",
    "YAML", "TOML", "CSV", "PDF", "PNG", "JPG", "SVG", "GIF", "MP4", "WebRTC", "GraphQL",
    "NoSQL", "DevOps", "CI", "CD", "IDE", "VS", "npm", "NPM", "TS", "JS", "JSX", "TSX",
];

// --- Output types ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCourse {
    pub title: String,
    pub description: Option<String>,
    pub thumbnail_path: Option<String>,
    pub sections: Vec<ParsedSection>,
    pub resources: Vec<ParsedResource>,
    pub confidence: Confidence,
    pub confidence_reasons: Vec<String>,
    pub total_video_count: usize,
    pub folder_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSection {
    pub title: String,
    pub order: usize,
    pub lessons: Vec<ParsedLesson>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLesson {
    pub title: String,
    pub order: usize,
    pub video_path: String,
    pub duration_secs: u64,
    pub subtitles: Vec<ParsedSubtitle>,
    pub resources: Vec<ParsedResource>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSubtitle {
    pub path: String,
    pub language: Option<String>,
    pub is_positional_match: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedResource {
    pub title: String,
    pub path: String,
    #[serde(rename = "type")]
    pub resource_type: ResourceType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ResourceType {
    Pdf,
    Document,
    Text,
    Archive,
    Image,
    Code,
    Link,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Confidence {
    High,
    Medium,
    Low,
}

// --- Internal types ---

struct FileEntry {
    path: PathBuf,
    name: String,
    extension: String,
}

struct FolderEntry {
    path: PathBuf,
    name: String,
    sort_key: SortKey,
}

#[derive(Clone)]
enum SortKey {
    Numeric(u32),
    Alphabetic(String),
}

impl PartialEq for SortKey {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (SortKey::Numeric(a), SortKey::Numeric(b)) => a == b,
            (SortKey::Alphabetic(a), SortKey::Alphabetic(b)) => a == b,
            _ => false,
        }
    }
}

impl Eq for SortKey {}

impl PartialOrd for SortKey {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SortKey {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (SortKey::Numeric(a), SortKey::Numeric(b)) => a.cmp(b),
            (SortKey::Alphabetic(a), SortKey::Alphabetic(b)) => a.cmp(b),
            (SortKey::Numeric(_), SortKey::Alphabetic(_)) => std::cmp::Ordering::Less,
            (SortKey::Alphabetic(_), SortKey::Numeric(_)) => std::cmp::Ordering::Greater,
        }
    }
}

// --- Main parse function ---

pub fn parse_folder(folder_path: &Path) -> Result<ParsedCourse, String> {
    if !folder_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let folder_name = folder_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Course")
        .to_string();

    let title = clean_display_name(&folder_name);

    // Read root directory entries
    let (root_files, root_folders) = read_directory(folder_path)?;

    // Detect description
    let description = detect_description(&root_files);

    // Detect thumbnail
    let thumbnail_path = detect_thumbnail(&root_files);

    // Classify root files
    let root_videos: Vec<&FileEntry> = root_files.iter().filter(|f| is_video(&f.extension)).collect();
    let root_subtitles: Vec<&FileEntry> = root_files.iter().filter(|f| is_subtitle(&f.extension)).collect();
    let root_other: Vec<&FileEntry> = root_files
        .iter()
        .filter(|f| {
            !is_video(&f.extension)
                && !is_subtitle(&f.extension)
                && !is_hidden(&f.name)
                && !is_thumbnail_file(&f.name)
                && !is_description_file(&f.name)
                && !is_metadata_file(&f.extension)
        })
        .collect();

    let mut confidence_reasons: Vec<String> = Vec::new();
    let mut sections: Vec<ParsedSection>;
    let mut course_resources: Vec<ParsedResource> = Vec::new();
    let mut used_positional_subtitle = false;

    // Determine pattern
    let has_root_videos = !root_videos.is_empty();
    let has_subfolders = !root_folders.is_empty();
    let subfolders_have_videos = root_folders.iter().any(|f| folder_has_videos(&f.path));

    if !has_root_videos && !subfolders_have_videos {
        return Err("No video files found in this folder".to_string());
    }

    if has_root_videos && !has_subfolders {
        // Pattern 1: Flat
        let (lessons, positional) = build_lessons_from_files(&root_videos, &root_subtitles, &root_other, folder_path);
        used_positional_subtitle = positional;
        sections = vec![ParsedSection {
            title: title.clone(),
            order: 0,
            lessons,
        }];
    } else if !has_root_videos && has_subfolders && subfolders_have_videos {
        // Pattern 2 or 3: Section folders
        sections = Vec::new();
        let mut sorted_folders = root_folders;
        sorted_folders.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));

        for (i, folder) in sorted_folders.iter().enumerate() {
            let (sub_files, sub_folders) = match read_directory(&folder.path) {
                Ok(r) => r,
                Err(_) => continue,
            };

            let sub_videos: Vec<&FileEntry> = sub_files.iter().filter(|f| is_video(&f.extension)).collect();
            let sub_subtitles: Vec<&FileEntry> = sub_files.iter().filter(|f| is_subtitle(&f.extension)).collect();
            let sub_other: Vec<&FileEntry> = sub_files
                .iter()
                .filter(|f| !is_video(&f.extension) && !is_subtitle(&f.extension) && !is_hidden(&f.name) && !is_metadata_file(&f.extension))
                .collect();

            if sub_videos.is_empty() && !sub_folders.is_empty() {
                // Pattern 3: Two levels — subsections contain videos
                let mut sub_sorted = sub_folders;
                sub_sorted.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));

                for (j, sub_folder) in sub_sorted.iter().enumerate() {
                    let (ss_files, _) = match read_directory(&sub_folder.path) {
                        Ok(r) => r,
                        Err(_) => continue,
                    };
                    let ss_videos: Vec<&FileEntry> = ss_files.iter().filter(|f| is_video(&f.extension)).collect();
                    let ss_subtitles: Vec<&FileEntry> = ss_files.iter().filter(|f| is_subtitle(&f.extension)).collect();
                    let ss_other: Vec<&FileEntry> = ss_files
                        .iter()
                        .filter(|f| !is_video(&f.extension) && !is_subtitle(&f.extension) && !is_hidden(&f.name) && !is_metadata_file(&f.extension))
                        .collect();

                    if ss_videos.is_empty() {
                        continue;
                    }

                    let (lessons, positional) = build_lessons_from_files(&ss_videos, &ss_subtitles, &ss_other, &sub_folder.path);
                    if positional {
                        used_positional_subtitle = true;
                    }

                    let section_title = format!("{} — {}", clean_display_name(&folder.name), clean_display_name(&sub_folder.name));
                    sections.push(ParsedSection {
                        title: section_title,
                        order: i * 100 + j,
                        lessons,
                    });
                }
            } else if !sub_videos.is_empty() {
                // Pattern 2: Direct section with videos
                let (lessons, positional) = build_lessons_from_files(&sub_videos, &sub_subtitles, &sub_other, &folder.path);
                if positional {
                    used_positional_subtitle = true;
                }

                // Collect resources from code/resource subfolders
                for sub_folder in &sub_folders {
                    if is_code_folder(&sub_folder.name) {
                        if let Ok((code_files, _)) = read_directory(&sub_folder.path) {
                            for file in &code_files {
                                if !is_hidden(&file.name) {
                                    course_resources.push(ParsedResource {
                                        title: file.name.clone(),
                                        path: file.path.to_string_lossy().to_string(),
                                        resource_type: ResourceType::Code,
                                    });
                                }
                            }
                        }
                    }
                }

                sections.push(ParsedSection {
                    title: clean_display_name(&folder.name),
                    order: i,
                    lessons,
                });
            }
        }
    } else if has_root_videos && has_subfolders {
        // Pattern 4: Mixed flat and nested
        sections = Vec::new();

        // Root videos become a virtual section
        let (root_lessons, positional) = build_lessons_from_files(&root_videos, &root_subtitles, &root_other, folder_path);
        if positional {
            used_positional_subtitle = true;
        }
        sections.push(ParsedSection {
            title: "Introduction".to_string(),
            order: 0,
            lessons: root_lessons,
        });

        // Subfolders become sections
        let mut sorted_folders = root_folders;
        sorted_folders.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));

        for (i, folder) in sorted_folders.iter().enumerate() {
            let (sub_files, _) = match read_directory(&folder.path) {
                Ok(r) => r,
                Err(_) => continue,
            };

            let sub_videos: Vec<&FileEntry> = sub_files.iter().filter(|f| is_video(&f.extension)).collect();
            let sub_subtitles: Vec<&FileEntry> = sub_files.iter().filter(|f| is_subtitle(&f.extension)).collect();
            let sub_other: Vec<&FileEntry> = sub_files
                .iter()
                .filter(|f| !is_video(&f.extension) && !is_subtitle(&f.extension) && !is_hidden(&f.name) && !is_metadata_file(&f.extension))
                .collect();

            if sub_videos.is_empty() {
                continue;
            }

            let (lessons, positional) = build_lessons_from_files(&sub_videos, &sub_subtitles, &sub_other, &folder.path);
            if positional {
                used_positional_subtitle = true;
            }

            sections.push(ParsedSection {
                title: clean_display_name(&folder.name),
                order: i + 1,
                lessons,
            });
        }

        confidence_reasons.push("Mixed flat and nested structure detected".to_string());
    } else {
        return Err("No recognizable course structure found".to_string());
    }

    // Collect course-level resources from root
    for file in &root_other {
        let rt = classify_resource(&file.extension, &file.name);
        course_resources.push(ParsedResource {
            title: clean_display_name(
                &file
                    .name
                    .rsplit_once('.')
                    .map(|(n, _)| n.to_string())
                    .unwrap_or(file.name.clone()),
            ),
            path: file.path.to_string_lossy().to_string(),
            resource_type: rt,
        });
    }

    // Count total videos
    let total_video_count: usize = sections.iter().map(|s| s.lessons.len()).sum();

    // Compute confidence
    let total_files_in_root = root_files.len();
    let unrecognized_count = root_files
        .iter()
        .filter(|f| {
            !is_video(&f.extension)
                && !is_subtitle(&f.extension)
                && !is_thumbnail_file(&f.name)
                && !is_description_file(&f.name)
                && !is_metadata_file(&f.extension)
                && classify_resource_known(&f.extension, &f.name)
        })
        .count();

    let has_numbers = sections.iter().any(|s| {
        s.lessons
            .iter()
            .any(|l| extract_leading_number(&l.title).is_some() || extract_embedded_number(&l.title).is_some())
    });

    if !has_numbers {
        confidence_reasons.push("No numbered files — using alphabetical order".to_string());
    }
    if used_positional_subtitle {
        confidence_reasons.push("Some subtitles matched by position (uncertain)".to_string());
    }
    if total_video_count <= 2 {
        confidence_reasons.push("Very few video files found".to_string());
    }
    if total_files_in_root > 0 {
        let unrecognized_ratio = unrecognized_count as f64 / total_files_in_root as f64;
        if unrecognized_ratio > 0.3 {
            confidence_reasons.push("More than 30% of files unrecognized".to_string());
        }
    }

    let confidence = if confidence_reasons.is_empty() {
        Confidence::High
    } else if confidence_reasons.len() <= 1 && !used_positional_subtitle {
        Confidence::Medium
    } else {
        Confidence::Low
    };

    Ok(ParsedCourse {
        title,
        description,
        thumbnail_path,
        sections,
        resources: course_resources,
        confidence,
        confidence_reasons,
        total_video_count,
        folder_path: folder_path.to_string_lossy().to_string(),
    })
}

// --- Directory reading ---

fn read_directory(path: &Path) -> Result<(Vec<FileEntry>, Vec<FolderEntry>), String> {
    let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();
    let mut folders = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        // Skip hidden files
        if is_hidden(&name) {
            continue;
        }

        if entry_path.is_dir() {
            // Skip empty folders
            if dir_is_empty(&entry_path) {
                continue;
            }

            let sort_key = extract_sort_key(&name);
            folders.push(FolderEntry {
                path: entry_path,
                name,
                sort_key,
            });
        } else if entry_path.is_file() || entry_path.is_symlink() {
            let extension = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            files.push(FileEntry {
                path: entry_path,
                name,
                extension,
            });
        }
    }

    Ok((files, folders))
}

// --- Lesson building ---

fn build_lessons_from_files(
    videos: &[&FileEntry],
    subtitles: &[&FileEntry],
    other_files: &[&FileEntry],
    _folder_path: &Path,
) -> (Vec<ParsedLesson>, bool) {
    let mut sorted_videos: Vec<&&FileEntry> = videos.iter().collect();

    // Determine if we have numbers (leading or embedded like "Lecture 3")
    let has_leading = sorted_videos
        .iter()
        .any(|v| extract_leading_number(&v.name).is_some());
    let has_embedded = sorted_videos
        .iter()
        .any(|v| extract_embedded_number(&v.name).is_some());
    let has_numbers = has_leading || has_embedded;

    if has_numbers {
        sorted_videos.sort_by(|a, b| {
            let na = extract_leading_number(&a.name)
                .or_else(|| extract_embedded_number(&a.name))
                .unwrap_or(u32::MAX);
            let nb = extract_leading_number(&b.name)
                .or_else(|| extract_embedded_number(&b.name))
                .unwrap_or(u32::MAX);
            na.cmp(&nb).then_with(|| a.name.cmp(&b.name))
        });
    } else {
        sorted_videos.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    }

    // Build subtitle map by base name (case-insensitive)
    let mut subtitle_map: HashMap<String, Vec<&FileEntry>> = HashMap::new();
    for sub in subtitles {
        let base = subtitle_base_name(&sub.name).to_lowercase();
        subtitle_map.entry(base).or_default().push(sub);
    }

    // Sort subtitles the same way as videos for positional fallback
    let mut sorted_subtitles: Vec<&&FileEntry> = subtitles.iter().collect();
    if has_numbers {
        sorted_subtitles.sort_by(|a, b| {
            let na = extract_leading_number(&a.name)
                .or_else(|| extract_embedded_number(&a.name))
                .unwrap_or(u32::MAX);
            let nb = extract_leading_number(&b.name)
                .or_else(|| extract_embedded_number(&b.name))
                .unwrap_or(u32::MAX);
            na.cmp(&nb).then_with(|| a.name.cmp(&b.name))
        });
    } else {
        sorted_subtitles.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    }

    let mut used_positional = false;
    let mut lessons = Vec::new();

    for (i, video) in sorted_videos.iter().enumerate() {
        let video_base = video_base_name(&video.name);
        let clean_title = clean_lesson_title(&video.name);

        // Match subtitles by base name (case-insensitive)
        let mut matched_subs: Vec<ParsedSubtitle> = Vec::new();
        if let Some(subs) = subtitle_map.get(&video_base.to_lowercase()) {
            for sub in subs {
                let lang = extract_subtitle_language(&sub.name, &video_base);
                matched_subs.push(ParsedSubtitle {
                    path: sub.path.to_string_lossy().to_string(),
                    language: lang,
                    is_positional_match: false,
                });
            }
        }

        // Fallback: positional matching (both lists sorted the same way)
        if matched_subs.is_empty() && sorted_subtitles.len() == sorted_videos.len() {
            if let Some(sub) = sorted_subtitles.get(i) {
                matched_subs.push(ParsedSubtitle {
                    path: sub.path.to_string_lossy().to_string(),
                    language: None,
                    is_positional_match: true,
                });
                used_positional = true;
            }
        }

        // Match resources by base name
        let mut lesson_resources: Vec<ParsedResource> = Vec::new();
        for file in other_files {
            let file_base = file
                .name
                .rsplit_once('.')
                .map(|(n, _)| n.to_string())
                .unwrap_or(file.name.clone())
                .to_lowercase();

            if file_base == video_base.to_lowercase() {
                let rt = classify_resource(&file.extension, &file.name);
                lesson_resources.push(ParsedResource {
                    title: clean_display_name(&file.name),
                    path: file.path.to_string_lossy().to_string(),
                    resource_type: rt,
                });
            }
        }

        let ffprobe_bin = find_bundled_bin("ffprobe")
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| "ffprobe".to_string());

        let duration_secs = probe_video_duration(&video.path);

        // Add embedded (soft) subtitle tracks from the video container
        let embedded_subs = probe_embedded_subtitles(&video.path, &ffprobe_bin);
        matched_subs.extend(embedded_subs);

        lessons.push(ParsedLesson {
            title: clean_title,
            order: i,
            video_path: video.path.to_string_lossy().to_string(),
            duration_secs,
            subtitles: matched_subs,
            resources: lesson_resources,
        });
    }

    // Strip common prefix/suffix across all lesson titles in this batch
    // (e.g., "CS50x 2026 - " prefix and " - CS50" suffix)
    let mut titles: Vec<String> = lessons.iter().map(|l| l.title.clone()).collect();
    strip_common_affixes(&mut titles);
    for (lesson, title) in lessons.iter_mut().zip(titles.into_iter()) {
        lesson.title = title;
    }

    (lessons, used_positional)
}

// --- File classification helpers ---

fn is_video(ext: &str) -> bool {
    VIDEO_EXTENSIONS.contains(&ext)
}

fn is_subtitle(ext: &str) -> bool {
    SUBTITLE_EXTENSIONS.contains(&ext)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn is_thumbnail_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    let stem = lower.rsplit_once('.').map(|(n, _)| n).unwrap_or(&lower);
    THUMBNAIL_NAMES.contains(&stem)
}

fn is_description_file(name: &str) -> bool {
    DESCRIPTION_NAMES.contains(&name.to_lowercase().as_str())
}

fn is_metadata_file(ext: &str) -> bool {
    matches!(ext, "json" | "html" | "htm" | "nfo" | "url")
}

fn is_code_folder(name: &str) -> bool {
    CODE_FOLDER_NAMES.contains(&name.to_lowercase().as_str())
}

fn folder_has_videos(path: &Path) -> bool {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if is_video(&ext.to_lowercase()) {
                        return true;
                    }
                }
            }
            // Check one level deeper for Pattern 3
            if p.is_dir() {
                if let Ok(sub_entries) = fs::read_dir(&p) {
                    for sub_entry in sub_entries.flatten() {
                        let sp = sub_entry.path();
                        if sp.is_file() {
                            if let Some(ext) = sp.extension().and_then(|e| e.to_str()) {
                                if is_video(&ext.to_lowercase()) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

fn dir_is_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(true)
}

fn classify_resource(ext: &str, name: &str) -> ResourceType {
    if ext == "pdf" {
        ResourceType::Pdf
    } else if DOCUMENT_EXTENSIONS.contains(&ext) {
        ResourceType::Document
    } else if TEXT_EXTENSIONS.contains(&ext) {
        // Check if it's a links file
        let lower = name.to_lowercase();
        if lower.contains("link") || lower.contains("resource") || lower.contains("reference") {
            ResourceType::Link
        } else {
            ResourceType::Text
        }
    } else if ARCHIVE_EXTENSIONS.contains(&ext) {
        ResourceType::Archive
    } else if IMAGE_EXTENSIONS.contains(&ext) {
        ResourceType::Image
    } else {
        ResourceType::Other
    }
}

fn classify_resource_known(ext: &str, _name: &str) -> bool {
    !(DOCUMENT_EXTENSIONS.contains(&ext)
        || TEXT_EXTENSIONS.contains(&ext)
        || ARCHIVE_EXTENSIONS.contains(&ext)
        || IMAGE_EXTENSIONS.contains(&ext))
}

// --- Name parsing ---

fn extract_sort_key(name: &str) -> SortKey {
    if let Some(num) = extract_leading_number(name) {
        SortKey::Numeric(num)
    } else if let Some(num) = extract_embedded_number(name) {
        SortKey::Numeric(num)
    } else {
        SortKey::Alphabetic(name.to_lowercase())
    }
}

fn extract_leading_number(name: &str) -> Option<u32> {
    let s = name.trim();

    // Try to find a leading number, possibly surrounded by brackets/parens
    // Patterns: "01", "01 -", "01.", "[01]", "(01)", "Section 1"
    let chars: Vec<char> = s.chars().collect();

    if chars.is_empty() {
        return None;
    }

    // Skip "Section", "Chapter", "Part", "Lesson" prefix
    let prefixes = ["section", "chapter", "part", "lesson", "lecture", "module", "week", "day"];
    let mut start = s;
    for prefix in &prefixes {
        if let Some(rest) = s.to_lowercase().strip_prefix(prefix) {
            let rest = rest.trim_start();
            start = &s[s.len() - rest.len()..];
            break;
        }
    }

    // Strip leading brackets/parens
    let start = start
        .trim_start_matches('[')
        .trim_start_matches('(')
        .trim_start();

    // Extract digits
    let digits: String = start.chars().take_while(|c| c.is_ascii_digit()).collect();

    if digits.is_empty() {
        return None;
    }

    let num: u32 = digits.parse().ok()?;

    // Check if it's a platform ID (6+ digits before underscore) — skip it
    if digits.len() >= 6 {
        // Check if followed by underscore
        let rest = &start[digits.len()..];
        if rest.starts_with('_') {
            // This is likely a platform ID — try to find the real number after it
            let after_id = rest.trim_start_matches('_');
            let real_digits: String = after_id.chars().take_while(|c| c.is_ascii_digit()).collect();
            if !real_digits.is_empty() {
                return real_digits.parse().ok();
            }
            return None;
        }
    }

    Some(num)
}

/// Search for keyword+number patterns anywhere in the name.
/// Handles filenames like "CS50x 2026 - Lecture 3 - Algorithms" where the
/// sortable number isn't at the start.
fn extract_embedded_number(name: &str) -> Option<u32> {
    let lower = name.to_lowercase();
    let keywords = [
        "section", "chapter", "part", "lesson", "lecture", "module", "week", "day", "episode",
        "ep", "ep.", "vol", "vol.",
    ];

    for keyword in &keywords {
        if let Some(pos) = lower.find(keyword) {
            let after = &name[pos + keyword.len()..];
            let after = after.trim_start_matches(|c: char| c == ' ' || c == '.' || c == '_' || c == '-' || c == ':');
            let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if !digits.is_empty() {
                return digits.parse().ok();
            }
        }
    }

    None
}

fn video_base_name(filename: &str) -> String {
    // Strip extension, then return the base
    let stem = filename
        .rsplit_once('.')
        .map(|(n, _)| n)
        .unwrap_or(filename);
    stem.to_string()
}

fn subtitle_base_name(filename: &str) -> String {
    // A subtitle might be: name.srt, name.en.srt, name.English.srt, name.en.vtt
    let mut name = filename.to_string();

    // Strip the subtitle extension
    for ext in SUBTITLE_EXTENSIONS {
        let suffix = format!(".{}", ext);
        if name.to_lowercase().ends_with(&suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    // Strip language code if present (2-3 chars or full language name)
    if let Some((base, lang_part)) = name.rsplit_once('.') {
        let lang_lower = lang_part.to_lowercase();
        // Common language codes and names
        let is_lang = lang_lower.len() <= 3
            || matches!(
                lang_lower.as_str(),
                "english"
                    | "french"
                    | "spanish"
                    | "german"
                    | "japanese"
                    | "chinese"
                    | "korean"
                    | "portuguese"
                    | "italian"
                    | "russian"
                    | "arabic"
                    | "hindi"
                    | "dutch"
                    | "swedish"
                    | "norwegian"
                    | "danish"
                    | "finnish"
                    | "polish"
                    | "turkish"
                    | "thai"
                    | "vietnamese"
                    | "indonesian"
                    | "czech"
                    | "hungarian"
                    | "romanian"
                    | "greek"
                    | "hebrew"
                    | "brazilian"
            );

        if is_lang && !base.is_empty() {
            return base.to_string();
        }
    }

    name
}

fn extract_subtitle_language(subtitle_name: &str, video_base: &str) -> Option<String> {
    // Strip subtitle extension
    let mut name = subtitle_name.to_string();
    for ext in SUBTITLE_EXTENSIONS {
        let suffix = format!(".{}", ext);
        if name.to_lowercase().ends_with(&suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    // The language code is what's between the video base name and the subtitle extension
    if name.len() > video_base.len() && name.starts_with(video_base) {
        let remainder = &name[video_base.len()..];
        let lang = remainder.trim_start_matches('.');
        if !lang.is_empty() {
            return Some(normalize_language(lang));
        }
    }

    None
}

pub fn normalize_language(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "en" | "eng" | "english" => "English".to_string(),
        "fr" | "fra" | "fre" | "french" => "French".to_string(),
        "es" | "spa" | "spanish" => "Spanish".to_string(),
        "de" | "deu" | "ger" | "german" => "German".to_string(),
        "ja" | "jpn" | "japanese" => "Japanese".to_string(),
        "zh" | "chi" | "chinese" => "Chinese".to_string(),
        "ko" | "kor" | "korean" => "Korean".to_string(),
        "pt" | "por" | "portuguese" | "brazilian" => "Portuguese".to_string(),
        "it" | "ita" | "italian" => "Italian".to_string(),
        "ru" | "rus" | "russian" => "Russian".to_string(),
        "ar" | "ara" | "arabic" => "Arabic".to_string(),
        "hi" | "hin" | "hindi" => "Hindi".to_string(),
        other => {
            // Title case the raw code
            let mut chars = other.chars();
            match chars.next() {
                Some(c) => format!("{}{}", c.to_uppercase(), chars.as_str()),
                None => other.to_string(),
            }
        }
    }
}

// --- Display name cleaning ---

fn clean_display_name(name: &str) -> String {
    let mut result = name.to_string();

    // Strip file extension (from any known type)
    if let Some((stem, ext)) = result.rsplit_once('.') {
        let ext_lower = ext.to_lowercase();
        if is_video(&ext_lower)
            || is_subtitle(&ext_lower)
            || DOCUMENT_EXTENSIONS.contains(&ext_lower.as_str())
            || TEXT_EXTENSIONS.contains(&ext_lower.as_str())
            || ARCHIVE_EXTENSIONS.contains(&ext_lower.as_str())
            || IMAGE_EXTENSIONS.contains(&ext_lower.as_str())
        {
            result = stem.to_string();
        }
    }

    // Strip platform prefix (e.g., "Udemy - ")
    let platform_prefixes = ["Udemy - ", "Coursera - ", "Pluralsight - ", "Skillshare - "];
    for prefix in &platform_prefixes {
        if let Some(rest) = result.strip_prefix(prefix) {
            result = rest.to_string();
        }
    }

    // Strip resolution/quality tags like (720p), (1080p), [4K], (HD), etc.
    result = strip_quality_tags(&result);

    result = strip_leading_number(&result);

    // Strip platform ID prefixes (long numeric + underscore)
    let re_platform_id = regex_strip_platform_id(&result);
    if let Some(cleaned) = re_platform_id {
        result = cleaned;
    }

    // Replace underscores and hyphens with spaces
    result = result.replace('_', " ").replace('-', " ");

    // Collapse duplicate spaces
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }

    // Apply title case, preserving acronyms
    result = apply_title_case(&result);

    result.trim().to_string()
}

fn clean_lesson_title(filename: &str) -> String {
    clean_display_name(filename)
}

fn strip_leading_number(name: &str) -> String {
    let s = name.trim();

    // Patterns: "01 - ", "01. ", "[01] ", "(01) ", "01- ", "01 "
    let chars: Vec<char> = s.chars().collect();

    if chars.is_empty() {
        return s.to_string();
    }

    // Handle bracketed numbers: [01] or (01)
    if chars[0] == '[' || chars[0] == '(' {
        let close = if chars[0] == '[' { ']' } else { ')' };
        if let Some(close_pos) = chars.iter().position(|c| *c == close) {
            let inner: String = chars[1..close_pos].iter().collect();
            if inner.chars().all(|c| c.is_ascii_digit()) {
                let rest: String = chars[close_pos + 1..].iter().collect();
                let rest = rest.trim_start_matches(|c: char| c == ' ' || c == '-' || c == '.' || c == '_');
                return rest.to_string();
            }
        }
    }

    // Handle "Section X", "Chapter X" etc. prefixes
    let prefixes = ["section", "chapter", "part", "lesson", "lecture", "module", "week", "day"];
    let lower = s.to_lowercase();
    for prefix in &prefixes {
        if lower.starts_with(prefix) {
            let rest = &s[prefix.len()..];
            let rest = rest.trim_start();
            // Strip the number after the prefix
            let digits: String = rest.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
            if !digits.is_empty() {
                let after = &rest[digits.len()..];
                let after = after.trim_start_matches(|c: char| c == ' ' || c == '-' || c == '.' || c == '_' || c == ':');
                if !after.is_empty() {
                    return after.to_string();
                }
            }
        }
    }

    // Handle plain leading numbers
    let digits: String = chars.iter().take_while(|c| c.is_ascii_digit()).collect();
    if !digits.is_empty() {
        let rest: String = chars[digits.len()..].iter().collect();
        let rest = rest.trim_start_matches(|c: char| c == ' ' || c == '-' || c == '.' || c == '_');
        if !rest.is_empty() {
            return rest.to_string();
        }
        // If stripping the number leaves nothing, keep the original
        return s.to_string();
    }

    s.to_string()
}

fn regex_strip_platform_id(name: &str) -> Option<String> {
    // Match pattern: 123456_rest or 1234567_01_rest
    let chars: Vec<char> = name.chars().collect();
    let digits: String = chars.iter().take_while(|c| c.is_ascii_digit()).collect();

    if digits.len() >= 6 {
        let rest = &name[digits.len()..];
        if let Some(stripped) = rest.strip_prefix('_') {
            return Some(stripped.to_string());
        }
    }

    None
}

/// Given a list of titles, detect and strip common prefix and suffix shared by all.
/// Only strips at word/delimiter boundaries to avoid cutting mid-word.
/// Requires at least 3 titles to activate (avoids false positives on small sets).
fn strip_common_affixes(titles: &mut [String]) {
    if titles.len() < 3 {
        return;
    }

    // Find common prefix
    let first = &titles[0];
    let mut prefix_len = first.len();
    for title in titles.iter().skip(1) {
        prefix_len = prefix_len.min(title.len());
        for (i, (a, b)) in first.chars().zip(title.chars()).enumerate() {
            if a != b || i >= prefix_len {
                prefix_len = i;
                break;
            }
        }
    }

    // Snap prefix to a structural separator boundary (" - ", " – ", " _ ")
    // to avoid cutting in the middle of meaningful words like "Lecture"
    if prefix_len > 0 {
        let prefix_str = &first[..prefix_len];
        let separators = [" - ", " – ", " _ "];
        let mut best_boundary = 0;
        for sep in &separators {
            if let Some(pos) = prefix_str.rfind(sep) {
                let boundary = pos + sep.len();
                if boundary > best_boundary {
                    best_boundary = boundary;
                }
            }
        }
        prefix_len = best_boundary;
    }

    // Find common suffix
    let first_rev: Vec<char> = first.chars().rev().collect();
    let mut suffix_len = first.len();
    for title in titles.iter().skip(1) {
        let rev: Vec<char> = title.chars().rev().collect();
        suffix_len = suffix_len.min(rev.len());
        for i in 0..suffix_len {
            if i >= first_rev.len() || i >= rev.len() || first_rev[i] != rev[i] {
                suffix_len = i;
                break;
            }
        }
    }

    // Snap suffix to a structural separator boundary
    if suffix_len > 0 {
        let suffix_start = first.len() - suffix_len;
        let suffix_str = &first[suffix_start..];
        let separators = [" - ", " – ", " _ "];
        let mut best_boundary = 0;
        for sep in &separators {
            if let Some(pos) = suffix_str.find(sep) {
                // suffix_len = everything from this separator onwards
                let candidate = suffix_str.len() - pos;
                if candidate > best_boundary {
                    best_boundary = candidate;
                }
            }
        }
        suffix_len = best_boundary;
    }

    // Apply stripping — only if the result is non-empty for all titles
    for title in titles.iter_mut() {
        let end = title.len().saturating_sub(suffix_len);
        if prefix_len < end {
            let stripped = title[prefix_len..end].trim().to_string();
            if !stripped.is_empty() {
                *title = stripped;
            }
        }
    }
}

fn strip_quality_tags(name: &str) -> String {
    let quality_tags = [
        "(720p)", "(1080p)", "(480p)", "(360p)", "(240p)", "(2160p)", "(4K)", "(4k)",
        "(HD)", "(FHD)", "(UHD)", "(hd)", "(fhd)", "(uhd)",
        "[720p]", "[1080p]", "[480p]", "[360p]", "[240p]", "[2160p]", "[4K]", "[4k]",
        "[HD]", "[FHD]", "[UHD]", "[hd]", "[fhd]", "[uhd]",
    ];
    let mut result = name.to_string();
    for tag in &quality_tags {
        result = result.replace(tag, "");
    }
    result
}

fn apply_title_case(text: &str) -> String {
    text.split_whitespace()
        .map(|word| {
            // Strip trailing punctuation for acronym matching, then reattach
            let alpha_end = word
                .char_indices()
                .rev()
                .find(|(_, c)| c.is_alphanumeric())
                .map(|(i, c)| i + c.len_utf8())
                .unwrap_or(word.len());
            let (core, trailing) = word.split_at(alpha_end);

            // Check if the core is an acronym (preserve canonical form)
            if ACRONYMS.iter().any(|a| a.eq_ignore_ascii_case(core)) {
                let canonical = ACRONYMS
                    .iter()
                    .find(|a| a.eq_ignore_ascii_case(core))
                    .map(|a| a.to_string())
                    .unwrap_or(core.to_string());
                format!("{}{}", canonical, trailing)
            } else if core.chars().all(|c| c.is_uppercase() || !c.is_alphabetic()) && core.len() > 1 {
                // ALL CAPS word that's not a known acronym — title case it
                let mut chars = core.chars();
                match chars.next() {
                    Some(c) => {
                        format!(
                            "{}{}{}",
                            c.to_uppercase(),
                            chars.as_str().to_lowercase(),
                            trailing
                        )
                    }
                    None => word.to_string(),
                }
            } else {
                // Already mixed case — leave it
                word.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// --- Description & thumbnail detection ---

fn detect_description(files: &[FileEntry]) -> Option<String> {
    for file in files {
        if is_description_file(&file.name) {
            if let Ok(content) = fs::read_to_string(&file.path) {
                let trimmed = content.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
    }
    None
}

// --- Video duration probing ---

pub fn find_bundled_bin(bin: &str) -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    #[cfg(target_os = "macos")]
    let name = format!("{}-universal-apple-darwin", bin);

    #[cfg(target_os = "windows")]
    let name = format!("{}-x86_64-pc-windows-msvc.exe", bin);

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let name = bin.to_string();

    let path = dir.join(&name);
    if path.exists() { Some(path) } else { None }
}

fn probe_embedded_subtitles(path: &Path, ffprobe_bin: &str) -> Vec<ParsedSubtitle> {
    let mut cmd = std::process::Command::new(ffprobe_bin);
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-select_streams", "s",
    ])
    .arg(path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = match cmd.output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let json: serde_json::Value = match serde_json::from_slice(&output.stdout) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let streams = match json.get("streams").and_then(|s| s.as_array()) {
        Some(s) => s,
        None => return Vec::new(),
    };

    let video_path_str = path.to_string_lossy();
    let mut result = Vec::new();

    for stream in streams {
        let index = match stream.get("index").and_then(|i| i.as_u64()) {
            Some(i) => i,
            None => continue,
        };

        // Skip image-based subtitle codecs (dvd_subtitle, hdmv_pgs_subtitle)
        let codec = stream
            .get("codec_name")
            .and_then(|c| c.as_str())
            .unwrap_or("");
        if matches!(codec, "dvd_subtitle" | "hdmv_pgs_subtitle" | "dvbsub" | "pgssub") {
            continue;
        }

        let language = stream
            .get("tags")
            .and_then(|t| t.get("language").or_else(|| t.get("title")))
            .and_then(|l| l.as_str())
            .filter(|l| !l.eq_ignore_ascii_case("und"))
            .map(|l| normalize_language(l));

        result.push(ParsedSubtitle {
            path: format!("{}#subtitle:{}", video_path_str, index),
            language,
            is_positional_match: false,
        });
    }

    result
}

fn probe_video_duration(path: &Path) -> u64 {
    // Try bundled ffprobe first, then fall back to system ffprobe
    let ffprobe_bin = find_bundled_bin("ffprobe")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "ffprobe".to_string());

    if let Some(secs) = probe_with_ffprobe(path, &ffprobe_bin) {
        return secs;
    }
    // Fallback: parse mp4 container directly
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if matches!(ext.as_str(), "mp4" | "m4v" | "mov") {
        if let Some(secs) = probe_mp4_duration(path) {
            return secs;
        }
    }
    0
}

fn probe_with_ffprobe(path: &Path, ffprobe_bin: &str) -> Option<u64> {
    let mut cmd = std::process::Command::new(ffprobe_bin);
    cmd.args([
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
    ])
    .arg(path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().ok()?;

    if !output.status.success() {
        return None;
    }

    let s = String::from_utf8_lossy(&output.stdout);
    let secs: f64 = s.trim().parse().ok()?;
    Some(secs as u64)
}

fn probe_mp4_duration(path: &Path) -> Option<u64> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = fs::File::open(path).ok()?;
    let file_len = file.metadata().ok()?.len();
    let mut pos: u64 = 0;

    // Scan top-level boxes for moov
    while pos < file_len {
        file.seek(SeekFrom::Start(pos)).ok()?;
        let mut header = [0u8; 8];
        if file.read_exact(&mut header).is_err() {
            break;
        }

        let size = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as u64;
        let box_type = &header[4..8];

        let box_size = if size == 1 {
            // 64-bit extended size
            let mut ext = [0u8; 8];
            file.read_exact(&mut ext).ok()?;
            u64::from_be_bytes(ext)
        } else if size == 0 {
            file_len - pos
        } else {
            size
        };

        if box_size < 8 {
            break;
        }

        if box_type == b"moov" {
            // Search inside moov for mvhd
            return find_mvhd_duration(&mut file, pos + 8, box_size - 8);
        }

        pos += box_size;
    }

    None
}

fn find_mvhd_duration(
    file: &mut fs::File,
    start: u64,
    len: u64,
) -> Option<u64> {
    use std::io::{Read, Seek, SeekFrom};

    let mut pos = start;
    let end = start + len;

    while pos < end {
        file.seek(SeekFrom::Start(pos)).ok()?;
        let mut header = [0u8; 8];
        if file.read_exact(&mut header).is_err() {
            break;
        }

        let size = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as u64;
        let box_type = &header[4..8];

        if size < 8 {
            break;
        }

        if box_type == b"mvhd" {
            // Read version byte
            let mut version = [0u8; 1];
            file.read_exact(&mut version).ok()?;

            if version[0] == 0 {
                // Version 0: skip 3 flags + 4 creation + 4 modification = 11 bytes
                file.seek(SeekFrom::Current(11)).ok()?;
                let mut buf = [0u8; 4];
                file.read_exact(&mut buf).ok()?;
                let timescale = u32::from_be_bytes(buf);
                file.read_exact(&mut buf).ok()?;
                let duration = u32::from_be_bytes(buf);
                if timescale > 0 {
                    return Some((duration as u64) / (timescale as u64));
                }
            } else {
                // Version 1: skip 3 flags + 8 creation + 8 modification = 19 bytes
                file.seek(SeekFrom::Current(19)).ok()?;
                let mut buf4 = [0u8; 4];
                file.read_exact(&mut buf4).ok()?;
                let timescale = u32::from_be_bytes(buf4);
                let mut buf8 = [0u8; 8];
                file.read_exact(&mut buf8).ok()?;
                let duration = u64::from_be_bytes(buf8);
                if timescale > 0 {
                    return Some(duration / (timescale as u64));
                }
            }
        }

        pos += size;
    }

    None
}

fn detect_thumbnail(files: &[FileEntry]) -> Option<String> {
    for file in files {
        if is_thumbnail_file(&file.name) && IMAGE_EXTENSIONS.contains(&file.extension.as_str()) {
            return Some(file.path.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- extract_leading_number ---

    #[test]
    fn leading_number_plain() {
        assert_eq!(extract_leading_number("01 - Introduction"), Some(1));
        assert_eq!(extract_leading_number("12. Arrays"), Some(12));
    }

    #[test]
    fn leading_number_with_lecture_prefix() {
        assert_eq!(extract_leading_number("Lecture 3 - Algorithms"), Some(3));
        assert_eq!(extract_leading_number("lecture 10 - The End"), Some(10));
    }

    #[test]
    fn leading_number_no_match() {
        assert_eq!(extract_leading_number("CS50x 2026 - Lecture 0"), None);
        assert_eq!(extract_leading_number("Introduction"), None);
    }

    // --- extract_embedded_number ---

    #[test]
    fn embedded_number_lecture() {
        assert_eq!(
            extract_embedded_number("CS50x 2026 - Lecture 0 - Scratch - CS50 (720p)"),
            Some(0)
        );
        assert_eq!(
            extract_embedded_number("CS50x 2026 - Lecture 10 - The End - CS50 (720p)"),
            Some(10)
        );
    }

    #[test]
    fn embedded_number_episode() {
        assert_eq!(
            extract_embedded_number("The Great Course - Episode 5 - Something"),
            Some(5)
        );
        assert_eq!(extract_embedded_number("Ep.3 - Title"), Some(3));
    }

    #[test]
    fn embedded_number_none() {
        assert_eq!(extract_embedded_number("Just a plain title"), None);
    }

    // --- strip_quality_tags ---

    #[test]
    fn quality_tags_removed() {
        assert_eq!(strip_quality_tags("Video (720p)"), "Video ");
        assert_eq!(strip_quality_tags("Video [1080p]"), "Video ");
        assert_eq!(strip_quality_tags("Video (4K)"), "Video ");
        assert_eq!(strip_quality_tags("No tag here"), "No tag here");
    }

    // --- strip_common_affixes ---

    #[test]
    fn common_affixes_cs50_style() {
        let mut titles = vec![
            "CS50x 2026 - Lecture 0 - Scratch - CS50".to_string(),
            "CS50x 2026 - Lecture 1 - C - CS50".to_string(),
            "CS50x 2026 - Lecture 2 - Arrays - CS50".to_string(),
            "CS50x 2026 - Lecture 3 - Algorithms - CS50".to_string(),
        ];
        strip_common_affixes(&mut titles);
        assert_eq!(titles[0], "Lecture 0 - Scratch");
        assert_eq!(titles[1], "Lecture 1 - C");
        assert_eq!(titles[2], "Lecture 2 - Arrays");
        assert_eq!(titles[3], "Lecture 3 - Algorithms");
    }

    #[test]
    fn common_affixes_no_strip_when_too_few() {
        let mut titles = vec!["A - Foo".to_string(), "A - Bar".to_string()];
        strip_common_affixes(&mut titles);
        // Should not strip with only 2 titles
        assert_eq!(titles[0], "A - Foo");
        assert_eq!(titles[1], "A - Bar");
    }

    #[test]
    fn common_affixes_prefix_only() {
        let mut titles = vec![
            "Course Name - Part 1".to_string(),
            "Course Name - Part 2".to_string(),
            "Course Name - Part 3".to_string(),
        ];
        strip_common_affixes(&mut titles);
        assert_eq!(titles[0], "Part 1");
        assert_eq!(titles[1], "Part 2");
        assert_eq!(titles[2], "Part 3");
    }

    // --- clean_display_name ---

    #[test]
    fn clean_display_name_cs50() {
        let result = clean_display_name("CS50x 2026 - Lecture 0 - Scratch - CS50 (720p).mp4");
        // Should strip extension, resolution tag, then remaining hyphens become spaces
        assert!(!result.contains("720p"), "Should strip resolution tag, got: {}", result);
        assert!(!result.contains(".mp4"), "Should strip extension, got: {}", result);
    }

    #[test]
    fn clean_display_name_preserves_acronyms() {
        let result = clean_display_name("08 - HTML, CSS, JavaScript.mp4");
        assert!(result.contains("HTML"), "got: {}", result);
        assert!(result.contains("CSS"), "got: {}", result);
    }

    // --- sort_key with embedded numbers ---

    #[test]
    fn sort_key_embedded_lecture() {
        let key = extract_sort_key("CS50x 2026 - Lecture 3 - Algorithms");
        assert!(matches!(key, SortKey::Numeric(3)));
    }

    #[test]
    fn sort_key_leading_wins_over_embedded() {
        // "02 - Lecture 5" should use leading 2, not embedded 5
        let key = extract_sort_key("02 - Lecture 5 - Something");
        assert!(matches!(key, SortKey::Numeric(2)));
    }

    // --- strip_leading_number with lecture ---

    #[test]
    fn strip_leading_lecture() {
        let result = strip_leading_number("Lecture 3 - Algorithms");
        assert_eq!(result, "Algorithms");
    }

    #[test]
    fn strip_leading_lecture_no_title_after() {
        // "Lecture 3" with nothing after should keep original
        let result = strip_leading_number("Lecture 3");
        assert_eq!(result, "Lecture 3");
    }
}
