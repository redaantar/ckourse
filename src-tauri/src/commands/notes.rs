use crate::db::{self, DbState};

#[tauri::command]
pub fn get_all_notes(state: tauri::State<'_, DbState>) -> Result<Vec<db::NoteWithCourse>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_all_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_course_notes(
    state: tauri::State<'_, DbState>,
    course_id: i64,
) -> Result<Vec<db::Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_course_notes(&conn, course_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_note(
    state: tauri::State<'_, DbState>,
    course_id: i64,
    lesson_id: i64,
    lesson_title: String,
    content: String,
) -> Result<db::Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::add_note(&conn, course_id, lesson_id, &lesson_title, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(
    state: tauri::State<'_, DbState>,
    note_id: i64,
    content: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_note(&conn, note_id, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: tauri::State<'_, DbState>, note_id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_note(&conn, note_id).map_err(|e| e.to_string())
}
