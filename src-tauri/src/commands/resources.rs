use tauri::ipc::Response;
use tauri_plugin_opener::OpenerExt;

use crate::db::{self, DbState};

/// Resources larger than this are refused rather than loaded into memory.
/// Course PDFs are typically a few MB; this only guards against a mislabelled
/// multi-GB file freezing the app.
const MAX_RESOURCE_BYTES: u64 = 256 * 1024 * 1024;

/// Read a resource's bytes so the frontend can render it in-app (e.g. PDFs).
///
/// Takes the resource id rather than a path, so the webview can only read files
/// that were imported as part of a course. Works for every source: local files,
/// saved servers (`srv:`) and Google Drive (`gdrive:`). The bytes are returned as
/// a raw IPC response, which arrives in JS as an `ArrayBuffer` without JSON
/// encoding.
#[tauri::command]
pub async fn read_resource(
    state: tauri::State<'_, DbState>,
    resource_id: i64,
) -> Result<Response, String> {
    let path = resource_path(&state, resource_id)?;

    let bytes = if let Some(file_id) = path.strip_prefix("gdrive:") {
        crate::google::fetch_file_bytes(file_id.to_string(), MAX_RESOURCE_BYTES).await?
    } else if let Some((server_id, remote_path)) = crate::remote::split_uri(&path) {
        let size_path = remote_path.clone();
        let size = crate::remote::with_backend(&server_id, move |b| {
            let p = size_path.clone();
            async move { b.size_of(&p).await }
        })
        .await?;
        ensure_size(size)?;
        crate::remote::read_uri(&path).await?
    } else {
        tauri::async_runtime::spawn_blocking(move || read_local(&path))
            .await
            .map_err(|e| e.to_string())??
    };

    ensure_size(bytes.len() as u64)?;
    Ok(Response::new(bytes))
}

/// Open a local resource in the system's default app.
///
/// Like `read_resource`, this takes an id so the webview never needs a broad
/// filesystem scope on the opener plugin — only imported files can be opened.
#[tauri::command]
pub fn open_resource(
    app: tauri::AppHandle,
    state: tauri::State<'_, DbState>,
    resource_id: i64,
) -> Result<(), String> {
    let path = resource_path(&state, resource_id)?;
    if path.starts_with("gdrive:") || crate::remote::split_uri(&path).is_some() {
        return Err("Remote resources can't be opened in another app".to_string());
    }
    if !std::path::Path::new(&path).is_file() {
        return Err("The file may have been moved or deleted".to_string());
    }
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("No app could open this file: {e}"))
}

fn resource_path(state: &DbState, resource_id: i64) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_resource_path(&conn, resource_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Resource {resource_id} not found"))
}

fn read_local(path: &str) -> Result<Vec<u8>, String> {
    let meta = std::fs::metadata(path)
        .map_err(|e| format!("The file may have been moved or deleted: {e}"))?;
    if !meta.is_file() {
        return Err("Resource is not a file".to_string());
    }
    ensure_size(meta.len())?;
    std::fs::read(path).map_err(|e| format!("Failed to read resource: {e}"))
}

fn ensure_size(size: u64) -> Result<(), String> {
    if size > MAX_RESOURCE_BYTES {
        return Err(format!(
            "Resource is too large to open in the app ({} MB)",
            size / (1024 * 1024)
        ));
    }
    Ok(())
}
