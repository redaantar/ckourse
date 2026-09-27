//! Loopback HTTP server that feeds the video player on Linux.
//!
//! WebKitGTK hands `<video>` loading to GStreamer, which only fetches media
//! over http(s), file and blob URLs. Sources on our custom URI schemes
//! (`stream://`, `gdrive://`, `srv://`) are rejected with
//! MEDIA_ERR_SRC_NOT_SUPPORTED before a single byte is decoded, whatever the
//! codec (<https://bugs.webkit.org/show_bug.cgi?id=146351>). So on Linux the
//! player loads the same sources from this server instead:
//!
//! `http://127.0.0.1:<port>/<token>/<scheme>/<percent-encoded path>`
//!
//! The path segment after the scheme is exactly what `convertFileSrc` would
//! put after `<scheme>://localhost/`, so each request is answered by the
//! existing protocol handler for that scheme. The random per-launch token
//! keeps other local processes and web pages from reading files through it.

use std::sync::OnceLock;

static BASE_URL: OnceLock<String> = OnceLock::new();

/// Base URL of the media server, or `None` when the webview plays custom
/// schemes natively (macOS, Windows) or the server failed to start.
#[tauri::command]
pub fn media_server_url() -> Option<String> {
    BASE_URL.get().cloned()
}

#[cfg(target_os = "linux")]
pub use server::start;

