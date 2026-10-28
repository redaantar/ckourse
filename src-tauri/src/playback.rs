//! Local transport streams are prepared outside the course folder. Lesson paths
//! and database IDs always refer to the original; the MP4 is disposable cache.
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::{fs, thread};
use tauri::Manager;

/// One preparation at a time — encoding is CPU-bound and a second concurrent
/// ffmpeg would only slow both down.
static PREPARATION: Mutex<()> = Mutex::new(());

/// Request ids the frontend abandoned (lesson changed, player unmounted). A
/// queued request returns as soon as it gets the lock; a running one kills ffmpeg.
static CANCELLED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

/// Least-recently-played entries are evicted once the cache grows past this.
const CACHE_LIMIT_BYTES: u64 = 10 * 1024 * 1024 * 1024;

const POLL_INTERVAL: Duration = Duration::from_millis(100);
const TEMP_SUFFIX: &str = ".tmp.mp4";
const CANCELLED_MESSAGE: &str = "Preparation cancelled";

fn is_cancelled(request_id: &str) -> bool {
    CANCELLED
        .lock()
        .map(|set| set.as_ref().is_some_and(|s| s.contains(request_id)))
        .unwrap_or(false)
}

fn forget_request(request_id: &str) {
    if let Ok(mut set) = CANCELLED.lock() {
        if let Some(s) = set.as_mut() {
            s.remove(request_id);
        }
    }
}

fn cache_key(source: &Path) -> Result<String, String> {
    let metadata = fs::metadata(source).map_err(|e| format!("Cannot read source video: {e}"))?;
    let modified = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let mut hash = Sha256::new();
    hash.update(format!(
        "ts-mp4-v1\0{}\0{}\0{modified}",
        source.display(),
        metadata.len()
    ));
    Ok(format!("{:x}", hash.finalize()))
}

fn bundled_tool(name: &str) -> Result<PathBuf, String> {
    crate::parser::find_bundled_bin(name)
        .ok_or_else(|| format!("Bundled {name} is missing. Please reinstall ckourse."))
}

fn prepare(source: &Path, cache: &Path, request_id: &str) -> Result<PathBuf, String> {
    let result = prepare_with_tools(
        source,
        cache,
        &bundled_tool("ffmpeg")?,
        &bundled_tool("ffprobe")?,
        &|| is_cancelled(request_id),
    );
    forget_request(request_id);
    result
}

fn prepare_with_tools(
    source: &Path,
    cache: &Path,
    ffmpeg: &Path,
    ffprobe: &Path,
    cancelled: &dyn Fn() -> bool,
) -> Result<PathBuf, String> {
    // Serialize requests, including React StrictMode/retries, and publish only
    // complete files. No temporary file is ever placed beside the source.
    let _guard = PREPARATION.lock().map_err(|e| e.to_string())?;
    if cancelled() {
        return Err(CANCELLED_MESSAGE.into());
    }
    let source = source
        .canonicalize()
        .map_err(|e| format!("Cannot open source video: {e}"))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("ts"))
    {
        return Err("Expected a local .ts video".into());
    }
    fs::create_dir_all(cache).map_err(|e| format!("Cannot create playback cache: {e}"))?;
    remove_stale_temporaries(cache);

    let key = cache_key(&source)?;
    let destination = cache.join(format!("{key}.mp4"));
    if fs::metadata(&destination).is_ok_and(|m| m.len() > 0) {
        mark_used(&destination);
        return Ok(destination);
    }

    let temporary = cache.join(format!("{key}-{}{TEMP_SUFFIX}", uuid::Uuid::new_v4()));
    let probe = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,pix_fmt",
            "-of",
            "json",
        ])
        .arg(&source)
        .output()
        .map_err(|e| format!("Cannot inspect video: {e}"))?;
    if !probe.status.success() {
        return Err("Cannot inspect this transport stream".into());
    }
    let info: serde_json::Value =
        serde_json::from_slice(&probe.stdout).map_err(|e| e.to_string())?;
    let stream = &info["streams"][0];
    let copy_video = stream["codec_name"] == "h264" && stream["pix_fmt"] == "yuv420p";

    let result = (|| {
        let mut last_error = String::new();
        let attempts: &[bool] = if copy_video { &[false, true] } else { &[true] };
        for &transcode in attempts {
            let mut command = Command::new(ffmpeg);
            command
                .args([
                    "-nostdin",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-fflags",
                    "+genpts",
                    "-i",
                ])
                .arg(&source)
                .args([
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a:0?",
                    "-sn",
                    "-dn",
                    "-map_metadata",
                    "-1",
                ]);
            if transcode {
                command.args([
                    "-c:v",
                    "libx264",
                    "-preset",
                    "fast",
                    "-crf",
                    "20",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                ]);
            } else {
                command.args(["-c:v", "copy"]);
            }
            // AAC covers TS audio codecs unsupported by WebKit (MP2, AC3, ...).
            command
                .args([
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    "-avoid_negative_ts",
                    "make_zero",
                    "-movflags",
                    "+faststart",
                ])
                .arg(&temporary);

            match run_cancellable(&mut command, cancelled)? {
                Ok(()) if fs::metadata(&temporary).is_ok_and(|m| m.len() > 0) => {
                    if cache_key(&source)? != key {
                        return Err("Source changed during preparation. Please retry.".into());
                    }
                    fs::rename(&temporary, &destination).map_err(|e| {
                        format!("Cannot save playback cache (check free disk space): {e}")
                    })?;
                    return Ok(destination.clone());
                }
                Ok(()) => {}
                Err(stderr) => last_error = stderr,
            }
        }
        let detail = last_error.lines().last().unwrap_or_default().trim();
        let mut message = "Cannot prepare this video. Check that it is readable, unencrypted, \
                           and that there is enough free disk space."
            .to_string();
        if !detail.is_empty() {
            message.push_str(&format!(" ({detail})"));
        }
        Err(message)
    })();
    let _ = fs::remove_file(&temporary);

    if let Ok(published) = &result {
        evict_least_recently_used(cache, published, CACHE_LIMIT_BYTES);
    }
    result
}

