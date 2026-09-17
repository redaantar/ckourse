//! Self-hosted course sources: SFTP, WebDAV and S3-compatible object storage.
//!
//! All three behave the same way from the app's point of view — list a directory,
//! read a byte range, read a small file whole — so they sit behind one
//! [`RemoteBackend`] trait. Everything above this module (the folder browser, the
//! parser, the `srv://` streaming protocol) is written against the trait and never
//! against a specific protocol.
//!
//! Paths are stored as `srv:<serverId>:<path>` so a lesson's progress keys on a
//! stable identifier and `remote_protocol` can find its way back to the right
//! server. `<serverId>` is a UUID (never contains a colon), so the URI splits on
//! its first two colons and the remainder is the path verbatim — S3 keys may
//! themselves contain colons.

pub mod s3;
pub mod sftp;
pub mod webdav;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::db::{self, DbState};
use crate::parser::{ParsedCourse, SourceEntry};

/// Prefix on every stored remote path.
pub const URI_PREFIX: &str = "srv:";

/// Guard rails on a recursive listing, so a mistakenly-picked root (`/`, or a
/// bucket with a million keys) fails fast instead of hanging the import.
const MAX_DEPTH: usize = 8;
const MAX_ENTRIES: usize = 20_000;

// =====================================================================
// Configuration
// =====================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerKind {
    Sftp,
    Webdav,
    S3,
}

impl ServerKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ServerKind::Sftp => "sftp",
            ServerKind::Webdav => "webdav",
            ServerKind::S3 => "s3",
        }
    }

    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "sftp" => Ok(ServerKind::Sftp),
            "webdav" => Ok(ServerKind::Webdav),
            "s3" => Ok(ServerKind::S3),
            other => Err(format!("Unknown server kind: {other}")),
        }
    }
}

/// A saved server. Secrets live in the OS keychain, never here — this struct is
/// handed to the frontend as-is.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub kind: ServerKind,
    /// SFTP: hostname. WebDAV: base URL. S3: endpoint URL.
    pub host: String,
    /// SFTP only.
    pub port: u16,
    /// SFTP/WebDAV: username. S3: access key id.
    pub username: String,
    /// Directory the folder browser opens at.
    pub base_path: String,
    /// S3 only.
    pub bucket: String,
    /// S3 only.
    pub region: String,
    /// S3 only — path-style addressing (MinIO and most self-hosted gateways).
    pub path_style: bool,
    /// SFTP only — the host key we pinned on first connect (trust on first use).
    pub host_fingerprint: Option<String>,
}

/// Secrets for one server, stored as a single JSON blob in the OS keychain.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServerSecrets {
    /// SFTP/WebDAV password, or the S3 secret access key.
    pub password: String,
    /// SFTP private key, PEM/OpenSSH text.
    pub private_key: String,
    /// Passphrase for `private_key`, when it's encrypted.
    pub passphrase: String,
}

impl ServerSecrets {
    pub fn is_empty(&self) -> bool {
        self.password.is_empty() && self.private_key.is_empty()
    }
}

// =====================================================================
// Backend trait
// =====================================================================

/// One entry in a remote directory listing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteNode {
    pub name: String,
    /// Absolute path on the server, in this backend's own path space.
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// The whole surface a course source needs: browse, range-read, whole-read.
#[async_trait]
pub trait RemoteBackend: Send + Sync {
    async fn list_dir(&self, path: &str) -> Result<Vec<RemoteNode>, String>;

    /// Read `[start, end]` inclusive. Backends return fewer bytes at EOF.
    async fn read_range(&self, path: &str, start: u64, end: u64) -> Result<Vec<u8>, String>;

    async fn size_of(&self, path: &str) -> Result<u64, String>;

    /// Read a file whole — subtitles and resources (e.g. PDFs opened in-app).
    async fn read_all(&self, path: &str) -> Result<Vec<u8>, String>;
}

// =====================================================================
// Registry: configs warmed from SQLite, live connections cached per server
// =====================================================================

static APP: OnceLock<AppHandle> = OnceLock::new();
static SERVERS: OnceLock<Mutex<HashMap<String, ServerConfig>>> = OnceLock::new();
static BACKENDS: OnceLock<tokio::sync::Mutex<HashMap<String, Arc<dyn RemoteBackend>>>> =
    OnceLock::new();

fn servers_cell() -> &'static Mutex<HashMap<String, ServerConfig>> {
    SERVERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn backends_cell() -> &'static tokio::sync::Mutex<HashMap<String, Arc<dyn RemoteBackend>>> {
    BACKENDS.get_or_init(|| tokio::sync::Mutex::new(HashMap::new()))
}

