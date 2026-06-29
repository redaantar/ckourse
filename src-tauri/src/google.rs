//! Google Drive OAuth 2.0 — loopback/system-browser flow with PKCE (RFC 8252).
//!
//! This is the desktop-correct flow: we open the user's *system browser* (where
//! Google's consent UI works), run a one-shot localhost listener to catch the
//! redirect, and exchange the code with PKCE. No popups — WKWebView/WebView2
//! cannot open them. Tokens (incl. the refresh token) live in the OS keychain.
//!
//! Scope is `drive.file` ONLY (non-sensitive). A "Desktop app" OAuth client is
//! expected (loopback redirect on any port; its client secret is non-confidential
//! for installed apps per Google's docs and is still sent on token exchange).

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use percent_encoding::{percent_decode_str, utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const KEYCHAIN_SERVICE: &str = "com.ckourse.app";
const KEYCHAIN_ACCOUNT: &str = "google-drive";
const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
// drive.readonly: drive.file does NOT grant access to a picked folder's contents
// (confirmed by spike — a folder pick exposes only the folder object). readonly
// grants recursive read access. It's a Restricted scope, but with bring-your-own
// credentials each user's own GCP project stays in "testing" mode (no CASA needed).
const SCOPE: &str = "https://www.googleapis.com/auth/drive.readonly";
/// How long we wait for the user to complete sign-in in their browser.
const AUTH_TIMEOUT_SECS: u64 = 300;

// --- Stored token shape (serialized into the keychain as JSON) ---

#[derive(Serialize, Deserialize, Clone)]
struct StoredTokens {
    access_token: String,
    refresh_token: Option<String>,
    /// Unix seconds when the access token expires.
    expires_at: u64,
    scope: String,
    token_type: String,
}

/// What Google's token endpoint returns.
#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
    #[serde(default)]
    scope: String,
    #[serde(default)]
    token_type: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub connected: bool,
    pub expires_at: Option<u64>,
    pub scope: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PickedFolder {
    pub id: String,
    pub name: String,
}

/// User-supplied Google OAuth credentials (bring-your-own). Stored in the keychain
/// so each user uses their own GCP project (which stays in "testing" mode → no CASA
/// security assessment needed for the Restricted drive.readonly scope).
#[derive(Serialize, Deserialize, Clone)]
struct Credentials {
    client_id: String,
    client_secret: String,
    api_key: String,
}

// --- Public API (called by the Tauri commands) ---

/// Run the full interactive connect flow. Opens the system browser, waits for the
/// redirect, exchanges the code, and persists tokens. Returns the new auth status.
pub async fn connect(app: AppHandle) -> Result<AuthStatus, String> {
    let creds = load_credentials()?;
    let client_id = creds.client_id;
    let client_secret = creds.client_secret;

    // Bind an ephemeral loopback port; Desktop OAuth clients accept any 127.0.0.1 port.
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}");

    let (verifier, challenge) = pkce();
    let state = random_b64(16);

    let auth_url = format!(
        "{AUTH_ENDPOINT}?client_id={}&redirect_uri={}&response_type=code&scope={}\
         &code_challenge={}&code_challenge_method=S256&state={}&access_type=offline&prompt=consent",
        enc(&client_id),
        enc(&redirect_uri),
        enc(SCOPE),
        enc(&challenge),
        enc(&state),
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {e}"))?;

    // Block on a single redirect (off the async runtime), with an overall timeout.
    let expected_state = state.clone();
    let code = tokio::time::timeout(
        Duration::from_secs(AUTH_TIMEOUT_SECS),
        tauri::async_runtime::spawn_blocking(move || wait_for_code(listener, &expected_state)),
    )
    .await
    .map_err(|_| "Timed out waiting for Google sign-in".to_string())?
    .map_err(|e| format!("Sign-in listener failed: {e}"))??;

    let tokens = exchange_code(&client_id, &client_secret, &code, &redirect_uri, &verifier).await?;
    store_tokens(&tokens)?;
    Ok(status_from(&tokens))
}

/// Return a currently-valid access token, refreshing it if it's expired/near expiry.
pub async fn valid_access_token() -> Result<String, String> {
    let creds = load_credentials()?;
    let mut tokens = load_tokens()?.ok_or("Not connected to Google Drive")?;
    if now() + 30 >= tokens.expires_at {
        let refresh_token = tokens
            .refresh_token
            .clone()
            .ok_or("No refresh token; reconnect to Google Drive")?;
        let refreshed = refresh(&creds.client_id, &creds.client_secret, &refresh_token).await?;
        tokens.access_token = refreshed.access_token;
        tokens.expires_at = refreshed.expires_at;
        if refreshed.refresh_token.is_some() {
            tokens.refresh_token = refreshed.refresh_token;
        }
        store_tokens(&tokens)?;
    }
    Ok(tokens.access_token)
}

/// Open the Google Picker in the user's *system browser* (the Picker iframe can't
/// run in WKWebView), let them pick one folder, and return its id+name. We host a
/// tiny page on a loopback port; the page posts the selection back to us. Requires
/// the user to already be signed into Google in that browser (they are, post-auth).
pub async fn pick_folder(app: AppHandle) -> Result<PickedFolder, String> {
    let creds = load_credentials()?;
    // The Picker needs the app id (the GCP project number) via setAppId. The
    // project number is the client id's leading numeric segment.
    let app_id = creds.client_id.split('-').next().unwrap_or("").to_string();
    let api_key = creds.api_key;

    let token = valid_access_token().await?;

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    app.opener()
        .open_url(format!("http://127.0.0.1:{port}/"), None::<&str>)
        .map_err(|e| format!("Failed to open browser: {e}"))?;

    tokio::time::timeout(
        Duration::from_secs(AUTH_TIMEOUT_SECS),
        tauri::async_runtime::spawn_blocking(move || serve_picker(listener, &token, &api_key, &app_id)),
    )
    .await
    .map_err(|_| "Timed out waiting for folder selection".to_string())?
    .map_err(|e| format!("Picker listener failed: {e}"))?
}

/// Serve the Picker page on `/`, then block until the page reports back on
/// `/picked?id=…&name=…` (or `?cancel=1`). Unrelated requests (favicon, etc.) 404.
fn serve_picker(
    listener: TcpListener,
    token: &str,
    api_key: &str,
    app_id: &str,
) -> Result<PickedFolder, String> {
    let page = picker_html(token, api_key, app_id);
    loop {
        let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
        let mut buf = [0u8; 8192];
        let n = match stream.read(&mut buf) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let request = String::from_utf8_lossy(&buf[..n]);
        let target = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("");
        let path = target.splitn(2, '?').next().unwrap_or("");
        let query = target.splitn(2, '?').nth(1).unwrap_or("");

        match path {
            "/" | "/index.html" => http_ok(&mut stream, "text/html; charset=utf-8", &page),
            "/picked" => {
                let mut id: Option<String> = None;
                let mut name: Option<String> = None;
                let mut cancel = false;
                for pair in query.split('&') {
                    let mut kv = pair.splitn(2, '=');
                    let key = kv.next().unwrap_or("");
                    let value = percent_decode_str(kv.next().unwrap_or(""))
                        .decode_utf8_lossy()
                        .into_owned();
                    match key {
                        "id" => id = Some(value),
                        "name" => name = Some(value),
                        "cancel" => cancel = true,
                        _ => {}
                    }
                }
                let (heading, result) = if cancel {
                    ("Selection cancelled — return to Ckourse.", Err("Folder selection cancelled".to_string()))
                } else if let Some(id) = id {
                    ("Folder selected — return to Ckourse.", Ok(PickedFolder { id, name: name.unwrap_or_default() }))
                } else {
                    ("No folder received.", Err("missing folder id".to_string()))
                };
                http_ok(&mut stream, "text/html; charset=utf-8", &closing_html(heading));
                return result;
            }
            _ => http_status(&mut stream, 404),
        }
    }
}

fn picker_html(token: &str, api_key: &str, app_id: &str) -> String {
    // token/api_key/app_id are opaque tokens (no quotes) — safe to embed in JS strings.
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><title>Select course folder</title>
<style>body{{font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}}</style></head>
<body><div id="msg">Loading Google Picker…</div>
<script src="https://apis.google.com/js/api.js"></script>
<script>
var TOKEN = "{token}";
var API_KEY = "{api_key}";
var APP_ID = "{app_id}";
function createPicker() {{
  var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true).setIncludeFolders(true)
    .setMimeTypes('application/vnd.google-apps.folder');
  var picker = new google.picker.PickerBuilder()
    .setOAuthToken(TOKEN).setDeveloperKey(API_KEY).setAppId(APP_ID).addView(view)
    .setTitle('Select your course folder')
    .setCallback(function(data) {{
      var action = data[google.picker.Response.ACTION];
      if (action === google.picker.Action.PICKED) {{
        var doc = data[google.picker.Response.DOCUMENTS][0];
        location.href = '/picked?id=' + encodeURIComponent(doc.id) + '&name=' + encodeURIComponent(doc.name);
      }} else if (action === google.picker.Action.CANCEL) {{
        location.href = '/picked?cancel=1';
      }}
    }}).build();
  picker.setVisible(true);
  document.getElementById('msg').textContent = 'Pick a folder in the dialog…';
}}
window.onload = function() {{ gapi.load('picker', createPicker); }};
</script></body></html>"#
    )
}

