use crate::db::{self, DbState};
use crate::subtitle;

#[tauri::command]
pub fn toggle_lesson_completed(
    state: tauri::State<'_, DbState>,
    lesson_id: i64,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::toggle_lesson_completed(&conn, lesson_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_last_watched(
    state: tauri::State<'_, DbState>,
    course_id: i64,
    lesson_id: i64,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_last_watched(&conn, course_id, lesson_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_lesson_position(
    state: tauri::State<'_, DbState>,
    lesson_id: i64,
    position: f64,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::save_lesson_position(&conn, lesson_id, position).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_lesson_duration(
    state: tauri::State<'_, DbState>,
    lesson_id: i64,
    duration: i64,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_lesson_duration(&conn, lesson_id, duration).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_lesson_subtitles(
    state: tauri::State<'_, DbState>,
    lesson_id: i64,
) -> Result<Vec<db::Subtitle>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_lesson_subtitles(&conn, lesson_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_subtitle_vtt(path: String) -> Result<String, String> {
    subtitle::read_as_vtt(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_favorites(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::FavoriteLesson>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_all_favorites(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(
    state: tauri::State<'_, DbState>,
    lesson_id: i64,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::toggle_favorite(&conn, lesson_id).map_err(|e| e.to_string())
}