/// Warm the config cache at startup. The `srv://` protocol handler resolves
/// servers through this cache rather than the DB, mirroring how Drive warms its
/// credentials — the handler has no access to managed state.
pub fn init(app: AppHandle, configs: Vec<ServerConfig>) {
    let _ = APP.set(app);
    if let Ok(mut map) = servers_cell().lock() {
        for c in configs {
            map.insert(c.id.clone(), c);
        }
    }
}

pub fn cache_server(config: ServerConfig) {
    if let Ok(mut map) = servers_cell().lock() {
        map.insert(config.id.clone(), config);
    }
}

pub fn uncache_server(id: &str) {
    if let Ok(mut map) = servers_cell().lock() {
        map.remove(id);
    }
}

pub fn get_config(id: &str) -> Result<ServerConfig, String> {
    servers_cell()
        .lock()
        .map_err(|e| e.to_string())?
        .get(id)
        .cloned()
        .ok_or_else(|| "That server is no longer configured. Re-add it in Settings.".to_string())
}

/// Drop a cached connection so the next call reconnects — used when a request
/// fails mid-session (SSH connections die when the server or the network blinks).
pub async fn evict_backend(id: &str) {
    backends_cell().lock().await.remove(id);
}

/// A connected backend for `server_id`, opening the connection on first use.
pub async fn backend(server_id: &str) -> Result<Arc<dyn RemoteBackend>, String> {
    if let Some(b) = backends_cell().lock().await.get(server_id) {
        return Ok(b.clone());
    }

    let config = get_config(server_id)?;
    let secrets = load_secrets(server_id)?;
    let built = connect(&config, &secrets).await?;

    backends_cell()
        .lock()
        .await
        .insert(server_id.to_string(), built.clone());
    Ok(built)
}

/// Open a connection without touching the cache — used by "Test connection" so a
/// failed attempt never poisons a working cached session.
pub async fn connect(
    config: &ServerConfig,
    secrets: &ServerSecrets,
) -> Result<Arc<dyn RemoteBackend>, String> {
    match config.kind {
        ServerKind::Sftp => {
            let (backend, fingerprint) = sftp::connect(config, secrets).await?;
            // Trust on first use: pin whatever host key we saw, so a later
            // change is caught instead of silently accepted.
            if config.host_fingerprint.as_deref() != Some(fingerprint.as_str()) {
                persist_fingerprint(&config.id, &fingerprint);
            }
            Ok(backend)
        }
        ServerKind::Webdav => webdav::connect(config, secrets).await,
        ServerKind::S3 => s3::connect(config, secrets).await,
    }
}

/// Run `op` against the server, reconnecting once if the cached connection was
/// stale. Only worth retrying idempotent reads, which is all this module does.
pub async fn with_backend<T, F, Fut>(server_id: &str, op: F) -> Result<T, String>
where
    F: Fn(Arc<dyn RemoteBackend>) -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let first = backend(server_id).await?;
    match op(first).await {
        Ok(v) => Ok(v),
        Err(first_err) => {
            evict_backend(server_id).await;
            let fresh = backend(server_id).await.map_err(|_| first_err.clone())?;
            op(fresh).await.map_err(|retry_err| {
                // Report the retry's error: it came from a known-fresh
                // connection, so it describes the real problem.
                eprintln!("[srv] retry failed for {server_id}: {retry_err} (first: {first_err})");
                retry_err
            })
        }
    }
}

// =====================================================================
// Keychain
// =====================================================================

const KEYCHAIN_SERVICE: &str = "com.ckourse.app.server";

fn keychain(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, id).map_err(|e| format!("Keychain unavailable: {e}"))
}

pub fn store_secrets(id: &str, secrets: &ServerSecrets) -> Result<(), String> {
    let json = serde_json::to_string(secrets).map_err(|e| e.to_string())?;
    keychain(id)?
        .set_password(&json)
        .map_err(|e| format!("Couldn't save credentials to the keychain: {e}"))
}

