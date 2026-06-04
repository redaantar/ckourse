use crate::db::{self, DbState};
use crate::google;
use tauri::AppHandle;

const CREDS_FLAG: &str = "google_drive_creds_set";
const CREDS_CLIENT_ID: &str = "google_drive_client_id";
const CREDS_CLIENT_SECRET: &str = "google_drive_client_secret";
const CREDS_API_KEY: &str = "google_drive_api_key";

// --- Bring-your-own credentials ---

#[tauri::command]
pub fn drive_set_credentials(
    state: tauri::State<'_, DbState>,
    client_id: String,
    client_secret: String,
    api_key: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_CLIENT_ID, &client_id).map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_CLIENT_SECRET, &client_secret).map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_API_KEY, &api_key).map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_FLAG, "true").map_err(|e| e.to_string())?;
    drop(conn);
    google::init_credentials(client_id, client_secret, api_key);
    Ok(())
}

#[tauri::command]
pub fn drive_credentials_status(state: tauri::State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val = db::get_setting(&conn, CREDS_FLAG).map_err(|e| e.to_string())?;
    Ok(val.as_deref() == Some("true"))
}

#[tauri::command]
pub fn drive_clear_credentials(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let _ = google::disconnect();
    google::clear_credentials_cache();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_FLAG, "false").map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_CLIENT_ID, "").map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_CLIENT_SECRET, "").map_err(|e| e.to_string())?;
    db::set_setting(&conn, CREDS_API_KEY, "").map_err(|e| e.to_string())
}

// --- Auth + folder selection ---

#[tauri::command]
pub async fn drive_connect(app: AppHandle) -> Result<google::AuthStatus, String> {
    google::connect(app).await
}

#[tauri::command]
pub async fn drive_access_token() -> Result<String, String> {
    google::valid_access_token().await
}

#[tauri::command]
pub async fn drive_pick_folder(app: AppHandle) -> Result<google::PickedFolder, String> {
    google::pick_folder(app).await
}

#[tauri::command]
pub async fn parse_drive_folder(
    folder_id: String,
    folder_name: String,
) -> Result<crate::parser::ParsedCourse, String> {
    google::parse_drive_folder(folder_id, folder_name).await
}

#[tauri::command]
pub fn drive_auth_status() -> Result<google::AuthStatus, String> {
    google::status()
}

#[tauri::command]
pub fn drive_disconnect() -> Result<(), String> {
    google::disconnect()
}
