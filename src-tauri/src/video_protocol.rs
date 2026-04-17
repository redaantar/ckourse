use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use tauri::http::{header, HeaderValue, Method, Request, Response, StatusCode};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};

pub const SCHEME: &str = "stream";

pub fn handle(
    _ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    tauri::async_runtime::spawn_blocking(move || {
        let response = serve(&request);
        responder.respond(response);
    });
}

fn serve(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = match decode_path(request) {
        Some(p) => p,
        None => return status_only(StatusCode::BAD_REQUEST),
    };

    if !path.is_file() {
        return status_only(StatusCode::NOT_FOUND);
    }

    let mut file = match fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => return status_only(StatusCode::NOT_FOUND),
    };

    let file_size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return status_only(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mime = guess_mime(&path);

    if request.method() == Method::HEAD {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CONTENT_LENGTH, file_size.to_string())
            .header(header::ACCEPT_RANGES, "bytes")
            .body(Vec::new())
            .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR));
    }

    if let Some(range_header) = request.headers().get(header::RANGE) {
        return match parse_range(range_header, file_size) {
            Some((start, end)) => serve_range(&mut file, start, end, file_size, mime),
            None => Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{}", file_size))
                .body(Vec::new())
                .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR)),
        };
    }

    let mut buf = Vec::with_capacity(file_size as usize);
    if file.read_to_end(&mut buf).is_err() {
        return status_only(StatusCode::INTERNAL_SERVER_ERROR);
    }
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .body(buf)
        .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR))
}

fn serve_range(
    file: &mut fs::File,
    start: u64,
    end: u64,
    file_size: u64,
    mime: &'static str,
) -> Response<Vec<u8>> {
    let length = end - start + 1;
    let mut buf = vec![0u8; length as usize];
    if file.seek(SeekFrom::Start(start)).is_err() {
        return status_only(StatusCode::INTERNAL_SERVER_ERROR);
    }
    if file.read_exact(&mut buf).is_err() {
        return status_only(StatusCode::INTERNAL_SERVER_ERROR);
    }
    Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, length.to_string())
        .header(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{}", start, end, file_size),
        )
        .header(header::ACCEPT_RANGES, "bytes")
        .body(buf)
        .unwrap_or_else(|_| status_only(StatusCode::INTERNAL_SERVER_ERROR))
}

fn decode_path(request: &Request<Vec<u8>>) -> Option<PathBuf> {
    let uri = request.uri();
    let raw = uri.path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    let as_str = decoded.as_ref();
    if as_str.starts_with('/') {
        Some(PathBuf::from(as_str))
    } else {
        Some(PathBuf::from(format!("/{}", as_str)))
    }
}

fn parse_range(header_value: &HeaderValue, file_size: u64) -> Option<(u64, u64)> {
    let s = header_value.to_str().ok()?;
    let s = s.strip_prefix("bytes=")?;
    let (a, b) = s.split_once('-')?;

    if a.is_empty() {
        let suffix: u64 = b.parse().ok()?;
        if suffix == 0 || suffix > file_size {
            return None;
        }
        return Some((file_size - suffix, file_size - 1));
    }

    let start: u64 = a.parse().ok()?;
    let end: u64 = if b.is_empty() {
        file_size.checked_sub(1)?
    } else {
        b.parse().ok()?
    };
    if start > end || end >= file_size {
        return None;
    }
    Some((start, end))
}

fn guess_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("mp4") | Some("m4v") => "video/mp4",
        Some("mov") => "video/quicktime",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        Some("ogg") | Some("ogv") => "video/ogg",
        _ => "application/octet-stream",
    }
}

fn status_only(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("status-only response")
}
