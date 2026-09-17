use tauri::ipc::Response;

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
    let path = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        db::get_resource_path(&conn, resource_id).map_err(|e| e.to_string())?
    }
    .ok_or_else(|| format!("Resource {resource_id} not found"))?;

    let bytes = if let Some(file_id) = path.strip_prefix("gdrive:") {
        crate::google::fetch_file_bytes(file_id.to_string()).await?
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
