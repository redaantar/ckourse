//! `srv://` URI scheme — streams videos from a saved server with seeking.
//!
//! All the streaming smarts (block cache, in-flight de-dup, read-ahead) live in
//! [`crate::stream_cache`]; this module only resolves the `srv:<serverId>:<path>`
//! URI and reads ranges through the protocol-agnostic [`crate::remote`] backend.

use std::sync::Arc;

use percent_encoding::percent_decode_str;
use tauri::http::{Request, Response, StatusCode};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};

use crate::remote;
use crate::stream_cache::{status_only, Engine, FetchFn};

pub const SCHEME: &str = "srv";

static ENGINE: Engine = Engine::new("srv");

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
    let uri = match decode_uri(&request) {
        Some(u) if !u.is_empty() => u,
        _ => return status_only(StatusCode::BAD_REQUEST),
    };
    let Some((server_id, path)) = remote::split_uri(&uri) else {
        eprintln!("[srv] malformed uri: {uri}");
        return status_only(StatusCode::BAD_REQUEST);
    };

    let meta = fetch_meta(server_id.clone(), path.clone());
    let fetch: FetchFn = Arc::new(move |start, end| {
        Box::pin(fetch_block(server_id.clone(), path.clone(), start, end))
    });
    ENGINE.serve(&uri, &request, meta, fetch).await
}

async fn fetch_meta(server_id: String, path: String) -> Result<(u64, String), String> {
    let content_type = remote::guess_mime(&path).to_string();
    let total = remote::with_backend(&server_id, move |b| {
        let path = path.clone();
        async move { b.size_of(&path).await }
    })
    .await?;
    Ok((total, content_type))
}

async fn fetch_block(
    server_id: String,
    path: String,
    start: u64,
    end: u64,
) -> Result<Vec<u8>, String> {
    remote::with_backend(&server_id, move |b| {
        let path = path.clone();
        async move { b.read_range(&path, start, end).await }
    })
    .await
}

/// The frontend hands us `<serverId>:<path>` through `convertFileSrc`, which
/// percent-encodes the whole thing into a single path segment.
fn decode_uri(request: &Request<Vec<u8>>) -> Option<String> {
    let raw = request.uri().path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    Some(format!("{}{}", remote::URI_PREFIX, decoded))
}