// --- Drive API: recursive folder listing → ParsedCourse ---

const FOLDER_MIME: &str = "application/vnd.google-apps.folder";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileList {
    #[serde(default)]
    files: Vec<DriveFile>,
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveFile {
    id: String,
    name: String,
    mime_type: String,
    video_media_metadata: Option<VideoMeta>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoMeta {
    duration_millis: Option<String>,
}

/// Fetch a folder's subtree via files.list and build a ParsedCourse with the
/// shared parser heuristics. `folder_id`/`folder_name` come from the Picker.
pub async fn parse_drive_folder(
    folder_id: String,
    folder_name: String,
) -> Result<crate::parser::ParsedCourse, String> {
    let token = valid_access_token().await?;
    let client = reqwest::Client::new();
    let children = list_folder_recursive(&client, &token, &folder_id).await?;
    crate::parser::parse_drive(&folder_name, children, &folder_id)
}

/// Download a (small) Drive file's bytes via alt=media — used for subtitles.
pub async fn fetch_file_bytes(file_id: String) -> Result<Vec<u8>, String> {
    let token = valid_access_token().await?;
    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
    );
    let resp = reqwest::Client::new()
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Drive fetch {}", resp.status()));
    }
    Ok(resp.bytes().await.map_err(|e| e.to_string())?.to_vec())
}