/// Run ffmpeg, killing it if the request is abandoned. The outer `Result` is a
/// hard failure (spawn error, cancellation); the inner one carries ffmpeg's
/// stderr when it exits unsuccessfully so the next attempt can run.
fn run_cancellable(
    command: &mut Command,
    cancelled: &dyn Fn() -> bool,
) -> Result<Result<(), String>, String> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Cannot prepare video: {e}"))?;

    // Drain stderr on its own thread so a chatty failure can't fill the pipe
    // and stall ffmpeg.
    let mut stderr = child.stderr.take();
    let reader = thread::spawn(move || {
        let mut out = String::new();
        if let Some(s) = stderr.as_mut() {
            let _ = s.read_to_string(&mut out);
        }
        out
    });

    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            return Err(CANCELLED_MESSAGE.into());
        }
        thread::sleep(POLL_INTERVAL);
    };
    let stderr = reader.join().unwrap_or_default();
    Ok(if status.success() {
        Ok(())
    } else {
        Err(stderr)
    })
}

/// Leftovers from a crash or force-quit. Safe to delete because the caller
/// holds `PREPARATION`, so no other preparation is writing one.
fn remove_stale_temporaries(cache: &Path) {
    let Ok(entries) = fs::read_dir(cache) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().ends_with(TEMP_SUFFIX) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Bump the modification time so eviction treats the entry as recently played.
fn mark_used(path: &Path) {
    if let Ok(file) = fs::File::options().write(true).open(path) {
        let _ = file.set_modified(SystemTime::now());
    }
}

/// Delete the oldest prepared videos until the cache fits in `limit`. The entry
/// just published is never removed, even if it alone exceeds the limit.
fn evict_least_recently_used(cache: &Path, keep: &Path, limit: u64) {
    let Ok(entries) = fs::read_dir(cache) else {
        return;
    };
    let mut files: Vec<(SystemTime, u64, PathBuf)> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.ends_with(".mp4") || name.ends_with(TEMP_SUFFIX) {
                return None;
            }
            let meta = entry.metadata().ok()?;
            Some((meta.modified().ok()?, meta.len(), path))
        })
        .collect();
    let mut total: u64 = files.iter().map(|(_, len, _)| len).sum();
    files.sort_by_key(|(modified, _, _)| *modified);
    for (_, len, path) in files {
        if total <= limit {
            break;
        }
        if path == keep {
            continue;
        }
        if fs::remove_file(&path).is_ok() {
            total -= len;
        }
    }
}