#[cfg(target_os = "linux")]
mod server {
    use std::fs::File;
    use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write};
    use std::net::{TcpListener, TcpStream};
    use std::time::Duration;

    use tauri::http::{header, Method, Request, Response, StatusCode};

    use super::BASE_URL;
    use crate::{drive_protocol, remote_protocol, video_protocol};

    /// Largest request head we accept; the player's are a few hundred bytes.
    const MAX_HEAD: u64 = 16 * 1024;

    /// Binds an ephemeral loopback port and serves requests on background
    /// threads. On failure the player falls back to the custom schemes.
    pub fn start() {
        let listener = match TcpListener::bind("127.0.0.1:0") {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[media] failed to start server: {e}");
                return;
            }
        };
        let port = match listener.local_addr() {
            Ok(addr) => addr.port(),
            Err(e) => {
                eprintln!("[media] failed to read server address: {e}");
                return;
            }
        };
        let token = random_token();
        let _ = BASE_URL.set(format!("http://127.0.0.1:{port}/{token}"));

        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let token = token.clone();
                // One thread per connection: the media stack keeps a
                // long-lived body stream open while it probes and seeks with
                // others.
                std::thread::spawn(move || handle(stream, &token));
            }
        });
    }

    fn random_token() -> String {
        let mut buf = [0u8; 16];
        getrandom::getrandom(&mut buf).expect("system RNG unavailable");
        buf.iter().map(|b| format!("{b:02x}")).collect()
    }

    /// Constant-time, so response timing doesn't leak the token.
    fn same_token(a: &str, b: &str) -> bool {
        a.len() == b.len()
            && a.bytes()
                .zip(b.bytes())
                .fold(0, |acc, (x, y)| acc | (x ^ y))
                == 0
    }

    struct RequestHead {
        method: String,
        target: String,
        range: Option<String>,
    }

    /// Reads the request line and headers. Bodies are never needed: the player
    /// only sends GET and HEAD.
    fn read_head(stream: &TcpStream) -> Option<RequestHead> {
        // Only the head has a deadline: once the body is flowing, the player
        // may stop reading for minutes while it's paused.
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .ok()?;
        let mut reader = BufReader::new(stream.take(MAX_HEAD));
        let mut line = String::new();
        reader.read_line(&mut line).ok()?;
        let mut parts = line.split_whitespace();
        let method = parts.next()?.to_string();
        let target = parts.next()?.to_string();

        let mut range = None;
        loop {
            line.clear();
            if reader.read_line(&mut line).ok()? == 0 {
                return None;
            }
            let l = line.trim_end();
            if l.is_empty() {
                break;
            }
            if let Some((name, value)) = l.split_once(':') {
                if name.trim().eq_ignore_ascii_case("range") {
                    range = Some(value.trim().to_string());
                }
            }
        }
        Some(RequestHead {
            method,
            target,
            range,
        })
    }

    fn handle(stream: TcpStream, token: &str) {
        let Some(head) = read_head(&stream) else {
            return respond_status(stream, 400);
        };
        let mut parts = head.target.trim_start_matches('/').splitn(3, '/');
        let (Some(t), Some(scheme), Some(rest)) = (parts.next(), parts.next(), parts.next()) else {
            return respond_status(stream, 404);
        };
        if !same_token(t, token) {
            return respond_status(stream, 404);
        }

        let method = match head.method.as_str() {
            "GET" => Method::GET,
            "HEAD" => Method::HEAD,
            _ => return respond_status(stream, 405),
        };
        let uri = format!("{scheme}://localhost/{rest}");

        match scheme {
            video_protocol::SCHEME => {
                let Some(proxied) = build_request(&uri, method, head.range.as_deref()) else {
                    return respond_status(stream, 400);
                };
                serve_file(stream, &proxied);
            }
            drive_protocol::SCHEME | remote_protocol::SCHEME => {
                serve_remote(stream, scheme, &uri, method, head.range);
            }
            _ => respond_status(stream, 404),
        }
    }

    fn build_request(uri: &str, method: Method, range: Option<&str>) -> Option<Request<Vec<u8>>> {
        let mut builder = Request::builder().method(method).uri(uri);
        if let Some(r) = range {
            builder = builder.header(header::RANGE, r);
        }
        builder.body(Vec::new()).ok()
    }

    /// Local files stream straight from disk, so a request without a Range
    /// header doesn't read the whole video into memory first.
    fn serve_file(stream: TcpStream, proxied: &Request<Vec<u8>>) {
        let Some(path) = video_protocol::decode_path(proxied) else {
            return respond_status(stream, 400);
        };
        if !path.is_file() {
            return respond_status(stream, 404);
        }
        let Ok(mut file) = File::open(&path) else {
            return respond_status(stream, 404);
        };
        let Ok(size) = file.metadata().map(|m| m.len()) else {
            return respond_status(stream, 500);
        };

        let mut headers = vec![
            (
                "Content-Type".to_string(),
                video_protocol::guess_mime(&path).to_string(),
            ),
            ("Accept-Ranges".to_string(), "bytes".to_string()),
        ];
        let (status, start, len) = match proxied.headers().get(header::RANGE) {
            None => (200, 0, size),
            Some(value) => match video_protocol::parse_range(value, size) {
                Some((start, end)) => {
                    headers.push((
                        "Content-Range".to_string(),
                        format!("bytes {start}-{end}/{size}"),
                    ));
                    (206, start, end - start + 1)
                }
                None => {
                    let unsatisfiable =
                        vec![("Content-Range".to_string(), format!("bytes */{size}"))];
                    return respond(stream, 416, &unsatisfiable, io::empty(), 0, false);
                }
            },
        };
        if file.seek(SeekFrom::Start(start)).is_err() {
            return respond_status(stream, 500);
        }
        let head_only = proxied.method() == Method::HEAD;
        respond(stream, status, &headers, file.take(len), len, head_only);
    }

    /// Drive and server lessons go through their protocol handlers, which
    /// answer open-ended ranges with one capped chunk. WebKit's custom-scheme
    /// loader asks again for the rest, but its HTTP loader takes a short body
    /// as the end of the file, so here we keep pulling chunks until the span
    /// the player asked for is complete.
    fn serve_remote(
        stream: TcpStream,
        scheme: &str,
        uri: &str,
        method: Method,
        mut range: Option<String>,
    ) {
        // The handlers don't understand suffix ranges (`bytes=-N`), so turn
        // them into an open-ended range from the file size.
        if let Some(suffix) = range.as_deref().and_then(|r| r.strip_prefix("bytes=-")) {
            let Ok(n) = suffix.parse::<u64>() else {
                return respond_status(stream, 416);
            };
            let meta = call_remote(scheme, uri, Method::HEAD, None);
            let Some(total) = content_length(&meta) else {
                return send(stream, meta, true);
            };
            if n == 0 || total == 0 {
                let unsatisfiable = vec![("Content-Range".to_string(), format!("bytes */{total}"))];
                return respond(stream, 416, &unsatisfiable, io::empty(), 0, false);
            }
            range = Some(format!("bytes={}-", total.saturating_sub(n)));
        }

        let explicit_end = range
            .as_deref()
            .and_then(|r| r.strip_prefix("bytes="))
            .and_then(|r| r.split_once('-'))
            .is_some_and(|(a, b)| !a.is_empty() && !b.is_empty());
        let first = call_remote(scheme, uri, method.clone(), range.as_deref());
        // HEAD, errors and fully-specified ranges are complete as they are.
        if method == Method::HEAD || explicit_end || first.status() != StatusCode::PARTIAL_CONTENT {
            return send(stream, first, method == Method::HEAD);
        }

        let Some((start, total)) = first
            .headers()
            .get(header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(parse_content_range)
        else {
            return send(stream, first, false);
        };
        let end = total - 1;
        let len = end - start + 1;

        let mut headers = vec![("Accept-Ranges".to_string(), "bytes".to_string())];
        if let Some(ct) = first
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
        {
            headers.push(("Content-Type".to_string(), ct.to_string()));
        }
        let status = if range.is_some() {
            headers.push((
                "Content-Range".to_string(),
                format!("bytes {start}-{end}/{total}"),
            ));
            206
        } else {
            200
        };

        let first_chunk = first.into_body();
        let scheme = scheme.to_string();
        let uri = uri.to_string();
        let body = RangeReader {
            pos: start + first_chunk.len() as u64,
            end,
            buf: first_chunk,
            off: 0,
            fetch: move |pos: u64| {
                let r = call_remote(&scheme, &uri, Method::GET, Some(&format!("bytes={pos}-")));
                if r.status() == StatusCode::PARTIAL_CONTENT && !r.body().is_empty() {
                    Ok(r.into_body())
                } else {
                    Err(io::Error::other(format!("chunk at {pos}: {}", r.status())))
                }
            },
        };
        respond(stream, status, &headers, body, len, false);
    }

    fn call_remote(
        scheme: &str,
        uri: &str,
        method: Method,
        range: Option<&str>,
    ) -> Response<Vec<u8>> {
        let Some(req) = build_request(uri, method, range) else {
            return crate::stream_cache::status_only(StatusCode::BAD_REQUEST);
        };
        if scheme == drive_protocol::SCHEME {
            tauri::async_runtime::block_on(drive_protocol::serve(req))
        } else {
            tauri::async_runtime::block_on(remote_protocol::serve(req))
        }
    }

    fn content_length(response: &Response<Vec<u8>>) -> Option<u64> {
        if !response.status().is_success() {
            return None;
        }
        response
            .headers()
            .get(header::CONTENT_LENGTH)?
            .to_str()
            .ok()?
            .parse()
            .ok()
    }

    /// `bytes <start>-<end>/<total>` → `(start, total)`.
    fn parse_content_range(value: &str) -> Option<(u64, u64)> {
        let (span, total) = value.strip_prefix("bytes ")?.split_once('/')?;
        let (start, _) = span.split_once('-')?;
        Some((start.parse().ok()?, total.parse().ok()?))
    }

    /// Yields `buf`, then keeps calling `fetch(pos)` for the next chunk until
    /// `end` (inclusive) has been read.
    struct RangeReader<F> {
        fetch: F,
        pos: u64,
        end: u64,
        buf: Vec<u8>,
        off: usize,
    }

    impl<F: FnMut(u64) -> io::Result<Vec<u8>>> Read for RangeReader<F> {
        fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
            if self.off == self.buf.len() {
                if self.pos > self.end {
                    return Ok(0);
                }
                let mut chunk = (self.fetch)(self.pos)?;
                chunk.truncate((self.end - self.pos + 1) as usize);
                self.pos += chunk.len() as u64;
                self.buf = chunk;
                self.off = 0;
            }
            let n = out.len().min(self.buf.len() - self.off);
            out[..n].copy_from_slice(&self.buf[self.off..self.off + n]);
            self.off += n;
            Ok(n)
        }
    }

    /// Relays a protocol handler's response. For HEAD the handler's own
    /// Content-Length (the file size) is kept, since its body is empty.
    fn send(stream: TcpStream, response: Response<Vec<u8>>, head_only: bool) {
        let status = response.status().as_u16();
        let len = match head_only {
            true => content_length(&response).unwrap_or(0),
            false => response.body().len() as u64,
        };
        let headers: Vec<(String, String)> = response
            .headers()
            .iter()
            .filter(|(name, _)| *name != header::CONTENT_LENGTH)
            .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_string())))
            .collect();
        let body = response.into_body();
        respond(
            stream,
            status,
            &headers,
            io::Cursor::new(body),
            len,
            head_only,
        );
    }

    fn respond_status(stream: TcpStream, status: u16) {
        respond(stream, status, &[], io::empty(), 0, false);
    }

    /// Writes one response and closes the connection. Always sending
    /// Content-Length lets the media stack know the file size (it won't seek
    /// without it). If the body comes up short — a remote chunk failed, or the
    /// player hung up to seek elsewhere — closing the socket is what tells the
    /// player the response is incomplete, so it can retry instead of waiting
    /// forever for the missing bytes.
    fn respond(
        mut stream: TcpStream,
        status: u16,
        headers: &[(String, String)],
        mut body: impl Read,
        len: u64,
        head_only: bool,
    ) {
        let reason = StatusCode::from_u16(status)
            .ok()
            .and_then(|s| s.canonical_reason())
            .unwrap_or("");
        let mut head =
            format!("HTTP/1.1 {status} {reason}\r\nContent-Length: {len}\r\nConnection: close\r\n");
        for (name, value) in headers {
            head.push_str(&format!("{name}: {value}\r\n"));
        }
        head.push_str("\r\n");
        if stream.write_all(head.as_bytes()).is_err() || head_only {
            return;
        }
        if let Err(e) = io::copy(&mut body, &mut stream) {
            // The player closing a stream it no longer needs is routine.
            if !matches!(
                e.kind(),
                io::ErrorKind::BrokenPipe | io::ErrorKind::ConnectionReset
            ) {
                eprintln!("[media] response cut short: {e}");
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// A remote that hands out at most `cap` bytes per call, like
        /// `stream_cache` does for open-ended ranges.
        fn capped_reader(
            data: Vec<u8>,
            start: u64,
            cap: usize,
        ) -> RangeReader<impl FnMut(u64) -> io::Result<Vec<u8>>> {
            let end = data.len() as u64 - 1;
            let chunk = move |pos: u64| {
                let from = pos as usize;
                Ok(data[from..(from + cap).min(data.len())].to_vec())
            };
            let fetch = chunk.clone();
            let first = fetch(start).unwrap();
            RangeReader {
                pos: start + first.len() as u64,
                end,
                buf: first,
                off: 0,
                fetch: chunk,
            }
        }

        #[test]
        fn stitches_capped_chunks_into_the_whole_span() {
            let data: Vec<u8> = (0..=255).cycle().take(10_000).collect();
            for start in [0, 1, 4_095, 9_999] {
                let mut out = Vec::new();
                capped_reader(data.clone(), start, 4_096)
                    .read_to_end(&mut out)
                    .unwrap();
                assert_eq!(out, data[start as usize..], "start {start}");
            }
        }

        #[test]
        fn a_failed_chunk_ends_the_stream_with_an_error() {
            let mut reader = RangeReader {
                pos: 4,
                end: 9,
                buf: vec![0; 4],
                off: 0,
                fetch: |_| Err(io::Error::other("offline")),
            };
            let mut out = Vec::new();
            assert!(reader.read_to_end(&mut out).is_err());
            assert_eq!(out.len(), 4);
        }

        #[test]
        fn parses_content_range() {
            assert_eq!(parse_content_range("bytes 0-99/1000"), Some((0, 1000)));
            assert_eq!(parse_content_range("bytes 500-999/1000"), Some((500, 1000)));
            assert_eq!(parse_content_range("bytes */1000"), None);
        }
    }
}