/// Recursively list a folder's contents, descending into subfolders.
fn list_folder_recursive<'a>(
    client: &'a reqwest::Client,
    token: &'a str,
    folder_id: &'a str,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<Vec<crate::parser::DriveEntry>, String>> + Send + 'a>,
> {
    Box::pin(async move {
        let mut entries = Vec::new();
        let mut page_token: Option<String> = None;
        let fields = "nextPageToken,files(id,name,mimeType,videoMediaMetadata/durationMillis)";

        loop {
            let q = format!("'{folder_id}' in parents and trashed = false");
            let mut url = format!(
                "https://www.googleapis.com/drive/v3/files?q={}&fields={}&pageSize=1000\
                 &supportsAllDrives=true&includeItemsFromAllDrives=true",
                enc(&q),
                enc(fields),
            );
            if let Some(pt) = &page_token {
                url.push_str(&format!("&pageToken={}", enc(pt)));
            }

            let resp = client
                .get(&url)
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| format!("Drive list failed: {e}"))?;
            let status = resp.status();
            let body = resp.text().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("Drive list {status}: {body}"));
            }
            let list: FileList =
                serde_json::from_str(&body).map_err(|e| format!("Bad Drive list response: {e}"))?;

            for f in list.files {
                if f.mime_type == FOLDER_MIME {
                    let children = list_folder_recursive(client, token, &f.id).await?;
                    entries.push(crate::parser::DriveEntry {
                        id: f.id,
                        name: f.name,
                        mime_type: f.mime_type,
                        is_folder: true,
                        duration_secs: 0,
                        children,
                    });
                } else {
                    let duration_secs = f
                        .video_media_metadata
                        .and_then(|m| m.duration_millis)
                        .and_then(|ms| ms.parse::<u64>().ok())
                        .map(|ms| ms / 1000)
                        .unwrap_or(0);
                    entries.push(crate::parser::DriveEntry {
                        id: f.id,
                        name: f.name,
                        mime_type: f.mime_type,
                        is_folder: false,
                        duration_secs,
                        children: Vec::new(),
                    });
                }
            }

            page_token = list.next_page_token;
            if page_token.is_none() {
                break;
            }
        }

        Ok(entries)
    })
}

pub fn status() -> Result<AuthStatus, String> {
    Ok(match load_tokens()? {
        Some(t) => AuthStatus {
            connected: true,
            expires_at: Some(t.expires_at),
            scope: Some(t.scope),
        },
        None => AuthStatus {
            connected: false,
            expires_at: None,
            scope: None,
        },
    })
}

pub fn disconnect() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// --- OAuth token exchange ---

async fn exchange_code(
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> Result<StoredTokens, String> {
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code),
        ("code_verifier", verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
    ];
    post_token(&params).await
}

