use tauri::Manager;

use crate::db::{self, DbState};

#[tauri::command]
pub fn get_all_settings(state: tauri::State<'_, DbState>) -> Result<Vec<(String, String)>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_all_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(
    state: tauri::State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library_stats(
    state: tauri::State<'_, DbState>,
    app: tauri::AppHandle,
) -> Result<db::LibraryStats, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("ckourse.db");
    db::get_library_stats(&conn, &db_path.to_string_lossy()).map_err(|e| e.to_string())
}
