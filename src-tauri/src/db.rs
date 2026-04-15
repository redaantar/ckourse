use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

use crate::parser::ParsedCourse;

// --- Database state ---

pub struct DbState {
    pub conn: Mutex<Connection>,
}

// --- API types (sent to/from frontend) ---

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub completed_lessons: i64,
    pub total_lessons: i64,
    pub status: String,
    pub accent_color: String,
    pub last_watched: Option<String>,
    pub category: String,
    pub folder_path: String,
    pub description: Option<String>,
    pub thumbnail_path: Option<String>,
    pub bookmarked: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CourseDetail {
    pub course_id: i64,
    pub total_duration: i64,
    pub resources: Vec<Resource>,
    pub sections: Vec<Section>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: i64,
    pub title: String,
    pub lessons: Vec<Lesson>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Lesson {
    pub id: i64,
    pub title: String,
    pub duration: i64,
    pub completed: bool,
    pub is_last_watched: bool,
    pub video_path: String,
    pub last_position: f64,
    pub favorited: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    pub id: i64,
    pub title: String,
    #[serde(rename = "type")]
    pub resource_type: String,
    pub path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub course_id: i64,
    pub lesson_id: i64,
    pub lesson_title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteWithCourse {
    pub id: i64,
    pub course_id: i64,
    pub lesson_id: i64,
    pub lesson_title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub course_title: String,
    pub accent_color: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub kind: String, // "course" | "lesson"
    pub course_id: i64,
    pub course_title: String,
    pub accent_color: String,
    pub lesson_id: Option<i64>,
    pub lesson_title: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Subtitle {
    pub id: i64,
    pub lesson_id: i64,
    pub path: String,
    pub language: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCourseInput {
    pub title: String,
    pub author: String,
    pub accent_color: String,
    pub category: String,
}

// --- Database initialization ---

pub fn init_db(app_data_dir: &Path) -> SqlResult<Connection> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("ckourse.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch("PRAGMA synchronous = NORMAL;")?;
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT '',
            accent_color TEXT NOT NULL DEFAULT '#61DAFB',
            category TEXT NOT NULL DEFAULT 'other',
            description TEXT,
            thumbnail_path TEXT,
            folder_path TEXT NOT NULL,
            last_watched TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            video_path TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            completed INTEGER NOT NULL DEFAULT 0,
            is_last_watched INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            last_position REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS subtitles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            language TEXT,
            is_positional_match INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            lesson_id INTEGER,
            title TEXT NOT NULL,
            path TEXT NOT NULL,
            resource_type TEXT NOT NULL DEFAULT 'other'
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            lesson_id INTEGER NOT NULL,
            lesson_title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            date TEXT PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE INDEX IF NOT EXISTS idx_sections_course_id ON sections(course_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_section_id ON lessons(section_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_completed ON lessons(completed);
        CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);
        CREATE INDEX IF NOT EXISTS idx_subtitles_lesson_id ON subtitles(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_resources_course_id ON resources(course_id);
        CREATE INDEX IF NOT EXISTS idx_courses_updated_at ON courses(updated_at DESC);
        ",
    )?;

    // Migrations for existing databases
    let _ = conn.execute_batch(
        "ALTER TABLE lessons ADD COLUMN last_position REAL NOT NULL DEFAULT 0;",
    );

    // Bookmarks table migration for existing databases
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );",
    );

    // Activity log table migration for existing databases
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS activity_log (date TEXT PRIMARY KEY);",
    );

    // Seed activity_log from existing last_watched dates
    let _ = conn.execute_batch(
        "INSERT OR IGNORE INTO activity_log (date)
         SELECT SUBSTR(last_watched, 1, 10) FROM courses WHERE last_watched IS NOT NULL;",
    );

    // Favorites table migration for existing databases
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );",
    );

    // Custom categories table migration for existing databases
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS custom_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );",
    );

    Ok(conn)
}

// --- Course operations ---