#[tauri::command]
pub async fn prepare_local_video(
    app: tauri::AppHandle,
    path: String,
    request_id: String,
) -> Result<String, String> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("playback");
    tauri::async_runtime::spawn_blocking(move || {
        prepare(Path::new(&path), &cache, &request_id).map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Abandon a preparation started with `request_id`, queued or running.
#[tauri::command]
pub fn cancel_local_video_preparation(request_id: String) -> Result<(), String> {
    CANCELLED
        .lock()
        .map_err(|e| e.to_string())?
        .get_or_insert_with(HashSet::new)
        .insert(request_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn cache_identity_tracks_source_path_and_content_metadata() {
        let dir = temp_dir();
        let a = dir.join("lesson.ts");
        let b = dir.join("other.ts");
        fs::write(&a, b"first").unwrap();
        fs::write(&b, b"first").unwrap();
        let key = cache_key(&a).unwrap();
        assert_eq!(key, cache_key(&a).unwrap());
        assert_ne!(key, cache_key(&b).unwrap());
        fs::write(&a, b"changed-length").unwrap();
        assert_ne!(key, cache_key(&a).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn eviction_removes_least_recently_used_but_keeps_the_new_entry() {
        let dir = temp_dir();
        let now = SystemTime::now();
        let entry = |name: &str, age_secs: u64| {
            let path = dir.join(name);
            fs::write(&path, vec![0u8; 100]).unwrap();
            let file = fs::File::options().write(true).open(&path).unwrap();
            file.set_modified(now - Duration::from_secs(age_secs))
                .unwrap();
            path
        };
        let oldest = entry("a.mp4", 300);
        let middle = entry("b.mp4", 200);
        let newest = entry("c.mp4", 100);
        // The entry just published can be the oldest by mtime (a cache hit that
        // failed to touch it) — it must still survive.
        let kept = entry("kept.mp4", 400);
        let temp = entry("x-123.tmp.mp4", 500);

        evict_least_recently_used(&dir, &kept, 250);

        assert!(kept.exists());
        assert!(!oldest.exists());
        assert!(!middle.exists());
        assert!(newest.exists());
        assert!(temp.exists(), "temporaries are not cache entries");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn cancelled_request_returns_before_running_any_tool() {
        let dir = temp_dir();
        let source = dir.join("lesson.ts");
        fs::write(&source, b"not used").unwrap();
        let missing = dir.join("no-such-tool");
        let err = prepare_with_tools(&source, &dir.join("cache"), &missing, &missing, &|| true)
            .unwrap_err();
        assert_eq!(err, CANCELLED_MESSAGE);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn cancel_command_marks_only_that_request() {
        cancel_local_video_preparation("req-a".into()).unwrap();
        assert!(is_cancelled("req-a"));
        assert!(!is_cancelled("req-b"));
        forget_request("req-a");
        assert!(!is_cancelled("req-a"));
    }

    // Uses the exact native binaries shipped in the app, not Homebrew tools.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "requires scripts/download-ffmpeg.sh"]
    fn transport_stream_preparation_preserves_sources_and_learning_data() {
        use crate::{db, parser};
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        let never = || false;
        let dir = std::env::temp_dir().join(format!("ckourse-media-{}", uuid::Uuid::new_v4()));
        let course = dir.join("Cours été #1");
        fs::create_dir_all(&course).unwrap();
        let bins = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
        let ffmpeg = bins.join("ffmpeg-aarch64-apple-darwin");
        let ffprobe = bins.join("ffprobe-aarch64-apple-darwin");
        for (name, codec, audio) in [
            ("01 H264.TS", "libx264", true),
            ("02 MPEG2.ts", "mpeg2video", true),
            ("03 silent.ts", "libx264", false),
        ] {
            let source = course.join(name);
            let mut generator = Command::new(&ffmpeg);
            generator.args([
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc2=size=320x180:rate=25",
            ]);
            if audio {
                generator.args(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]);
            }
            assert!(generator
                .args([
                    "-t", "4", "-c:v", codec, "-pix_fmt", "yuv420p", "-c:a", "mp2", "-f", "mpegts"
                ])
                .arg(&source)
                .status()
                .unwrap()
                .success());
            fs::set_permissions(&source, fs::Permissions::from_mode(0o444)).unwrap();
        }
        fs::set_permissions(&course, fs::Permissions::from_mode(0o555)).unwrap();
        let parsed = parser::parse_folder(&course).unwrap();
        assert_eq!(parsed.total_video_count, 3);
        let conn = db::init_db(&dir.join("database")).unwrap();
        let id = db::save_parsed_course(
            &conn,
            &parsed,
            &db::SaveCourseInput {
                title: "TS course".into(),
                author: "Test".into(),
                accent_color: "#abcdef".into(),
                category: "Test".into(),
            },
        )
        .unwrap();
        let detail = db::get_course_detail(&conn, id).unwrap().unwrap();
        let lesson = &detail.sections[0].lessons[0];
        db::save_lesson_position(&conn, lesson.id, 2.25).unwrap();
        db::set_last_watched(&conn, id, lesson.id).unwrap();
        db::toggle_lesson_completed(&conn, lesson.id).unwrap();
        db::toggle_bookmark(&conn, id).unwrap();
        db::toggle_favorite(&conn, lesson.id).unwrap();
        db::add_note(
            &conn,
            id,
            lesson.id,
            &lesson.title,
            "At [00:02](timestamp:2): important",
        )
        .unwrap();
        let before = serde_json::to_value(db::get_course_detail(&conn, id).unwrap()).unwrap();
        let notes = serde_json::to_value(db::get_course_notes(&conn, id).unwrap()).unwrap();
        let cache = dir.join("cache");
        for entry in fs::read_dir(&course).unwrap() {
            let source = entry.unwrap().path();
            let original = fs::read(&source).unwrap();
            let cached = prepare_with_tools(&source, &cache, &ffmpeg, &ffprobe, &never).unwrap();
            assert!(!cached.starts_with(&course));
            // A second request reuses the published file rather than re-encoding.
            let inode = fs::metadata(&cached).unwrap().ino();
            assert_eq!(
                cached,
                prepare_with_tools(&source, &cache, &ffmpeg, &ffprobe, &never).unwrap()
            );
            assert_eq!(inode, fs::metadata(&cached).unwrap().ino());
            assert_eq!(original, fs::read(&source).unwrap());
            let probe = Command::new(&ffprobe)
                .args([
                    "-v",
                    "error",
                    "-show_streams",
                    "-show_format",
                    "-of",
                    "json",
                ])
                .arg(&cached)
                .output()
                .unwrap();
            let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
            assert_eq!(info["streams"][0]["codec_name"], "h264");
            let duration: f64 = info["format"]["duration"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            assert!((duration - 4.0).abs() < 0.25, "timeline drift: {duration}");
            assert!(Command::new(&ffmpeg)
                .args(["-v", "error", "-ss", "2.25", "-i"])
                .arg(&cached)
                .args(["-t", "0.5", "-f", "null", "-"])
                .status()
                .unwrap()
                .success());
        }
        assert_eq!(
            before,
            serde_json::to_value(db::get_course_detail(&conn, id).unwrap()).unwrap()
        );
        assert_eq!(
            notes,
            serde_json::to_value(db::get_course_notes(&conn, id).unwrap()).unwrap()
        );
        assert!(db::get_course_by_id(&conn, id).unwrap().unwrap().bookmarked);
        assert_eq!(fs::read_dir(&course).unwrap().count(), 3);

        let broken = dir.join("broken.ts");
        fs::write(&broken, b"invalid video").unwrap();
        let bad_cache = dir.join("bad-cache");
        assert!(prepare_with_tools(&broken, &bad_cache, &ffmpeg, &ffprobe, &never).is_err());
        assert_eq!(fs::read_dir(&bad_cache).unwrap().count(), 0);

        // Cancelling mid-encode kills ffmpeg and leaves no temporary behind.
        // First check is before the lock, second is ffmpeg's first poll.
        let checks = std::cell::Cell::new(0);
        let cancel_after = || {
            checks.set(checks.get() + 1);
            checks.get() > 1
        };
        let mpeg2 = course.join("02 MPEG2.ts");
        let cancel_cache = dir.join("cancel-cache");
        assert_eq!(
            prepare_with_tools(&mpeg2, &cancel_cache, &ffmpeg, &ffprobe, &cancel_after)
                .unwrap_err(),
            CANCELLED_MESSAGE
        );
        assert_eq!(fs::read_dir(&cancel_cache).unwrap().count(), 0);

        // A separate read-only mounted image can be supplied for an EROFS test.
        if let Ok(path) = std::env::var("CKOURSE_READONLY_SOURCE") {
            let source = Path::new(&path);
            assert!(fs::File::create(source.with_file_name("write-must-fail")).is_err());
            let original = fs::read(source).unwrap();
            prepare_with_tools(source, &dir.join("volume-cache"), &ffmpeg, &ffprobe, &never)
                .unwrap();
            assert_eq!(original, fs::read(source).unwrap());
        }
        fs::set_permissions(&course, fs::Permissions::from_mode(0o755)).unwrap();
        if std::env::var_os("CKOURSE_KEEP_MEDIA_TESTS").is_some() {
            println!("MEDIA_TEST_DIR={}", dir.display());
        } else {
            fs::remove_dir_all(&dir).unwrap();
        }
    }
}
