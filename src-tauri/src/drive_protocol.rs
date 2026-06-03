//! `gdrive://` URI scheme — streams Google Drive videos with seeking.
//!
//! The <video> element parses the MP4 container with many tiny range requests
//! (especially when `moov` is at the end of a non-faststart file). Hitting Drive
//! for each one is far too slow (a network round-trip per request → stalls), so
//! we serve from a **read-ahead block cache**: requests are satisfied from aligned
//! 2 MB blocks fetched from Drive on demand. Hundreds of tiny player reads collapse
//! into a couple of Drive fetches, and seeking only pulls the blocks it touches —
//! we never download the whole file up front.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use percent_encoding::percent_decode_str;
use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};

pub const SCHEME: &str = "gdrive";

/// Cache/fetch granularity.
const BLOCK: u64 = 2 * 1024 * 1024;
/// How many bytes to hand the player for an open-ended (`bytes=N-`) request.
const OPEN_ENDED_DELIVER: u64 = 4 * 1024 * 1024;

/// Single-file read-ahead cache (the player streams one video at a time; a new
/// file id resets the cache, bounding memory to the current video's touched blocks).
struct FileCache {
    file_id: String,
    total: u64,
    content_type: String,
    blocks: HashMap<u64, Arc<Vec<u8>>>,
}

static CACHE: OnceLock<Mutex<Option<FileCache>>> = OnceLock::new();
fn cache_cell() -> &'static Mutex<Option<FileCache>> {
    CACHE.get_or_init(|| Mutex::new(None))
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

async fn serve(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let file_id = match decode_file_id(&request) {
        Some(id) if !id.is_empty() => id,
        _ => return status_only(StatusCode::BAD_REQUEST),
    };

    let token = match crate::google::valid_access_token().await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[gdrive] UNAUTHORIZED: {e}");
            return status_only(StatusCode::UNAUTHORIZED);
        }
    };

    let client = reqwest::Client::new();
    let (total, content_type) = match ensure_meta(&client, &token, &file_id).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[gdrive] meta error: {e}");
            return status_only(StatusCode::BAD_GATEWAY);
        }
    };

    if request.method() == Method::HEAD {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, total.to_string())
            .header(header::ACCEPT_RANGES, "bytes")
            .body(Vec::new())
            .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR));
    }

    if total == 0 {
        return status_only(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let (start, end_opt) = parse_req_range(&request);
    if start >= total {
        return Response::builder()
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(header::CONTENT_RANGE, format!("bytes */{total}"))
            .body(Vec::new())
            .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR));
    }
    let end = end_opt
        .unwrap_or(start + OPEN_ENDED_DELIVER - 1)
        .min(total - 1);

    // Assemble [start..=end] from cached blocks, fetching any that are missing.
    let mut body: Vec<u8> = Vec::with_capacity((end - start + 1) as usize);
    let mut pos = start;
    while pos <= end {
        let block_idx = pos / BLOCK;
        let block = match get_block(&client, &token, &file_id, block_idx, total).await {
            Ok(b) => b,
            Err(e) => {
                eprintln!("[gdrive] block {block_idx} fetch error: {e}");
                return status_only(StatusCode::BAD_GATEWAY);
            }
        };
        let block_start = block_idx * BLOCK;
        let block_end_global = block_start + block.len() as u64; // exclusive
        if pos >= block_end_global {
            break; // safety: short final block
        }
        let off = (pos - block_start) as usize;
        let copy_end = (end + 1).min(block_end_global); // exclusive
        let len = (copy_end - pos) as usize;
        body.extend_from_slice(&block[off..off + len]);
        pos = copy_end;
    }

    if body.is_empty() {
        return status_only(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let actual_end = start + body.len() as u64 - 1;

    Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, body.len().to_string())
        .header(
            header::CONTENT_RANGE,
            format!("bytes {start}-{actual_end}/{total}"),
        )
        .body(body)
        .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR))
}

/// Ensure the cache holds metadata (total size + content type) for `file_id`,
/// resetting it if a different file starts streaming. Returns (total, content_type).
async fn ensure_meta(
    client: &reqwest::Client,
    token: &str,
    file_id: &str,
) -> Result<(u64, String), String> {
    {
        let guard = cache_cell().lock().map_err(|e| e.to_string())?;
        if let Some(c) = guard.as_ref() {
            if c.file_id == file_id {
                return Ok((c.total, c.content_type.clone()));
            }
        }
    }

    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{file_id}?fields=size,mimeType&supportsAllDrives=true"
    );
    let resp = client
        .get(&url)
        .bearer_auth(token)
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

    eprintln!("[gdrive] meta id={file_id} total={total} type={content_type}");

    let mut guard = cache_cell().lock().map_err(|e| e.to_string())?;
    *guard = Some(FileCache {
        file_id: file_id.to_string(),
        total,
        content_type: content_type.clone(),
        blocks: HashMap::new(),
    });
    Ok((total, content_type))
}

/// Return a cached block, fetching it from Drive on a miss.
async fn get_block(
    client: &reqwest::Client,
    token: &str,
    file_id: &str,
    block_idx: u64,
    total: u64,
) -> Result<Arc<Vec<u8>>, String> {
    {
        let guard = cache_cell().lock().map_err(|e| e.to_string())?;
        if let Some(c) = guard.as_ref() {
            if c.file_id == file_id {
                if let Some(b) = c.blocks.get(&block_idx) {
                    return Ok(b.clone());
                }
            }
        }
    }

    let block_start = block_idx * BLOCK;
    let block_end = ((block_idx + 1) * BLOCK).min(total) - 1; // inclusive
    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
    );
    eprintln!("[gdrive] fetch block {block_idx} ({block_start}-{block_end})");
    let resp = client
        .get(&url)
        .bearer_auth(token)
        .header(header::RANGE, format!("bytes={block_start}-{block_end}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("block {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let arc = Arc::new(bytes);

    let mut guard = cache_cell().lock().map_err(|e| e.to_string())?;
    if let Some(c) = guard.as_mut() {
        if c.file_id == file_id {
            c.blocks.insert(block_idx, arc.clone());
        }
    }
    Ok(arc)
}

/// Parse the request's Range header into (start, optional end). Defaults to (0, None).
fn parse_req_range(request: &Request<Vec<u8>>) -> (u64, Option<u64>) {
    let raw = match request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
    {
        Some(s) => s,
        None => return (0, None),
    };
    let spec = match raw.strip_prefix("bytes=") {
        Some(s) => s,
        None => return (0, None),
    };
    let (a, b) = match spec.split_once('-') {
        Some(parts) => parts,
        None => return (0, None),
    };
    let start: u64 = a.trim().parse().unwrap_or(0);
    let end = b.trim();
    let end_opt = if end.is_empty() {
        None
    } else {
        end.parse::<u64>().ok()
    };
    (start, end_opt)
}

fn decode_file_id(request: &Request<Vec<u8>>) -> Option<String> {
    let raw = request.uri().path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    Some(decoded.into_owned())
}

fn status_only(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("status-only response")
}