pub fn load_secrets(id: &str) -> Result<ServerSecrets, String> {
    match keychain(id)?.get_password() {
        Ok(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => Ok(ServerSecrets::default()),
        Err(e) => Err(format!("Couldn't read credentials from the keychain: {e}")),
    }
}

pub fn delete_secrets(id: &str) -> Result<(), String> {
    match keychain(id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Couldn't remove credentials from the keychain: {e}")),
    }
}

/// Persist a newly-pinned SSH host key, in the config cache and in SQLite.
fn persist_fingerprint(id: &str, fingerprint: &str) {
    if let Ok(mut map) = servers_cell().lock() {
        if let Some(cfg) = map.get_mut(id) {
            cfg.host_fingerprint = Some(fingerprint.to_string());
        }
    }
    if let Some(app) = APP.get() {
        if let Some(state) = app.try_state::<DbState>() {
            if let Ok(conn) = state.conn.lock() {
                let _ = db::set_server_fingerprint(&conn, id, fingerprint);
            }
        }
    }
}

// =====================================================================
// URIs
// =====================================================================

/// Split a stored `srv:<serverId>:<path>` into its parts.
pub fn split_uri(uri: &str) -> Option<(String, String)> {
    let rest = uri.strip_prefix(URI_PREFIX)?;
    let (server_id, path) = rest.split_once(':')?;
    if server_id.is_empty() || path.is_empty() {
        return None;
    }
    Some((server_id.to_string(), path.to_string()))
}

pub fn make_uri(server_id: &str, path: &str) -> String {
    format!("{URI_PREFIX}{server_id}:{path}")
}

/// Content type for the `<video>` element, from the file extension. Remote
/// listings rarely carry a usable MIME type, and WKWebView needs a plausible one.
pub fn guess_mime(name: &str) -> &'static str {
    match name
        .rsplit_once('.')
        .map(|(_, e)| e.to_lowercase())
        .unwrap_or_default()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "ogg" | "ogv" => "video/ogg",
        _ => "video/mp4",
    }
}

// =====================================================================
// Browsing + parsing
// =====================================================================

/// One level of a directory listing, for the in-app folder browser.
pub async fn browse(server_id: &str, path: &str) -> Result<Vec<RemoteNode>, String> {
    let path = path.to_string();
    let mut nodes = with_backend(server_id, move |b| {
        let path = path.clone();
        async move { b.list_dir(&path).await }
    })
    .await?;
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(nodes)
}

/// Walk a remote folder and hand the tree to the shared parser heuristics.
///
/// Durations come back as 0: no remote source reports them and probing each
/// video would mean a network round-trip per lesson at import time. The player
/// backfills the real duration the first time a lesson plays.
pub async fn parse_remote_folder(
    server_id: &str,
    path: &str,
    name: &str,
) -> Result<ParsedCourse, String> {
    let backend = backend(server_id).await?;
    let mut budget = MAX_ENTRIES;
    let children = list_recursive(backend, server_id, path.to_string(), 0, &mut budget).await?;
    crate::parser::parse_source_tree(name, children, &make_uri(server_id, path))
}

fn list_recursive<'a>(
    backend: Arc<dyn RemoteBackend>,
    server_id: &'a str,
    path: String,
    depth: usize,
    budget: &'a mut usize,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<SourceEntry>, String>> + Send + 'a>>
{
    Box::pin(async move {
        if depth >= MAX_DEPTH {
            return Ok(Vec::new());
        }

        let nodes = backend.list_dir(&path).await?;
        let mut entries = Vec::with_capacity(nodes.len());

        for node in nodes {
            if *budget == 0 {
                return Err(format!(
                    "That folder holds more than {MAX_ENTRIES} files — pick a single course folder rather than your whole library."
                ));
            }
            *budget -= 1;

            let children = if node.is_dir {
                list_recursive(
                    backend.clone(),
                    server_id,
                    node.path.clone(),
                    depth + 1,
                    budget,
                )
                .await?
            } else {
                Vec::new()
            };

            entries.push(SourceEntry {
                uri: make_uri(server_id, &node.path),
                name: node.name,
                // Remote listings don't carry a trustworthy MIME type, so the
                // parser classifies by extension instead.
                mime_type: String::new(),
                is_folder: node.is_dir,
                duration_secs: 0,
                children,
            });
        }

        Ok(entries)
    })
}

/// Read a whole remote file, addressed by its stored `srv:` URI — subtitles.
pub async fn read_uri(uri: &str) -> Result<Vec<u8>, String> {
    let (server_id, path) = split_uri(uri).ok_or_else(|| format!("Malformed remote path: {uri}"))?;
    with_backend(&server_id, move |b| {
        let path = path.clone();
        async move { b.read_all(&path).await }
    })
    .await
}

/// Join a directory path with a child name, POSIX-style. Every backend here
/// addresses with `/`, whatever the server's own OS uses.
pub fn join_path(dir: &str, name: &str) -> String {
    if dir.is_empty() || dir == "/" {
        format!("/{name}")
    } else {
        format!("{}/{}", dir.trim_end_matches('/'), name)
    }
}
