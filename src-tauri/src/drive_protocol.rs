//! `gdrive://` URI scheme — streams Google Drive videos with seeking.
//!
//! All the streaming smarts (block cache, in-flight de-dup, read-ahead) live in
//! [`crate::stream_cache`]; this module only knows how to talk to the Drive API:
//! file metadata for size/type, and `files.get?alt=media` with a Range header
//! for the bytes.

use std::sync::{Arc, OnceLock};

use percent_encoding::percent_decode_str;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};

use crate::stream_cache::{status_only, Engine, FetchFn};

pub const SCHEME: &str = "gdrive";

static ENGINE: Engine = Engine::new("gdrive");

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(reqwest::Client::new)
}

pub fn handle(
    _ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    tauri::async_runtime::spawn(async move {
        let response = serve(request).await;
        responder.respond(response);
    });
}

pub(crate) async fn serve(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let file_id = match decode_file_id(&request) {
        Some(id) if !id.is_empty() => id,
        _ => return status_only(StatusCode::BAD_REQUEST),
    };

    // Check auth up front: a lapsed token must surface as 401 so the frontend
    // can offer "Reconnect Google Drive" instead of a generic retry.
    let token = match crate::google::valid_access_token().await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[gdrive] UNAUTHORIZED: {e}");
            return status_only(StatusCode::UNAUTHORIZED);
        }
    };

    let meta = fetch_meta(file_id.clone(), token);
    let fetch: FetchFn = {
        let file_id = file_id.clone();
        Arc::new(move |start, end| Box::pin(fetch_block(file_id.clone(), start, end)))
    };
    ENGINE.serve(&file_id, &request, meta, fetch).await
}

/// File size and content type from the Drive metadata endpoint.
async fn fetch_meta(file_id: String, token: String) -> Result<(u64, String), String> {
    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{file_id}?fields=size,mimeType&supportsAllDrives=true"
    );
    let resp = client()
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("metadata {}", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let total: u64 = json
        .get("size")
        .and_then(|s| s.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let content_type = json
        .get("mimeType")
        .and_then(|s| s.as_str())
        .filter(|m| m.starts_with("video/"))
        .unwrap_or("video/mp4")
        .to_string();
    Ok((total, content_type))
}

/// One block's bytes. Refreshes the access token itself so background read-ahead
/// keeps working across a token expiry.
async fn fetch_block(file_id: String, start: u64, end: u64) -> Result<Vec<u8>, String> {
    let token = crate::google::valid_access_token().await?;
    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
    );
    let resp = client()
        .get(&url)
        .bearer_auth(&token)
        .header(header::RANGE, format!("bytes={start}-{end}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("block {}", resp.status()));
    }
    Ok(resp.bytes().await.map_err(|e| e.to_string())?.to_vec())
}

fn decode_file_id(request: &Request<Vec<u8>>) -> Option<String> {
    let raw = request.uri().path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    Some(decoded.into_owned())
}
