use crate::google;
use tauri::AppHandle;

// --- Bring-your-own credentials ---

#[tauri::command]
pub fn drive_set_credentials(
    client_id: String,
    client_secret: String,
    api_key: String,
) -> Result<(), String> {
    google::set_credentials(client_id, client_secret, api_key)
}

#[tauri::command]
pub fn drive_credentials_status() -> Result<bool, String> {
    google::credentials_status()
}

#[tauri::command]
pub fn drive_clear_credentials() -> Result<(), String> {
    // Tokens are tied to these credentials — drop both.
    let _ = google::disconnect();
    google::clear_credentials()
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