pub fn save_parsed_course(
    conn: &Connection,
    parsed: &ParsedCourse,
    input: &SaveCourseInput,
) -> SqlResult<i64> {
    let now = chrono_now();
    // Wrap the entire import in a transaction so a partial failure rolls back cleanly
    conn.execute_batch("BEGIN")?;
    match save_parsed_course_inner(conn, parsed, input, &now) {
        Ok(id) => {
            conn.execute_batch("COMMIT")?;
            Ok(id)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

fn save_parsed_course_inner(
    conn: &Connection,
    parsed: &ParsedCourse,
    input: &SaveCourseInput,
    now: &str,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO courses (title, author, accent_color, category, description, thumbnail_path, folder_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.title,
            input.author,
            input.accent_color,
            input.category,
            parsed.description,
            parsed.thumbnail_path,
            parsed.folder_path,
            now,
            now,
        ],
    )?;

    let course_id = conn.last_insert_rowid();

    // Insert course-level resources
    for r in &parsed.resources {
        let rt = format!("{:?}", r.resource_type).to_lowercase();
        conn.execute(
            "INSERT INTO resources (course_id, lesson_id, title, path, resource_type) VALUES (?1, NULL, ?2, ?3, ?4)",
            params![course_id, r.title, r.path, rt],
        )?;
    }

    // Insert sections and lessons
    for section in &parsed.sections {
        conn.execute(
            "INSERT INTO sections (course_id, title, sort_order) VALUES (?1, ?2, ?3)",
            params![course_id, section.title, section.order],
        )?;
        let section_id = conn.last_insert_rowid();

        for lesson in &section.lessons {
            conn.execute(
                "INSERT INTO lessons (section_id, title, video_path, sort_order, completed, is_last_watched, duration)
                 VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)",
                params![section_id, lesson.title, lesson.video_path, lesson.order, (lesson.duration_secs / 60) as i64],
            )?;
            let lesson_id = conn.last_insert_rowid();

            // Subtitles
            for sub in &lesson.subtitles {
                conn.execute(
                    "INSERT INTO subtitles (lesson_id, path, language, is_positional_match) VALUES (?1, ?2, ?3, ?4)",
                    params![lesson_id, sub.path, sub.language, sub.is_positional_match as i32],
                )?;
            }

            // Lesson-level resources
            for r in &lesson.resources {
                let rt = format!("{:?}", r.resource_type).to_lowercase();
                conn.execute(
                    "INSERT INTO resources (course_id, lesson_id, title, path, resource_type) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![course_id, lesson_id, r.title, r.path, rt],
                )?;
            }
        }
    }

    Ok(course_id)
}

pub fn get_all_courses(conn: &Connection) -> SqlResult<Vec<Course>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.title, c.author, c.accent_color, c.category, c.folder_path,
                c.description, c.thumbnail_path, c.last_watched,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) as completed,
                (SELECT COUNT(*) > 0 FROM bookmarks b WHERE b.course_id = c.id) as bookmarked
         FROM courses c
         ORDER BY c.updated_at DESC",
    )?;

    let courses = stmt
        .query_map([], |row| {
            let total: i64 = row.get(9)?;
            let completed: i64 = row.get(10)?;
            let status = if completed == 0 {
                "not-started"
            } else if completed >= total {
                "completed"
            } else {
                "in-progress"
            };

            Ok(Course {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                accent_color: row.get(3)?,
                category: row.get(4)?,
                folder_path: row.get(5)?,
                description: row.get(6)?,
                thumbnail_path: row.get(7)?,
                last_watched: row.get(8)?,
                total_lessons: total,
                completed_lessons: completed,
                status: status.to_string(),
                bookmarked: row.get::<_, i32>(11)? != 0,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(courses)
}

pub fn get_course_detail(conn: &Connection, course_id: i64) -> SqlResult<Option<CourseDetail>> {
    // Check course exists
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM courses WHERE id = ?1",
        params![course_id],
        |row| row.get(0),
    )?;

    if !exists {
        return Ok(None);
    }

    // Get sections
    let mut section_stmt = conn.prepare(
        "SELECT id, title FROM sections WHERE course_id = ?1 ORDER BY sort_order",
    )?;

    let mut lesson_stmt = conn.prepare(
        "SELECT l.id, l.title, l.video_path, l.duration, l.completed, l.is_last_watched, l.last_position,
                (SELECT COUNT(*) > 0 FROM favorites f WHERE f.lesson_id = l.id) as favorited
         FROM lessons l WHERE l.section_id = ?1 ORDER BY l.sort_order",
    )?;

    let sections: Vec<Section> = section_stmt
        .query_map(params![course_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<SqlResult<Vec<_>>>()?
        .into_iter()
        .map(|(sid, stitle)| {
            let lessons: Vec<Lesson> = match lesson_stmt.query_map(params![sid], |row| {
                Ok(Lesson {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    video_path: row.get(2)?,
                    duration: row.get(3)?,
                    completed: row.get::<_, i32>(4)? != 0,
                    is_last_watched: row.get::<_, i32>(5)? != 0,
                    last_position: row.get(6)?,
                    favorited: row.get::<_, i32>(7)? != 0,
                })
            }) {
                Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
                Err(_) => Vec::new(),
            };

            Section {
                id: sid,
                title: stitle,
                lessons,
            }
        })
        .collect();

    // Get resources
    let mut res_stmt = conn.prepare(
        "SELECT id, title, resource_type, path FROM resources WHERE course_id = ?1 AND lesson_id IS NULL",
    )?;

    let resources: Vec<Resource> = res_stmt
        .query_map(params![course_id], |row| {
            Ok(Resource {
                id: row.get(0)?,
                title: row.get(1)?,
                resource_type: row.get(2)?,
                path: row.get(3)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    let total_duration: i64 = sections
        .iter()
        .flat_map(|s| &s.lessons)
        .map(|l| l.duration)
        .sum();

    Ok(Some(CourseDetail {
        course_id,
        total_duration,
        resources,
        sections,
    }))
}

pub fn get_course_by_id(conn: &Connection, course_id: i64) -> SqlResult<Option<Course>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.title, c.author, c.accent_color, c.category, c.folder_path,
                c.description, c.thumbnail_path, c.last_watched,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) as completed,
                (SELECT COUNT(*) > 0 FROM bookmarks b WHERE b.course_id = c.id) as bookmarked
         FROM courses c WHERE c.id = ?1",
    )?;

    match stmt.query_row(params![course_id], |row| {
        let total: i64 = row.get(9)?;
        let completed: i64 = row.get(10)?;
        let status = if completed == 0 {
            "not-started"
        } else if completed >= total {
            "completed"
        } else {
            "in-progress"
        };
        Ok(Course {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            accent_color: row.get(3)?,
            category: row.get(4)?,
            folder_path: row.get(5)?,
            description: row.get(6)?,
            thumbnail_path: row.get(7)?,
            last_watched: row.get(8)?,
            total_lessons: total,
            completed_lessons: completed,
            status: status.to_string(),
            bookmarked: row.get::<_, i32>(11)? != 0,
        })
    }) {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn toggle_lesson_completed(conn: &Connection, lesson_id: i64) -> SqlResult<bool> {
    let current: i32 = conn.query_row(
        "SELECT completed FROM lessons WHERE id = ?1",
        params![lesson_id],
        |row| row.get(0),
    )?;

    let new_val = if current == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE lessons SET completed = ?1 WHERE id = ?2",
        params![new_val, lesson_id],
    )?;

    // Update course updated_at
    conn.execute(
        "UPDATE courses SET updated_at = ?1 WHERE id = (
            SELECT s.course_id FROM sections s JOIN lessons l ON l.section_id = s.id WHERE l.id = ?2
        )",
        params![chrono_now(), lesson_id],
    )?;

    record_activity(conn);

    Ok(new_val != 0)
}

pub fn set_last_watched(conn: &Connection, course_id: i64, lesson_id: i64) -> SqlResult<()> {
    // Clear all is_last_watched for this course
    conn.execute(
        "UPDATE lessons SET is_last_watched = 0 WHERE section_id IN (SELECT id FROM sections WHERE course_id = ?1)",
        params![course_id],
    )?;

    // Set the new one
    conn.execute(
        "UPDATE lessons SET is_last_watched = 1 WHERE id = ?1",
        params![lesson_id],
    )?;

    let now = chrono_now();
    conn.execute(
        "UPDATE courses SET last_watched = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, course_id],
    )?;

    record_activity(conn);

    Ok(())
}

pub fn update_course(
    conn: &Connection,
    course_id: i64,
    title: &str,
    author: &str,
    accent_color: &str,
    category: &str,
) -> SqlResult<()> {
    let now = chrono_now();
    conn.execute(
        "UPDATE courses SET title = ?1, author = ?2, accent_color = ?3, category = ?4, updated_at = ?5 WHERE id = ?6",
        params![title, author, accent_color, category, now, course_id],
    )?;
    Ok(())
}

pub fn reset_course_progress(conn: &Connection, course_id: i64) -> SqlResult<()> {
    conn.execute(
        "UPDATE lessons SET completed = 0, is_last_watched = 0
         WHERE section_id IN (SELECT id FROM sections WHERE course_id = ?1)",
        params![course_id],
    )?;
    conn.execute(
        "UPDATE courses SET last_watched = NULL, updated_at = ?1 WHERE id = ?2",
        params![chrono_now(), course_id],
    )?;
    Ok(())
}

pub fn delete_course(conn: &Connection, course_id: i64) -> SqlResult<()> {
    conn.execute("DELETE FROM courses WHERE id = ?1", params![course_id])?;
    Ok(())
}

// --- Notes ---

pub fn get_all_notes(conn: &Connection) -> SqlResult<Vec<NoteWithCourse>> {
    let mut stmt = conn.prepare(
        "SELECT n.id, n.course_id, n.lesson_id, n.lesson_title, n.content,
                n.created_at, n.updated_at, c.title, c.accent_color
         FROM notes n
         JOIN courses c ON c.id = n.course_id
         ORDER BY n.updated_at DESC",
    )?;

    let notes = stmt
        .query_map([], |row| {
            Ok(NoteWithCourse {
                id: row.get(0)?,
                course_id: row.get(1)?,
                lesson_id: row.get(2)?,
                lesson_title: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                course_title: row.get(7)?,
                accent_color: row.get(8)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(notes)
}

pub fn get_course_notes(conn: &Connection, course_id: i64) -> SqlResult<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, course_id, lesson_id, lesson_title, content, created_at, updated_at
         FROM notes WHERE course_id = ?1 ORDER BY created_at DESC",
    )?;

    let notes = stmt
        .query_map(params![course_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                course_id: row.get(1)?,
                lesson_id: row.get(2)?,
                lesson_title: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(notes)
}

pub fn add_note(
    conn: &Connection,
    course_id: i64,
    lesson_id: i64,
    lesson_title: &str,
    content: &str,
) -> SqlResult<Note> {
    let now = chrono_now();
    conn.execute(
        "INSERT INTO notes (course_id, lesson_id, lesson_title, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![course_id, lesson_id, lesson_title, content, now, now],
    )?;

    let id = conn.last_insert_rowid();
    Ok(Note {
        id,
        course_id,
        lesson_id,
        lesson_title: lesson_title.to_string(),
        content: content.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_note(conn: &Connection, note_id: i64, content: &str) -> SqlResult<()> {
    let now = chrono_now();
    conn.execute(
        "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
        params![content, now, note_id],
    )?;
    Ok(())
}

pub fn delete_note(conn: &Connection, note_id: i64) -> SqlResult<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![note_id])?;
    Ok(())
}

pub fn save_lesson_position(conn: &Connection, lesson_id: i64, position: f64) -> SqlResult<()> {
    conn.execute(
        "UPDATE lessons SET last_position = ?1 WHERE id = ?2",
        params![position, lesson_id],
    )?;
    Ok(())
}

pub fn update_lesson_duration(conn: &Connection, lesson_id: i64, duration: i64) -> SqlResult<()> {
    conn.execute(
        "UPDATE lessons SET duration = ?1 WHERE id = ?2 AND duration != ?1",
        params![duration, lesson_id],
    )?;
    Ok(())
}

// --- Bookmarks ---

pub fn toggle_bookmark(conn: &Connection, course_id: i64) -> SqlResult<bool> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM bookmarks WHERE course_id = ?1",
        params![course_id],
        |row| row.get(0),
    )?;

    if exists {
        conn.execute(
            "DELETE FROM bookmarks WHERE course_id = ?1",
            params![course_id],
        )?;
        Ok(false)
    } else {
        conn.execute(
            "INSERT INTO bookmarks (course_id, created_at) VALUES (?1, ?2)",
            params![course_id, chrono_now()],
        )?;
        Ok(true)
    }
}

// --- Favorites ---

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteLesson {
    pub id: i64,
    pub lesson_id: i64,
    pub lesson_title: String,
    pub duration: i64,
    pub completed: bool,
    pub last_position: f64,
    pub course_id: i64,
    pub course_title: String,
    pub accent_color: String,
    pub created_at: String,
}

pub fn get_all_favorites(conn: &Connection) -> SqlResult<Vec<FavoriteLesson>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, l.id, l.title, l.duration, l.completed, l.last_position,
                c.id, c.title, c.accent_color, f.created_at
         FROM favorites f
         JOIN lessons l ON l.id = f.lesson_id
         JOIN sections s ON s.id = l.section_id
         JOIN courses c ON c.id = s.course_id
         ORDER BY f.created_at DESC",
    )?;

    let favorites = stmt
        .query_map([], |row| {
            Ok(FavoriteLesson {
                id: row.get(0)?,
                lesson_id: row.get(1)?,
                lesson_title: row.get(2)?,
                duration: row.get(3)?,
                completed: row.get::<_, i32>(4)? != 0,
                last_position: row.get(5)?,
                course_id: row.get(6)?,
                course_title: row.get(7)?,
                accent_color: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(favorites)
}

pub fn get_bookmarked_courses(conn: &Connection) -> SqlResult<Vec<Course>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.title, c.author, c.accent_color, c.category, c.folder_path,
                c.description, c.thumbnail_path, c.last_watched,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) as completed
         FROM courses c
         JOIN bookmarks b ON b.course_id = c.id
         ORDER BY b.created_at DESC",
    )?;

    let courses = stmt
        .query_map([], |row| {
            let total: i64 = row.get(9)?;
            let completed: i64 = row.get(10)?;
            let status = if completed == 0 {
                "not-started"
            } else if completed >= total {
                "completed"
            } else {
                "in-progress"
            };

            Ok(Course {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                accent_color: row.get(3)?,
                category: row.get(4)?,
                folder_path: row.get(5)?,
                description: row.get(6)?,
                thumbnail_path: row.get(7)?,
                last_watched: row.get(8)?,
                total_lessons: total,
                completed_lessons: completed,
                status: status.to_string(),
                bookmarked: true,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(courses)
}

pub fn toggle_favorite(conn: &Connection, lesson_id: i64) -> SqlResult<bool> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM favorites WHERE lesson_id = ?1",
        params![lesson_id],
        |row| row.get(0),
    )?;

    if exists {
        conn.execute(
            "DELETE FROM favorites WHERE lesson_id = ?1",
            params![lesson_id],
        )?;
        Ok(false)
    } else {
        conn.execute(
            "INSERT INTO favorites (lesson_id, created_at) VALUES (?1, ?2)",
            params![lesson_id, chrono_now()],
        )?;
        Ok(true)
    }
}

// --- Subtitles ---

pub fn get_lesson_subtitles(conn: &Connection, lesson_id: i64) -> SqlResult<Vec<Subtitle>> {
    let mut stmt = conn.prepare(
        "SELECT id, lesson_id, path, language FROM subtitles WHERE lesson_id = ?1",
    )?;

    let subs = stmt
        .query_map(params![lesson_id], |row| {
            Ok(Subtitle {
                id: row.get(0)?,
                lesson_id: row.get(1)?,
                path: row.get(2)?,
                language: row.get(3)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    Ok(subs)
}

// --- Activity & Stats ---

fn record_activity(conn: &Connection) {
    let today = &chrono_now()[..10]; // "YYYY-MM-DD"
    let _ = conn.execute(
        "INSERT OR IGNORE INTO activity_log (date) VALUES (?1)",
        params![today],
    );
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_courses: i64,
    pub completed_courses: i64,
    pub in_progress_courses: i64,
    pub total_lessons: i64,
    pub completed_lessons: i64,
    pub total_watch_time_mins: i64,
    pub total_notes: i64,
    pub current_streak: i64,
    pub week_activity: Vec<bool>, // last 7 days, index 0 = 6 days ago, index 6 = today
    pub user_level: i64,          // 1-4 based on completed lessons
    pub lessons_to_next_level: i64, // 0 if max level
}

fn calculate_level(completed: i64) -> (i64, i64) {
    // Returns (level, lessons_to_next_level)
    match completed {
        0..=4 => (1, 5 - completed),
        5..=19 => (2, 20 - completed),
        20..=49 => (3, 50 - completed),
        _ => (4, 0),
    }
}

pub fn get_dashboard_stats(conn: &Connection) -> SqlResult<DashboardStats> {
    // Aggregate lesson stats in a single query
    let (total_lessons, completed_lessons, total_watch_time_mins): (i64, i64, i64) =
        conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(completed), 0), COALESCE(SUM(CASE WHEN completed = 1 THEN duration ELSE 0 END), 0) FROM lessons",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

    let total_notes: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?;

    let total_courses: i64 =
        conn.query_row("SELECT COUNT(*) FROM courses", [], |row| row.get(0))?;

    let completed_courses: i64 = conn.query_row(
        "SELECT COUNT(*) FROM courses c WHERE
         (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) > 0
         AND (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 0) = 0",
        [],
        |row| row.get(0),
    )?;

    let in_progress_courses: i64 = conn.query_row(
        "SELECT COUNT(*) FROM courses c WHERE
         (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) > 0
         AND (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 0) > 0",
        [],
        |row| row.get(0),
    )?;

    // Current streak: count consecutive days from today backwards in activity_log
    let today = &chrono_now()[..10];
    let mut streak: i64 = 0;

    // Get all activity dates in descending order
    let mut stmt = conn.prepare(
        "SELECT date FROM activity_log ORDER BY date DESC",
    )?;
    let dates: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    if !dates.is_empty() {
        // Parse today's date
        let today_days = date_to_days(today);
        let mut expected_days = today_days;

        for date_str in &dates {
            let d = date_to_days(date_str);
            if d == expected_days {
                streak += 1;
                expected_days -= 1;
            } else if d < expected_days {
                break;
            }
        }
    }

    // Week activity: fetch all active dates in the last 7 days in one query
    let today_days = date_to_days(today);
    let week_start = days_to_date(today_days - 6);
    let mut week_stmt = conn.prepare(
        "SELECT date FROM activity_log WHERE date >= ?1 AND date <= ?2",
    )?;
    let active_dates: std::collections::HashSet<String> = week_stmt
        .query_map(params![week_start, today], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    let mut week_activity = vec![false; 7];
    for i in 0..7usize {
        let target_date = days_to_date(today_days - (6 - i as i64));
        week_activity[i] = active_dates.contains(&target_date);
    }

    let (user_level, lessons_to_next_level) = calculate_level(completed_lessons);

    Ok(DashboardStats {
        total_courses,
        completed_courses,
        in_progress_courses,
        total_lessons,
        completed_lessons,
        total_watch_time_mins,
        total_notes,
        current_streak: streak,
        week_activity,
        user_level,
        lessons_to_next_level,
    })
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CourseProgress {
    pub id: i64,
    pub title: String,
    pub accent_color: String,
    pub category: String,
    pub total_lessons: i64,
    pub completed_lessons: i64,
    pub total_duration_mins: i64,
    pub completed_duration_mins: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityDay {
    pub date: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBreakdown {
    pub category: String,
    pub count: i64,
    pub completed: i64,
    pub total_lessons: i64,
    pub completed_lessons: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressData {
    pub stats: DashboardStats,
    pub courses: Vec<CourseProgress>,
    pub activity_days: Vec<ActivityDay>,
    pub categories: Vec<CategoryBreakdown>,
    pub longest_streak: i64,
}

pub fn get_progress_data(conn: &Connection) -> SqlResult<ProgressData> {
    let stats = get_dashboard_stats(conn)?;

    // Per-course progress
    let mut stmt = conn.prepare(
        "SELECT c.id, c.title, c.accent_color, c.category,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total,
                (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) as completed,
                (SELECT COALESCE(SUM(l.duration), 0) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total_dur,
                (SELECT COALESCE(SUM(l.duration), 0) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 1) as comp_dur
         FROM courses c ORDER BY c.title",
    )?;
    let courses: Vec<CourseProgress> = stmt
        .query_map([], |row| {
            Ok(CourseProgress {
                id: row.get(0)?,
                title: row.get(1)?,
                accent_color: row.get(2)?,
                category: row.get(3)?,
                total_lessons: row.get(4)?,
                completed_lessons: row.get(5)?,
                total_duration_mins: row.get(6)?,
                completed_duration_mins: row.get(7)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    // Activity history (all dates)
    let mut stmt = conn.prepare("SELECT date FROM activity_log ORDER BY date")?;
    let activity_days: Vec<ActivityDay> = stmt
        .query_map([], |row| {
            Ok(ActivityDay { date: row.get(0)? })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    // Category breakdown — single query using GROUP BY
    let mut cat_stmt = conn.prepare(
        "SELECT c.category,
                COUNT(DISTINCT c.id) as course_count,
                COALESCE(SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END), 0) as total_lessons,
                COALESCE(SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END), 0) as completed_lessons
         FROM courses c
         LEFT JOIN sections s ON s.course_id = c.id
         LEFT JOIN lessons l ON l.section_id = s.id
         GROUP BY c.category
         ORDER BY COUNT(DISTINCT c.id) DESC",
    )?;
    let cat_rows: Vec<(String, i64, i64, i64)> = cat_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
        .collect::<SqlResult<Vec<_>>>()?;

    // Count completed courses per category in one additional query
    let mut comp_stmt = conn.prepare(
        "SELECT c.category, COUNT(*) FROM courses c
         WHERE (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) > 0
           AND (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id AND l.completed = 0) = 0
         GROUP BY c.category",
    )?;
    let completed_per_cat: std::collections::HashMap<String, i64> = comp_stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?
        .filter_map(|r| r.ok())
        .collect();

    let categories: Vec<CategoryBreakdown> = cat_rows
        .into_iter()
        .map(|(cat, count, total_lessons, completed_lessons)| {
            let completed = completed_per_cat.get(&cat).copied().unwrap_or(0);
            CategoryBreakdown {
                category: cat,
                count,
                completed,
                total_lessons,
                completed_lessons,
            }
        })
        .collect();

    // Longest streak
    let mut longest_streak: i64 = 0;
    let mut current_run: i64 = 0;
    let mut prev_days: Option<i64> = None;
    let mut streak_stmt = conn.prepare("SELECT date FROM activity_log ORDER BY date")?;
    let dates: Vec<String> = streak_stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    for d in &dates {
        let day = date_to_days(d);
        match prev_days {
            Some(p) if day == p + 1 => current_run += 1,
            _ => current_run = 1,
        }
        if current_run > longest_streak {
            longest_streak = current_run;
        }
        prev_days = Some(day);
    }

    Ok(ProgressData {
        stats,
        courses,
        activity_days,
        categories,
        longest_streak,
    })
}

// --- Custom Categories ---

pub fn get_custom_categories(conn: &Connection) -> SqlResult<Vec<String>> {
    let mut stmt = conn.prepare("SELECT name FROM custom_categories ORDER BY name")?;
    let names = stmt
        .query_map([], |row| row.get(0))?
        .collect::<SqlResult<Vec<String>>>()?;
    Ok(names)
}

pub fn add_custom_category(conn: &Connection, name: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO custom_categories (name) VALUES (?1)",
        params![name],
    )?;
    Ok(())
}

pub fn delete_custom_category(conn: &Connection, name: &str) -> SqlResult<()> {
    conn.execute(
        "DELETE FROM custom_categories WHERE name = ?1",
        params![name],
    )?;
    Ok(())
}

// --- Helpers ---

fn chrono_now() -> String {
    // Simple ISO 8601 timestamp without external crate
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or(std::time::Duration::ZERO)
        .as_secs();

    // Format as ISO 8601 manually
    let secs_per_day = 86400u64;
    let days = now / secs_per_day;
    let time_of_day = now % secs_per_day;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since epoch to date (simplified)
    let mut y = 1970i64;
    let mut remaining_days = days as i64;

    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0usize;
    for (i, &d) in month_days.iter().enumerate() {
        if remaining_days < d {
            m = i;
            break;
        }
        remaining_days -= d;
    }

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        y,
        m + 1,
        remaining_days + 1,
        hours,
        minutes,
        seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Convert "YYYY-MM-DD" to days since epoch (for streak calculation)
fn date_to_days(date: &str) -> i64 {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return 0;
    }
    let y: i64 = parts[0].parse().unwrap_or(1970);
    let m: usize = parts[1].parse().unwrap_or(1);
    let d: i64 = parts[2].parse().unwrap_or(1);

    let mut days: i64 = 0;
    for year in 1970..y {
        days += if is_leap(year) { 366 } else { 365 };
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    for i in 0..(m.saturating_sub(1)) {
        days += month_days[i] as i64;
    }
    days += d - 1;
    days
}

/// Convert days since epoch back to "YYYY-MM-DD"
fn days_to_date(mut days: i64) -> String {
    let mut y = 1970i64;
    loop {
        let dy = if is_leap(y) { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 0usize;
    for (i, &md) in month_days.iter().enumerate() {
        if days < md as i64 {
            m = i;
            break;
        }
        days -= md as i64;
    }
    format!("{:04}-{:02}-{:02}", y, m + 1, days + 1)
}

// --- Data management ---

pub fn delete_all_data(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "
        DELETE FROM notes;
        DELETE FROM subtitles;
        DELETE FROM resources;
        DELETE FROM favorites;
        DELETE FROM bookmarks;
        DELETE FROM lessons;
        DELETE FROM sections;
        DELETE FROM courses;
        DELETE FROM activity_log;
        DELETE FROM settings;
        ",
    )?;
    Ok(())
}

// --- Settings ---

pub fn get_all_settings(conn: &Connection) -> SqlResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    rows.collect()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub total_courses: i64,
    pub total_sections: i64,
    pub total_lessons: i64,
    pub total_notes: i64,
    pub total_bookmarks: i64,
    pub total_favorites: i64,
    pub db_path: String,
}

pub fn get_library_stats(conn: &Connection, db_path: &str) -> SqlResult<LibraryStats> {
    let (total_courses, total_sections, total_lessons, total_notes, total_bookmarks, total_favorites): (i64, i64, i64, i64, i64, i64) =
        conn.query_row(
            "SELECT
                (SELECT COUNT(*) FROM courses),
                (SELECT COUNT(*) FROM sections),
                (SELECT COUNT(*) FROM lessons),
                (SELECT COUNT(*) FROM notes),
                (SELECT COUNT(*) FROM bookmarks),
                (SELECT COUNT(*) FROM favorites)",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )?;
    Ok(LibraryStats {
        total_courses,
        total_sections,
        total_lessons,
        total_notes,
        total_bookmarks,
        total_favorites,
        db_path: db_path.to_string(),
    })
}

pub fn search_content(conn: &Connection, query: &str) -> SqlResult<Vec<SearchResult>> {
    let pattern = format!("%{}%", query.to_lowercase());
    let mut results: Vec<SearchResult> = Vec::new();

    // Search courses
    let mut stmt = conn.prepare(
        "SELECT id, title, accent_color FROM courses
         WHERE LOWER(title) LIKE ?1
         ORDER BY updated_at DESC
         LIMIT 5",
    )?;
    let course_rows = stmt.query_map(params![pattern], |row| {
        Ok(SearchResult {
            kind: "course".to_string(),
            course_id: row.get(0)?,
            course_title: row.get(1)?,
            accent_color: row.get(2)?,
            lesson_id: None,
            lesson_title: None,
        })
    })?;
    for r in course_rows {
        results.push(r?);
    }

    // Search lessons
    let mut stmt = conn.prepare(
        "SELECT l.id, l.title, s.course_id, c.title, c.accent_color
         FROM lessons l
         JOIN sections s ON l.section_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE LOWER(l.title) LIKE ?1
         ORDER BY c.updated_at DESC
         LIMIT 10",
    )?;
    let lesson_rows = stmt.query_map(params![pattern], |row| {
        Ok(SearchResult {
            kind: "lesson".to_string(),
            lesson_id: Some(row.get(0)?),
            lesson_title: Some(row.get(1)?),
            course_id: row.get(2)?,
            course_title: row.get(3)?,
            accent_color: row.get(4)?,
        })
    })?;
    for r in lesson_rows {
        results.push(r?);
    }

    Ok(results)
}