async fn refresh(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<StoredTokens, String> {
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];
    post_token(&params).await
}

async fn post_token(params: &[(&str, &str)]) -> Result<StoredTokens, String> {
    let resp = reqwest::Client::new()
        .post(TOKEN_ENDPOINT)
        .form(params)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Google token endpoint returned {status}: {body}"));
    }
    let tr: TokenResponse =
        serde_json::from_str(&body).map_err(|e| format!("Bad token response: {e}; body={body}"))?;
    Ok(StoredTokens {
        access_token: tr.access_token,
        refresh_token: tr.refresh_token,
        expires_at: now() + tr.expires_in,
        scope: tr.scope,
        token_type: tr.token_type,
    })
}

// --- Loopback redirect listener ---

/// Accept exactly one HTTP request on the loopback socket, pull `code`/`state`
/// from the query string, write a small closing page, and return the auth code.
fn wait_for_code(listener: TcpListener, expected_state: &str) -> Result<String, String> {
    let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // First line: "GET /?code=...&state=... HTTP/1.1"
    let target = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("");
    let query = target.splitn(2, '?').nth(1).unwrap_or("");

    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut oauth_error: Option<String> = None;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        let key = kv.next().unwrap_or("");
        let raw = kv.next().unwrap_or("");
        let value = percent_decode_str(raw).decode_utf8_lossy().into_owned();
        match key {
            "code" => code = Some(value),
            "state" => state = Some(value),
            "error" => oauth_error = Some(value),
            _ => {}
        }
    }

    let (heading, result) = if let Some(err) = oauth_error {
        ("Sign-in failed.", Err(format!("OAuth error: {err}")))
    } else if state.as_deref() != Some(expected_state) {
        ("Sign-in could not be verified.", Err("OAuth state mismatch".to_string()))
    } else if let Some(c) = code {
        ("Connected to Google Drive — you can close this tab and return to Ckourse.", Ok(c))
    } else {
        ("No authorization code received.", Err("missing code".to_string()))
    };

    http_ok(&mut stream, "text/html; charset=utf-8", &closing_html(heading));
    result
}

// --- Tiny HTTP response helpers (loopback only) ---

fn http_ok(stream: &mut TcpStream, content_type: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        content_type,
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn http_status(stream: &mut TcpStream, code: u16) {
    let response =
        format!("HTTP/1.1 {code} \r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn closing_html(heading: &str) -> String {
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Ckourse</title></head>\
         <body style=\"font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;\
         display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">\
         <h2 style=\"font-weight:600\">{heading}</h2></body></html>"
    )
}

// --- PKCE + randomness ---

fn pkce() -> (String, String) {
    let verifier = random_b64(32); // 32 bytes -> 43-char base64url verifier
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    (verifier, challenge)
}

fn random_b64(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    getrandom::getrandom(&mut buf).expect("system RNG unavailable");
    URL_SAFE_NO_PAD.encode(buf)
}

fn enc(s: &str) -> String {
    utf8_percent_encode(s, NON_ALPHANUMERIC).to_string()
}

// --- Keychain persistence (tokens only) ---

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

// --- Bring-your-own credentials (in-memory cache; persisted in SQLite by the commands layer) ---

static CREDENTIALS: OnceLock<Mutex<Option<Credentials>>> = OnceLock::new();

fn creds_lock() -> &'static Mutex<Option<Credentials>> {
    CREDENTIALS.get_or_init(|| Mutex::new(None))
}

/// Populate the in-memory credentials cache. Called from the commands layer on
/// startup (from SQLite) and whenever the user saves new credentials.
pub fn init_credentials(client_id: String, client_secret: String, api_key: String) {
    *creds_lock().lock().unwrap() = Some(Credentials { client_id, client_secret, api_key });
}

/// Clear the in-memory credentials cache.
pub fn clear_credentials_cache() {
    *creds_lock().lock().unwrap() = None;
}

fn load_credentials() -> Result<Credentials, String> {
    creds_lock()
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "Google credentials not set — add them in Settings.".to_string())
}

fn store_tokens(tokens: &StoredTokens) -> Result<(), String> {
    let json = serde_json::to_string(tokens).map_err(|e| e.to_string())?;
    entry()?.set_password(&json).map_err(|e| e.to_string())
}

fn load_tokens() -> Result<Option<StoredTokens>, String> {
    match entry()?.get_password() {
        Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn status_from(tokens: &StoredTokens) -> AuthStatus {
    AuthStatus {
        connected: true,
        expires_at: Some(tokens.expires_at),
        scope: Some(tokens.scope.clone()),
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
